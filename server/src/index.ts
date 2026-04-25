import { config } from "./config.js";
import { connectDb, closeDb } from "./db.js";
import { startBrowser, stopBrowser } from "./render/pdf.js";
import { createInternalApp } from "./http/internal.js";
import { createPublicApp } from "./http/public.js";
import * as termsService from "./terms/service.js";

async function main(): Promise<void> {
  await connectDb();
  console.log(`[db] connected ${config.mongoUrl} db=${config.mongoDb}`);

  await termsService.ensureDefault();

  await startBrowser();
  console.log("[pdf] chromium ready");

  const internal = await createInternalApp();
  const publicApp = createPublicApp();

  const internalServer = internal.listen(config.portInternal, config.bindAddr, () => {
    console.log(
      `[server] internal http://${config.bindAddr}:${config.portInternal}` +
        ` (admin + mcp at /mcp)`,
    );
  });

  const publicServer = publicApp.listen(config.portPublic, config.bindAddr, () => {
    console.log(
      `[server] public   http://${config.bindAddr}:${config.portPublic}` +
        ` (cloudflared bind here, public base = ${config.publicBaseUrl})`,
    );
  });

  const shutdown = async (signal: string): Promise<void> => {
    console.log(`[server] ${signal} received, shutting down…`);
    internalServer.close();
    publicServer.close();
    try {
      await stopBrowser();
    } catch (e) {
      console.error("[pdf] stop error", e);
    }
    try {
      await closeDb();
    } catch (e) {
      console.error("[db] close error", e);
    }
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error("[fatal]", err);
  process.exit(1);
});
