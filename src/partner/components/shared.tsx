import type { ReactNode } from 'react';
import { AlertTriangle, RefreshCw, type LucideIcon } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* 格式化                                                              */
/* ------------------------------------------------------------------ */

const amountFormatter = new Intl.NumberFormat('zh-CN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const countFormatter = new Intl.NumberFormat('zh-CN', {
  maximumFractionDigits: 0,
});

/** 1234.5 -> "1,234.50" */
export function formatAmount(value: number | null | undefined): string {
  const safe = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return amountFormatter.format(safe);
}

/** 1234.5 -> "¥1,234.50" */
export function formatMoney(value: number | null | undefined): string {
  return `¥${formatAmount(value)}`;
}

/** 整数千分位 */
export function formatCount(value: number | null | undefined): string {
  const safe = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return countFormatter.format(safe);
}

const quantityFormatter = new Intl.NumberFormat('zh-CN', {
  maximumFractionDigits: 2,
});

/** 数量保留最多 2 位小数（吨 / 件等） */
export function formatQuantity(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return quantityFormatter.format(value);
}

/** 金额展示：等宽数字 + 可选脱敏 */
export function Money({
  value,
  masked = false,
  className,
}: {
  value: number | null | undefined;
  masked?: boolean;
  className?: string;
}) {
  return (
    <span className={cn('whitespace-nowrap tabular-nums', className)}>
      {masked ? '¥ ****' : formatMoney(value)}
    </span>
  );
}

/** 2026-03-08T10:00:00 -> "2026-03-08" */
export function formatDateText(value: string | null | undefined): string {
  if (!value) return '—';
  return String(value).slice(0, 10);
}

/** "2026-03" -> "2026年3月" */
export function monthText(value: string | null | undefined): string {
  if (!value) return '—';
  const match = /^(\d{4})-(\d{2})/.exec(String(value));
  if (!match) return String(value);
  return `${match[1]}年${Number(match[2])}月`;
}

/** "2026-03" -> "3月" */
export function shortMonth(value: string | null | undefined): string {
  if (!value) return '';
  const match = /^(\d{4})-(\d{2})/.exec(String(value));
  if (!match) return String(value);
  return `${Number(match[2])}月`;
}

/** Date -> 本地时区 yyyy-MM-dd（避免 toISOString 的时区偏移） */
export function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function currentMonth(): string {
  return toISODate(new Date()).slice(0, 7);
}

export function daysAgoISO(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return toISODate(date);
}

/** "2026-03" 偏移若干个月，返回 "2026-02" */
export function shiftMonth(month: string, delta: number): string {
  const match = /^(\d{4})-(\d{2})$/.exec(String(month ?? ''));
  if (!match) return month;
  const date = new Date(Number(match[1]), Number(match[2]) - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** 距今自然日天数（按本地日期计算，忽略时分秒）；日期缺失或非法返回 null */
export function daysSince(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
  if (!match) return null;
  const target = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (Number.isNaN(target.getTime())) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.round((today.getTime() - target.getTime()) / 86400000));
}

/** 0.1234 -> "12.3%" */
export function formatPercent(ratio: number | null | undefined, digits = 1): string {
  if (typeof ratio !== 'number' || !Number.isFinite(ratio)) return '—';
  return `${(ratio * 100).toFixed(digits)}%`;
}

/* ------------------------------------------------------------------ */
/* 状态语义（财务语义，不跟股市涨跌走）                                */
/* ------------------------------------------------------------------ */

type StatusTone = 'red' | 'amber' | 'green' | 'blue' | 'gray';

interface StatusMeta {
  label: string;
  tone: StatusTone;
}

const STATUS_MAP: Record<string, StatusMeta> = {
  unpaid: { label: '未付款', tone: 'red' },
  未付款: { label: '未付款', tone: 'red' },
  未付: { label: '未付款', tone: 'red' },
  未结算: { label: '未结算', tone: 'red' },
  待付款: { label: '待付款', tone: 'red' },
  pending: { label: '待处理', tone: 'amber' },
  待处理: { label: '待处理', tone: 'amber' },
  待对账: { label: '待对账', tone: 'amber' },
  processing: { label: '处理中', tone: 'amber' },
  处理中: { label: '处理中', tone: 'amber' },
  partial: { label: '部分结算', tone: 'amber' },
  部分结算: { label: '部分结算', tone: 'amber' },
  partialinvoiced: { label: '部分开票', tone: 'amber' },
  部分开票: { label: '部分开票', tone: 'amber' },
  paid: { label: '已付款', tone: 'green' },
  已付款: { label: '已付款', tone: 'green' },
  已付: { label: '已付款', tone: 'green' },
  已结算: { label: '已结算', tone: 'green' },
  invoiced: { label: '已开票', tone: 'blue' },
  已开票: { label: '已开票', tone: 'blue' },
  uninvoiced: { label: '未开票', tone: 'gray' },
  未开票: { label: '未开票', tone: 'gray' },
  reconciled: { label: '已对账', tone: 'green' },
  已对账: { label: '已对账', tone: 'green' },
  confirmed: { label: '已确认', tone: 'green' },
  已确认: { label: '已确认', tone: 'green' },
  unreconciled: { label: '未对账', tone: 'red' },
  未对账: { label: '未对账', tone: 'red' },
};

const TONE_BADGE: Record<StatusTone, string> = {
  red: 'border-destructive/30 bg-destructive/10 text-destructive',
  amber: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  green: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  blue: 'border-primary/30 bg-primary/10 text-primary',
  gray: 'border-border bg-muted text-muted-foreground',
};

const TONE_BAR: Record<StatusTone, string> = {
  red: 'bg-destructive',
  amber: 'bg-amber-500',
  green: 'bg-emerald-500',
  blue: 'bg-primary',
  gray: 'bg-muted-foreground/50',
};

/** 统一归一化：忽略大小写、空格、下划线、连字符 */
export function normalizeStatus(value: string | null | undefined): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]/g, '');
}

