export type CareRole = 'admin' | 'boss' | 'marketing' | 'sale';

export interface CareUser {
  username: string;
  name: string;
  role: CareRole;
  email: string | null;
  saleId: number | null;
  createdAt: string;
}

export interface NewCareUser {
  username: string;
  password: string;
  name: string;
  role: CareRole;
  email?: string;
  saleId?: number | null;
}
