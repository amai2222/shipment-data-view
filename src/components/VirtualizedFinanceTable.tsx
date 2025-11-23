// 财务对账专用虚拟化表格组件
// 文件: src/components/VirtualizedFinanceTable.tsx
// 优化：使用 react-window 实现真正的虚拟化，支持大数据量渲染

import { useMemo, useCallback, useRef, useEffect, memo } from 'react';
import { FixedSizeList as List, ListChildComponentProps } from 'react-window';
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { CurrencyDisplay } from "@/components/CurrencyDisplay";

interface Partner {
  id: string;
  name: string;
  level: number;
}

interface PartnerCost {
  partner_id: string;
  partner_name: string;
  level: number;
  payable_amount: number;
  reconciliation_status?: string;
  reconciliation_date?: string;
  reconciliation_notes?: string;
  cost_id?: string;
}

interface FinanceRecord {
  id: string;
  auto_number: string;
  project_name: string;
  driver_name: string;
  loading_location: string;
  unloading_location: string;
  loading_date: string;
  unloading_date: string | null;
  loading_weight: number | null;
  unloading_weight: number | null;
  current_cost: number | null;
  payable_cost: number | null;
  extra_cost: number | null;
  license_plate: string | null;
  driver_phone: string | null;
  transport_type: string | null;
  remarks: string | null;
  chain_name: string | null;
  billing_type_id: number;
  partner_costs: PartnerCost[];
}

interface PartnerSummary {
  partner_id: string;
  partner_name: string;
  level: number;
  total_payable: number;
  records_count: number;
}

interface VirtualizedFinanceTableProps {
  data: FinanceRecord[];
  displayedPartners: Partner[];
  selectedIds: Set<string>;
  selectionMode: 'none' | 'all_filtered';
  canReconcile: boolean;
  onRecordClick: (record: FinanceRecord) => void;
  onRecordSelect: (recordId: string) => void;
  onReconcileClick: (costIds: string[]) => void;
  height?: number;
  rowHeight?: number;
  // ✅ 新增：合计数据
  pageSummary?: {
    total_freight: number;
    total_extra_cost: number;
    total_driver_receivable: number;
    partner_totals: Record<string, number>; // partner_id -> total_payable
  };
  allSummary?: {
    total_freight: number;
    total_extra_cost: number;
    total_driver_receivable: number;
    partner_summary?: PartnerSummary[];
  };
}

// 获取对账状态徽章
const getReconciliationBadge = (status?: string) => {
  if (!status || status === 'Unreconciled') {
    return <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-300 text-xs"><Clock className="mr-1 h-3 w-3" />未对账</Badge>;
  }
  if (status === 'Reconciled') {
    return <Badge variant="default" className="bg-green-50 text-green-700 border-green-300 text-xs"><CheckCircle2 className="mr-1 h-3 w-3" />已对账</Badge>;
  }
  if (status === 'Exception') {
    return <Badge variant="destructive" className="bg-red-50 text-red-700 border-red-300 text-xs"><AlertCircle className="mr-1 h-3 w-3" />异常</Badge>;
  }
  return null;
};

// 获取数量显示
const getQuantityDisplay = (record: FinanceRecord) => {
  const billingTypeId = record.billing_type_id || 1;
  const loading = record.loading_weight || 0;
  const unloading = record.unloading_weight || 0;
  
  switch (billingTypeId) {
    case 1: return `${loading.toFixed(2)} / ${unloading.toFixed(2)} 吨`;
    case 2: return `1 车`;
    case 3: return `${loading.toFixed(2)} / ${unloading.toFixed(2)} 立方`;
    case 4: return `${Math.round(loading)} / ${Math.round(unloading)} 件`;
    default: return `${loading} / ${unloading} 吨`;
  }
};