export function statusMeta(value: string | null | undefined): StatusMeta {
  const key = normalizeStatus(value);
  if (STATUS_MAP[key]) return STATUS_MAP[key];
  return { label: value ? String(value) : '—', tone: 'gray' };
}

/** 状态标签（财务语义配色） */
export function StatusBadge({
  value,
  className,
}: {
  value: string | null | undefined;
  className?: string;
}) {
  const meta = statusMeta(value);
  return (
    <Badge
      variant="outline"
      className={cn('gap-1 whitespace-nowrap px-2 py-0.5 text-[11px] font-medium', TONE_BADGE[meta.tone], className)}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {meta.label}
    </Badge>
  );
}

/** 状态对应的条形图填充色 */
export function statusBarClass(value: string | null | undefined): string {
  return TONE_BAR[statusMeta(value).tone];
}

export function isReconciled(value: string | null | undefined): boolean {
  return normalizeStatus(value) === 'reconciled' || normalizeStatus(value) === '已对账';
}

/* ------------------------------------------------------------------ */
/* 布局与三态                                                          */
/* ------------------------------------------------------------------ */

export function PageHead({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-4 space-y-1.5">
      <h1 className="text-lg font-semibold tracking-tight md:text-xl">{title}</h1>
      <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
      {children}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-card/60 px-6 py-12 text-center',
        className,
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="h-6 w-6" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description ? <p className="text-xs leading-relaxed text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
  className,
}: {
  message: string;
  onRetry: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-6 py-10 text-center',
        className,
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">加载失败</p>
        <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">{message}</p>
      </div>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RefreshCw className="h-4 w-4" />
        重新加载
      </Button>
    </div>
  );
}

/** 数字卡骨架 */
export function SkeletonCards({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div className={cn('grid grid-cols-2 gap-3 md:grid-cols-4', className)}>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="rounded-lg border border-border bg-card p-4">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="mt-3 h-6 w-24" />
        </div>
      ))}
    </div>
  );
}

/** 列表行骨架 */
export function SkeletonRows({ count = 6, className }: { count?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-20" />
          </div>
          <Skeleton className="mt-2 h-3 w-48" />
        </div>
      ))}
    </div>
  );
}

/** 详情字段（配合 dl 使用） */
export function Field({
  label,
  children,
  className,
}: {
  label: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('min-w-0 space-y-1', className)}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="break-words text-sm font-medium text-foreground">
        {children === null || children === undefined || children === '' ? '—' : children}
      </dd>
    </div>
  );
}

/** 表单 / 操作区内的行内错误 */
export function InlineError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="flex items-start gap-1.5 text-xs leading-relaxed text-destructive">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{message}</span>
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* 环比                                                                */
/* ------------------------------------------------------------------ */

/**
 * 环比标识：只用 ▲/▼ 表达方向，配色统一走灰蓝系（primary / muted-foreground），
 * 刻意不使用红涨绿跌，避免与「未付款=红」的财务语义打架。
 */
