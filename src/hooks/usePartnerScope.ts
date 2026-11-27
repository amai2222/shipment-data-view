// 文件路径: src/hooks/usePartnerScope.ts
// 描述: 合作方（partner 角色）自助查询统一 Hook
//      封装 supabase/migrations/20261127_05_partner_rpc.sql 中的 7 个 RPC。
//      所有金额在数据库侧为 numeric，前端统一用 number。
//      数据范围由后端 get_visible_partner_ids() 决定，前端无法传 partner_id，
//      因此这里没有任何「切换合作方」的参数。

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

// ============================================================================
// 类型定义（与 RPC 返回结构一一对应）
// ============================================================================

/** 数据范围：self = 仅本方；tree = 含下级树 */
export type PartnerScope = 'self' | 'tree';

/** partner_get_overview() */
export interface PartnerOverviewPartner {
  id: string;
  name: string;
  /** 货主 / 合作商 / 资方 / 本公司 */
  partner_type: string;
  tax_rate: number;
}

export interface PartnerOverviewStats {
  waybill_count: number;
  unpaid_amount: number;
  paid_amount: number;
  /** 当月（按 loading_date）应付金额 */
  month_amount: number;
}

export interface PartnerOverview {
  partner: PartnerOverviewPartner;
  stats: PartnerOverviewStats;
  scope: PartnerScope;
  can_view_balance: boolean;
}

/** partner_get_waybills() —— 不含 base_amount / unit_price / payable_cost */
export interface PartnerWaybillRow {
  cost_id: string;
  record_id: string;
  auto_number: string;
  project_name: string;
  /** YYYY-MM-DD */
  loading_date: string | null;
  loading_location: string;
  unloading_location: string;
  license_plate: string;
  effective_quantity: number | null;
  billing_type_id: number | null;
  payable_amount: number;
  payment_status: string | null;
  invoice_status: string | null;
  reconciliation_status: string | null;
  /** YYYY-MM，由 loading_date 推导 */
  bill_month: string | null;
}

export interface PartnerWaybillPage {
  rows: PartnerWaybillRow[];
  total: number;
}

/** partner_get_statement() */
export interface PartnerStatementGroup {
  project_name: string;
  count: number;
  amount: number;
}

export interface PartnerStatementStatus {
  status: string;
  count: number;
  amount: number;
}

export interface PartnerStatement {
  /** YYYY-MM */
  month: string;
  groups: PartnerStatementGroup[];
  total_amount: number;
  paid_amount: number;
  unpaid_amount: number;
  by_status: PartnerStatementStatus[];
}

/** partner_get_trend() */
export interface PartnerTrendRow {
  /** YYYY-MM，升序 */
  month: string;
  amount: number;
  count: number;
}

export interface PartnerTrend {
  rows: PartnerTrendRow[];
}

/** partner_get_reconciliation() */
export interface PartnerReconciliationRow {
  cost_id: string;
  auto_number: string;
  loading_date: string | null;
  payable_amount: number;
  reconciliation_status: string | null;
  reconciliation_notes: string | null;
}

export interface PartnerReconciliation {
  rows: PartnerReconciliationRow[];
  total: number;
  unreconciled_count: number;
  unreconciled_amount: number;
}

/** partner_confirm_reconciliation() */
export interface PartnerConfirmResult {
  /** 实际写入条数 */
  updated: number;
  /** 越权 / 不存在而被跳过的条数 */
  skipped: number;
}

/** partner_get_profile() */
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

// ============================================================================
// RPC 调用封装
// ============================================================================

/**
 * 新 RPC 尚未进入自动生成的 Database 类型（types.ts 为生成文件，不手改），
 * 这里用最小化的窄接口代替 any，保证调用处仍有参数/返回值约束。
 */
interface RpcResult {
  data: unknown;
  error: { message: string; code?: string } | null;
}

interface PartnerRpcClient {
  rpc(fn: string, args?: Record<string, unknown>): Promise<RpcResult>;
}

const partnerRpc = supabase as unknown as PartnerRpcClient;

async function callPartnerRpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await partnerRpc.rpc(fn, args);

  if (error) {
    // PGRST202 = 函数不存在（迁移未部署）
    if (error.code === 'PGRST202') {
      throw new Error(`合作方数据接口未部署，请先执行迁移：${fn}`);
    }
    throw new Error(error.message || '合作方数据加载失败，请稍后重试');
  }

  if (data === null || data === undefined) {
    throw new Error('合作方数据为空，请稍后重试');
  }

  return data as T;
}

// ============================================================================
// Hook 参数
// ============================================================================

export interface PartnerScopeParams {
  /** 运单查询起始装货日期 YYYY-MM-DD */
  from?: string | null;
  /** 运单查询结束装货日期 YYYY-MM-DD */
  to?: string | null;
  page?: number;
  size?: number;
  keyword?: string | null;
  /** 对账 / 对账单月份 YYYY-MM，null 取当前月 */
  month?: string | null;
  /** 趋势月数 1~24 */
  months?: number;
}

