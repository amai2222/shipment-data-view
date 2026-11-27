// 文件路径: src/pages/ChainProfit.tsx
// 描述: 链路毛利分析页。只读取 G2 提供的报表 RPC，不参与任何计费/税率/金额计算。

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/utils/supabase';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  AlertCircle,
  Layers,
  Loader2,
  Percent,
  RefreshCw,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

// ============================================================
// 类型（按 G2 已实现的接口结构写死）
// ============================================================

interface ChainProfitSummary {
  revenue: number;
  cost: number;
  gross: number;
  margin_rate: number;
  waybill_count: number;
  chain_count: number;
}

interface ChainProfitRow {
  chain_id: string;
  chain_name: string;
  project_id: string;
  project_name: string;
  owner_name: string | null;
  revenue: number;
  cost: number;
  gross: number;
  margin_rate: number;
  waybill_count: number;
}

interface MonthProfitRow {
  month: string;
  revenue: number;
  cost: number;
  gross: number;
}

interface ChainProfitReport {
  summary: ChainProfitSummary;
  by_chain: ChainProfitRow[];
  by_month: MonthProfitRow[];
}

interface ChainStructureLayer {
  level: number;
  partner_name: string;
  partner_type: string | null;
  calculation_method: string | null;
  tax_rate: number | null;
  profit_rate: number | null;
  unit_price: number | null;
  waybill_count: number;
  total_payable: number;
  share: number;
  kind: string | null;
}

interface ChainStructure {
  chain: {
    id: string;
    chain_name: string;
    project_name: string;
    owner_name: string | null;
    billing_type_id: number | null;
    waybill_count: number;
  };
  layers: ChainStructureLayer[];
}

interface AgingBucket {
  bucket: string;
  count: number;
  amount: number;
}

interface AgingReport {
  buckets: AgingBucket[];
  total_count: number;
  total_amount: number;
}

// ============================================================
// 展示工具（仅格式化，不做任何业务计算）
// ============================================================

const CHART = {
  receivable: 'hsl(var(--primary))',
  payable: 'hsl(var(--muted-foreground))',
  gross: 'hsl(var(--accent))',
  grid: 'hsl(var(--border))',
  axis: 'hsl(var(--muted-foreground))',
  tooltipBg: 'hsl(var(--popover))',
  tooltipBorder: 'hsl(var(--border))',
  tooltipText: 'hsl(var(--popover-foreground))',
};

const AXIS_TICK = { fill: CHART.axis, fontSize: 12 } as const;
const TOOLTIP_STYLE = {
  backgroundColor: CHART.tooltipBg,
  border: `1px solid ${CHART.tooltipBorder}`,
  borderRadius: 8,
  color: CHART.tooltipText,
  fontSize: 12,
} as const;

