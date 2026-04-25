import { ObjectId } from "mongodb";
import * as repo from "./repository.js";
import type {
  CustomerMasterDoc,
  CustomerMasterInput,
  CustomerMasterPatch,
  CustomerMasterView,
} from "./types.js";

export class ValidationError extends Error {}
export class NotFoundError extends Error {
  constructor(idOrName: string) {
    super(`Müşteri bulunamadı: ${idOrName}`);
  }
}

function clean(s?: string | null): string | undefined {
  if (!s) return undefined;
  const t = s.trim();
  return t.length > 0 ? t : undefined;
}

function normalize(input: CustomerMasterInput): Required<Pick<CustomerMasterInput, "tradeName">> &
  Omit<CustomerMasterInput, "tradeName"> {
  const tradeName = clean(input.tradeName);
  if (!tradeName) throw new ValidationError("Ticari unvan zorunlu");
  return {
    tradeName,
    contactPerson: clean(input.contactPerson),
    greetingName: clean(input.greetingName),
    phone: clean(input.phone),
    email: clean(input.email),
    address: clean(input.address),
    taxOffice: clean(input.taxOffice),
    taxNo: clean(input.taxNo),
    notes: clean(input.notes),
  };
}

function toView(d: CustomerMasterDoc): CustomerMasterView {
  const v: CustomerMasterView = {
    id: d._id.toHexString(),
    tradeName: d.tradeName,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
  for (const k of [
    "contactPerson",
    "greetingName",
    "phone",
    "email",
    "address",
    "taxOffice",
    "taxNo",
    "notes",
  ] as const) {
    const val = d[k];
    if (val) v[k] = val;
  }
  return v;
}

export async function registerCustomer(input: CustomerMasterInput): Promise<CustomerMasterView> {
  const n = normalize(input);
  const existing = await repo.findByTradeName(n.tradeName);
  if (existing) {
    // Mevcutsa, sadece yeni alanları doldur (boş olanları)
    const patch: Partial<CustomerMasterDoc> = {};
    for (const k of [
      "contactPerson",
      "greetingName",
      "phone",
      "email",
      "address",
      "taxOffice",
      "taxNo",
      "notes",
    ] as const) {
      if (!existing[k] && n[k]) patch[k] = n[k];
    }
    if (Object.keys(patch).length > 0) {
      const updated = await repo.update(existing._id, patch);
      return toView(updated ?? existing);
    }
    return toView(existing);
  }
  const now = new Date();
  const doc: CustomerMasterDoc = {
    _id: new ObjectId(),
    tradeName: n.tradeName,
    createdAt: now,
    updatedAt: now,
  };
  for (const k of [
    "contactPerson",
    "greetingName",
    "phone",
    "email",
    "address",
    "taxOffice",
    "taxNo",
    "notes",
  ] as const) {
    if (n[k]) doc[k] = n[k];
  }
  await repo.insert(doc);
  return toView(doc);
}

export async function getCustomer(idOrName: string): Promise<CustomerMasterView> {
  const d = await repo.findByIdOrTradeName(idOrName);
  if (!d) throw new NotFoundError(idOrName);
  return toView(d);
}

export async function listCustomers(query?: string, limit?: number): Promise<CustomerMasterView[]> {
  const docs = await repo.list(query, limit);
  return docs.map(toView);
}

export async function updateCustomer(
  idOrName: string,
  patch: CustomerMasterPatch,
): Promise<CustomerMasterView> {
  const d = await repo.findByIdOrTradeName(idOrName);
  if (!d) throw new NotFoundError(idOrName);
  const setPatch: Partial<CustomerMasterDoc> = {};
  if (patch.tradeName !== undefined) {
    const tn = clean(patch.tradeName);
    if (!tn) throw new ValidationError("Ticari unvan boş olamaz");
    setPatch.tradeName = tn;
  }
  for (const k of [
    "contactPerson",
    "greetingName",
    "phone",
    "email",
    "address",
    "taxOffice",
    "taxNo",
    "notes",
  ] as const) {
    if (k in patch) {
      const cleaned = clean(patch[k] as string | undefined);
      if (cleaned !== undefined) setPatch[k] = cleaned;
    }
  }
  const updated = await repo.update(d._id, setPatch);
  if (!updated) throw new NotFoundError(idOrName);
  return toView(updated);
}

export async function forgetCustomer(idOrName: string): Promise<boolean> {
  const d = await repo.findByIdOrTradeName(idOrName);
  if (!d) return false;
  return repo.deleteById(d._id);
}

/**
 * Bir teklif yaratırken müşteri verisinden master kaydını bulur veya oluşturur.
 * Snapshot eski şekilde teklife embed edilmeye devam eder.
 */
export async function findOrCreate(input: CustomerMasterInput): Promise<CustomerMasterView> {
  return registerCustomer(input);
}

export const findByIdOrTradeName = repo.findByIdOrTradeName;
