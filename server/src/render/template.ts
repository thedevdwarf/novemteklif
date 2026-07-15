import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Handlebars from "handlebars";
import { config } from "../config.js";
import { loadAssets } from "./assets.js";
import { resolveTemplate } from "./templates.js";
import type { ProposalView } from "../proposals/service.js";

const here = fileURLToPath(new URL(".", import.meta.url));
const templatesDir = resolve(here, "../../templates");

const NUM_FORMATTER = new Intl.NumberFormat("tr-TR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const CURRENCY_SUFFIX: Record<string, string> = {
  TRY: "₺",
  USD: "$",
  EUR: "€",
};

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function formatDate(d: Date | string | undefined): string {
  if (!d) return "";
  const date = d instanceof Date ? d : new Date(d);
  return `${pad2(date.getDate())}.${pad2(date.getMonth() + 1)}.${date.getFullYear()}`;
}

function formatMoney(n: number | undefined, currency?: string): string {
  if (n === undefined || n === null || Number.isNaN(n)) return "—";
  const suffix = CURRENCY_SUFFIX[currency ?? "TRY"] ?? "₺";
  return `${NUM_FORMATTER.format(n)} ${suffix}`;
}

Handlebars.registerHelper("formatMoney", formatMoney);
Handlebars.registerHelper("formatDate", formatDate);
Handlebars.registerHelper("paddingCount", (items: unknown[] | undefined, min: number) => {
  const n = Array.isArray(items) ? items.length : 0;
  return Math.max(0, min - n);
});
Handlebars.registerHelper("times", function (this: unknown, n: number, options: Handlebars.HelperOptions) {
  let out = "";
  const count = Number(n) || 0;
  for (let i = 0; i < count; i++) out += options.fn(i);
  return out;
});
Handlebars.registerHelper("greetingNameOrContact", (customer: { greetingName?: string; contactPerson?: string }) => {
  return customer?.greetingName || customer?.contactPerson || "";
});

const templateCache = new Map<string, HandlebarsTemplateDelegate>();

function getTemplate(templateId?: string): HandlebarsTemplateDelegate {
  const meta = resolveTemplate(templateId);
  const cached = templateCache.get(meta.id);
  if (cached) return cached;
  const src = readFileSync(resolve(templatesDir, meta.file), "utf-8");
  const compiled = Handlebars.compile(src, { noEscape: false });
  templateCache.set(meta.id, compiled);
  return compiled;
}

export function renderProposalHtml(p: ProposalView): string {
  const tpl = getTemplate(p.templateId);
  return tpl({
    ...p,
    assets: loadAssets(),
    company: config.company,
  });
}
