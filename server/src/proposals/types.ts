import type { ObjectId } from "mongodb";

export interface Customer {
  tradeName: string;
  contactPerson: string;
  greetingName?: string;
  address?: string;
  taxOffice?: string;
  taxNo?: string;
}

export interface ItemInput {
  name: string;
  qty: number;
  unitPrice: number;
}

export interface Item extends ItemInput {
  total: number;
}

export interface Totals {
  subtotal: number;
  vatRate: number;
  vat: number;
  grandTotal: number;
  monthly?: number;
}

export interface Title {
  main: string;
  accent: string;
}

export type ProposalStatus = "draft" | "sent" | "accepted" | "rejected";

export interface ProposalDoc {
  _id: ObjectId;
  proposalNo: string;
  revision: string;
  customer: Customer;
  title: Title;
  items: Item[];
  totals: Totals;
  note?: string;
  status: ProposalStatus;
  previewToken?: string | null;
  previewExpiresAt?: Date | null;
  previewRevokedAt?: Date | null;
  pdfPath?: string | null;
  parentId?: ObjectId | null;
  clonedFromId?: ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
  date: Date;
  deletedAt?: Date | null;
}

export interface CounterDoc {
  _id: string;
  seq: number;
}

export interface ProposalPatch {
  customer?: Partial<Customer>;
  title?: Partial<Title>;
  items?: ItemInput[];
  note?: string | null;
  vatRate?: number;
  monthly?: number | null;
  date?: Date;
}

export interface CreateProposalInput {
  customer: Customer;
  items: ItemInput[];
  title?: Partial<Title>;
  note?: string;
  vatRate?: number;
  monthly?: number;
  date?: Date;
}

export interface SearchInput {
  query?: string;
  customerName?: string;
  dateFrom?: Date;
  dateTo?: Date;
  status?: ProposalStatus;
  limit?: number;
}

export interface SearchResult {
  id: string;
  proposalNo: string;
  revision: string;
  customer: { tradeName: string; contactPerson: string };
  date: Date;
  grandTotal: number;
  status: ProposalStatus;
  hasActivePreview: boolean;
}
