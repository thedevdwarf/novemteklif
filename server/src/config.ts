import "dotenv/config";

function int(name: string, def: number): number {
  const raw = process.env[name];
  if (!raw) return def;
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n)) throw new Error(`Invalid integer for ${name}: ${raw}`);
  return n;
}

function str(name: string, def: string): string {
  const v = process.env[name];
  return v && v.length > 0 ? v : def;
}

export const config = {
  portInternal: int("PORT_INTERNAL", 7878),
  portPublic: int("PORT_PUBLIC", 7879),
  bindAddr: str("BIND_ADDR", "127.0.0.1"),

  mongoUrl: str("MONGO_URL", "mongodb://127.0.0.1:27017"),
  mongoDb: str("MONGO_DB", "teklify"),

  outDir: str("OUT_DIR", "/home/Teklifler"),

  publicBaseUrl: str("PUBLIC_BASE_URL", "http://127.0.0.1:7879").replace(/\/$/, ""),
  previewTtlDays: int("PREVIEW_TTL_DAYS", 7),

  company: {
    name: str("COMPANY_NAME", "Novem Yazılım ve Danışmanlık Tic. Ltd. Şti."),
    address: str(
      "COMPANY_ADDRESS",
      "Atatürk Mh. Komsan Üstü Yolu Cd. Residence Quality No:4/28 Küçükçekmece / İstanbul",
    ),
    tax: str("COMPANY_TAX", "Halkalı V.D. · 632 155 9162"),
  },

  proposalPrefix: str("PROPOSAL_PREFIX", "NVM"),

  telegramBotToken: str("TELEGRAM_BOT_TOKEN", ""),
} as const;

export type Config = typeof config;
