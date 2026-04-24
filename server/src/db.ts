import { MongoClient, type Db, type Collection } from "mongodb";
import { config } from "./config.js";
import type { ProposalDoc, CounterDoc } from "./proposals/types.js";

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectDb(): Promise<Db> {
  if (db) return db;
  client = new MongoClient(config.mongoUrl, {
    serverSelectionTimeoutMS: 5000,
  });
  await client.connect();
  db = client.db(config.mongoDb);
  await ensureIndexes(db);
  return db;
}

export async function closeDb(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}

export function proposals(): Collection<ProposalDoc> {
  if (!db) throw new Error("DB not connected");
  return db.collection<ProposalDoc>("proposals");
}

export function counters(): Collection<CounterDoc> {
  if (!db) throw new Error("DB not connected");
  return db.collection<CounterDoc>("counters");
}

async function ensureIndexes(db: Db): Promise<void> {
  const p = db.collection<ProposalDoc>("proposals");
  await p.createIndex({ proposalNo: 1, revision: 1 }, { unique: true });
  await p.createIndex(
    { previewToken: 1 },
    { unique: true, partialFilterExpression: { previewToken: { $type: "string" } } },
  );
  await p.createIndex(
    { "customer.tradeName": "text", "customer.contactPerson": "text" },
    { name: "customer_text" },
  );
  await p.createIndex({ "customer.tradeName": 1 });
  await p.createIndex({ createdAt: -1 });
  await p.createIndex({ parentId: 1 });
  await p.createIndex({ clonedFromId: 1 });
}
