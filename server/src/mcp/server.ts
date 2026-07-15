import type { Express, Request, Response } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { registerTools } from "./tools.js";
import { mcpAuth } from "./auth.js";
import { mcpRateLimiter } from "./rateLimit.js";
import { config } from "../config.js";

function buildServer(): McpServer {
  const server = new McpServer({
    name: "teklif",
    version: "0.1.0",
  });
  registerTools(server);
  return server;
}

export async function mountMcp(app: Express): Promise<void> {
  if (!config.mcpAuthToken) {
    console.error(
      "[mcp] UYARI: MCP_AUTH_TOKEN tanımlı değil — /mcp fail-closed modda, " +
        "hiçbir istek yetkilendirilmeyecek. Bkz. .env.example.",
    );
  }

  app.post("/mcp", mcpRateLimiter, mcpAuth, async (req: Request, res: Response) => {
    try {
      const server = buildServer();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // stateless: her request bağımsız
      });
      res.on("close", () => {
        transport.close().catch(() => {});
        server.close().catch(() => {});
      });
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      console.error("[mcp] handler error", err);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal MCP error" },
          id: null,
        });
      }
    }
  });

  // GET ve DELETE — stateless modda 405 (rate limit + auth diğer route'larla tutarlı uygulanır)
  app.get("/mcp", mcpRateLimiter, mcpAuth, (_req, res) => {
    res.status(405).type("application/json").send(
      JSON.stringify({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Method not allowed (use POST)" },
        id: null,
      }),
    );
  });
  app.delete("/mcp", mcpRateLimiter, mcpAuth, (_req, res) => {
    res.status(405).type("application/json").send(
      JSON.stringify({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Method not allowed (use POST)" },
        id: null,
      }),
    );
  });
}
