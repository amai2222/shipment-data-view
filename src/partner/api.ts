/**
 * 合作方（分包商 / 货主）门户数据层
 *
 * 7 个后端 RPC 已定契约，函数名与字段名不可变更。
 * 所有金额字段在后端可能是 numeric（返回字符串），这里统一做一次归一化，
 * UI 层只处理 number，避免每处再写 Number()。
 */
import { partnerSupabase as supabase } from '@/partner/client';

/* ------------------------------------------------------------------ */
/* 类型                                                                */
/* ------------------------------------------------------------------ */

export type PartnerScope = 'self' | 'tree';

export interface PartnerBasic {
  id: string;
  name: string;
  partner_type: string | null;
  tax_rate: number | null;
}

export interface PartnerStats {
  waybill_count: number;
  unpaid_amount: number;
  paid_amount: number;
  month_amount: number;
}

/** RPC: partner_get_overview() */
export interface PartnerOverview {
  partner: PartnerBasic;
  stats: PartnerStats;
  scope: PartnerScope;
  can_view_balance: boolean;
}

/** RPC: partner_get_waybills(...) 行 */
export interface PartnerWaybillRow {
  cost_id: string;
  record_id: string | null;
  auto_number: string | null;
  project_name: string | null;
  loading_date: string | null;
  loading_location: string | null;
  unloading_location: string | null;
  license_plate: string | null;
  effective_quantity: number | null;
  billing_type_id: string | null;
  payable_amount: number;
  payment_status: string | null;
  invoice_status: string | null;
  reconciliation_status: string | null;
  bill_month: string | null;
}

/** RPC: partner_get_waybills(...) 返回 */
export interface PartnerWaybillPage {
  rows: PartnerWaybillRow[];
  total: number;
}

export interface WaybillQuery {
  /** yyyy-MM-dd */
  from?: string | null;
  to?: string | null;
  page?: number;
  size?: number;
  keyword?: string | null;
}

export interface StatementGroup {
  project_name: string | null;
  count: number;
  amount: number;
}

export interface StatementStatusItem {
  status: string | null;
  count: number;
  amount: number;
}

/** RPC: partner_get_statement(p_month) */
export interface PartnerStatement {
  month: string;
  groups: StatementGroup[];
  total_amount: number;
  paid_amount: number;
  unpaid_amount: number;
  by_status: StatementStatusItem[];
}

export interface TrendRow {
  month: string;
  amount: number;
  count: number;
}

/** RPC: partner_get_trend(p_months) */
export interface PartnerTrend {
  rows: TrendRow[];
}

export interface ReconciliationRow {
  cost_id: string;
  auto_number: string | null;
  loading_date: string | null;
  payable_amount: number;
  reconciliation_status: string | null;
  reconciliation_notes: string | null;
}

/** RPC: partner_get_reconciliation(p_month) */
export interface PartnerReconciliation {
  rows: ReconciliationRow[];
  total: number;
  unreconciled_count: number;
  unreconciled_amount: number;
}

/** RPC: partner_confirm_reconciliation(p_cost_ids, p_note) */
export interface ConfirmReconciliationResult {
  updated: number;
  skipped: number;
}

export interface PartnerProfile {
  partner: {
    id: string;
    name: string;
    full_name: string | null;
    tax_number: string | null;
  };
  bank: {
    bank_name: string | null;
    bank_account: string | null;
    branch_name: string | null;
  };
  user: {
    email: string | null;
    full_name: string | null;
  };
}

/* ------------------------------------------------------------------ */
/* 错误与工具                                                          */
/* ------------------------------------------------------------------ */

/** 面向用户的中文错误；原始信息保留在 detail 里便于排查 */
export class PartnerApiError extends Error {
  detail?: string;

  constructor(message: string, detail?: string) {
    super(message);
    this.name = 'PartnerApiError';
    this.detail = detail;
  }
}

