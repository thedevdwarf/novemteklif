import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, type Browser } from "playwright";
import { config } from "../config.js";
import type { ProposalView } from "../proposals/service.js";
import { renderProposalHtml } from "./template.js";

let browser: Browser | null = null;

export async function startBrowser(): Promise<void> {
  if (browser) return;
  browser = await chromium.launch({ args: ["--no-sandbox"] });
}

export async function stopBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}

async function getBrowser(): Promise<Browser> {
  if (!browser) await startBrowser();
  return browser!;
}

const TURKISH_MAP: Record<string, string> = {
  ı: "i", İ: "I", ğ: "g", Ğ: "G", ü: "u", Ü: "U",
  ş: "s", Ş: "S", ö: "o", Ö: "O", ç: "c", Ç: "C",
};

function slugify(s: string, max = 40): string {
  const stripped = s
    .split("")
    .map((ch) => TURKISH_MAP[ch] ?? ch)
    .join("")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, max);
  return stripped || "musteri";
}

export function pdfFileName(p: ProposalView): string {
  return `${p.proposalNo}_${slugify(p.customer.tradeName)}_v${p.revision}.pdf`;
}

export async function renderPdf(p: ProposalView): Promise<{ filePath: string; fileName: string }> {
  const html = renderProposalHtml(p);
  const b = await getBrowser();
  const ctx = await b.newContext();
  const page = await ctx.newPage();
  try {
    await page.setContent(html, { waitUntil: "networkidle" });
    const buf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    await mkdir(config.outDir, { recursive: true });
    const fileName = pdfFileName(p);
    const filePath = resolve(config.outDir, fileName);
    await writeFile(filePath, buf);
    return { filePath, fileName };
  } finally {
    await page.close();
    await ctx.close();
  }
}

export async function renderPdfBuffer(p: ProposalView): Promise<Buffer> {
  const html = renderProposalHtml(p);
  const b = await getBrowser();
  const ctx = await b.newContext();
  const page = await ctx.newPage();
  try {
    await page.setContent(html, { waitUntil: "networkidle" });
    const buf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    return Buffer.from(buf);
  } finally {
    await page.close();
    await ctx.close();
  }
}
