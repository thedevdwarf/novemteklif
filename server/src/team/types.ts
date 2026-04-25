import type { ObjectId } from "mongodb";

export interface TeamMemberDoc {
  _id: ObjectId;
  name: string;
  telegramId?: string | null;
  role?: string | null;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TeamMemberInput {
  name: string;
  telegramId?: string;
  role?: string;
  notes?: string;
}

export interface TeamMemberView {
  id: string;
  name: string;
  telegramId?: string;
  role?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}
