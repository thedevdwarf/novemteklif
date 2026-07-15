import type { NextFunction, Request, Response } from "express";
import { timingSafeEqual } from "node:crypto";
import { config } from "../config.js";

/**
 * /mcp endpoint'i için Bearer token doğrulaması.
 *
 * Token `MCP_AUTH_TOKEN` env değişkeninden okunur (bkz. config.ts, .env.example).
 * İstek `Authorization: Bearer <token>` veya `X-API-Key: <token>` header'ından
 * token taşımalı; eşleşmezse veya hiç gelmezse 401 döner.
 *
 * MCP_AUTH_TOKEN tanımlı değilse fail-closed davranılır: hiçbir istek eşleşemez,
 * yani token yapılandırılmadan endpoint yanlışlıkla açık kalmaz.
 */
export function mcpAuth(req: Request, res: Response, next: NextFunction): void {
  const configured = config.mcpAuthToken;
  const presented = extractToken(req);

  if (!configured || !presented || !safeCompare(presented, configured)) {
    sendUnauthorized(res);
    return;
  }

  next();
}

function extractToken(req: Request): string | undefined {
  const auth = req.header("authorization");
  if (auth) {
    const trimmed = auth.trim();
    const spaceIdx = trimmed.indexOf(" ");
    if (spaceIdx === -1) return undefined;
    const scheme = trimmed.slice(0, spaceIdx);
    const value = trimmed.slice(spaceIdx + 1).trim();
    if (scheme.toLowerCase() !== "bearer" || value.length === 0) return undefined;
    return value;
  }

  const apiKey = req.header("x-api-key");
  if (apiKey && apiKey.trim().length > 0) return apiKey.trim();

  return undefined;
}

/** Sabit süreli karşılaştırma — token uzunluğu/eşleşmesi zamanlamadan sızmasın. */
function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) {
    // Uzunluklar farklıyken de sabit-süreli bir karşılaştırma çalıştır (kendisiyle),
    // erken dönüşün zamanlama sinyali vermesini azaltmak için.
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

function sendUnauthorized(res: Response): void {
  res
    .status(401)
    .set("WWW-Authenticate", 'Bearer realm="mcp"')
    .type("application/json")
    .send(
      JSON.stringify({
        jsonrpc: "2.0",
        error: { code: -32001, message: "Unauthorized" },
        id: null,
      }),
    );
}
