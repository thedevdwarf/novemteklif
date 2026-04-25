import { ObjectId, type Collection, type Db } from "mongodb";
import type { TermsTemplateDoc } from "./types.js";

let coll: Collection<TermsTemplateDoc> | null = null;
const TR_COLLATION = { locale: "tr", strength: 2 } as const;

export function init(db: Db): Collection<TermsTemplateDoc> {
  coll = db.collection<TermsTemplateDoc>("terms_templates");
  return coll;
}

function get(): Collection<TermsTemplateDoc> {
  if (!coll) throw new Error("terms repository not initialized");
  return coll;
}

export async function findById(id: string): Promise<TermsTemplateDoc | null> {
  if (!ObjectId.isValid(id)) return null;
  return get().findOne({ _id: new ObjectId(id) });
}

export async function findByName(name: string): Promise<TermsTemplateDoc | null> {
  return get().findOne({ name }, { collation: TR_COLLATION });
}

export async function findByIdOrName(idOrName: string): Promise<TermsTemplateDoc | null> {
  if (ObjectId.isValid(idOrName)) {
    const byId = await get().findOne({ _id: new ObjectId(idOrName) });
    if (byId) return byId;
  }
  return findByName(idOrName);
}

export async function findDefault(): Promise<TermsTemplateDoc | null> {
  return get().findOne({ isDefault: true });
}

export async function listAll(): Promise<TermsTemplateDoc[]> {
  return get().find({}).sort({ isDefault: -1, name: 1 }).toArray();
}

export async function insert(doc: TermsTemplateDoc): Promise<void> {
  await get().insertOne(doc);
}

export async function update(
  id: ObjectId,
  patch: Partial<TermsTemplateDoc>,
): Promise<TermsTemplateDoc | null> {
  return get().findOneAndUpdate(
    { _id: id },
    { $set: { ...patch, updatedAt: new Date() } },
    { returnDocument: "after" },
  );
}

export async function clearAllDefaults(): Promise<void> {
  await get().updateMany({ isDefault: true }, { $set: { isDefault: false, updatedAt: new Date() } });
}

export async function deleteById(id: ObjectId): Promise<boolean> {
  const r = await get().deleteOne({ _id: id });
  return r.deletedCount === 1;
}
