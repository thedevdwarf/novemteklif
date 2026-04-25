import { ObjectId } from "mongodb";
import * as repo from "./repository.js";
import {
  DEFAULT_BLOCKS,
  type TermBlock,
  type TermsTemplateDoc,
  type TermsTemplateInput,
  type TermsTemplateView,
} from "./types.js";

export class ValidationError extends Error {}
export class NotFoundError extends Error {
  constructor(idOrName: string) {
    super(`Koşullar şablonu bulunamadı: ${idOrName}`);
  }
}

function validateBlocks(blocks: TermBlock[]): TermBlock[] {
  if (!Array.isArray(blocks) || blocks.length === 0) {
    throw new ValidationError("En az bir koşul maddesi gerekli");
  }
  return blocks.map((b, i) => {
    const title = b.title?.trim();
    if (!title) throw new ValidationError(`Madde ${i + 1}: başlık zorunlu`);
    if (!Array.isArray(b.paragraphs) || b.paragraphs.length === 0) {
      throw new ValidationError(`Madde ${i + 1} (${title}): en az bir paragraf gerekli`);
    }
    const paragraphs = b.paragraphs.map((p) => p.trim()).filter((p) => p.length > 0);
    if (paragraphs.length === 0) {
      throw new ValidationError(`Madde ${i + 1} (${title}): paragraflar boş olamaz`);
    }
    return { title, paragraphs };
  });
}

function toView(d: TermsTemplateDoc): TermsTemplateView {
  const v: TermsTemplateView = {
    id: d._id.toHexString(),
    name: d.name,
    isDefault: d.isDefault,
    blocks: d.blocks,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
  if (d.parentId) v.parentId = d.parentId.toHexString();
  if (d.notes) v.notes = d.notes;
  return v;
}

/**
 * Boot sırasında çağrılır: default template yoksa hardcoded DEFAULT_BLOCKS ile oluştur.
 */
export async function ensureDefault(): Promise<TermsTemplateView> {
  const existing = await repo.findDefault();
  if (existing) return toView(existing);
  const now = new Date();
  const doc: TermsTemplateDoc = {
    _id: new ObjectId(),
    name: "default",
    isDefault: true,
    blocks: DEFAULT_BLOCKS,
    parentId: null,
    createdAt: now,
    updatedAt: now,
  };
  await repo.insert(doc);
  console.log(`[terms] default template seed edildi (${doc._id.toHexString()})`);
  return toView(doc);
}

export async function getDefault(): Promise<TermsTemplateView> {
  const d = await repo.findDefault();
  if (!d) {
    // Beklenmedik durum — boot'ta seed olmalıydı; geri dönüş için yeniden seed
    return ensureDefault();
  }
  return toView(d);
}

export async function getDefaultBlocks(): Promise<TermBlock[]> {
  const d = await repo.findDefault();
  return d?.blocks ?? DEFAULT_BLOCKS;
}

export async function getTemplate(idOrName: string): Promise<TermsTemplateView> {
  const d = await repo.findByIdOrName(idOrName);
  if (!d) throw new NotFoundError(idOrName);
  return toView(d);
}

export async function listTemplates(): Promise<TermsTemplateView[]> {
  const docs = await repo.listAll();
  return docs.map(toView);
}

export async function createTemplate(input: TermsTemplateInput): Promise<TermsTemplateView> {
  const name = input.name?.trim();
  if (!name) throw new ValidationError("Şablon adı zorunlu");
  if (name.toLowerCase() === "default") {
    throw new ValidationError("'default' adı rezerve, başka bir isim seç");
  }
  const existing = await repo.findByName(name);
  if (existing) {
    throw new ValidationError(`'${name}' adında bir şablon zaten var. update_terms_template kullan.`);
  }
  const blocks = validateBlocks(input.blocks);
  const now = new Date();
  const doc: TermsTemplateDoc = {
    _id: new ObjectId(),
    name,
    isDefault: false,
    blocks,
    parentId: null,
    createdAt: now,
    updatedAt: now,
  };
  if (input.notes?.trim()) doc.notes = input.notes.trim();
  await repo.insert(doc);
  return toView(doc);
}

export async function cloneTemplate(
  sourceIdOrName: string,
  newName: string,
  notes?: string,
): Promise<TermsTemplateView> {
  const src = await repo.findByIdOrName(sourceIdOrName);
  if (!src) throw new NotFoundError(sourceIdOrName);
  const trimmedNew = newName?.trim();
  if (!trimmedNew) throw new ValidationError("Yeni şablon adı zorunlu");
  if (trimmedNew.toLowerCase() === "default") {
    throw new ValidationError("'default' adı rezerve");
  }
  if (await repo.findByName(trimmedNew)) {
    throw new ValidationError(`'${trimmedNew}' adında bir şablon zaten var`);
  }
  const now = new Date();
  const doc: TermsTemplateDoc = {
    _id: new ObjectId(),
    name: trimmedNew,
    isDefault: false,
    blocks: src.blocks.map((b) => ({ title: b.title, paragraphs: [...b.paragraphs] })),
    parentId: src._id,
    createdAt: now,
    updatedAt: now,
  };
  if (notes?.trim()) doc.notes = notes.trim();
  await repo.insert(doc);
  return toView(doc);
}

export async function updateTemplate(
  idOrName: string,
  patch: { name?: string; blocks?: TermBlock[]; notes?: string },
): Promise<TermsTemplateView> {
  const d = await repo.findByIdOrName(idOrName);
  if (!d) throw new NotFoundError(idOrName);
  const set: Partial<TermsTemplateDoc> = {};
  if (patch.name !== undefined) {
    const trimmed = patch.name.trim();
    if (!trimmed) throw new ValidationError("Şablon adı boş olamaz");
    if (d.isDefault && trimmed.toLowerCase() !== "default") {
      throw new ValidationError("Default şablonun adı değiştirilemez");
    }
    set.name = trimmed;
  }
  if (patch.blocks !== undefined) set.blocks = validateBlocks(patch.blocks);
  if (patch.notes !== undefined) set.notes = patch.notes.trim() || undefined;
  const updated = await repo.update(d._id, set);
  if (!updated) throw new NotFoundError(idOrName);
  return toView(updated);
}

export async function setDefault(idOrName: string): Promise<TermsTemplateView> {
  const d = await repo.findByIdOrName(idOrName);
  if (!d) throw new NotFoundError(idOrName);
  await repo.clearAllDefaults();
  const updated = await repo.update(d._id, { isDefault: true });
  if (!updated) throw new NotFoundError(idOrName);
  return toView(updated);
}

export async function deleteTemplate(idOrName: string): Promise<boolean> {
  const d = await repo.findByIdOrName(idOrName);
  if (!d) return false;
  if (d.isDefault) throw new ValidationError("Default şablon silinemez. Önce başka bir şablonu default yap.");
  return repo.deleteById(d._id);
}
