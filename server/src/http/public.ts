import express, { type Express, type Request, type Response } from "express";
import * as service from "../proposals/service.js";
import { renderProposalHtml } from "../render/template.js";

export function createPublicApp(): Express {
  const app = express();
  app.disable("x-powered-by");

  app.get("/healthz", (_req, res) => {
    res.type("text/plain").send("ok");
  });

  app.get("/p/:token", async (req: Request, res: Response) => {
    const token = String(req.params.token ?? "");
    if (!token || token.length < 8 || token.length > 64) {
      sendGone(res, "Geçersiz önizleme bağlantısı.");
      return;
    }
    try {
      const doc = await service.findByToken(token);
      if (!doc) {
        sendGone(res, "Bu önizleme bağlantısı bulunamadı veya sonlandırılmıştır.");
        return;
      }
      if (doc.previewRevokedAt) {
        sendGone(res, "Bu teklif önizlemesi sonlandırılmıştır.");
        return;
      }
      if (doc.previewExpiresAt && doc.previewExpiresAt < new Date()) {
        sendGone(res, "Önizleme bağlantısının süresi dolmuştur.");
        return;
      }
      const view = service.toView(doc);
      res.set({
        "Cache-Control": "no-store, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
        "Content-Type": "text/html; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
      });
      res.send(renderProposalHtml(view));
    } catch (err) {
      console.error("[public] preview error", err);
      res.status(500).type("text/plain").send("Sunucu hatası.");
    }
  });

  app.use((_req, res) => {
    res.status(404).type("text/plain").send("Bulunamadı.");
  });

  return app;
}

function sendGone(res: Response, msg: string): void {
  res.status(410).type("text/html; charset=utf-8").send(`<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><title>Önizleme Sonlandı</title>
<style>body{font-family:Helvetica,Arial,sans-serif;background:#0A1628;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;padding:20px;text-align:center}
.box{max-width:480px}
h1{font-size:22pt;margin:0 0 16px;color:#00FFF0}
p{font-size:11pt;color:rgba(255,255,255,.75);line-height:1.6}
small{display:block;margin-top:24px;color:rgba(255,255,255,.4);font-size:9pt}</style>
</head><body><div class="box">
<h1>Önizleme sonlandırıldı</h1>
<p>${escapeHtml(msg)}</p>
<p>Lütfen Novem Yazılım ile iletişime geçin.</p>
<small>Novem Yazılım ve Danışmanlık Tic. Ltd. Şti.</small>
</div></body></html>`);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;",
  );
}
