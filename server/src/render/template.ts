import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Handlebars from "handlebars";
import { config } from "../config.js";
import { loadAssets } from "./assets.js";
import type { ProposalView } from "../proposals/service.js";

const here = fileURLToPath(new URL(".", import.meta.url));
const templatesDir = resolve(here, "../../templates");

const TRY_FORMATTER = new Intl.NumberFormat("tr-TR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function formatDate(d: Date | string | undefined): string {
  if (!d) return "";
  const date = d instanceof Date ? d : new Date(d);
  return `${pad2(date.getDate())}.${pad2(date.getMonth() + 1)}.${date.getFullYear()}`;
}

function formatTRY(n: number | undefined): string {
  if (n === undefined || n === null || Number.isNaN(n)) return "—";
  return `${TRY_FORMATTER.format(n)} ₺`;
}

Handlebars.registerHelper("formatTRY", formatTRY);
Handlebars.registerHelper("formatDate", formatDate);
Handlebars.registerHelper("eq", (a: unknown, b: unknown) => a === b);
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

let cachedTemplate: HandlebarsTemplateDelegate | null = null;

function getTemplate(): HandlebarsTemplateDelegate {
  if (cachedTemplate) return cachedTemplate;
  const src = readFileSync(resolve(templatesDir, "proposal.hbs"), "utf-8");
  cachedTemplate = Handlebars.compile(src, { noEscape: false });
  return cachedTemplate;
}

export function renderProposalHtml(p: ProposalView): string {
  const tpl = getTemplate();
  return tpl({
    ...p,
    assets: loadAssets(),
    company: config.company,
  });
}
