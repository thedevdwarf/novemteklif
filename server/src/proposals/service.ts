import { ObjectId } from "mongodb";
import { customAlphabet } from "nanoid";
import { config } from "../config.js";
import * as repo from "./repository.js";
import * as customerService from "../customers/service.js";
import type {
  CreateProposalInput,
  ItemInput,
  Item,
  ProposalDoc,
  ProposalPatch,
  Title,
  Totals,
  Customer,
  Currency,
  ProposalStatus,
} from "./types.js";

const ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const newToken = customAlphabet(ALPHABET, 24);

const DEFAULT_TITLE: Title = { main: "Novem POS" };
const DEFAULT_CURRENCY: Currency = "TRY";
const VALID_CURRENCIES: ReadonlySet<Currency> = new Set(["TRY", "USD", "EUR"]);

export class NotFoundError extends Error {
  constructor(idOrNo: string) {
    super(`Teklif bulunamadı: ${idOrNo}`);
  }
}

export class ValidationError extends Error {}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function normalizeCurrency(c?: string | null): Currency {
  if (!c) return DEFAULT_CURRENCY;
  const upper = c.toUpperCase() as Currency;
  if (!VALID_CURRENCIES.has(upper)) {
    throw new ValidationError(`Desteklenmeyen para birimi: ${c}. Geçerli: TRY, USD, EUR`);
  }
  return upper;
}

function normalizePreparer(p?: string | null): string {
  const t = (p ?? "").trim();
  if (!t) throw new ValidationError("Teklifi hazırlayan kişinin adı zorunlu");
  return t;
}

function computeItems(items: ItemInput[]): Item[] {
  return items.map((it) => {
    if (!it.name?.trim()) throw new ValidationError("Kalem adı boş olamaz");
    if (!Number.isFinite(it.qty) || it.qty <= 0) {
      throw new ValidationError(`Geçersiz adet: ${it.qty}`);
    }
    if (!Number.isFinite(it.unitPrice) || it.unitPrice < 0) {
      throw new ValidationError(`Geçersiz birim fiyat: ${it.unitPrice}`);
    }
    return { name: it.name.trim(), qty: it.qty, unitPrice: it.unitPrice, total: round2(it.qty * it.unitPrice) };
  });
}

function computeTotals(items: Item[], monthly?: number | null): Totals {
  const subtotal = round2(items.reduce((s, it) => s + it.total, 0));
  const t: Totals = { subtotal, grandTotal: subtotal };
  if (monthly !== undefined && monthly !== null) t.monthly = round2(monthly);
  return t;
}

function nextRevision(current: string): string {
  const n = Number.parseFloat(current);
  if (!Number.isFinite(n)) return "2.00";
  return (n + 1).toFixed(2);
}

function previewUrl(token: string): string {
  return `${config.publicBaseUrl}/p/${token}`;
}

function makeToken(): { token: string; expiresAt: Date } {
  const token = newToken();
  const expiresAt = new Date(Date.now() + config.previewTtlDays * 24 * 60 * 60 * 1000);
  return { token, expiresAt };
}

function normalizeCustomer(c: Customer): Customer {
  const tradeName = c.tradeName?.trim();
  const contactPerson = c.contactPerson?.trim();
  if (!tradeName) throw new ValidationError("Müşteri ticari unvanı zorunlu");
  if (!contactPerson) throw new ValidationError("İletişim kişisi zorunlu");
  return {
    tradeName,
    contactPerson,
    greetingName: c.greetingName?.trim() || contactPerson,
    address: c.address?.trim(),
    taxOffice: c.taxOffice?.trim(),
    taxNo: c.taxNo?.trim(),
  };
}

export interface ProposalView {
  id: string;
  proposalNo: string;
  revision: string;
  customer: Customer;
  title: Title;
  currency: Currency;
  preparer: string;
  items: Item[];
  totals: Totals;
  note?: string;
  status: ProposalStatus;
  date: Date;
  createdAt: Date;
  updatedAt: Date;
  previewUrl?: string;
  previewExpiresAt?: Date;
  previewRevokedAt?: Date;
  pdfPath?: string;
  parentId?: string;
  clonedFromId?: string;
}