export function toErrorMessage(error: unknown, fallback = '操作失败，请稍后重试'): string {
  if (error instanceof PartnerApiError) return error.message;
  return fallback;
}

const detailOf = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
};

const num = (value: unknown): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (value === null || value === undefined || value === '') return 0;
  const parsed = Number(String(value).replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

const numOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = num(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const str = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text === '' ? null : text;
};

/* ------------------------------------------------------------------ */
/* RPC 调用底座                                                        */
/* ------------------------------------------------------------------ */

type RpcResponse = { data: unknown; error: { message?: string } | null };

type RpcClient = {
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<RpcResponse>;
};

/**
 * Database 类型由主站维护，尚未包含合作方 RPC。
 * 这里做一次窄化断言，避免改动共享的 types.ts。
 */
const rpcClient = supabase as unknown as RpcClient;

const callRpc = (fn: string, args?: Record<string, unknown>): Promise<RpcResponse> =>
  rpcClient.rpc(fn, args);

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

/* ------------------------------------------------------------------ */
/* 7 个 RPC 封装                                                       */
/* ------------------------------------------------------------------ */

export async function getOverview(): Promise<PartnerOverview> {
  try {
    const { data, error } = await callRpc('partner_get_overview');
    if (error) throw new Error(error.message || 'partner_get_overview failed');

    const raw = asRecord(data);
    const partner = asRecord(raw.partner);
    const stats = asRecord(raw.stats);

    return {
      partner: {
        id: str(partner.id) ?? '',
        name: str(partner.name) ?? '合作方',
        partner_type: str(partner.partner_type),
        tax_rate: numOrNull(partner.tax_rate),
      },
      stats: {
        waybill_count: num(stats.waybill_count),
        unpaid_amount: num(stats.unpaid_amount),
        paid_amount: num(stats.paid_amount),
        month_amount: num(stats.month_amount),
      },
      scope: raw.scope === 'tree' ? 'tree' : 'self',
      can_view_balance: Boolean(raw.can_view_balance),
    };
  } catch (error) {
    throw new PartnerApiError('无法加载账户概览，请稍后重试', detailOf(error));
  }
}

const mapWaybillRow = (input: unknown): PartnerWaybillRow => {
  const row = asRecord(input);
  return {
    cost_id: str(row.cost_id) ?? '',
    record_id: str(row.record_id),
    auto_number: str(row.auto_number),
    project_name: str(row.project_name),
    loading_date: str(row.loading_date),
    loading_location: str(row.loading_location),
    unloading_location: str(row.unloading_location),
    license_plate: str(row.license_plate),
    effective_quantity: numOrNull(row.effective_quantity),
    billing_type_id: str(row.billing_type_id),
    payable_amount: num(row.payable_amount),
    payment_status: str(row.payment_status),
    invoice_status: str(row.invoice_status),
    reconciliation_status: str(row.reconciliation_status),
    bill_month: str(row.bill_month),
  };
};

export async function getWaybills(query: WaybillQuery = {}): Promise<PartnerWaybillPage> {
  try {
    const { data, error } = await callRpc('partner_get_waybills', {
      p_from: query.from || null,
      p_to: query.to || null,
      p_page: query.page ?? 1,
      p_size: query.size ?? 20,
      p_keyword: query.keyword?.trim() || null,
    });
    if (error) throw new Error(error.message || 'partner_get_waybills failed');

    const raw = asRecord(data);
    const rows = Array.isArray(raw.rows) ? raw.rows.map(mapWaybillRow) : [];

    return { rows, total: num(raw.total) };
  } catch (error) {
    throw new PartnerApiError('运单列表加载失败，请调整筛选条件后重试', detailOf(error));
  }
}

export async function getStatement(month: string): Promise<PartnerStatement> {
  try {
    const { data, error } = await callRpc('partner_get_statement', { p_month: month });
    if (error) throw new Error(error.message || 'partner_get_statement failed');

    const raw = asRecord(data);

    return {
      month: str(raw.month) ?? month,
      groups: Array.isArray(raw.groups)
        ? raw.groups.map((item) => {
            const group = asRecord(item);
            return {
              project_name: str(group.project_name),
              count: num(group.count),
              amount: num(group.amount),
            };
          })
        : [],
      total_amount: num(raw.total_amount),
      paid_amount: num(raw.paid_amount),
      unpaid_amount: num(raw.unpaid_amount),
      by_status: Array.isArray(raw.by_status)
        ? raw.by_status.map((item) => {
            const status = asRecord(item);
            return {
              status: str(status.status),
              count: num(status.count),
              amount: num(status.amount),
            };
          })
        : [],
    };
  } catch (error) {
    throw new PartnerApiError('结算单加载失败，请稍后重试', detailOf(error));
  }
}

export async function getTrend(months = 6): Promise<PartnerTrend> {
  try {
    const { data, error } = await callRpc('partner_get_trend', { p_months: months });
    if (error) throw new Error(error.message || 'partner_get_trend failed');

    const raw = asRecord(data);

    return {
      rows: Array.isArray(raw.rows)
        ? raw.rows.map((item) => {
            const row = asRecord(item);
            return {
              month: str(row.month) ?? '',
              amount: num(row.amount),
              count: num(row.count),
            };
          })
        : [],
    };
  } catch (error) {
    throw new PartnerApiError('趋势数据加载失败，请稍后重试', detailOf(error));
  }
}

export async function getReconciliation(month: string): Promise<PartnerReconciliation> {
  try {
    const { data, error } = await callRpc('partner_get_reconciliation', { p_month: month });
    if (error) throw new Error(error.message || 'partner_get_reconciliation failed');

    const raw = asRecord(data);

    return {
      rows: Array.isArray(raw.rows)
        ? raw.rows.map((item) => {
            const row = asRecord(item);
            return {
              cost_id: str(row.cost_id) ?? '',
              auto_number: str(row.auto_number),
              loading_date: str(row.loading_date),
              payable_amount: num(row.payable_amount),
              reconciliation_status: str(row.reconciliation_status),
              reconciliation_notes: str(row.reconciliation_notes),
            };
          })
        : [],
      total: num(raw.total),
      unreconciled_count: num(raw.unreconciled_count),
      unreconciled_amount: num(raw.unreconciled_amount),
    };
  } catch (error) {
    throw new PartnerApiError('对账清单加载失败，请稍后重试', detailOf(error));
  }
}

export async function confirmReconciliation(
  costIds: string[],
  note: string,
): Promise<ConfirmReconciliationResult> {
  try {
    const { data, error } = await callRpc('partner_confirm_reconciliation', {
      p_cost_ids: costIds,
      p_note: note.trim() || null,
    });
    if (error) throw new Error(error.message || 'partner_confirm_reconciliation failed');

    const raw = asRecord(data);
    return { updated: num(raw.updated), skipped: num(raw.skipped) };
  } catch (error) {
    throw new PartnerApiError('确认对账失败，请稍后重试', detailOf(error));
  }
}

export async function getProfile(): Promise<PartnerProfile> {
  try {
    const { data, error } = await callRpc('partner_get_profile');
    if (error) throw new Error(error.message || 'partner_get_profile failed');

    const raw = asRecord(data);
    const partner = asRecord(raw.partner);
    const bank = asRecord(raw.bank);
    const user = asRecord(raw.user);

    return {
      partner: {
        id: str(partner.id) ?? '',
        name: str(partner.name) ?? '合作方',
        full_name: str(partner.full_name),
        tax_number: str(partner.tax_number),
      },
      bank: {
        bank_name: str(bank.bank_name),
        bank_account: str(bank.bank_account),
        branch_name: str(bank.branch_name),
      },
      user: {
        email: str(user.email),
        full_name: str(user.full_name),
      },
    };
  } catch (error) {
    throw new PartnerApiError('企业信息加载失败，请稍后重试', detailOf(error));
  }
}
