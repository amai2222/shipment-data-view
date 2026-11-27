import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, ClipboardCheck, Info } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  confirmReconciliation,
  getReconciliation,
  toErrorMessage,
  type ConfirmReconciliationResult,
  type PartnerReconciliation,
} from '../api';
import {
  EmptyState,
  ErrorState,
  InlineError,
  Money,
  PageHead,
  SkeletonRows,
  StatusBadge,
  currentMonth,
  formatCount,
  formatDateText,
  isReconciled,
  monthText,
  notifyReconcileUpdated,
} from '../components/shared';

export default function Reconcile() {
  const [month, setMonth] = useState(() => currentMonth());
  const [data, setData] = useState<PartnerReconciliation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [note, setNote] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [result, setResult] = useState<ConfirmReconciliationResult | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setActionError(null);
    try {
      const next = await getReconciliation(month);
      setData(next);
      // 只保留仍然存在且仍未对账的选中项
      const selectable = new Set(
        next.rows
          .filter((row) => !isReconciled(row.reconciliation_status))
          .map((row) => row.cost_id),
      );
      setSelected((prev) => new Set([...prev].filter((id) => selectable.has(id))));
    } catch (err) {
      setData(null);
      setSelected(new Set());
      setError(toErrorMessage(err, '对账清单加载失败'));
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = data?.rows ?? [];
  const selectableRows = rows.filter((row) => !isReconciled(row.reconciliation_status));
  const allSelected = selectableRows.length > 0 && selected.size === selectableRows.length;
  const someSelected = selected.size > 0 && !allSelected;

  const toggleRow = (costId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(costId)) next.delete(costId);
      else next.add(costId);
      return next;
    });
    setActionError(null);
  };

  const toggleAll = () => {
    setActionError(null);
    if (allSelected) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(selectableRows.map((row) => row.cost_id)));
  };

  const changeMonth = (value: string) => {
    if (!value) return;
    setSelected(new Set());
    setResult(null);
    setNote('');
    setMonth(value);
  };

  const handleConfirm = async () => {
    if (selected.size === 0) {
      setActionError('请先勾选需要确认的运单。');
      return;
    }

    setSubmitting(true);
    setActionError(null);
    try {
      const res = await confirmReconciliation([...selected], note);
      setResult(res);
      setSelected(new Set());
      setNote('');
      setDialogOpen(false);
      await load();
      notifyReconcileUpdated();
    } catch (err) {
      setActionError(toErrorMessage(err, '确认对账失败，请稍后重试'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <PageHead
        title="运单对账"
        description="核对本月每笔运单的结算金额，勾选无误的记录并批量确认；确认后平台会进入付款流程。"
      />

      <div className="flex flex-wrap items-end gap-2">
        <label className="space-y-1">
          <span className="text-[11px] text-muted-foreground">账单月份</span>
          <Input
            type="month"
            value={month}
            onChange={(event) => changeMonth(event.target.value)}
            className="w-[170px]"
          />
        </label>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          刷新清单
        </Button>
      </div>

      {loading ? (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-16 rounded-lg border border-border bg-card" />
            ))}
          </div>
          <SkeletonRows count={5} />
        </div>
      ) : error ? (
        <ErrorState className="mt-3" message={error} onRetry={load} />
      ) : rows.length === 0 ? (
        <EmptyState
          className="mt-3"
          icon={ClipboardCheck}
          title={`${monthText(month)}没有需要核对的运单`}
          description="账单生成后，未对账的运单会自动出现在这里。"
        />
      ) : (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-border bg-card p-3">
              <p className="text-[11px] text-muted-foreground">本月运单</p>
              <p className="mt-1 text-base font-semibold tabular-nums">
                {formatCount(data?.total ?? 0)}
                <span className="ml-0.5 text-[11px] font-normal text-muted-foreground">笔</span>
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-3">
              <p className="text-[11px] text-muted-foreground">未对账</p>
              <p className="mt-1 text-base font-semibold tabular-nums text-destructive">
                {formatCount(data?.unreconciled_count ?? 0)}
                <span className="ml-0.5 text-[11px] font-normal text-muted-foreground">笔</span>
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-3">
              <p className="text-[11px] text-muted-foreground">待对账金额</p>
              <Money
                value={data?.unreconciled_amount ?? 0}
                className="mt-1 block text-sm font-semibold"
              />
            </div>
          </div>

          {result ? (
            <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-xs">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <p className="leading-relaxed text-foreground">
                已确认 {formatCount(result.updated)} 笔运单。
                {result.skipped > 0
                  ? `另有 ${formatCount(result.skipped)} 笔因状态已被变更而跳过，请刷新后核对。`
                  : ''}
              </p>
            </div>
          ) : null}

          <div className="rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2.5">
              <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                <Checkbox
                  checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                  onCheckedChange={toggleAll}
                  disabled={selectableRows.length === 0}
                  aria-label="全选未对账运单"
                />
                全选未对账（{formatCount(selectableRows.length)}）
              </label>
              <span className="text-xs tabular-nums text-muted-foreground">
                已选 <span className="font-semibold text-foreground">{formatCount(selected.size)}</span> 笔
              </span>
            </div>

            <div className="divide-y divide-border">
              {rows.map((row) => {
                const done = isReconciled(row.reconciliation_status);
                return (
                  <div
                    key={row.cost_id}
                    className={cn('flex items-start gap-3 px-3 py-3', done && 'opacity-70')}
                  >
                    <Checkbox
                      className="mt-0.5"
                      checked={done ? true : selected.has(row.cost_id)}
                      disabled={done}
                      onCheckedChange={() => toggleRow(row.cost_id)}
                      aria-label={`选择运单 ${row.auto_number ?? ''}`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (!done) toggleRow(row.cost_id);
                          }}
                          className="truncate font-mono text-xs font-semibold text-foreground disabled:cursor-default"
                          disabled={done}
                        >
                          {row.auto_number || '—'}
                        </button>
                        <Money value={row.payable_amount} className="text-sm font-semibold" />
                      </div>

                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="tabular-nums">{formatDateText(row.loading_date)}</span>
                        <StatusBadge value={row.reconciliation_status} />
                      </div>

                      {row.reconciliation_notes ? (
                        <p className="mt-1.5 rounded bg-muted/60 px-2 py-1 text-[11px] leading-relaxed text-muted-foreground">
                          备注：{row.reconciliation_notes}
                        </p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-3 md:p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">批量确认</h2>
              <span className="text-[11px] text-muted-foreground">
                将把已勾选的 {formatCount(selected.size)} 笔标记为已对账
              </span>
            </div>

            <Textarea
              className="mt-2"
              rows={2}
              maxLength={200}
              placeholder="备注（可选）：如「金额核对无误」「已与调度确认」"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />

            <div className="mt-2 flex flex-col gap-2">
              <Button
                className="w-full"
                disabled={selected.size === 0 || submitting}
                onClick={() => {
                  setActionError(null);
                  setDialogOpen(true);
                }}
              >
                <ClipboardCheck className="h-4 w-4" />
                确认对账
                {selected.size > 0 ? `（${formatCount(selected.size)} 笔）` : ''}
              </Button>
              <InlineError message={actionError} />
            </div>

            <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              确认后该运单将在门户中显示为「已对账」，并进入财务付款流程；如发现金额有误，请先联系业务经办人。
            </p>
          </div>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => {
        if (!submitting) setDialogOpen(open);
      }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>确认对账</DialogTitle>
            <DialogDescription>
              即将把 {formatCount(selected.size)} 笔运单标记为已对账，确认后不可在门户内撤销。
            </DialogDescription>
          </DialogHeader>

          {note.trim() ? (
            <p className="rounded-md bg-muted px-3 py-2 text-xs leading-relaxed text-muted-foreground">
              备注：{note.trim()}
            </p>
          ) : null}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={submitting}
            >
              取消
            </Button>
            <Button onClick={handleConfirm} disabled={submitting}>
              {submitting ? '提交中…' : '确认提交'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