export function toView(d: ProposalDoc): ProposalView {
  const v: ProposalView = {
    id: d._id.toHexString(),
    proposalNo: d.proposalNo,
    revision: d.revision,
    customer: d.customer,
    title: d.title,
    currency: d.currency ?? DEFAULT_CURRENCY,
    preparer: d.preparer ?? "Novem Yazılım",
    items: d.items,
    totals: d.totals,
    status: d.status,
    date: d.date,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
  if (d.note) v.note = d.note;
  if (d.previewToken && !d.previewRevokedAt) v.previewUrl = previewUrl(d.previewToken);
  if (d.previewExpiresAt) v.previewExpiresAt = d.previewExpiresAt;
  if (d.previewRevokedAt) v.previewRevokedAt = d.previewRevokedAt;
  if (d.pdfPath) v.pdfPath = d.pdfPath;
  if (d.parentId) v.parentId = d.parentId.toHexString();
  if (d.clonedFromId) v.clonedFromId = d.clonedFromId.toHexString();
  return v;
}

export async function createProposal(input: CreateProposalInput): Promise<ProposalView> {
  if (!input.items || input.items.length === 0) {
    throw new ValidationError("En az bir kalem gerekli");
  }
  const customer = normalizeCustomer(input.customer);
  // Cari master kaydını bul/oluştur ve referansını al
  const master = await customerService.findOrCreate({
    tradeName: customer.tradeName,
    contactPerson: customer.contactPerson,
    greetingName: customer.greetingName,
    address: customer.address,
    taxOffice: customer.taxOffice,
    taxNo: customer.taxNo,
  });
  const items = computeItems(input.items);
  const currency = normalizeCurrency(input.currency);
  const preparer = normalizePreparer(input.preparer);
  const totals = computeTotals(items, input.monthly);
  const date = input.date ?? new Date();
  const seq = await repo.nextSeq(date.getFullYear());
  const proposalNo = `${config.proposalPrefix}-${date.getFullYear()}-${String(seq).padStart(3, "0")}`;
  const { token, expiresAt } = makeToken();
  const title: Title = { main: input.title?.main ?? DEFAULT_TITLE.main };

  const now = new Date();
  const doc: ProposalDoc = {
    _id: new ObjectId(),
    proposalNo,
    revision: "1.00",
    customer,
    title,
    currency,
    preparer,
    items,
    totals,
    status: "draft",
    previewToken: token,
    previewExpiresAt: expiresAt,
    previewRevokedAt: null,
    pdfPath: null,
    parentId: null,
    clonedFromId: null,
    customerId: new ObjectId(master.id),
    createdAt: now,
    updatedAt: now,
    date,
    deletedAt: null,
  };
  if (input.note) doc.note = input.note;
  await repo.insert(doc);
  return toView(doc);
}

async function loadOrThrow(idOrNo: string): Promise<ProposalDoc> {
  const d = await repo.findByIdOrNo(idOrNo);
  if (!d) throw new NotFoundError(idOrNo);
  return d;
}

export async function getProposal(idOrNo: string): Promise<ProposalView> {
  return toView(await loadOrThrow(idOrNo));
}

export async function updateProposal(idOrNo: string, patch: ProposalPatch): Promise<ProposalView> {
  const cur = await loadOrThrow(idOrNo);
  const customer = patch.customer
    ? normalizeCustomer({ ...cur.customer, ...patch.customer })
    : cur.customer;
  const items = patch.items ? computeItems(patch.items) : cur.items;
  const currency = patch.currency ? normalizeCurrency(patch.currency) : (cur.currency ?? DEFAULT_CURRENCY);
  const preparer = patch.preparer !== undefined ? normalizePreparer(patch.preparer) : (cur.preparer ?? "Novem Yazılım");
  const monthly =
    patch.monthly === null
      ? undefined
      : patch.monthly !== undefined
        ? patch.monthly
        : cur.totals.monthly;
  const totals = computeTotals(items, monthly);
  const title: Title = patch.title
    ? { main: patch.title.main ?? cur.title.main }
    : cur.title;

  const noteUpdate: Partial<ProposalDoc> = {};
  if (patch.note === null) noteUpdate.note = undefined;
  else if (patch.note !== undefined) noteUpdate.note = patch.note;

  const updated = await repo.update(cur._id, {
    customer,
    items,
    currency,
    preparer,
    totals,
    title,
    ...(patch.date ? { date: patch.date } : {}),
    ...noteUpdate,
  });
  if (!updated) throw new NotFoundError(idOrNo);
  return toView(updated);
}

export async function reviseProposal(idOrNo: string, patch?: ProposalPatch): Promise<ProposalView> {
  const cur = await loadOrThrow(idOrNo);
  const all = await repo.findRevisions(cur.proposalNo);
  const latest = all[all.length - 1] ?? cur;
  const newRev = nextRevision(latest.revision);

  const customer = patch?.customer
    ? normalizeCustomer({ ...cur.customer, ...patch.customer })
    : cur.customer;
  const items = patch?.items ? computeItems(patch.items) : cur.items;
  const currency = patch?.currency ? normalizeCurrency(patch.currency) : (cur.currency ?? DEFAULT_CURRENCY);
  const preparer = patch?.preparer !== undefined ? normalizePreparer(patch.preparer) : (cur.preparer ?? "Novem Yazılım");
  const monthly =
    patch?.monthly === null
      ? undefined
      : patch?.monthly !== undefined
        ? patch.monthly
        : cur.totals.monthly;
  const totals = computeTotals(items, monthly);
  const title: Title = patch?.title
    ? { main: patch.title.main ?? cur.title.main }
    : cur.title;

  const { token, expiresAt } = makeToken();
  const now = new Date();
  const doc: ProposalDoc = {
    _id: new ObjectId(),
    proposalNo: cur.proposalNo,
    revision: newRev,
    customer,
    title,
    currency,
    preparer,
    items,
    totals,
    status: "draft",
    previewToken: token,
    previewExpiresAt: expiresAt,
    previewRevokedAt: null,
    pdfPath: null,
    parentId: cur._id,
    clonedFromId: cur.clonedFromId ?? null,
    customerId: cur.customerId ?? null,
    createdAt: now,
    updatedAt: now,
    date: patch?.date ?? new Date(),
    deletedAt: null,
  };
  const note = patch?.note === null ? undefined : (patch?.note ?? cur.note);
  if (note) doc.note = note;

  await repo.insert(doc);
  return toView(doc);
}

export async function cloneProposalForCustomer(
  sourceIdOrNo: string,
  newCustomer: Customer,
  patch?: ProposalPatch,
): Promise<ProposalView> {
  const src = await loadOrThrow(sourceIdOrNo);
  const customer = normalizeCustomer({ ...newCustomer });
  // Yeni müşteri için cari master oluştur/bul
  const master = await customerService.findOrCreate({
    tradeName: customer.tradeName,
    contactPerson: customer.contactPerson,
    greetingName: customer.greetingName,
    address: customer.address,
    taxOffice: customer.taxOffice,
    taxNo: customer.taxNo,
  });
  const items = patch?.items ? computeItems(patch.items) : src.items;
  const currency = patch?.currency ? normalizeCurrency(patch.currency) : (src.currency ?? DEFAULT_CURRENCY);
  const preparer = patch?.preparer !== undefined ? normalizePreparer(patch.preparer) : (src.preparer ?? "Novem Yazılım");
  const monthly =
    patch?.monthly === null
      ? undefined
      : patch?.monthly !== undefined
        ? patch.monthly
        : src.totals.monthly;
  const totals = computeTotals(items, monthly);
  const title: Title = patch?.title
    ? { main: patch.title.main ?? src.title.main }
    : src.title;

  const date = patch?.date ?? new Date();
  const seq = await repo.nextSeq(date.getFullYear());
  const proposalNo = `${config.proposalPrefix}-${date.getFullYear()}-${String(seq).padStart(3, "0")}`;
  const { token, expiresAt } = makeToken();
  const now = new Date();

  const doc: ProposalDoc = {
    _id: new ObjectId(),
    proposalNo,
    revision: "1.00",
    customer,
    title,
    currency,
    preparer,
    items,
    totals,
    status: "draft",
    previewToken: token,
    previewExpiresAt: expiresAt,
    previewRevokedAt: null,
    pdfPath: null,
    parentId: null,
    clonedFromId: src._id,
    customerId: new ObjectId(master.id),
    createdAt: now,
    updatedAt: now,
    date,
    deletedAt: null,
  };
  const note = patch?.note === null ? undefined : (patch?.note ?? src.note);
  if (note) doc.note = note;

  await repo.insert(doc);
  return toView(doc);
}

export async function regenerateToken(idOrNo: string): Promise<ProposalView> {
  const cur = await loadOrThrow(idOrNo);
  const { token, expiresAt } = makeToken();
  const updated = await repo.update(cur._id, {
    previewToken: token,
    previewExpiresAt: expiresAt,
    previewRevokedAt: null,
  });
  if (!updated) throw new NotFoundError(idOrNo);
  return toView(updated);
}

export async function setStatus(idOrNo: string, status: ProposalStatus): Promise<ProposalView> {
  const cur = await loadOrThrow(idOrNo);
  const updated = await repo.update(cur._id, { status });
  if (!updated) throw new NotFoundError(idOrNo);
  return toView(updated);
}

export async function deleteProposal(idOrNo: string): Promise<boolean> {
  const cur = await loadOrThrow(idOrNo);
  return repo.softDelete(cur._id);
}

/**
 * PDF üretim sonrası çağrılır: dosya yolunu set, preview token'ı revoke et.
 */
export async function markPdfGenerated(id: ObjectId, pdfPath: string): Promise<ProposalView> {
  const updated = await repo.update(id, {
    pdfPath,
    previewToken: null,
    previewRevokedAt: new Date(),
  });
  if (!updated) throw new Error("Proposal vanished during PDF generation");
  return toView(updated);
}

export const search = repo.search;
export const findByToken = repo.findByToken;
export const findByIdOrNo = repo.findByIdOrNo;
