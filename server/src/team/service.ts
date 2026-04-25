import * as repo from "./repository.js";
import type { TeamMemberDoc, TeamMemberInput, TeamMemberView } from "./types.js";

export class ValidationError extends Error {}
export class NotFoundError extends Error {
  constructor(idOrName: string) {
    super(`Ekip üyesi bulunamadı: ${idOrName}`);
  }
}

function toView(d: TeamMemberDoc): TeamMemberView {
  const v: TeamMemberView = {
    id: d._id.toHexString(),
    name: d.name,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
  if (d.telegramId) v.telegramId = d.telegramId;
  if (d.role) v.role = d.role;
  if (d.notes) v.notes = d.notes;
  return v;
}

function clean(s?: string | null): string | null | undefined {
  if (s === null) return null;
  if (s === undefined) return undefined;
  const t = s.trim();
  return t.length > 0 ? t : null;
}

export async function registerMember(input: TeamMemberInput): Promise<TeamMemberView> {
  const name = (input.name ?? "").trim();
  if (!name) throw new ValidationError("İsim zorunlu");
  const telegramId = clean(input.telegramId ?? undefined);
  // Telegram ID format: sadece rakam (Telegram user_id)
  if (telegramId && !/^\d+$/.test(telegramId)) {
    throw new ValidationError("Telegram ID sadece rakamlardan oluşmalıdır");
  }
  // Aynı telegramId başka bir kişide kayıtlıysa uyar
  if (telegramId) {
    const existing = await repo.findByTelegramId(telegramId);
    if (existing && existing.name.toLowerCase() !== name.toLowerCase()) {
      throw new ValidationError(
        `Bu Telegram ID zaten "${existing.name}" adında bir üyeye kayıtlı. Önce o kaydı sil veya başka ID kullan.`,
      );
    }
  }
  const doc = await repo.upsertByName({
    name,
    telegramId,
    role: clean(input.role ?? undefined),
    notes: clean(input.notes ?? undefined),
  });
  return toView(doc);
}

export async function getMember(idOrName: string): Promise<TeamMemberView> {
  const d = await repo.findByIdOrName(idOrName);
  if (!d) throw new NotFoundError(idOrName);
  return toView(d);
}

export async function listMembers(): Promise<TeamMemberView[]> {
  const docs = await repo.listAll();
  return docs.map(toView);
}

export async function forgetMember(idOrName: string): Promise<boolean> {
  return repo.deleteByIdOrName(idOrName);
}
