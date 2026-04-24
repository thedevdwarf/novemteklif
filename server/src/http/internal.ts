import express, { type Express, type Request, type Response } from "express";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import * as service from "../proposals/service.js";
import { renderProposalHtml } from "../render/template.js";
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

  // Admin PDF — diskten stream
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
      try {
        await stat(doc.pdfPath);
      } catch {
        return void res.status(404).type("text/plain").send("PDF dosyası diskte bulunamadı.");
      }
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${doc.proposalNo}_v${doc.revision}.pdf"`,
      );
      createReadStream(doc.pdfPath).pipe(res);
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
