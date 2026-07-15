import express, { type Express, type Request, type Response } from "express";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import * as service from "../proposals/service.js";
import { renderProposalHtml } from "../render/template.js";
import { renderPdfBuffer } from "../render/pdf.js";
import { mountMcp } from "../mcp/server.js";

export async function createInternalApp(): Promise<Express> {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));

  app.get("/healthz", (_req, res) => {
    res.type("text/plain").send("ok");
  });

  // Admin preview — login yok ama sadece localhost'tan erişilebilir
  app.get("/admin/proposals/:idOrNo", async (req: Request, res: Response) => {
    const idOrNo = String(req.params.idOrNo ?? "");
    if (!idOrNo) return void res.status(400).type("text/plain").send("idOrNo gerekli");
    try {
      const doc = await service.findByIdOrNo(idOrNo);
      if (!doc) return void res.status(404).type("text/plain").send("Bulunamadı");
      const view = service.toView(doc);
      res.set("Cache-Control", "no-store");
      res.type("text/html; charset=utf-8").send(renderProposalHtml(view));
    } catch (err) {
      console.error("[admin] preview error", err);
      res.status(500).type("text/plain").send("Sunucu hatası");
    }
  });

  // Admin PDF — diskten stream; dosya diskte kayıpsa (ör. WSL/container
  // restart) generate_pdf onayı zaten DB'de kayıtlı olduğundan gate'i tekrar
  // sormadan buffer'dan anında yeniden üretip stream ediyoruz.
  app.get("/admin/proposals/:idOrNo/pdf", async (req: Request, res: Response) => {
    const idOrNo = String(req.params.idOrNo ?? "");
    if (!idOrNo) return void res.status(400).type("text/plain").send("idOrNo gerekli");
    try {
      const doc = await service.findByIdOrNo(idOrNo);
      if (!doc) return void res.status(404).type("text/plain").send("Bulunamadı");
      if (!doc.pdfPath) {
        return void res
          .status(404)
          .type("text/plain")
          .send("PDF henüz üretilmemiş. Önce generate_pdf çağırın.");
      }
      const fileName = `${doc.proposalNo}_v${doc.revision}.pdf`;
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      try {
        await stat(doc.pdfPath);
        createReadStream(doc.pdfPath).pipe(res);
      } catch {
        console.warn(`[admin] pdf dosyası diskte yok, buffer'dan yeniden üretiliyor: ${doc.pdfPath}`);
        const view = service.toView(doc);
        const buf = await renderPdfBuffer(view);
        res.send(buf);
      }
    } catch (err) {
      console.error("[admin] pdf error", err);
      res.status(500).type("text/plain").send("Sunucu hatası");
    }
  });

  await mountMcp(app);

  app.use((_req, res) => {
    res.status(404).type("text/plain").send("Bulunamadı.");
  });

  return app;
}
