import { ObjectId, type Collection, type Db } from "mongodb";
import type { CustomerMasterDoc } from "./types.js";

let coll: Collection<CustomerMasterDoc> | null = null;

const TR_COLLATION = { locale: "tr", strength: 2 } as const;

export function init(db: Db): Collection<CustomerMasterDoc> {
  coll = db.collection<CustomerMasterDoc>("customers");
  return coll;
}

function get(): Collection<CustomerMasterDoc> {
  if (!coll) throw new Error("customer repository not initialized");
  return coll;
}

export async function findById(id: string): Promise<CustomerMasterDoc | null> {
  if (!ObjectId.isValid(id)) return null;
  return get().findOne({ _id: new ObjectId(id) });
}

export async function findByTradeName(tradeName: string): Promise<CustomerMasterDoc | null> {
  return get().findOne({ tradeName }, { collation: TR_COLLATION });
}

export async function findByIdOrTradeName(idOrName: string): Promise<CustomerMasterDoc | null> {
  if (ObjectId.isValid(idOrName)) {
    const byId = await get().findOne({ _id: new ObjectId(idOrName) });
    if (byId) return byId;
  }
  return findByTradeName(idOrName);
}

export async function list(query?: string, limit = 50): Promise<CustomerMasterDoc[]> {
  const filter = query
    ? { tradeName: { $regex: query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } }
    : {};
  return get()
    .find(filter)
    .sort({ tradeName: 1 })
    .limit(Math.min(Math.max(limit, 1), 200))
    .toArray();
}

export async function insert(doc: CustomerMasterDoc): Promise<void> {
  await get().insertOne(doc);
}

export async function update(id: ObjectId, patch: Partial<CustomerMasterDoc>): Promise<CustomerMasterDoc | null> {
  const r = await get().findOneAndUpdate(
    { _id: id },
    { $set: { ...patch, updatedAt: new Date() } },
    { returnDocument: "after" },
  );
  return r;
}

export async function deleteById(id: ObjectId): Promise<boolean> {
  const r = await get().deleteOne({ _id: id });
  return r.deletedCount === 1;
}