export function DeltaTag({
  ratio,
  suffix = '环比',
  className,
}: {
  ratio: number | null;
  suffix?: string | null;
  className?: string;
}) {
  if (ratio === null || !Number.isFinite(ratio)) {
    return <span className={cn('text-[11px] text-muted-foreground', className)}>—</span>;
  }

  const flat = Math.abs(ratio) < 0.0005;
  const up = ratio > 0;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap text-[11px] tabular-nums',
        flat ? 'text-muted-foreground' : up ? 'text-primary' : 'text-muted-foreground',
        className,
      )}
    >
      <span aria-hidden="true">{flat ? '–' : up ? '▲' : '▼'}</span>
      <span>{formatPercent(Math.abs(ratio))}</span>
      <span className="sr-only">{flat ? '持平' : up ? '上升' : '下降'}</span>
      {suffix ? <span className="text-muted-foreground">{suffix}</span> : null}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* 账龄                                                                */
/* ------------------------------------------------------------------ */

export interface AgingSourceRow {
  loading_date: string | null;
  payable_amount: number;
  reconciliation_status?: string | null;
}

export interface AgingBucket {
  key: string;
  label: string;
  count: number;
  amount: number;
}

const AGING_DEFS: Array<{ key: string; label: string; min: number; max: number }> = [
  { key: 'd0_30', label: '0-30 天', min: 0, max: 30 },
  { key: 'd31_60', label: '31-60 天', min: 31, max: 60 },
  { key: 'd61_90', label: '61-90 天', min: 61, max: 90 },
  { key: 'd90_plus', label: '90 天以上', min: 91, max: Number.MAX_SAFE_INTEGER },
];

/**
 * 前端分桶：默认只统计未对账运单（已对账的部分已进入付款流程，不再计入账龄压力）。
 * 装货日期缺失的行无法计算账龄，直接跳过。
 */
export function buildAgingBuckets(rows: AgingSourceRow[]): AgingBucket[] {
  const buckets = AGING_DEFS.map((def) => ({ ...def, count: 0, amount: 0 }));

  rows.forEach((row) => {
    if (row.reconciliation_status !== undefined && isReconciled(row.reconciliation_status)) return;
    const days = daysSince(row.loading_date);
    if (days === null) return;
    const bucket = buckets.find((item) => days >= item.min && days <= item.max);
    if (!bucket) return;
    bucket.count += 1;
    bucket.amount += row.payable_amount || 0;
  });

  return buckets.map(({ key, label, count, amount }) => ({ key, label, count, amount }));
}

/* ------------------------------------------------------------------ */
/* CSV 导出                                                            */
/* ------------------------------------------------------------------ */

/** 单元格转义：加引号、双引号翻倍，并阻断 Excel 公式注入 */
export function csvCell(value: string | number | null | undefined): string {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

/** 生成带 BOM 的 CSV 并触发下载（Excel 打开不乱码） */
export function downloadCsv(
  filename: string,
  rows: Array<Array<string | number | null | undefined>>,
): void {
  const content = rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/* ------------------------------------------------------------------ */
/* 跨页面刷新（对账完成后同步底部角标）                                */
/* ------------------------------------------------------------------ */

export const RECONCILE_EVENT = 'partner:reconcile-updated';

export function notifyReconcileUpdated(): void {
  window.dispatchEvent(new Event(RECONCILE_EVENT));
}

/* ------------------------------------------------------------------ */
/* 骨架屏补充                                                          */
/* ------------------------------------------------------------------ */

/** 图表区骨架 */
export function SkeletonChart({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-end gap-2">
        {[64, 96, 52, 110, 78, 120].map((height, index) => (
          <Skeleton key={index} className="flex-1 rounded-sm" style={{ height }} />
        ))}
      </div>
      <Skeleton className="h-3 w-full" />
    </div>
  );
}

/** 表格式骨架（带表头与若干行） */
export function SkeletonTable({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('rounded-lg border border-border bg-card p-4', className)}>
      <Skeleton className="h-3 w-24" />
      <div className="mt-4 space-y-2.5">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="flex items-center gap-3">
            <Skeleton className="h-3.5 flex-1" />
            <Skeleton className="h-3.5 w-16" />
            <Skeleton className="h-3.5 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** 打印用签章位：屏幕端隐藏，仅出现在 .partner-print-doc 内 */
export function SignatureBlock({ note }: { note?: string }) {
  return (
    <>
      <div className="mt-8 grid grid-cols-2 gap-10 text-[11px]">
        <div className="space-y-6">
          <p className="font-medium">供方（盖章）</p>
          <p className="border-b border-border pb-1 text-muted-foreground">经办人：</p>
          <p className="border-b border-border pb-1 text-muted-foreground">日期：</p>
        </div>
        <div className="space-y-6">
          <p className="font-medium">需方（盖章）</p>
          <p className="border-b border-border pb-1 text-muted-foreground">经办人：</p>
          <p className="border-b border-border pb-1 text-muted-foreground">日期：</p>
        </div>
      </div>
      {note ? (
        <p className="mt-6 text-[10px] leading-relaxed text-muted-foreground">{note}</p>
      ) : null}
    </>
  );
}
