import { rateLimit } from "express-rate-limit";
import { config } from "../config.js";

/**
 * /mcp endpoint'i için IP başına dakikalık istek limiti.
 * Limit `MCP_RATE_LIMIT_PER_MINUTE` env değişkeni ile ayarlanır (bkz. config.ts).
 *
 * Auth middleware'inden ÖNCE uygulanır ki brute-force token deneme trafiği de
 * (401 alsa dahi) bu limite tabi olsun.
 */
export const mcpRateLimiter = rateLimit({
  windowMs: 60_000,
  limit: config.mcpRateLimitPerMinute,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res
      .status(429)
      .type("application/json")
      .send(
        JSON.stringify({
          jsonrpc: "2.0",
          error: { code: -32002, message: "Too many requests" },
          id: null,
        }),
      );
  },
});
