// 批量操作按钮组件（付款申请）
import { Button } from '@/components/ui/button';
import { Banknote } from 'lucide-react';

interface BulkActionButtonsProps {
  selectedCount: number;
  selectionMode: 'none' | 'current_page' | 'all_filtered';
  totalRecords: number;
  onApplyForPayment: () => void;
  isGenerating: boolean;
}

export function BulkActionButtons({
  selectedCount,
  selectionMode,
  totalRecords,
  onApplyForPayment,
  isGenerating
}: BulkActionButtonsProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium text-green-900">
            {selectionMode === 'all_filtered' ? (
              <>已选择所有 <span className="font-bold">{totalRecords}</span> 条记录</>
            ) : (
              <>已选择 <span className="font-bold">{selectedCount}</span> 条记录</>
            )}
          </div>
          <div className="text-sm text-green-700">可为选中的运单创建付款申请</div>
        </div>
        <Button
          onClick={onApplyForPayment}
          disabled={isGenerating}
          className="bg-green-600 hover:bg-green-700"
        >
          <Banknote className="mr-2 h-4 w-4" />
          {isGenerating ? '生成中...' : '一键申请付款'}
        </Button>
      </div>
    </div>
  );
}

