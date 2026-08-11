export type TenantStatus = "active" | "inactive";

export type Tenant = {
  id: number;
  company_name: string;
  legal_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  logo_path: string | null;
  logo_url: string | null;
  status: TenantStatus;
  is_platform?: boolean;
  parent_tenant_id?: number | null;
  users_count?: unknown;
  subscription_start: string | null;
  subscription_end: string | null;
  created_at: string;
  updated_at: string;
};

export type TenantListMeta = {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
  from: number | null;
  to: number | null;
};

export type TenantListResponse = {
  success: boolean;
  message: string;
  data: Tenant[];
  meta: TenantListMeta;
};

export type TenantApiError = {
  message: string;
  fieldErrors?: Record<string, string[]>;
};
