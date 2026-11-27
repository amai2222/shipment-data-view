import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  FileSpreadsheet,
  MapPin,
  Printer,
  ReceiptText,
  RefreshCw,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import {
  getProfile,
  getStatement,
  getWaybills,
  toErrorMessage,
  type PartnerProfile,
  type PartnerStatement,
  type PartnerWaybillRow,
} from '../api';
import {
  EmptyState,
  ErrorState,
  Money,
  PageHead,
  SignatureBlock,
  SkeletonCards,
  SkeletonTable,
  StatusBadge,
  daysSince,
  formatCount,
  formatDateText,
  formatMoney,
  formatQuantity,
  monthText,
  toISODate,
} from '../components/shared';

const MONTH_PAGE_SIZE = 100;
const MAX_PAGES = 3;
const NO_PROJECT = '__none__';

const projectLabel = (name: string | null): string => name || '未关联项目';

const isValidMonth = (value: string | undefined): boolean => /^\d{4}-\d{2}$/.test(String(value ?? ''));

const monthEnd = (month: string): string => {
  const [year, mon] = month.split('-').map(Number);
  return toISODate(new Date(year, mon, 0));
};

export default function StatementDetail() {
  const { month: monthParam } = useParams<{ month: string }>();
  const month = monthParam ?? '';
  const valid = isValidMonth(month);

  const [searchParams] = useSearchParams();
  const projectParam = searchParams.get('project') ?? '';

  const [statement, setStatement] = useState<PartnerStatement | null>(null);
  const [profile, setProfile] = useState<PartnerProfile | null>(null);
  const [rows, setRows] = useState<PartnerWaybillRow[]>([]);
  const [total, setTotal] = useState(0);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [project, setProject] = useState(projectParam);

  const load = useCallback(async () => {
    if (!valid) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [statementData, profileData] = await Promise.all([
        getStatement(month),
        getProfile().catch(() => null),
      ]);

      const from = `${month}-01`;
      const to = monthEnd(month);
      const first = await getWaybills({ from, to, page: 1, size: MONTH_PAGE_SIZE });

      const collected = [...first.rows];
      const pageCount = Math.min(Math.ceil(first.total / MONTH_PAGE_SIZE), MAX_PAGES);
      for (let page = 2; page <= pageCount; page += 1) {
        const next = await getWaybills({ from, to, page, size: MONTH_PAGE_SIZE });
        collected.push(...next.rows);
      }

      setStatement(statementData);
      setProfile(profileData);
      setRows(collected);
      setTotal(first.total);
      setTruncated(first.total > collected.length);
    } catch (err) {
      setStatement(null);
      setRows([]);
      setTotal(0);
      setTruncated(false);
      setError(toErrorMessage(err, '对账单明细加载失败'));
    } finally {
      setLoading(false);
    }
  }, [month, valid]);

  useEffect(() => {
    void load();
  }, [load]);

  const projects = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach((row) => {
      const key = row.project_name || NO_PROJECT;
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    return [...map.entries()].map(([key, count]) => ({ key, count }));
  }, [rows]);

  useEffect(() => {
    if (loading) return;
    if (project === '') return;
    if (!projects.some((item) => item.key === project)) setProject('');
  }, [projects, project, loading]);

  const filteredRows = project
    ? rows.filter((row) => (row.project_name || NO_PROJECT) === project)
    : rows;
  const filteredAmount = filteredRows.reduce((sum, row) => sum + (row.payable_amount || 0), 0);
  const projectTitle = project === NO_PROJECT ? '未关联项目' : project;

  const printDoc = statement ? (
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
          <p className="text-base font-semibold">
            {project ? `单月对账单 · ${projectTitle}` : '单月对账单'}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">结算期间：{monthText(month)}</p>
          <p className="text-[11px] text-muted-foreground">打印日期：{toISODate(new Date())}</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-3 text-[11px]">
        <div>
          <p className="text-muted-foreground">应付合计</p>
          <p className="mt-0.5 font-semibold tabular-nums">{formatMoney(filteredAmount)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">运单笔数</p>
          <p className="mt-0.5 font-semibold tabular-nums">{formatCount(filteredRows.length)} 笔</p>
        </div>
        <div>
          <p className="text-muted-foreground">整月运单数</p>
          <p className="mt-0.5 font-semibold tabular-nums">{formatCount(total)} 笔</p>
        </div>
      </div>

      <table className="mt-3">
        <thead>
          <tr>
            <th className="w-[34px] text-center">#</th>
            <th className="text-left">运单号</th>
            <th className="w-[76px] text-left">装货日期</th>
            <th className="text-left">项目</th>
            <th className="text-left">装卸地</th>
            <th className="w-[54px] text-right">数量</th>
            <th className="w-[92px] text-right">金额（元）</th>
            <th className="w-[58px] text-left">对账</th>
          </tr>
        </thead>
        <tbody>
          {filteredRows.length === 0 ? (
            <tr>
              <td colSpan={8} className="text-center text-muted-foreground">
                本期无运单明细
              </td>
            </tr>
          ) : (
            filteredRows.map((row, index) => (
              <tr key={row.cost_id}>
                <td className="text-center tabular-nums text-muted-foreground">{index + 1}</td>
                <td className="font-mono">{row.auto_number || '—'}</td>
                <td className="tabular-nums">{formatDateText(row.loading_date)}</td>
                <td>{projectLabel(row.project_name)}</td>
                <td>
                  {row.loading_location || '—'} → {row.unloading_location || '—'}
                </td>
                <td className="text-right tabular-nums">{formatQuantity(row.effective_quantity)}</td>
                <td className="text-right tabular-nums">{formatMoney(row.payable_amount)}</td>
                <td>{row.reconciliation_status || '—'}</td>
              </tr>
            ))
          )}
          <tr>
            <td colSpan={6} className="text-right font-semibold">
              合计
            </td>
            <td className="text-right font-semibold tabular-nums">{formatMoney(filteredAmount)}</td>
            <td />
          </tr>
        </tbody>
      </table>

      {truncated ? (
        <p className="mt-2 text-[10px] text-muted-foreground">
          注：本月运单量较大，纸质单据仅列示前 {formatCount(filteredRows.length)} 条，完整明细请以平台数据为准。
        </p>
      ) : null}

      <SignatureBlock note="说明：本对账单仅列示本企业应结算金额，不含其他主体价格与费用构成。" />
    </div>
  ) : null;

  if (!valid) {
    return (
      <div>
        <PageHead title="单月对账单" description="按月份查看逐票运单明细，并可直接打印归档。" />
        <EmptyState
          className="mt-3"
          icon={ReceiptText}
          title="月份格式不正确"
          description="请从结算单页面点击项目进入，或手动输入 yyyy-MM 格式的月份。"
          action={
            <Button variant="outline" size="sm" asChild>
              <Link to="/statement">返回结算单</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div>
      <div className="partner-screen-only">
        <div className="mb-2" data-print-hide>
          <Link
            to="/statement"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            返回结算单
          </Link>
        </div>

        <PageHead
          title={`${monthText(month)}对账单`}
          description="逐票运单明细与合计数，确认无误后可直接打印归档；打印版式已按 A4 优化。"
        >
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-[11px] text-muted-foreground">
              结算期间 {monthText(month)}
            </span>
            {truncated ? (
              <span className="text-[11px] text-muted-foreground">
                · 明细仅加载前 {formatCount(rows.length)} 条
              </span>
            ) : null}
          </div>
        </PageHead>

        <div className="flex flex-wrap items-end gap-2" data-print-hide>
          <Button variant="outline" onClick={() => window.print()} disabled={loading || !statement}>
            <Printer className="h-4 w-4" />
            打印对账单
          </Button>
          <Button variant="ghost" onClick={load} disabled={loading}>
            <RefreshCw className="h-4 w-4" />
            刷新
          </Button>
        </div>

        {loading ? (
          <div className="mt-3 space-y-4">
            <SkeletonCards count={3} className="md:grid-cols-3" />
            <SkeletonTable rows={6} />
          </div>
        ) : error ? (
          <ErrorState className="mt-3" message={error} onRetry={load} />
        ) : !statement ? (
          <EmptyState
            className="mt-3"
            icon={ReceiptText}
            title={`${monthText(month)}没有对账单`}
            description="该月份还没有生成账单，换个相邻月份看看。"
            action={
              <Button variant="outline" size="sm" asChild>
                <Link to="/statement">返回结算单</Link>
              </Button>
            }
          />
        ) : (
          <div className="mt-3 space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground">本期应付</p>
                <Money
                  value={statement.total_amount}
                  className="mt-2 block text-xl font-semibold tracking-tight"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  共 {formatCount(total)} 笔运单
                </p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground">已付款</p>
                <Money
                  value={statement.paid_amount}
                  className="mt-2 block text-xl font-semibold tracking-tight text-emerald-600 dark:text-emerald-400"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">财务已确认支付</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground">未付款</p>
                <Money
                  value={statement.unpaid_amount}
                  className="mt-2 block text-xl font-semibold tracking-tight text-destructive"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">含处理中，以对账结果为准</p>
              </div>
            </div>

            {projects.length > 1 ? (
              <div className="flex flex-wrap items-center gap-1.5" data-print-hide>
                <span className="text-[11px] text-muted-foreground">项目</span>
                <button
                  type="button"
                  onClick={() => setProject('')}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                    project === ''
                      ? 'border-primary/30 bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  全部
                </button>
                {projects.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setProject(item.key)}
                    className={cn(
                      'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                      project === item.key
                        ? 'border-primary/30 bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    {item.key === NO_PROJECT ? '未关联项目' : item.key}
                    <span className="ml-1 tabular-nums opacity-70">{formatCount(item.count)}</span>
                  </button>
                ))}
              </div>
            ) : null}

            <section className="overflow-hidden rounded-lg border border-border bg-card">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
                <div>
                  <h2 className="text-sm font-semibold">运单明细</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {project ? projectTitle : '全部项目'} · {formatCount(filteredRows.length)} 笔 · 合计{' '}
                    {formatMoney(filteredAmount)}
                  </p>
                </div>
                <ReceiptText className="h-4 w-4 text-muted-foreground" />
              </div>

              {filteredRows.length === 0 ? (
                <EmptyState
                  icon={FileSpreadsheet}
                  title="本期没有运单明细"
                  description={
                    project ? '当前项目本月没有运单，切换其他项目或返回全部查看。' : '该月份尚未产生运单。'
                  }
                  className="border-0 bg-transparent py-10"
                  action={
                    project ? (
                      <Button variant="outline" size="sm" onClick={() => setProject('')}>
                        查看全部项目
                      </Button>
                    ) : undefined
                  }
                />
              ) : (
                <>
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/40 hover:bg-muted/40">
                          <TableHead className="w-[130px]">运单号</TableHead>
                          <TableHead className="w-[100px]">装货日期</TableHead>
                          <TableHead className="w-[80px] text-right">账龄</TableHead>
                          <TableHead>装卸地</TableHead>
                          <TableHead className="w-[80px] text-right">数量</TableHead>
                          <TableHead className="w-[130px] text-right">金额</TableHead>
                          <TableHead className="w-[100px]">对账状态</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredRows.map((row) => {
                          const age = daysSince(row.loading_date);
                          return (
                            <TableRow key={row.cost_id}>
                              <TableCell className="font-mono text-xs">
                                {row.auto_number || '—'}
                              </TableCell>
                              <TableCell className="text-xs tabular-nums text-muted-foreground">
                                {formatDateText(row.loading_date)}
                              </TableCell>
                              <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                                {age === null ? '—' : `${formatCount(age)} 天`}
                              </TableCell>
                              <TableCell className="text-xs">
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3 shrink-0 text-muted-foreground" />
                                  <span className="max-w-[200px] truncate">
                                    {row.loading_location || '—'} → {row.unloading_location || '—'}
                                  </span>
                                </span>
                              </TableCell>
                              <TableCell className="text-right text-sm tabular-nums">
                                {formatQuantity(row.effective_quantity)}
                              </TableCell>
                              <TableCell className="text-right">
                                <Money value={row.payable_amount} className="text-sm font-medium" />
                              </TableCell>
                              <TableCell>
                                <StatusBadge value={row.reconciliation_status} />
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="divide-y divide-border md:hidden">
                    {filteredRows.map((row) => {
                      const age = daysSince(row.loading_date);
                      return (
                        <div key={row.cost_id} className="px-4 py-3">
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-mono text-sm font-semibold">
                              {row.auto_number || '—'}
                            </span>
                            <Money value={row.payable_amount} className="text-sm font-semibold" />
                          </div>
                          <p className="mt-1 truncate text-[11px] text-muted-foreground">
                            {row.loading_location || '—'} → {row.unloading_location || '—'}
                          </p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                            <span className="tabular-nums">{formatDateText(row.loading_date)}</span>
                            <span className="tabular-nums">
                              账龄 {age === null ? '—' : `${formatCount(age)} 天`}
                            </span>
                            <StatusBadge value={row.reconciliation_status} />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-baseline justify-between border-t border-border px-4 py-3 text-xs">
                    <span className="text-muted-foreground">
                      共 {formatCount(filteredRows.length)} 笔
                    </span>
                    <span className="flex items-baseline gap-2">
                      <span className="text-muted-foreground">合计</span>
                      <Money value={filteredAmount} className="text-sm font-semibold" />
                    </span>
                  </div>
                </>
              )}
            </section>

            {truncated ? (
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                本月运单量较大，页面仅加载前 {formatCount(rows.length)} 条，打印版同样只含已加载部分，完整数据请以平台结算单为准。
              </p>
            ) : null}
          </div>
        )}
      </div>

      {printDoc}
    </div>
  );
}
