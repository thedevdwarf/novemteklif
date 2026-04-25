// Geliştirme yardımcısı: DB/Playwright olmadan sadece şablon render edip HTML'i diske yazar.
// Çalıştır: npx tsx src/dev-render-sample.ts
//
// Çıktı: ./sample-output.html — tarayıcıda açıp şablonun göründüğünden emin ol.
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { ObjectId } from "mongodb";
import { renderProposalHtml } from "./render/template.js";
import { toView } from "./proposals/service.js";
import type { ProposalDoc } from "./proposals/types.js";

const sample: ProposalDoc = {
  _id: new ObjectId(),
  proposalNo: "NVM-2026-001",
  revision: "1.00",
  customer: {
    tradeName: "Hatay Soslu Döner",
    contactPerson: "Tayfun Dede",
    greetingName: "Tayfun Dede",
  },
  title: { main: "Novem POS", accent: "Restoran Çözümü" },
  currency: "TRY",
  preparer: "Osman Tuzcu",
  items: [
    { name: "Termal Yazıcı", qty: 4, unitPrice: 100, total: 400 },
    { name: "Mikrotik RBD52G-5HacD2HnD-TC", qty: 1, unitPrice: 4500, total: 4500 },
    { name: "Luna Cloud Hotspot — Yıllık Abonelik", qty: 1, unitPrice: 4500, total: 4500 },
  ],
  totals: {
    subtotal: 9400,
    grandTotal: 9400,
  },
  status: "draft",
  previewToken: "aB3xYz9KqMn7vP2LqRsT",
  previewExpiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
  previewRevokedAt: null,
  pdfPath: null,
  parentId: null,
  clonedFromId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  date: new Date("2026-04-23"),
  deletedAt: null,
};

const html = renderProposalHtml(toView(sample));
const out = resolve(process.cwd(), "sample-output.html");
writeFileSync(out, html, "utf-8");
console.log(`✓ Render edildi: ${out}`);
console.log(`  Tarayıcıda aç: file://${out.replace(/\\/g, "/")}`);