const money = (value?: number | null) =>
  `¥${Number(value ?? 0).toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const count = (value?: number | null) => Number(value ?? 0).toLocaleString('zh-CN');

const percent = (value?: number | null) => `${Number(value ?? 0).toFixed(1)}%`;

// 条形宽度：最小 2% 保证可见，最大 100%
const barWidth = (value?: number | null) => Math.max(2, Math.min(100, Number(value ?? 0)));

const compactAxis = (value: number) => {
  const abs = Math.abs(value);
  if (abs >= 100000000) return `${(value / 100000000).toFixed(1)}亿`;
  if (abs >= 10000) return `${(value / 10000).toFixed(1)}万`;
  return String(Math.round(value));
};

const toISODate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const currentMonthStart = () => {
  const now = new Date();
  return toISODate(new Date(now.getFullYear(), now.getMonth(), 1));
};

const today = () => toISODate(new Date());

const methodLabel = (layer: ChainStructureLayer) => {
  if (layer.calculation_method === 'tax') return `税点 ${percent(Number(layer.tax_rate ?? 0) * 100)}`;
  if (layer.calculation_method === 'profit') return `利润 ${money(layer.profit_rate)}`;
  if (layer.calculation_method === 'fixed_price') return `单价 ${money(layer.unit_price)}`;
  return '—';
};

export default function ChainProfit() {
  // 筛选条件
  const [fromDate, setFromDate] = useState<string>(currentMonthStart);
  const [toDate, setToDate] = useState<string>(today);
  const [projectId, setProjectId] = useState<string>('all');
  const [reloadKey, setReloadKey] = useState(0);

  // 数据
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [report, setReport] = useState<ChainProfitReport | null>(null);
  const [aging, setAging] = useState<AgingReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 抽屉
  const [activeChain, setActiveChain] = useState<ChainProfitRow | null>(null);
  const [structure, setStructure] = useState<ChainStructure | null>(null);
  const [structureLoading, setStructureLoading] = useState(false);
  const [structureError, setStructureError] = useState<string | null>(null);

  // 项目下拉
  useEffect(() => {
    let cancelled = false;
    const loadProjects = async () => {
      try {
        const { data, error: projectsError } = await supabase
          .from('projects')
          .select('id, name')
          .order('name', { ascending: true });
        if (projectsError) throw projectsError;
        if (!cancelled) setProjects((data || []) as Array<{ id: string; name: string }>);
      } catch (loadError) {
        console.warn('加载项目下拉失败:', loadError);
      }
    };
    loadProjects();
    return () => {
      cancelled = true;
    };
  }, []);

  // 报表 + 账龄
  const loadReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [reportRes, agingRes] = await Promise.all([
        supabase.rpc('get_chain_profit_report', {
          p_from: fromDate || null,
          p_to: toDate || null,
          p_project_id: projectId === 'all' ? null : projectId,
        }),
        supabase.rpc('get_receivable_aging', { p_as_of: toDate || today() }),
      ]);

      if (reportRes.error) throw reportRes.error;
      // 账龄接口异常时不阻断主报表，仅账龄图显示空态
      if (agingRes.error) console.warn('加载应收账龄失败:', agingRes.error);

      const rawReport = (reportRes.data || null) as ChainProfitReport | null;
      const rawAging = (agingRes.error ? null : (agingRes.data as AgingReport | null)) || null;

      setReport({
        summary: {
          revenue: Number(rawReport?.summary?.revenue ?? 0),
          cost: Number(rawReport?.summary?.cost ?? 0),
          gross: Number(rawReport?.summary?.gross ?? 0),
          margin_rate: Number(rawReport?.summary?.margin_rate ?? 0),
          waybill_count: Number(rawReport?.summary?.waybill_count ?? 0),
          chain_count: Number(rawReport?.summary?.chain_count ?? 0),
        },
        by_chain: (rawReport?.by_chain || []).map((row) => ({
          ...row,
          revenue: Number(row.revenue ?? 0),
          cost: Number(row.cost ?? 0),
          gross: Number(row.gross ?? 0),
          margin_rate: Number(row.margin_rate ?? 0),
          waybill_count: Number(row.waybill_count ?? 0),
        })),
        by_month: (rawReport?.by_month || []).map((row) => ({
          ...row,
          revenue: Number(row.revenue ?? 0),
          cost: Number(row.cost ?? 0),
          gross: Number(row.gross ?? 0),
        })),
      });

      setAging({
        buckets: (rawAging?.buckets || []).map((bucket) => ({
          ...bucket,
          count: Number(bucket.count ?? 0),
          amount: Number(bucket.amount ?? 0),
        })),
        total_count: Number(rawAging?.total_count ?? 0),
        total_amount: Number(rawAging?.total_amount ?? 0),
      });
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : '加载链路毛利数据失败';
      setError(message);
      setReport(null);
      setAging(null);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, projectId, reloadKey]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const summary = report?.summary;
  const chainRows = report?.by_chain || [];
  const monthRows = report?.by_month || [];
  const agingBuckets = aging?.buckets || [];

  const hasData = !loading && !error && chainRows.length > 0;

  // 抽屉：层级结构
  const openStructure = useCallback(async (row: ChainProfitRow) => {
    setActiveChain(row);
    setStructure(null);
    setStructureError(null);
    setStructureLoading(true);
    try {
      const { data, error: structureRpcError } = await supabase.rpc('get_chain_structure', {
        p_chain_id: row.chain_id,
      });
      if (structureRpcError) throw structureRpcError;
      setStructure((data || null) as ChainStructure | null);
    } catch (loadError) {
      setStructureError(loadError instanceof Error ? loadError.message : '加载链路结构失败');
    } finally {
      setStructureLoading(false);
    }
  }, []);

  const sortedLayers = useMemo(() => {
    const layers = [...(structure?.layers || [])];
    return layers.sort((a, b) => a.level - b.level);
  }, [structure]);

  const minLevel = useMemo(
    () => (sortedLayers.length > 0 ? sortedLayers[0].level : 0),
    [sortedLayers]
  );

  const maxLayerAmount = useMemo(
    () => sortedLayers.reduce((max, layer) => Math.max(max, Number(layer.total_payable ?? 0)), 0),
    [sortedLayers]
  );

  const layerKind = (layer: ChainStructureLayer): 'receivable' | 'payable' => {
    if (layer.kind === 'receivable' || layer.kind === 'payable') return layer.kind;
    return layer.level === minLevel ? 'receivable' : 'payable';
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader
        title="链路毛利"
        description="按链路查看应收、应付与毛利，并可下钻查看各层级结构"
        icon={TrendingUp}
        iconColor="text-primary"
      />

      {/* 筛选 */}
      <Card className="border-border/60">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-40 space-y-2">
              <Label htmlFor="chain-profit-from">开始日期</Label>
              <Input
                id="chain-profit-from"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
            <div className="w-40 space-y-2">
              <Label htmlFor="chain-profit-to">结束日期</Label>
              <Input
                id="chain-profit-to"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
            <div className="w-56 space-y-2">
              <Label>项目</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="全部项目" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部项目</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              onClick={() => setReloadKey((key) => key + 1)}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              刷新
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 加载态 */}
      {loading && (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          正在加载链路毛利数据...
        </div>
      )}

      {/* 错误态 */}
      {!loading && error && (
        <Card className="border-destructive/40">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <div>
              <p className="font-medium text-foreground">数据加载失败</p>
              <p className="text-sm text-muted-foreground mt-1">{error}</p>
            </div>
            <Button variant="outline" onClick={() => setReloadKey((key) => key + 1)}>
              <RefreshCw className="h-4 w-4 mr-2" />
              重试
            </Button>
          </CardContent>
        </Card>
      )}

      {!loading && !error && (
        <>
          {/* KPI */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Wallet className="h-4 w-4" />
                  中科应收
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tabular-nums">{money(summary?.revenue)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  共 {count(summary?.waybill_count)} 单 · {count(summary?.chain_count)} 条链路
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Layers className="h-4 w-4" />
                  中科应付
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tabular-nums">{money(summary?.cost)}</div>
                <p className="text-xs text-muted-foreground mt-1">下游各层级应付合计</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  毛利
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className={`text-2xl font-bold tabular-nums ${
                    Number(summary?.gross ?? 0) >= 0 ? 'text-foreground' : 'text-destructive'
                  }`}
                >
                  {money(summary?.gross)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">应收 − 应付</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Percent className="h-4 w-4" />
                  毛利率
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tabular-nums">{percent(summary?.margin_rate)}</div>
                <div className="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${barWidth(summary?.margin_rate)}%` }}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 主表 */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">链路汇总</CardTitle>
              <span className="text-xs text-muted-foreground">点击行可查看层级结构</span>
            </CardHeader>
            <CardContent className="p-0">
              {chainRows.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  当前筛选条件下暂无链路数据
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>链路</TableHead>
                        <TableHead>项目</TableHead>
                        <TableHead>归属方</TableHead>
                        <TableHead className="text-right">应收</TableHead>
                        <TableHead className="text-right">应付</TableHead>
                        <TableHead className="text-right">毛利</TableHead>
                        <TableHead className="text-right">毛利率</TableHead>
                        <TableHead className="text-right">单量</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {chainRows.map((row) => (
                        <TableRow
                          key={row.chain_id}
                          className="cursor-pointer"
                          onClick={() => openStructure(row)}
                          title={`查看 ${row.chain_name} 的层级结构`}
                        >
                          <TableCell className="font-medium">{row.chain_name}</TableCell>
                          <TableCell className="text-muted-foreground">{row.project_name}</TableCell>
                          <TableCell className="text-muted-foreground">{row.owner_name || '—'}</TableCell>
                          <TableCell className="text-right tabular-nums">{money(row.revenue)}</TableCell>
                          <TableCell className="text-right tabular-nums">{money(row.cost)}</TableCell>
                          <TableCell
                            className={`text-right tabular-nums font-semibold ${
                              Number(row.gross ?? 0) >= 0 ? 'text-foreground' : 'text-destructive'
                            }`}
                          >
                            {money(row.gross)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant={Number(row.margin_rate ?? 0) >= 0 ? 'secondary' : 'destructive'}>
                              {percent(row.margin_rate)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{count(row.waybill_count)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/40 hover:bg-muted/40">
                        <TableCell colSpan={3} className="font-semibold">
                          合计
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">
                          {money(summary?.revenue)}
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">
                          {money(summary?.cost)}
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">
                          {money(summary?.gross)}
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">
                          {percent(summary?.margin_rate)}
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">
                          {count(summary?.waybill_count)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 图表 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg">月度应收 / 应付 / 毛利</CardTitle>
              </CardHeader>
              <CardContent>
                {monthRows.length === 0 ? (
                  <div className="h-[300px] flex items-center justify-center text-sm text-muted-foreground">
                    暂无月度数据
                  </div>
                ) : (
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={monthRows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
                        <XAxis
                          dataKey="month"
                          tick={AXIS_TICK}
                          tickLine={false}
                          axisLine={{ stroke: CHART.grid }}
                        />
                        <YAxis yAxisId="left" tick={AXIS_TICK} tickLine={false} axisLine={false} tickFormatter={compactAxis} width={56} />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          tick={AXIS_TICK}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={compactAxis}
                          width={56}
                        />
                        <Tooltip
                          contentStyle={TOOLTIP_STYLE}
                          itemStyle={{ color: CHART.tooltipText }}
                          labelStyle={{ color: CHART.tooltipText }}
                          formatter={(value) => money(Number(value))}
                        />
                        <Legend wrapperStyle={{ color: CHART.axis, fontSize: 12 }} />
                        <Bar yAxisId="left" dataKey="revenue" name="应收" fill={CHART.receivable} radius={[4, 4, 0, 0]} barSize={18} />
                        <Bar yAxisId="left" dataKey="cost" name="应付" fill={CHART.payable} radius={[4, 4, 0, 0]} barSize={18} />
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="gross"
                          name="毛利"
                          stroke={CHART.gross}
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 4 }}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">应收账龄</CardTitle>
              </CardHeader>
              <CardContent>
                {agingBuckets.length === 0 ? (
                  <div className="h-[300px] flex items-center justify-center text-sm text-muted-foreground">
                    暂无账龄数据
                  </div>
                ) : (
                  <>
                    <div className="h-[248px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={agingBuckets} margin={{ top: 16, right: 8, bottom: 0, left: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
                          <XAxis
                            dataKey="bucket"
                            tick={AXIS_TICK}
                            tickLine={false}
                            axisLine={{ stroke: CHART.grid }}
                          />
                          <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} tickFormatter={compactAxis} width={52} />
                          <Tooltip
                            contentStyle={TOOLTIP_STYLE}
                            itemStyle={{ color: CHART.tooltipText }}
                            labelStyle={{ color: CHART.tooltipText }}
                            formatter={(value) => money(Number(value))}
                            labelFormatter={(label, payload) => {
                              const bucket = payload?.[0]?.payload as AgingBucket | undefined;
                              return `${label} · ${count(bucket?.count)} 单`;
                            }}
                          />
                          <Bar dataKey="amount" name="金额" fill={CHART.gross} radius={[4, 4, 0, 0]} barSize={22}>
                            <LabelList
                              dataKey="count"
                              position="top"
                              fill={CHART.axis}
                              fontSize={11}
                              formatter={(value) => count(Number(value))}
                            />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 text-center">
                      合计 {count(aging?.total_count)} 单 · {money(aging?.total_amount)}
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {!hasData && (
            <p className="text-xs text-muted-foreground text-center">
              提示：若长期无数据，请确认所选日期区间内是否已有运单结算记录。
            </p>
          )}
        </>
      )}

      {/* 右侧抽屉：层级结构 */}
      <Sheet
        open={!!activeChain}
        onOpenChange={(open) => {
          if (!open) {
            setActiveChain(null);
            setStructure(null);
            setStructureError(null);
          }
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{activeChain?.chain_name || '链路结构'}</SheetTitle>
            <SheetDescription>
              {activeChain ? `${activeChain.project_name} · 归属方 ${activeChain.owner_name || '—'}` : ''}
            </SheetDescription>
          </SheetHeader>

          {activeChain && (
            <div className="mt-4 space-y-5">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border border-border/60 p-3">
                  <p className="text-xs text-muted-foreground">应收</p>
                  <p className="font-semibold tabular-nums mt-1">{money(activeChain.revenue)}</p>
                </div>
                <div className="rounded-lg border border-border/60 p-3">
                  <p className="text-xs text-muted-foreground">应付</p>
                  <p className="font-semibold tabular-nums mt-1">{money(activeChain.cost)}</p>
                </div>
                <div className="rounded-lg border border-border/60 p-3">
                  <p className="text-xs text-muted-foreground">毛利</p>
                  <p className="font-semibold tabular-nums mt-1">{money(activeChain.gross)}</p>
                </div>
                <div className="rounded-lg border border-border/60 p-3">
                  <p className="text-xs text-muted-foreground">单量 / 毛利率</p>
                  <p className="font-semibold tabular-nums mt-1">
                    {count(activeChain.waybill_count)} 单 · {percent(activeChain.margin_rate)}
                  </p>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium mb-3">层级结构（按层级由低到高）</h4>

                {structureLoading && (
                  <div className="flex items-center justify-center py-10 text-muted-foreground text-sm">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    正在加载层级结构...
                  </div>
                )}

                {!structureLoading && structureError && (
                  <div className="rounded-lg border border-destructive/40 p-4 text-sm text-destructive">
                    {structureError}
                  </div>
                )}

                {!structureLoading && !structureError && sortedLayers.length === 0 && (
                  <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                    该链路暂无层级数据
                  </div>
                )}

                {!structureLoading && !structureError && sortedLayers.length > 0 && (
                  <div className="space-y-4">
                    {sortedLayers.map((layer) => {
                      const kind = layerKind(layer);
                      const isReceivable = kind === 'receivable';
                      const width = maxLayerAmount > 0
                        ? Math.max(3, Math.min(100, (Number(layer.total_payable ?? 0) / maxLayerAmount) * 100))
                        : 0;
                      return (
                        <div key={`${layer.level}-${layer.partner_name}`} className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2 text-sm">
                            <div className="flex items-center gap-2 min-w-0">
                              <Badge variant={isReceivable ? 'default' : 'secondary'} className="shrink-0">
                                L{layer.level}
                              </Badge>
                              <span className="font-medium truncate">{layer.partner_name}</span>
                              <span className="text-xs text-muted-foreground shrink-0">
                                {isReceivable ? '应收 · receivable' : '应付 · payable'}
                              </span>
                            </div>
                            <span className="font-semibold tabular-nums shrink-0">
                              {money(layer.total_payable)}
                            </span>
                          </div>
                          <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                            <div
                              className={`h-full rounded-full ${isReceivable ? 'bg-primary' : 'bg-accent'}`}
                              style={{ width: `${width}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>
                              {methodLabel(layer)}
                              {layer.partner_type ? ` · ${layer.partner_type}` : ''}
                            </span>
                            <span>
                              占比 {percent(layer.share)} · {count(layer.waybill_count)} 单
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
