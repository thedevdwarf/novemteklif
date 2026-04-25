import { ObjectId, type Filter } from "mongodb";
import { proposals, counters } from "../db.js";
import type { ProposalDoc, SearchInput, SearchResult } from "./types.js";

export async function nextSeq(year: number): Promise<number> {
  const id = `proposal-${year}`;
  const r = await counters().findOneAndUpdate(
    { _id: id },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after" },
  );
  if (!r) throw new Error("Counter increment failed");
  return r.seq;
}

export async function insert(doc: ProposalDoc): Promise<void> {
  await proposals().insertOne(doc);
}

export async function findById(id: string): Promise<ProposalDoc | null> {
  if (!ObjectId.isValid(id)) return null;
  return proposals().findOne({ _id: new ObjectId(id), deletedAt: null });
}

/**
 * Belirtilen `idOrNo` doc, ID değilse en yüksek revizyonlu (son) doc.
 */
export async function findByIdOrNo(idOrNo: string): Promise<ProposalDoc | null> {
  if (ObjectId.isValid(idOrNo)) {
    const byId = await proposals().findOne({ _id: new ObjectId(idOrNo), deletedAt: null });
    if (byId) return byId;
  }
  return proposals().findOne(
    { proposalNo: idOrNo, deletedAt: null },
    { sort: { revision: -1 } },
  );
}

export async function findByToken(token: string): Promise<ProposalDoc | null> {
  return proposals().findOne({ previewToken: token, deletedAt: null });
}

export async function findRevisions(proposalNo: string): Promise<ProposalDoc[]> {
  return proposals()
    .find({ proposalNo, deletedAt: null })
    .sort({ revision: 1 })
    .toArray();
}

export async function update(id: ObjectId, patch: Partial<ProposalDoc>): Promise<ProposalDoc | null> {
  const r = await proposals().findOneAndUpdate(
    { _id: id },
    { $set: { ...patch, updatedAt: new Date() } },
    { returnDocument: "after" },
  );
  return r;
}

export async function softDelete(id: ObjectId): Promise<boolean> {
  const r = await proposals().updateOne(
    { _id: id, deletedAt: null },
    { $set: { deletedAt: new Date(), previewToken: null, updatedAt: new Date() } },
  );
  return r.modifiedCount === 1;
}

export async function search(input: SearchInput): Promise<SearchResult[]> {
  const filter: Filter<ProposalDoc> = { deletedAt: null };
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 100);

  if (input.customerName) {
    const safe = input.customerName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter["customer.tradeName"] = { $regex: safe, $options: "i" };
  }

  if (input.status) filter.status = input.status;

  if (input.dateFrom || input.dateTo) {
    filter.date = {};
    if (input.dateFrom) filter.date.$gte = input.dateFrom;
    if (input.dateTo) filter.date.$lte = input.dateTo;
  }

  if (input.query) filter.$text = { $search: input.query };
  if (input.customerId) filter.customerId = new ObjectId(input.customerId);

  const docs = await proposals()
    .find(filter)
    .sort(input.query ? { score: { $meta: "textScore" } } : { createdAt: -1 })
    .limit(limit)
    .toArray();

  const now = new Date();
  return docs.map((d) => ({
    id: d._id.toHexString(),
    proposalNo: d.proposalNo,
    revision: d.revision,
    customer: { tradeName: d.customer.tradeName, contactPerson: d.customer.contactPerson },
    date: d.date,
    grandTotal: d.totals.grandTotal,
    status: d.status,
    hasActivePreview:
      !!d.previewToken &&
      !d.previewRevokedAt &&
      (!d.previewExpiresAt || d.previewExpiresAt > now),
  }));
}
