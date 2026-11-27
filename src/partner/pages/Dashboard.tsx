import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  TrendingUp,
  Truck,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  getOverview,
  getReconciliation,
  getStatement,
  getTrend,
  toErrorMessage,
  type PartnerOverview,
  type PartnerReconciliation,
  type PartnerStatement,
  type TrendRow,
} from '../api';
import {
  DeltaTag,
  EmptyState,
  ErrorState,
  Money,
  PageHead,
  SkeletonCards,
  SkeletonChart,
  currentMonth,
  formatAmount,
  formatCount,
  monthText,
  shortMonth,
  statusMeta,
} from '../components/shared';

interface StatCard {
  label: string;
  icon: LucideIcon;
  iconClass: string;
  money: boolean;
  amount?: number;
  count?: number;
  /** 环比比值（0.12 = +12%），null 表示无法计算 */
  delta?: number | null;
}

function TrendTooltip({ active, payload, masked }: any) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload as TrendRow;

  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="font-medium text-popover-foreground">{monthText(row.month)}</p>
      {masked ? null : (
        <p className="mt-1 tabular-nums text-muted-foreground">
          结算金额 <span className="font-semibold text-foreground">¥{formatAmount(row.amount)}</span>
        </p>
      )}
      <p className="tabular-nums text-muted-foreground">
        运单 <span className="font-semibold text-foreground">{formatCount(row.count)}</span> 单
      </p>
    </div>
  );
}

const ratioOf = (current: number, previous: number): number | null =>
  previous > 0 ? (current - previous) / previous : null;

