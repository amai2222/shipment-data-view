import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronRight,
  Download,
  FileSpreadsheet,
  Gauge,
  Printer,
  RefreshCw,
  Wallet,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  getProfile,
  getReconciliation,
  getStatement,
  toErrorMessage,
  type PartnerProfile,
  type PartnerStatement,
  type ReconciliationRow,
  type StatementGroup,
} from '../api';
import {
  buildAgingBuckets,
  DeltaTag,
  downloadCsv,
  EmptyState,
  ErrorState,
  InlineError,
  Money,
  PageHead,
  SkeletonCards,
  SkeletonTable,
  SignatureBlock,
  StatusBadge,
  currentMonth,
  formatCount,
  formatMoney,
  monthText,
  shiftMonth,
  statusBarClass,
  toISODate,
} from '../components/shared';

/** 账龄回溯的月份数：覆盖 0-30 / 31-60 / 61-90 / 90+ 四桶 */
const AGING_MONTHS = 4;

/** 未关联项目在链接参数中的占位值，与详情页约定一致 */
const NO_PROJECT = '__none__';

const projectKey = (name: string | null): string => name ?? '__none__';

export default function Statement() {
  const [month, setMonth] = useState(() => currentMonth());
  const [data, setData] = useState<PartnerStatement | null>(null);
  const [prev, setPrev] = useState<PartnerStatement | null>(null);
  const [prevMissing, setPrevMissing] = useState(false);
  const [profile, setProfile] = useState<PartnerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const [agingRows, setAgingRows] = useState<ReconciliationRow[] | null>(null);
  const [agingLoading, setAgingLoading] = useState(true);
  const [agingError, setAgingError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setExportError(null);
    setPrevMissing(false);

    try {
      const [current, previous, profileData] = await Promise.all([
        getStatement(month),
        getStatement(shiftMonth(month, -1)).catch(() => null),
        getProfile().catch(() => null),
      ]);
      setData(current);
      setPrev(previous);
      setPrevMissing(previous === null);
      setProfile(profileData);
    } catch (err) {
      setData(null);
      setPrev(null);
      setProfile(null);
      setError(toErrorMessage(err, '结算单加载失败'));
    } finally {
      setLoading(false);
    }
  }, [month]);

  const loadAging = useCallback(async () => {
    setAgingLoading(true);
    setAgingError(null);
    try {
      const months = Array.from({ length: AGING_MONTHS }).map((_, index) =>
        shiftMonth(month, -index),
      );
      const pages = await Promise.all(months.map((item) => getReconciliation(item)));
      const seen = new Set<string>();
      const rows: ReconciliationRow[] = [];
      pages.forEach((page) => {
        page.rows.forEach((row) => {
          if (seen.has(row.cost_id)) return;
          seen.add(row.cost_id);
          rows.push(row);
        });
      });
      setAgingRows(rows);
    } catch (err) {
      setAgingRows(null);
      setAgingError(toErrorMessage(err, '账龄数据加载失败'));
    } finally {
      setAgingLoading(false);
    }
  }, [month]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadAging();
  }, [loadAging]);

  const groups = data?.groups ?? [];
  const statuses = data?.by_status ?? [];
  const totalCount = groups.reduce((sum, group) => sum + group.count, 0);
  const totalAmount = data?.total_amount ?? 0;

  const prevAmountMap = useMemo(() => {
    const map = new Map<string, number>();
    (prev?.groups ?? []).forEach((group) => map.set(projectKey(group.project_name), group.amount));
    return map;
  }, [prev]);

  const momOf = (group: StatementGroup): number | 'new' | null => {
    if (prevMissing) return null;
    const base = prevAmountMap.get(projectKey(group.project_name));
    if (base === undefined) return 'new';
    if (base <= 0) return null;
    return (group.amount - base) / base;
  };

  const totalDelta =
    !prevMissing && prev && prev.total_amount > 0
      ? (totalAmount - prev.total_amount) / prev.total_amount
      : null;

  const buckets = useMemo(() => (agingRows ? buildAgingBuckets(agingRows) : []), [agingRows]);
  const agingCount = buckets.reduce((sum, bucket) => sum + bucket.count, 0);
  const agingAmount = buckets.reduce((sum, bucket) => sum + bucket.amount, 0);
  const agingMax = buckets.reduce((max, bucket) => Math.max(max, bucket.amount), 0);

  /** 单月对账单详情入口，带上项目以便详情页预筛选 */
  const detailHref = (projectName: string | null): string =>
    `/statement/${data?.month ?? month}?project=${encodeURIComponent(projectName ?? NO_PROJECT)}`;

  const exportCsv = () => {    if (!data) return;
    setExportError(null);

    try {
      const rows: Array<Array<string | number>> = [
        ['账单月份', monthText(data.month)],
        [],
        ['项目', '运单笔数', '金额(元)', '上月金额(元)', '环比', '占比'],
      ];

      groups.forEach((group) => {
        const share = totalAmount > 0 ? (group.amount / totalAmount) * 100 : 0;
        const mom = momOf(group);
        rows.push([
          group.project_name || '未关联项目',
          group.count,
          group.amount.toFixed(2),
          prevAmountMap.get(projectKey(group.project_name))?.toFixed(2) ?? '',
          mom === 'new' ? '新增' : mom === null ? '' : `${(mom * 100).toFixed(1)}%`,
          `${share.toFixed(1)}%`,
        ]);
      });

      rows.push(['合计', totalCount, totalAmount.toFixed(2), '', '', '100%']);
      rows.push([]);
      rows.push(['付款状态', '笔数', '金额(元)']);
      statuses.forEach((item) => {
        rows.push([item.status || '未知', item.count, item.amount.toFixed(2)]);
      });

      downloadCsv(`对账单_${data.month || month}.csv`, rows);
    } catch {
      setExportError('导出失败，请稍后重试或联系平台客服。');
    }
  };

  const printDoc = data ? (
    <div className="partner-print-doc partner-print-page">
      <div className="flex items-start justify-between gap-6 border-b-2 border-foreground pb-3">
        <div>
          <p className="text-lg font-semibold">
            {profile?.partner.full_name || profile?.partner.name || '合作方'}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            纳税人识别号：{profile?.partner.tax_number || '—'}
          </p>
        </div>
        <div className="text-right">
          <p className="text-base font-semibold">月度对账单</p>
          <p className="mt-1 text-[11px] text-muted-foreground">结算期间：{monthText(data.month)}</p>
          <p className="text-[11px] text-muted-foreground">打印日期：{toISODate(new Date())}</p>
        </div>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        本单仅列示本企业应结算金额，不含其他主体价格与费用构成。
      </p>

      <table className="mt-3">
        <thead>
          <tr>
            <th className="text-left">项目</th>
            <th className="w-[70px] text-right">运单笔数</th>
            <th className="w-[110px] text-right">金额（元）</th>
            <th className="w-[70px] text-right">占比</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group, index) => {
            const share = totalAmount > 0 ? (group.amount / totalAmount) * 100 : 0;
            return (
              <tr key={`${projectKey(group.project_name)}-${index}`}>
                <td>{group.project_name || '未关联项目'}</td>
                <td className="text-right tabular-nums">{formatCount(group.count)}</td>
                <td className="text-right tabular-nums">{formatMoney(group.amount)}</td>
                <td className="text-right tabular-nums">{share.toFixed(1)}%</td>
              </tr>
            );
          })}
          <tr>
            <td className="font-semibold">合计</td>
            <td className="text-right font-semibold tabular-nums">{formatCount(totalCount)}</td>
            <td className="text-right font-semibold tabular-nums">{formatMoney(totalAmount)}</td>
            <td className="text-right font-semibold tabular-nums">100.0%</td>
          </tr>
        </tbody>
      </table>

      <table className="mt-4">
        <thead>
          <tr>
            <th className="text-left">付款状态</th>
            <th className="w-[80px] text-right">笔数</th>
            <th className="w-[110px] text-right">金额（元）</th>
          </tr>
        </thead>
        <tbody>
          {statuses.length === 0 ? (
            <tr>
              <td colSpan={3} className="text-center text-muted-foreground">
                本月无状态数据
              </td>
            </tr>
          ) : (
            statuses.map((item, index) => (
              <tr key={`${item.status ?? 'unknown'}-${index}`}>
                <td>{item.status || '未知'}</td>
                <td className="text-right tabular-nums">{formatCount(item.count)}</td>
                <td className="text-right tabular-nums">{formatMoney(item.amount)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <SignatureBlock note="说明：本对账单以平台账单数据为准，如有异议请在收到后 5 个工作日内联系业务经办人核对。" />
    </div>
  ) : null;

  return (
    <div>
      <div className="partner-screen-only">
        <PageHead
          title="月度结算单"
          description="选择账单月份，查看按项目汇总的结算金额与付款进度；可导出 CSV 或打印纸质对账单。"
        />

        <div className="flex flex-wrap items-end gap-2" data-print-hide>
          <label className="space-y-1">
            <span className="text-[11px] text-muted-foreground">账单月份</span>
            <Input
              type="month"
              value={month}
              onChange={(event) => {
                if (event.target.value) setMonth(event.target.value);
              }}
              className="w-[170px]"
            />
          </label>
          <Button
            variant="outline"
            onClick={exportCsv}
            disabled={loading || !data || groups.length === 0}
          >
            <Download className="h-4 w-4" />
            导出 CSV
          </Button>
          <Button
            variant="outline"
            onClick={() => window.print()}
            disabled={loading || !data || groups.length === 0}
          >
            <Printer className="h-4 w-4" />
            打印对账单
          </Button>
        </div>

        <div className="mt-2">
          <InlineError message={exportError} />
        </div>

        {loading ? (
          <div className="mt-3 space-y-4">
            <SkeletonCards count={3} className="md:grid-cols-3" />
            <SkeletonTable rows={4} />
            <SkeletonTable rows={4} />
          </div>
        ) : error ? (
          <ErrorState className="mt-3" message={error} onRetry={load} />
        ) : !data || (groups.length === 0 && statuses.length === 0) ? (
          <EmptyState
            className="mt-3"
            icon={FileSpreadsheet}
            title={`${monthText(month)}没有结算数据`}
            description="该月份还没有生成的账单，换个相邻月份看看。"
          />
        ) : (
          <div className="mt-3 space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground">应付合计</p>
                <Money
                  value={data.total_amount}
                  className="mt-2 block text-xl font-semibold tracking-tight"
                />
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                  <span>共 {formatCount(totalCount)} 笔运单</span>
                  {prevMissing ? null : <DeltaTag ratio={totalDelta} suffix="较上月" />}
                </div>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground">已付款</p>
                <Money
                  value={data.paid_amount}
                  className="mt-2 block text-xl font-semibold tracking-tight text-emerald-600 dark:text-emerald-400"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">财务已确认支付</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground">未付款</p>
                <Money
                  value={data.unpaid_amount}
                  className="mt-2 block text-xl font-semibold tracking-tight text-destructive"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  差额部分为处理中，未计入两端
                </p>
              </div>
            </div>

            <section className="overflow-hidden rounded-lg border border-border bg-card">
              <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
                <div>
                  <h2 className="text-sm font-semibold">按项目汇总</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {monthText(data.month)}
                    {prevMissing ? ' · 上月数据暂不可用，环比留空' : ''}
                  </p>
                </div>
                <Wallet className="h-4 w-4 text-muted-foreground" />
              </div>

              {groups.length === 0 ? (
                <p className="px-4 py-8 text-center text-xs text-muted-foreground">
                  本月没有按项目汇总的数据。
                </p>
              ) : (
                <>
                  <div className="hidden md:block">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                          <th className="px-4 py-2.5 text-left font-medium">项目</th>
                          <th className="w-[90px] px-4 py-2.5 text-right font-medium">笔数</th>
                          <th className="w-[140px] px-4 py-2.5 text-right font-medium">金额</th>
                          <th className="w-[130px] px-4 py-2.5 text-right font-medium">环比</th>
                          <th className="w-[80px] px-4 py-2.5 text-right font-medium">占比</th>
                          <th className="w-10" />
                        </tr>
                      </thead>
                      <tbody>
                        {groups.map((group, index) => {
                          const share = totalAmount > 0 ? (group.amount / totalAmount) * 100 : 0;
                          const mom = momOf(group);
                          return (
                            <tr
                              key={`${projectKey(group.project_name)}-${index}`}
                              className="border-b border-border transition-colors last:border-0 hover:bg-muted/40"
                            >
                              <td className="max-w-0 px-4 py-3">
                                <Link
                                  to={detailHref(group.project_name)}
                                  className="block truncate underline-offset-4 hover:text-primary hover:underline"
                                >
                                  {group.project_name || '未关联项目'}
                                </Link>
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                                {formatCount(group.count)}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <Money value={group.amount} className="font-medium" />
                              </td>
                              <td className="px-4 py-3 text-right">
                                {mom === 'new' ? (
                                  <span className="text-[11px] text-primary">新增</span>
                                ) : (
                                  <DeltaTag ratio={mom} suffix={null} />
                                )}
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums text-xs text-muted-foreground">
                                {share.toFixed(1)}%
                              </td>
                              <td className="px-4 py-3">
                                <Link
                                  to={detailHref(group.project_name)}
                                  aria-label={`查看${group.project_name || '未关联项目'}的单月对账单`}
                                  className="text-muted-foreground hover:text-foreground"
                                >
                                  <ChevronRight className="h-4 w-4" />
                                </Link>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="divide-y divide-border md:hidden">
                    {groups.map((group, index) => {
                      const share = totalAmount > 0 ? (group.amount / totalAmount) * 100 : 0;
                      const mom = momOf(group);
                      return (
                        <Link
                          key={`${projectKey(group.project_name)}-${index}`}
                          to={detailHref(group.project_name)}
                          className="block px-4 py-3 transition-colors active:bg-muted/60"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <p className="min-w-0 flex-1 truncate text-sm">
                              {group.project_name || '未关联项目'}
                            </p>
                            <Money value={group.amount} className="text-sm font-semibold" />
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                            <span className="tabular-nums">{formatCount(group.count)} 笔</span>
                            <span className="tabular-nums">占比 {share.toFixed(1)}%</span>
                            {mom === 'new' ? (
                              <span className="text-primary">新增</span>
                            ) : (
                              <DeltaTag ratio={mom} suffix={null} />
                            )}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </>
              )}

              <p className="border-t border-border px-4 py-2.5 text-[11px] text-muted-foreground">
                点击任意项目可查看该月的逐票对账单并打印。
              </p>
            </section>

            <section className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold">账龄分析</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    近 {AGING_MONTHS} 个月未对账运单，按装货日期距今天数分桶
                  </p>
                </div>
                <Gauge className="h-4 w-4 shrink-0 text-muted-foreground" />
              </div>

              {agingLoading ? (
                <div className="mt-4 space-y-3">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Skeleton className="h-3 w-16" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                      <Skeleton className="h-2.5 w-full" />
                    </div>
                  ))}
                </div>
              ) : agingError ? (
                <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
                  <p className="text-xs leading-relaxed text-destructive">{agingError}</p>
                  <Button variant="outline" size="sm" className="mt-2" onClick={loadAging}>
                    <RefreshCw className="h-3.5 w-3.5" />
                    重试
                  </Button>
                </div>
              ) : agingCount === 0 ? (
                <EmptyState
                  icon={Gauge}
                  title="暂无未对账运单"
                  description="近几个月没有待对账运单，账龄分布为空。"
                  className="mt-4 border-0 bg-transparent py-8"
                />
              ) : (
                <div className="mt-4 space-y-4">
                  {buckets.map((bucket) => {
                    const share = agingAmount > 0 ? (bucket.amount / agingAmount) * 100 : 0;
                    const width = agingMax > 0 ? (bucket.amount / agingMax) * 100 : 0;
                    return (
                      <div key={bucket.key} className="space-y-1.5">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <span className="font-medium text-foreground">{bucket.label}</span>
                          <span className="flex items-baseline gap-2 tabular-nums text-muted-foreground">
                            <span>{formatCount(bucket.count)} 笔</span>
                            <Money value={bucket.amount} className="text-xs font-medium text-foreground" />
                            <span className="w-11 text-right text-[11px]">{share.toFixed(1)}%</span>
                          </span>
                        </div>
                        <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn(
                              'h-full rounded-full',
                              bucket.key === 'd90_plus' && bucket.amount > 0
                                ? 'bg-destructive'
                                : 'bg-primary',
                            )}
                            style={{ width: bucket.amount > 0 ? `${Math.max(width, 2)}%` : '0%' }}
                          />
                        </div>
                      </div>
                    );
                  })}

                  <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-border pt-3 text-xs">
                    <span className="text-muted-foreground">
                      未对账 {formatCount(agingCount)} 笔 · 超 90 天占比{' '}
                      {agingAmount > 0
                        ? `${(((buckets.find((item) => item.key === 'd90_plus')?.amount ?? 0) / agingAmount) * 100).toFixed(1)}%`
                        : '0.0%'}
                    </span>
                    <span className="flex items-baseline gap-2">
                      <span className="text-muted-foreground">合计</span>
                      <Money value={agingAmount} className="font-semibold text-foreground" />
                    </span>
                  </div>
                </div>
              )}
            </section>

            <section className="rounded-lg border border-border bg-card p-4">
              <h2 className="text-sm font-semibold">付款状态分布</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">各状态金额占本月应付合计的比例</p>

              {statuses.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted-foreground">本月没有状态数据。</p>
              ) : (
                <div className="mt-4 space-y-4">
                  {statuses.map((item, index) => {
                    const share = totalAmount > 0 ? (item.amount / totalAmount) * 100 : 0;
                    return (
                      <div key={`${item.status ?? 'unknown'}-${index}`} className="space-y-1.5">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <span className="flex items-center gap-2">
                            <StatusBadge value={item.status} />
                            <span className="tabular-nums text-muted-foreground">
                              {formatCount(item.count)} 笔
                            </span>
                          </span>
                          <span className="flex items-baseline gap-2">
                            <Money value={item.amount} className="text-xs font-medium" />
                            <span className="w-12 text-right tabular-nums text-[11px] text-muted-foreground">
                              {share.toFixed(1)}%
                            </span>
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn('h-full rounded-full', statusBarClass(item.status))}
                            style={{ width: share > 0 ? `${Math.max(share, 2)}%` : '0%' }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
                CSV 金额单位：元；数值已按 2 位小数输出，可直接用于财务核对。
              </p>
            </section>
          </div>
        )}
      </div>

      {printDoc}
    </div>
  );
}
