import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  MapPin,
  PackageSearch,
  Search,
  X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  getWaybills,
  toErrorMessage,
  type PartnerWaybillPage,
  type PartnerWaybillRow,
} from '../api';
import {
  downloadCsv,
  EmptyState,
  ErrorState,
  Field,
  InlineError,
  Money,
  PageHead,
  SkeletonRows,
  StatusBadge,
  daysAgoISO,
  daysSince,
  formatCount,
  formatDateText,
  formatQuantity,
  monthText,
  statusMeta,
  toISODate,
} from '../components/shared';

const PAGE_SIZE = 20;
const STATUS_OPTIONS = ['全部状态', '未付款', '处理中', '已付款'];
const ALL_PROJECTS = '__all__';
const NO_PROJECT = '__none__';

const projectLabel = (name: string | null): string => name || '未关联项目';

/** 账龄配色：60 天内弱化，61-90 天加粗，超 90 天标红提示风险 */
function agingClass(days: number | null): string {
  if (days === null) return 'text-muted-foreground';
  if (days > 90) return 'text-destructive font-medium';
  if (days > 60) return 'text-foreground';
  return 'text-muted-foreground';
}

export default function Waybills() {
  const [from, setFrom] = useState(() => daysAgoISO(29));
  const [to, setTo] = useState(() => toISODate(new Date()));
  const [keywordInput, setKeywordInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState(STATUS_OPTIONS[0]);
  const [projectFilter, setProjectFilter] = useState(ALL_PROJECTS);
  const [page, setPage] = useState(1);

  const [data, setData] = useState<PartnerWaybillPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<PartnerWaybillRow | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [exportError, setExportError] = useState<string | null>(null);

  const requestId = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);

    try {
      const result = await getWaybills({
        from: from || null,
        to: to || null,
        page,
        size: PAGE_SIZE,
        keyword: keyword || null,
      });
      if (id !== requestId.current) return;
      setData(result);
      // 只保留当前页仍存在的勾选项，避免导出到不可见的数据
      setPicked((prev) => {
        if (prev.size === 0) return prev;
        const ids = new Set(result.rows.map((row) => row.cost_id));
        const next = new Set([...prev].filter((costId) => ids.has(costId)));
        return next.size === prev.size ? prev : next;
      });
    } catch (err) {
      if (id !== requestId.current) return;
      setData(null);
      setPicked(new Set());
      setError(toErrorMessage(err, '运单列表加载失败'));
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [from, to, page, keyword]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = data?.rows ?? [];

  /* 项目快捷筛选：从当前页数据聚合，随翻页自动更新 */
  const projects = useMemo(() => {
    const map = new Map<string, number>();
    (data?.rows ?? []).forEach((row) => {
      const key = row.project_name || NO_PROJECT;
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    return [...map.entries()].map(([key, count]) => ({ key, count }));
  }, [data]);

  useEffect(() => {
    if (projectFilter === ALL_PROJECTS) return;
    if (!projects.some((item) => item.key === projectFilter)) setProjectFilter(ALL_PROJECTS);
  }, [projects, projectFilter]);

  const statusRows =
    statusFilter === STATUS_OPTIONS[0]
      ? rows
      : rows.filter((row) => statusMeta(row.payment_status).label === statusFilter);

  const visibleRows =
    projectFilter === ALL_PROJECTS
      ? statusRows
      : statusRows.filter((row) => (row.project_name || NO_PROJECT) === projectFilter);

  const visibleAmount = visibleRows.reduce((sum, row) => sum + (row.payable_amount || 0), 0);
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const pickedRows = visibleRows.filter((row) => picked.has(row.cost_id));
  const allPicked = visibleRows.length > 0 && visibleRows.every((row) => picked.has(row.cost_id));
  const somePicked = !allPicked && pickedRows.length > 0;

  const togglePick = (costId: string) => {
    setExportError(null);
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(costId)) next.delete(costId);
      else next.add(costId);
      return next;
    });
  };

  const togglePickAll = () => {
    setExportError(null);
    if (allPicked) {
      setPicked((prev) => {
        const next = new Set(prev);
        visibleRows.forEach((row) => next.delete(row.cost_id));
        return next;
      });
      return;
    }
    setPicked((prev) => {
      const next = new Set(prev);
      visibleRows.forEach((row) => next.add(row.cost_id));
      return next;
    });
  };

  const exportSelected = () => {
    setExportError(null);
    if (pickedRows.length === 0) {
      setExportError('请先勾选需要导出的运单。');
      return;
    }

    try {
      const header = [
        '运单号',
        '项目',
        '装货日期',
        '账龄(天)',
        '装货地',
        '卸货地',
        '车牌号',
        '有效数量',
        '结算金额(元)',
        '付款状态',
        '对账状态',
      ];
      const body = pickedRows.map((row) => [
        row.auto_number ?? '',
        projectLabel(row.project_name),
        formatDateText(row.loading_date),
        daysSince(row.loading_date) ?? '',
        row.loading_location ?? '',
        row.unloading_location ?? '',
        row.license_plate ?? '',
        row.effective_quantity ?? '',
        (row.payable_amount || 0).toFixed(2),
        statusMeta(row.payment_status).label,
        statusMeta(row.reconciliation_status).label,
      ]);
      downloadCsv(`运单明细_${from || '全部'}_${to || '全部'}.csv`, [header, ...body]);
    } catch {
      setExportError('导出失败，请稍后重试。');
    }
  };

  const applyKeyword = () => {
    setPage(1);
    setKeyword(keywordInput.trim());
  };

  const resetFilters = () => {
    setFrom(daysAgoISO(29));
    setTo(toISODate(new Date()));
    setKeywordInput('');
    setKeyword('');
    setStatusFilter(STATUS_OPTIONS[0]);
    setProjectFilter(ALL_PROJECTS);
    setPage(1);
    setPicked(new Set());
    setExportError(null);
  };

  return (
    <div>
      <PageHead
        title="我的运单"
        description="按日期区间查询你名下的运单明细，点击任意一条可以查看装卸地、数量与结算金额等完整信息。"
      />

      <div className="rounded-lg border border-border bg-card p-3 md:p-4">
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-[11px] text-muted-foreground">开始日期</span>
            <Input
              type="date"
              value={from}
              max={to || undefined}
              onChange={(event) => {
                setFrom(event.target.value);
                setPage(1);
              }}
            />
          </label>
          <label className="space-y-1">
            <span className="text-[11px] text-muted-foreground">结束日期</span>
            <Input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(event) => {
                setTo(event.target.value);
                setPage(1);
              }}
            />
          </label>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-[160px_minmax(0,1fr)_auto]">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger aria-label="付款状态筛选">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="col-span-2 md:col-span-1">
            <Input
              placeholder="运单号 / 项目 / 车牌号"
              value={keywordInput}
              onChange={(event) => setKeywordInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') applyKeyword();
              }}
            />
          </div>

          <div className="col-span-2 flex gap-2 md:col-span-1">
            <Button className="flex-1 md:flex-none" onClick={applyKeyword}>
              <Search className="h-4 w-4" />
              查询
            </Button>
            <Button variant="ghost" onClick={resetFilters}>
              重置
            </Button>
          </div>
        </div>

        {projects.length > 1 ? (
          <div className="mt-3 space-y-1.5">
            <p className="text-[11px] text-muted-foreground">按项目筛选（当前页）</p>
            <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
              <button
                type="button"
                onClick={() => setProjectFilter(ALL_PROJECTS)}
                className={cn(
                  'shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                  projectFilter === ALL_PROJECTS
                    ? 'border-primary/30 bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                全部项目
              </button>
              {projects.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setProjectFilter(item.key)}
                  className={cn(
                    'shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                    projectFilter === item.key
                      ? 'border-primary/30 bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  {item.key === NO_PROJECT ? '未关联项目' : item.key}
                  <span className="ml-1 tabular-nums opacity-70">{formatCount(item.count)}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          状态与项目筛选仅作用于当前页已加载的运单；翻页或修改日期后重新统计。
        </p>
      </div>

      {loading ? (
        <SkeletonRows count={6} className="mt-3" />
      ) : error ? (
        <ErrorState className="mt-3" message={error} onRetry={load} />
      ) : visibleRows.length === 0 ? (
        <EmptyState
          className="mt-3"
          icon={PackageSearch}
          title={total > 0 ? '当前页没有符合筛选的运单' : '这个区间没有运单'}
          description={
            total > 0
              ? '把筛选条件切回「全部状态 / 全部项目」，或翻到其他页继续查看。'
              : '试试扩大日期区间，或换一个关键词重新查询。'
          }
          action={
            <Button variant="outline" size="sm" onClick={resetFilters}>
              清空筛选条件
            </Button>
          }
        />
      ) : (
        <>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs text-muted-foreground">
            <span>
              共 {formatCount(total)} 条
              {visibleRows.length !== rows.length
                ? ` · 本页筛选后 ${formatCount(visibleRows.length)} 条`
                : ''}
              · 本页结算金额合计{' '}
              <Money value={visibleAmount} className="font-semibold text-foreground" />
            </span>
            <span className="flex items-center gap-2">
              {pickedRows.length > 0 ? (
                <>
                  <span className="tabular-nums">已选 {formatCount(pickedRows.length)} 笔</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-[11px]"
                    onClick={() => setPicked(new Set())}
                  >
                    <X className="h-3.5 w-3.5" />
                    清空
                  </Button>
                </>
              ) : null}
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                disabled={pickedRows.length === 0}
                onClick={exportSelected}
              >
                <Download className="h-3.5 w-3.5" />
                导出选中行 CSV
              </Button>
            </span>
          </div>

          <div className="mt-1">
            <InlineError message={exportError} />
          </div>

          {/* 桌面：表格 */}
          <div className="mt-2 hidden overflow-x-auto rounded-lg border border-border bg-card md:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allPicked ? true : somePicked ? 'indeterminate' : false}
                      onCheckedChange={togglePickAll}
                      aria-label="全选当前页运单"
                    />
                  </TableHead>
                  <TableHead className="w-[140px]">运单号</TableHead>
                  <TableHead className="min-w-[120px]">项目</TableHead>
                  <TableHead className="min-w-[170px]">装卸地</TableHead>
                  <TableHead className="w-[105px]">装货日期</TableHead>
                  <TableHead className="w-[80px] text-right">账龄</TableHead>
                  <TableHead className="w-[80px] text-right">数量</TableHead>
                  <TableHead className="w-[130px] text-right">我的结算金额</TableHead>
                  <TableHead className="w-[105px]">付款状态</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRows.map((row) => {
                  const age = daysSince(row.loading_date);
                  return (
                    <TableRow
                      key={row.cost_id}
                      className="cursor-pointer"
                      data-state={picked.has(row.cost_id) ? 'selected' : undefined}
                      onClick={() => setSelected(row)}
                    >
                      <TableCell onClick={(event) => event.stopPropagation()}>
                        <Checkbox
                          checked={picked.has(row.cost_id)}
                          onCheckedChange={() => togglePick(row.cost_id)}
                          aria-label={`勾选运单 ${row.auto_number ?? ''}`}
                        />
                      </TableCell>
                      <TableCell>
                        <button
                          type="button"
                          className="font-mono text-xs font-semibold text-foreground underline-offset-4 hover:text-primary hover:underline"
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelected(row);
                          }}
                        >
                          {row.auto_number || '—'}
                        </button>
                      </TableCell>
                      <TableCell className="max-w-[160px] truncate text-sm">
                        {projectLabel(row.project_name)}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-0.5 text-xs">
                          <p className="flex items-center gap-1 text-foreground">
                            <MapPin className="h-3 w-3 shrink-0 text-muted-foreground" />
                            <span className="max-w-[150px] truncate">
                              {row.loading_location || '—'}
                            </span>
                          </p>
                          <p className="flex items-center gap-1 text-muted-foreground">
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span className="max-w-[150px] truncate">
                              {row.unloading_location || '—'}
                            </span>
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs tabular-nums text-muted-foreground">
                        {formatDateText(row.loading_date)}
                      </TableCell>
                      <TableCell
                        className={cn('text-right text-xs tabular-nums', agingClass(age))}
                      >
                        {age === null ? '—' : `${formatCount(age)} 天`}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {formatQuantity(row.effective_quantity)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Money value={row.payable_amount} className="text-sm font-semibold" />
                      </TableCell>
                      <TableCell>
                        <StatusBadge value={row.payment_status} />
                      </TableCell>
                      <TableCell>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* 移动：卡片列表 */}
          <div className="mt-2 space-y-2 md:hidden">
            {visibleRows.map((row) => {
              const age = daysSince(row.loading_date);
              return (
                <div
                  key={row.cost_id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelected(row)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelected(row);
                    }
                  }}
                  className="w-full rounded-lg border border-border bg-card p-3.5 text-left transition-colors active:bg-muted/60"
                >
                  <div className="flex items-start gap-3">
                    <span
                      className="mt-0.5"
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                    >
                      <Checkbox
                        checked={picked.has(row.cost_id)}
                        onCheckedChange={() => togglePick(row.cost_id)}
                        aria-label={`勾选运单 ${row.auto_number ?? ''}`}
                      />
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-mono text-sm font-semibold">
                          {row.auto_number || '—'}
                        </span>
                        <StatusBadge value={row.payment_status} />
                      </div>

                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {projectLabel(row.project_name)}
                      </p>

                      <div className="mt-2.5 space-y-1.5">
                        <div className="flex items-start gap-1.5 text-xs">
                          <span className="mt-px inline-flex h-4 w-4 shrink-0 items-center justify-center rounded bg-primary/10 text-[10px] font-medium text-primary">
                            装
                          </span>
                          <span className="min-w-0 flex-1 truncate">
                            {row.loading_location || '—'}
                          </span>
                        </div>
                        <div className="flex items-start gap-1.5 text-xs">
                          <span className="mt-px inline-flex h-4 w-4 shrink-0 items-center justify-center rounded bg-muted text-[10px] font-medium text-muted-foreground">
                            卸
                          </span>
                          <span className="min-w-0 flex-1 truncate">
                            {row.unloading_location || '—'}
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 flex items-end justify-between gap-2 border-t border-border pt-2.5">
                        <span className="flex flex-col gap-0.5 text-[11px] tabular-nums text-muted-foreground">
                          <span>
                            {formatDateText(row.loading_date)}
                            {row.effective_quantity !== null
                              ? ` · ${formatQuantity(row.effective_quantity)}`
                              : ''}
                          </span>
                          <span className={cn('flex items-center gap-1', agingClass(age))}>
                            账龄 {age === null ? '—' : `${formatCount(age)} 天`}
                          </span>
                        </span>
                        <span className="text-right">
                          <span className="block text-[10px] text-muted-foreground">结算金额</span>
                          <Money value={row.payable_amount} className="text-base font-semibold" />
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              共 {formatCount(total)} 条 · 第 {page} / {totalPages} 页
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || loading}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
                上一页
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              >
                下一页
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}

      <Drawer
        open={!!selected}
        shouldScaleBackground={false}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DrawerContent className="max-h-[88vh]">
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 overflow-y-auto px-4">
              <DrawerHeader className="px-0 pb-2 pt-1 text-left">
                <DrawerTitle className="font-mono text-base">
                  {selected?.auto_number || '运单详情'}
                </DrawerTitle>
                <DrawerDescription>
                  {projectLabel(selected?.project_name ?? null)} ·{' '}
                  {formatDateText(selected?.loading_date)}
                </DrawerDescription>
              </DrawerHeader>

              {selected ? (
                <div className="pb-4">
                  <div className="rounded-lg border border-border bg-muted/40 p-4">
                    <p className="text-xs text-muted-foreground">我的结算金额</p>
                    <Money
                      value={selected.payable_amount}
                      className="mt-1 block text-2xl font-semibold tracking-tight"
                    />
                    <div className="mt-3 flex flex-wrap gap-2">
                      <StatusBadge value={selected.payment_status} />
                      <StatusBadge value={selected.invoice_status} />
                      <StatusBadge value={selected.reconciliation_status} />
                    </div>
                  </div>

                  <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4">
                    <Field label="运单号" className="col-span-2">
                      <span className="font-mono text-xs">{selected.auto_number || '—'}</span>
                    </Field>
                    <Field label="所属项目" className="col-span-2">
                      {selected.project_name}
                    </Field>
                    <Field label="装货日期">{formatDateText(selected.loading_date)}</Field>
                    <Field label="账龄">
                      {(() => {
                        const age = daysSince(selected.loading_date);
                        return age === null ? null : `${formatCount(age)} 天`;
                      })()}
                    </Field>
                    <Field label="账单月份">
                      {selected.bill_month ? monthText(selected.bill_month) : null}
                    </Field>
                    <Field label="装货地" className="col-span-2">
                      {selected.loading_location}
                    </Field>
                    <Field label="卸货地" className="col-span-2">
                      {selected.unloading_location}
                    </Field>
                    <Field label="车牌号">{selected.license_plate}</Field>
                    <Field label="有效数量">{formatQuantity(selected.effective_quantity)}</Field>
                    <Field label="付款状态">
                      <StatusBadge value={selected.payment_status} />
                    </Field>
                    <Field label="开票状态">
                      <StatusBadge value={selected.invoice_status} />
                    </Field>
                    <Field label="对账状态">
                      <StatusBadge value={selected.reconciliation_status} />
                    </Field>
                    <Field label="结算方式 ID">
                      <span className="break-all font-mono text-[11px] text-muted-foreground">
                        {selected.billing_type_id}
                      </span>
                    </Field>
                    <Field label="运单记录 ID" className="col-span-2">
                      <span className="break-all font-mono text-[11px] text-muted-foreground">
                        {selected.record_id}
                      </span>
                    </Field>
                  </dl>
                </div>
              ) : null}
            </div>

            <DrawerFooter className="border-t border-border">
              <Button variant="outline" onClick={() => setSelected(null)}>
                关闭
              </Button>
            </DrawerFooter>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