export default function Dashboard() {
  const [overview, setOverview] = useState<PartnerOverview | null>(null);
  const [trend, setTrend] = useState<TrendRow[]>([]);
  const [reconciliation, setReconciliation] = useState<PartnerReconciliation | null>(null);
  const [statement, setStatement] = useState<PartnerStatement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [overviewData, trendData] = await Promise.all([getOverview(), getTrend(6)]);
      setOverview(overviewData);
      setTrend(trendData.rows);

      // 待办信息属于增强区块，单独失败不阻断首页
      const [reconciliationResult, statementResult] = await Promise.allSettled([
        getReconciliation(currentMonth()),
        getStatement(currentMonth()),
      ]);
      setReconciliation(
        reconciliationResult.status === 'fulfilled' ? reconciliationResult.value : null,
      );
      setStatement(statementResult.status === 'fulfilled' ? statementResult.value : null);
    } catch (err) {
      setOverview(null);
      setTrend([]);
      setReconciliation(null);
      setStatement(null);
      setError(toErrorMessage(err, '概览数据加载失败'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const masked = overview ? !overview.can_view_balance : false;

  /* 近 6 个月按月份升序，取「本月」与「上月」两组计算环比 */
  const sortedTrend = [...trend].sort((a, b) => a.month.localeCompare(b.month));
  const monthKey = currentMonth();
  const currentIndex = sortedTrend.findIndex((row) => row.month.slice(0, 7) === monthKey);
  const currentRow =
    currentIndex >= 0 ? sortedTrend[currentIndex] : sortedTrend[sortedTrend.length - 1] ?? null;
  const previousRow =
    currentIndex > 0
      ? sortedTrend[currentIndex - 1]
      : currentIndex < 0 && sortedTrend.length > 1
        ? sortedTrend[sortedTrend.length - 2]
        : null;

  const amountDelta = currentRow && previousRow ? ratioOf(currentRow.amount, previousRow.amount) : null;
  const countDelta = currentRow && previousRow ? ratioOf(currentRow.count, previousRow.count) : null;

  const stats: StatCard[] = overview
    ? [
        {
          label: '总运单数',
          icon: Truck,
          iconClass: 'bg-primary/10 text-primary',
          money: false,
          count: overview.stats.waybill_count,
          delta: countDelta,
        },
        {
          label: '待结算金额',
          icon: Wallet,
          iconClass: 'bg-destructive/10 text-destructive',
          money: true,
          amount: overview.stats.unpaid_amount,
        },
        {
          label: '已结算金额',
          icon: CheckCircle2,
          iconClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
          money: true,
          amount: overview.stats.paid_amount,
        },
        {
          label: '本月金额',
          icon: ClipboardCheck,
          iconClass: 'bg-primary/10 text-primary',
          money: true,
          amount: overview.stats.month_amount,
          delta: amountDelta,
        },
      ]
    : [];

  const hasTrend = trend.some((row) => row.amount > 0 || row.count > 0);

  /* 待办：待对账笔数来自对账清单；待结算笔数由本月结算单的未付款/处理中状态汇总 */
  const unreconciledCount = reconciliation?.unreconciled_count ?? null;
  const pendingSettleCount = statement
    ? statement.by_status
        .filter((item) => {
          const tone = statusMeta(item.status).tone;
          return tone === 'red' || tone === 'amber';
        })
        .reduce((sum, item) => sum + item.count, 0)
    : null;

  return (
    <div>
      <PageHead
        title="账户概览"
        description="这里是你的合作账户首页：可以查看运单规模、待结算与已结算金额，以及近半年的结算走势。"
      >
        {overview ? (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Badge variant="outline" className="text-[11px] font-normal text-muted-foreground">
              数据范围：{overview.scope === 'tree' ? '含下级企业' : '仅本企业'}
            </Badge>
            {masked ? (
              <Badge variant="outline" className="text-[11px] font-normal text-muted-foreground">
                金额暂未授权查看
              </Badge>
            ) : null}
          </div>
        ) : null}
      </PageHead>

      {loading ? (
        <div className="space-y-4">
          <SkeletonCards />
          <div className="rounded-lg border border-border bg-card p-4">
            <Skeleton className="h-4 w-32" />
            <SkeletonChart className="mt-4" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 2 }).map((_, index) => (
              <div key={index} className="rounded-lg border border-border bg-card p-4">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="mt-3 h-5 w-12" />
              </div>
            ))}
          </div>
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : overview ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {stats.map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.label} className="rounded-lg border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs text-muted-foreground">{card.label}</p>
                    <span
                      className={cn(
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-md',
                        card.iconClass,
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                  </div>
                  <div className="mt-2 flex items-baseline gap-1">
                    {card.money ? (
                      <Money
                        value={card.amount}
                        masked={masked}
                        className="text-lg font-semibold tracking-tight md:text-2xl"
                      />
                    ) : (
                      <span className="text-lg font-semibold tabular-nums tracking-tight md:text-2xl">
                        {formatCount(card.count)}
                      </span>
                    )}
                    {!card.money ? (
                      <span className="text-xs text-muted-foreground">单</span>
                    ) : null}
                  </div>
                  {card.delta !== undefined ? (
                    <DeltaTag ratio={masked && card.money ? null : card.delta} className="mt-1.5" />
                  ) : null}
                </div>
              );
            })}
          </div>

          {/* 待办条 */}
          <section className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="grid grid-cols-2 divide-x divide-border">
              <Link
                to="/reconcile"
                className="group flex flex-col gap-1 p-3.5 transition-colors hover:bg-muted/40 md:flex-row md:items-center md:gap-3 md:p-4"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <AlertCircle className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs text-muted-foreground">待对账</span>
                  <span className="mt-0.5 flex items-baseline gap-1">
                    <span className="text-lg font-semibold tabular-nums tracking-tight">
                      {unreconciledCount === null ? '—' : formatCount(unreconciledCount)}
                    </span>
                    <span className="text-[11px] text-muted-foreground">笔</span>
                  </span>
                </span>
                <ArrowRight className="hidden h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground md:block" />
              </Link>

              <Link
                to="/statement"
                className="group flex flex-col gap-1 p-3.5 transition-colors hover:bg-muted/40 md:flex-row md:items-center md:gap-3 md:p-4"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <FileText className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs text-muted-foreground">待结算</span>
                  <span className="mt-0.5 flex items-baseline gap-1">
                    <span className="text-lg font-semibold tabular-nums tracking-tight">
                      {pendingSettleCount === null ? '—' : formatCount(pendingSettleCount)}
                    </span>
                    <span className="text-[11px] text-muted-foreground">笔</span>
                  </span>
                </span>
                <ArrowRight className="hidden h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground md:block" />
              </Link>
            </div>
            {unreconciledCount === null || pendingSettleCount === null ? (
              <p className="border-t border-border px-4 py-2 text-[11px] leading-relaxed text-muted-foreground">
                部分数据暂时无法获取，可进入对应页面查看最新状态。
              </p>
            ) : null}
          </section>

          <section className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold">近 6 个月结算走势</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">柱＝结算金额，折线＝运单单量</p>
              </div>
              <TrendingUp className="h-4 w-4 shrink-0 text-muted-foreground" />
            </div>

            {hasTrend ? (
              <>
                <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground">
                  {masked ? null : (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2.5 rounded-sm bg-primary" aria-hidden="true" />
                      结算金额
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-0.5 w-3 rounded-full bg-muted-foreground" aria-hidden="true" />
                    运单单量
                  </span>
                </div>

                <div className="mt-2 h-[240px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={sortedTrend} margin={{ top: 8, right: 6, left: 0, bottom: 0 }}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="hsl(var(--border))"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="month"
                        tickFormatter={(value: string) => shortMonth(value)}
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        dy={6}
                      />
                      {masked ? null : (
                        <YAxis
                          yAxisId="amount"
                          tickFormatter={(value: number) =>
                            value >= 10000 ? `${(value / 10000).toFixed(1)}万` : String(value)
                          }
                          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                          tickLine={false}
                          axisLine={false}
                          width={44}
                        />
                      )}
                      <YAxis
                        yAxisId="count"
                        orientation="right"
                        allowDecimals={false}
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        width={32}
                      />
                      <Tooltip
                        content={(props) => <TrendTooltip {...props} masked={masked} />}
                        cursor={{ stroke: 'hsl(var(--border))', strokeWidth: 1 }}
                      />
                      {masked ? null : (
                        <Bar
                          yAxisId="amount"
                          dataKey="amount"
                          fill="hsl(var(--primary))"
                          fillOpacity={0.75}
                          radius={[4, 4, 0, 0]}
                          maxBarSize={28}
                        />
                      )}
                      <Line
                        yAxisId="count"
                        type="monotone"
                        dataKey="count"
                        stroke="hsl(var(--muted-foreground))"
                        strokeWidth={2}
                        dot={{ r: 2.5, strokeWidth: 0, fill: 'hsl(var(--muted-foreground))' }}
                        activeDot={{ r: 4 }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </>
            ) : (
              <EmptyState
                icon={TrendingUp}
                title="暂无趋势数据"
                description="当前统计周期内还没有产生结算金额，产生账单后会自动展示。"
                className="mt-4 border-0 bg-transparent py-8"
              />
            )}
          </section>

          {reconciliation ? (
            reconciliation.unreconciled_count > 0 ? (
              <Link
                to="/reconcile"
                className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 transition-colors hover:bg-amber-500/15"
              >
                <AlertCircle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">
                    本月有 {formatCount(reconciliation.unreconciled_count)} 笔运单待对账
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {masked
                      ? '请前往对账页核对明细并确认。'
                      : `涉及金额 ¥${formatAmount(reconciliation.unreconciled_amount)}，请核对后确认。`}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            ) : (
              <div className="flex items-center gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <p className="text-sm text-foreground">本月运单已全部确认对账，无需处理。</p>
              </div>
            )
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