// 虚拟化行组件（使用 memo 优化）
const VirtualRow = memo(({ 
  index, 
  style, 
  data 
}: ListChildComponentProps & { 
  data: { 
    items: FinanceRecord[];
    displayedPartners: Partner[];
    selectedIds: Set<string>;
    selectionMode: 'none' | 'all_filtered';
    canReconcile: boolean;
    onRecordClick: (record: FinanceRecord) => void;
    onRecordSelect: (recordId: string) => void;
    onReconcileClick: (costIds: string[]) => void;
  } 
}) => {
  const { 
    items, 
    displayedPartners, 
    selectedIds, 
    selectionMode,
    canReconcile,
    onRecordClick,
    onRecordSelect,
    onReconcileClick
  } = data;
  
  const record = items[index];
  if (!record) return null;

  const isSelected = selectionMode === 'all_filtered' || selectedIds.has(record.id);
  
  // 收集当前运单的所有合作方成本ID
  const costIds = (record.partner_costs || [])
    .map(cost => cost.cost_id)
    .filter((id): id is string => !!id);

  return (
    <div 
      style={style}
      className="flex items-center border-b hover:bg-muted/50 text-sm"
      role="row"
    >
      {/* 复选框列 */}
      <div className="flex-shrink-0 w-12 px-2" role="cell">
        <Checkbox 
          checked={isSelected} 
          onCheckedChange={() => onRecordSelect(record.id)}
        />
      </div>

      {/* 运单编号 */}
      <div 
        className="flex-shrink-0 px-2 font-mono cursor-pointer hover:text-primary"
        style={{ width: '120px' }}
        onClick={() => onRecordClick(record)}
        role="cell"
      >
        {record.auto_number}
      </div>

      {/* 项目 */}
      <div 
        className="flex-shrink-0 px-2 cursor-pointer truncate"
        style={{ width: '150px' }}
        onClick={() => onRecordClick(record)}
        title={record.project_name}
        role="cell"
      >
        {record.project_name}
      </div>

      {/* 合作链路 */}
      <div 
        className="flex-shrink-0 px-2 cursor-pointer truncate"
        style={{ width: '120px' }}
        onClick={() => onRecordClick(record)}
        title={record.chain_name || '未设置'}
        role="cell"
      >
        {record.chain_name || '-'}
      </div>

      {/* 司机 */}
      <div 
        className="flex-shrink-0 px-2 cursor-pointer"
        style={{ width: '100px' }}
        onClick={() => onRecordClick(record)}
        role="cell"
      >
        {record.driver_name}
      </div>

      {/* 路线 */}
      <div 
        className="flex-shrink-0 px-2 cursor-pointer"
        style={{ width: '100px' }}
        onClick={() => onRecordClick(record)}
        role="cell"
      >
        {`${record.loading_location?.substring(0, 2) || ''}→${record.unloading_location?.substring(0, 2) || ''}`}
      </div>

      {/* 日期 */}
      <div 
        className="flex-shrink-0 px-2 cursor-pointer"
        style={{ width: '100px' }}
        onClick={() => onRecordClick(record)}
        role="cell"
      >
        {record.loading_date}
      </div>

      {/* 装货数量 */}
      <div 
        className="flex-shrink-0 px-2 cursor-pointer"
        style={{ width: '120px' }}
        onClick={() => onRecordClick(record)}
        role="cell"
      >
        {getQuantityDisplay(record)}
      </div>

      {/* 运费+额外费 */}
      <div 
        className="flex-shrink-0 px-2 cursor-pointer"
        style={{ width: '150px' }}
        onClick={() => onRecordClick(record)}
        role="cell"
      >
        <div className="flex items-center gap-2">
          <CurrencyDisplay value={record.current_cost} className="text-red-600 text-xs" />
          <span className="text-gray-400">/</span>
          <CurrencyDisplay value={record.extra_cost} className="text-black text-xs" />
        </div>
      </div>

      {/* 司机应收 */}
      <div 
        className="flex-shrink-0 px-2 cursor-pointer"
        style={{ width: '120px' }}
        onClick={() => onRecordClick(record)}
        role="cell"
      >
        <CurrencyDisplay value={record.payable_cost} className="text-green-600 text-xs" />
      </div>

      {/* 动态合作方列 */}
      {displayedPartners.map(partner => {
        const cost = (record.partner_costs || []).find((c) => c.partner_id === partner.id);
        return (
          <div 
            key={partner.id}
            className="flex-shrink-0 px-2 text-center"
            style={{ width: '140px' }}
            role="cell"
          >
            <div className="flex flex-col items-center gap-1">
              <div className="font-mono text-xs">
                <CurrencyDisplay value={cost?.payable_amount} />
              </div>
              {cost && getReconciliationBadge(cost.reconciliation_status)}
            </div>
          </div>
        );
      })}

      {/* 状态 */}
      <div 
        className="flex-shrink-0 px-2 cursor-pointer"
        style={{ width: '100px' }}
        onClick={() => onRecordClick(record)}
        role="cell"
      >
        <Badge variant={record.current_cost ? "default" : "secondary"} className="text-xs">
          {record.current_cost ? "已计费" : "待计费"}
        </Badge>
      </div>

      {/* 操作 */}
      <div className="flex-shrink-0 px-2" style={{ width: '100px' }} role="cell">
        {costIds.length > 0 && canReconcile && (
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onReconcileClick(costIds);
            }}
            className="h-7 text-xs"
          >
            <CheckCircle2 className="mr-1 h-3 w-3" />
            对账
          </Button>
        )}
      </div>
    </div>
  );
});

