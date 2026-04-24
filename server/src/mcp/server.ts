import type { Express, Request, Response } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { registerTools } from "./tools.js";

function buildServer(): McpServer {
  const server = new McpServer({
    name: "teklif",
    version: "0.1.0",
  });
  registerTools(server);
  return server;
}

export async function mountMcp(app: Express): Promise<void> {
  app.post("/mcp", async (req: Request, res: Response) => {
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

  // GET ve DELETE — stateless modda 405
  app.get("/mcp", (_req, res) => {
    res.status(405).type("application/json").send(
      JSON.stringify({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Method not allowed (use POST)" },
        id: null,
      }),
    );
  });
  app.delete("/mcp", (_req, res) => {
    res.status(405).type("application/json").send(
      JSON.stringify({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Method not allowed (use POST)" },
        id: null,
      }),
    );
  });
}