const DEFAULT_PAGE_SIZE = 20;
const DEFAULT_TREND_MONTHS = 6;

export interface UsePartnerScopeReturn {
  overview: PartnerOverview | null;
  waybills: PartnerWaybillPage | null;
  statement: PartnerStatement | null;
  trend: PartnerTrend | null;
  reconciliation: PartnerReconciliation | null;
  profile: PartnerProfile | null;
  loading: boolean;
  error: string | null;
  refresh: (params?: PartnerScopeParams) => Promise<void>;
  /** 额外暴露：确认对账（第 7 个 RPC 的写操作，成功后自动 refresh） */
  confirmReconciliation: (costIds: string[], note?: string | null) => Promise<PartnerConfirmResult>;
}

// ============================================================================
// Hook 实现
// ============================================================================

export function usePartnerScope(initialParams?: PartnerScopeParams): UsePartnerScopeReturn {
  const [overview, setOverview] = useState<PartnerOverview | null>(null);
  const [waybills, setWaybills] = useState<PartnerWaybillPage | null>(null);
  const [statement, setStatement] = useState<PartnerStatement | null>(null);
  const [trend, setTrend] = useState<PartnerTrend | null>(null);
  const [reconciliation, setReconciliation] = useState<PartnerReconciliation | null>(null);
  const [profile, setProfile] = useState<PartnerProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 保存最近一次参数，供 confirmReconciliation 之后刷新复用
  const paramsRef = useRef<PartnerScopeParams>(initialParams ?? {});
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(async (params?: PartnerScopeParams) => {
    const merged: PartnerScopeParams = { ...paramsRef.current, ...(params ?? {}) };
    paramsRef.current = merged;

    const page = merged.page && merged.page > 0 ? merged.page : 1;
    const size = merged.size && merged.size > 0 ? merged.size : DEFAULT_PAGE_SIZE;
    const months = merged.months && merged.months > 0 ? merged.months : DEFAULT_TREND_MONTHS;
    const month = merged.month ?? null;

    if (mountedRef.current) {
      setLoading(true);
      setError(null);
    }

    // 首次加载任意一个失败即整体报错，但已成功的数据仍然回填，便于页面局部渲染
    const tasks = [
      callPartnerRpc<PartnerOverview>('partner_get_overview'),
      callPartnerRpc<PartnerWaybillPage>('partner_get_waybills', {
        p_from: merged.from ?? null,
        p_to: merged.to ?? null,
        p_page: page,
        p_size: size,
        p_keyword: merged.keyword ?? null,
      }),
      callPartnerRpc<PartnerStatement>('partner_get_statement', { p_month: month }),
      callPartnerRpc<PartnerTrend>('partner_get_trend', { p_months: months }),
      callPartnerRpc<PartnerReconciliation>('partner_get_reconciliation', { p_month: month }),
      callPartnerRpc<PartnerProfile>('partner_get_profile'),
    ] as const;

    const results = await Promise.allSettled(tasks);

    if (!mountedRef.current) return;

    const [overviewRes, waybillsRes, statementRes, trendRes, reconciliationRes, profileRes] = results;

    if (overviewRes.status === 'fulfilled') setOverview(overviewRes.value);
    if (waybillsRes.status === 'fulfilled') setWaybills(waybillsRes.value);
    if (statementRes.status === 'fulfilled') setStatement(statementRes.value);
    if (trendRes.status === 'fulfilled') setTrend(trendRes.value);
    if (reconciliationRes.status === 'fulfilled') setReconciliation(reconciliationRes.value);
    if (profileRes.status === 'fulfilled') setProfile(profileRes.value);

    const firstRejected = results.find(
      (r): r is PromiseRejectedResult => r.status === 'rejected'
    );
    if (firstRejected) {
      const reason = firstRejected.reason;
      setError(reason instanceof Error ? reason.message : '合作方数据加载失败，请稍后重试');
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void load(initialParams);
    // initialParams 只在挂载时生效，后续请调用 refresh(params)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  const refresh = useCallback(
    async (params?: PartnerScopeParams) => {
      await load(params);
    },
    [load]
  );

  const confirmReconciliation = useCallback(
    async (costIds: string[], note?: string | null): Promise<PartnerConfirmResult> => {
      if (!costIds || costIds.length === 0) {
        throw new Error('请选择需要确认对账的运单');
      }

      const result = await callPartnerRpc<PartnerConfirmResult>('partner_confirm_reconciliation', {
        p_cost_ids: costIds,
        p_note: note ?? null,
      });

      // 确认成功后同步刷新对账明细与概览
      await load();
      return result;
    },
    [load]
  );

  return {
    overview,
    waybills,
    statement,
    trend,
    reconciliation,
    profile,
    loading,
    error,
    refresh,
    confirmReconciliation,
  };
}

export default usePartnerScope;