VirtualRow.displayName = 'VirtualRow';

// 主组件
export function VirtualizedFinanceTable({
  data,
  displayedPartners,
  selectedIds,
  selectionMode,
  canReconcile,
  onRecordClick,
  onRecordSelect,
  onReconcileClick,
  height = 600,
  rowHeight = 60,
  pageSummary,
  allSummary
}: VirtualizedFinanceTableProps) {
  const listRef = useRef<List>(null);

  // 数据变化时滚动到顶部
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollToItem(0);
    }
  }, [data.length]);

  // 计算表格总宽度
  const tableWidth = useMemo(() => {
    const fixedColumnsWidth = 1328; // 固定列总宽度（包含合作链路列120px）
    const partnerColumnsWidth = displayedPartners.length * 140; // 每个合作方列 140px
    return fixedColumnsWidth + partnerColumnsWidth;
  }, [displayedPartners.length]);

  const itemData = useMemo(() => ({
    items: data,
    displayedPartners,
    selectedIds,
    selectionMode,
    canReconcile,
    onRecordClick,
    onRecordSelect,
    onReconcileClick
  }), [
    data, 
    displayedPartners, 
    selectedIds, 
    selectionMode,
    canReconcile,
    onRecordClick,
    onRecordSelect,
    onReconcileClick
  ]);

  if (data.length === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground">
        暂无数据
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 shadow-lg overflow-hidden bg-white" role="table" aria-label="运单财务明细表格">
      {/* 表头（固定） */}
      <div 
        className="flex items-center bg-muted/50 font-medium border-b text-sm overflow-x-auto"
        style={{ width: '100%' }}
        role="rowgroup"
      >
        <div className="flex" style={{ minWidth: `${tableWidth}px` }} role="row">
          <div className="flex-shrink-0 w-12 px-2 py-3" role="columnheader">选择</div>
          <div className="flex-shrink-0 px-2 py-3" style={{ width: '120px' }} role="columnheader">运单编号</div>
          <div className="flex-shrink-0 px-2 py-3" style={{ width: '150px' }} role="columnheader">项目</div>
          <div className="flex-shrink-0 px-2 py-3" style={{ width: '120px' }} role="columnheader">合作链路</div>
          <div className="flex-shrink-0 px-2 py-3" style={{ width: '100px' }} role="columnheader">司机</div>
          <div className="flex-shrink-0 px-2 py-3" style={{ width: '100px' }} role="columnheader">路线</div>
          <div className="flex-shrink-0 px-2 py-3" style={{ width: '100px' }} role="columnheader">日期</div>
          <div className="flex-shrink-0 px-2 py-3" style={{ width: '120px' }} role="columnheader">装货数量</div>
          <div className="flex-shrink-0 px-2 py-3 text-red-600" style={{ width: '150px' }} role="columnheader">运费+额外费</div>
          <div className="flex-shrink-0 px-2 py-3 text-green-600" style={{ width: '120px' }} role="columnheader">司机应收</div>
          
          {displayedPartners.map(partner => (
            <div key={partner.id} className="flex-shrink-0 px-2 py-3 text-center" style={{ width: '140px' }} role="columnheader">
              {partner.name}
              <div className="text-xs text-muted-foreground">({partner.level}级)</div>
            </div>
          ))}
          
          <div className="flex-shrink-0 px-2 py-3" style={{ width: '100px' }} role="columnheader">状态</div>
          <div className="flex-shrink-0 px-2 py-3" style={{ width: '100px' }} role="columnheader">操作</div>
        </div>
      </div>

      {/* 虚拟化内容区域（只渲染可见行） */}
      <div style={{ width: '100%', overflowX: 'auto' }} role="rowgroup">
        <List
          ref={listRef}
          height={height}
          width={tableWidth}
          itemCount={data.length}
          itemSize={rowHeight}
          itemData={itemData}
          overscanCount={5}
        >
          {VirtualRow}
        </List>
      </div>

      {/* 合计行 - 本页合计 */}
      {pageSummary && (
        <div 
          className="flex items-center border-t-2 border-t-primary/20 bg-muted/20 text-sm font-semibold"
          style={{ width: '100%' }}
          role="row"
        >
          <div className="flex" style={{ minWidth: `${tableWidth}px` }}>
            <div className="flex-shrink-0 w-12 px-2 py-2" role="cell">-</div>
            <div className="flex-shrink-0 px-2 py-2" style={{ width: '120px' }} role="cell">
              <span className="text-xs text-muted-foreground">本页合计</span>
            </div>
            <div className="flex-shrink-0 px-2 py-2" style={{ width: '150px' }} role="cell">-</div>
            <div className="flex-shrink-0 px-2 py-2" style={{ width: '120px' }} role="cell">-</div>
            <div className="flex-shrink-0 px-2 py-2" style={{ width: '100px' }} role="cell">-</div>
            <div className="flex-shrink-0 px-2 py-2" style={{ width: '100px' }} role="cell">-</div>
            <div className="flex-shrink-0 px-2 py-2" style={{ width: '100px' }} role="cell">-</div>
            <div className="flex-shrink-0 px-2 py-2" style={{ width: '120px' }} role="cell">-</div>
            <div className="flex-shrink-0 px-2 py-2 text-red-600" style={{ width: '150px' }} role="cell">
              <CurrencyDisplay value={pageSummary.total_freight} className="text-red-600 text-xs" />
              <span className="text-gray-400 mx-1">/</span>
              <CurrencyDisplay value={pageSummary.total_extra_cost} className="text-black text-xs" />
            </div>
            <div className="flex-shrink-0 px-2 py-2 text-green-600" style={{ width: '120px' }} role="cell">
              <CurrencyDisplay value={pageSummary.total_driver_receivable} className="text-green-600 text-xs" />
            </div>
            
            {displayedPartners.map(partner => {
              const pageTotal = pageSummary.partner_totals[partner.id] || 0;
              return (
                <div 
                  key={partner.id}
                  className="flex-shrink-0 px-2 py-2 text-center" 
                  style={{ width: '140px' }} 
                  role="cell"
                >
                  <CurrencyDisplay value={pageTotal} className="text-xs" />
                </div>
              );
            })}
            
            <div className="flex-shrink-0 px-2 py-2" style={{ width: '100px' }} role="cell">-</div>
            <div className="flex-shrink-0 px-2 py-2" style={{ width: '100px' }} role="cell">-</div>
          </div>
        </div>
      )}

      {/* 合计行 - 全部合计 */}
      {allSummary && (
        <div 
          className="flex items-center border-t-2 border-t-primary/30 bg-muted/30 text-sm font-bold"
          style={{ width: '100%' }}
          role="row"
        >
          <div className="flex" style={{ minWidth: `${tableWidth}px` }}>
            <div className="flex-shrink-0 w-12 px-2 py-2" role="cell">-</div>
            <div className="flex-shrink-0 px-2 py-2" style={{ width: '120px' }} role="cell">
              <span className="text-xs text-muted-foreground">全部合计</span>
            </div>
            <div className="flex-shrink-0 px-2 py-2" style={{ width: '150px' }} role="cell">-</div>
            <div className="flex-shrink-0 px-2 py-2" style={{ width: '120px' }} role="cell">-</div>
            <div className="flex-shrink-0 px-2 py-2" style={{ width: '100px' }} role="cell">-</div>
            <div className="flex-shrink-0 px-2 py-2" style={{ width: '100px' }} role="cell">-</div>
            <div className="flex-shrink-0 px-2 py-2" style={{ width: '100px' }} role="cell">-</div>
            <div className="flex-shrink-0 px-2 py-2" style={{ width: '120px' }} role="cell">-</div>
            <div className="flex-shrink-0 px-2 py-2 text-red-600" style={{ width: '150px' }} role="cell">
              <CurrencyDisplay value={allSummary.total_freight} className="text-red-600 text-xs" />
              <span className="text-gray-400 mx-1">/</span>
              <CurrencyDisplay value={allSummary.total_extra_cost} className="text-black text-xs" />
            </div>
            <div className="flex-shrink-0 px-2 py-2 text-green-600" style={{ width: '120px' }} role="cell">
              <CurrencyDisplay value={allSummary.total_driver_receivable} className="text-green-600 text-xs" />
            </div>
            
            {displayedPartners.map(partner => {
              const allTotal = allSummary.partner_summary?.find(p => p.partner_id === partner.id)?.total_payable || 0;
              return (
                <div 
                  key={partner.id}
                  className="flex-shrink-0 px-2 py-2 text-center" 
                  style={{ width: '140px' }} 
                  role="cell"
                >
                  <CurrencyDisplay value={allTotal} className="text-xs font-bold" />
                </div>
              );
            })}
            
            <div className="flex-shrink-0 px-2 py-2" style={{ width: '100px' }} role="cell">-</div>
            <div className="flex-shrink-0 px-2 py-2" style={{ width: '100px' }} role="cell">-</div>
          </div>
        </div>
      )}

      {/* 数据统计（作为表格的一部分） */}
      <div className="px-4 py-2 text-xs text-muted-foreground border-t bg-muted/30" role="row">
        <div role="cell">共 {data.length} 条记录</div>
      </div>
    </div>
  );
}

export default VirtualizedFinanceTable;

