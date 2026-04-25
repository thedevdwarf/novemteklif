import type { ObjectId } from "mongodb";

export interface CustomerMasterDoc {
  _id: ObjectId;
  tradeName: string;
  contactPerson?: string;
  greetingName?: string;
  phone?: string;
  email?: string;
  address?: string;
  taxOffice?: string;
  taxNo?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomerMasterInput {
  tradeName: string;
  contactPerson?: string;
  greetingName?: string;
  phone?: string;
  email?: string;
  address?: string;
  taxOffice?: string;
  taxNo?: string;
  notes?: string;
}

export interface CustomerMasterPatch extends Partial<CustomerMasterInput> {}

export interface CustomerMasterView {
  id: string;
  tradeName: string;
  contactPerson?: string;
  greetingName?: string;
  phone?: string;
  email?: string;
  address?: string;
  taxOffice?: string;
  taxNo?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}
