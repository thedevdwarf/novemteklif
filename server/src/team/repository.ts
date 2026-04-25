import { ObjectId, type Collection } from "mongodb";
import type { Db } from "mongodb";
import type { TeamMemberDoc } from "./types.js";

let coll: Collection<TeamMemberDoc> | null = null;

export function init(db: Db): Collection<TeamMemberDoc> {
  coll = db.collection<TeamMemberDoc>("team_members");
  return coll;
}

function get(): Collection<TeamMemberDoc> {
  if (!coll) throw new Error("team repository not initialized");
  return coll;
}

export async function findByIdOrName(idOrName: string): Promise<TeamMemberDoc | null> {
  if (ObjectId.isValid(idOrName)) {
    const byId = await get().findOne({ _id: new ObjectId(idOrName) });
    if (byId) return byId;
  }
  // ad case-insensitive prefix arama
  const safe = idOrName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return get().findOne({ name: { $regex: `^${safe}$`, $options: "i" } });
}

export async function findByTelegramId(telegramId: string): Promise<TeamMemberDoc | null> {
  return get().findOne({ telegramId });
}

export async function listAll(): Promise<TeamMemberDoc[]> {
  return get().find({}).sort({ name: 1 }).toArray();
}

export async function upsertByName(input: {
  name: string;
  telegramId?: string | null;
  role?: string | null;
  notes?: string | null;
}): Promise<TeamMemberDoc> {
  const now = new Date();
  const safe = input.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const set: Partial<TeamMemberDoc> = { updatedAt: now };
  if (input.telegramId !== undefined) set.telegramId = input.telegramId;
  if (input.role !== undefined) set.role = input.role;
  if (input.notes !== undefined) set.notes = input.notes;

  const r = await get().findOneAndUpdate(
    { name: { $regex: `^${safe}$`, $options: "i" } },
    {
      $set: set,
      $setOnInsert: { _id: new ObjectId(), name: input.name, createdAt: now },
    },
    { upsert: true, returnDocument: "after" },
  );
  if (!r) throw new Error("upsert failed");
  return r;
}

export async function deleteByIdOrName(idOrName: string): Promise<boolean> {
  const doc = await findByIdOrName(idOrName);
  if (!doc) return false;
  const r = await get().deleteOne({ _id: doc._id });
  return r.deletedCount === 1;
}
