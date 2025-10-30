// 批量操作按钮组件
import { Button } from '@/components/ui/button';
import { Receipt } from 'lucide-react';

interface BulkActionButtonsProps {
  selectedCount: number;
  selectionMode: 'none' | 'current_page' | 'all_filtered';
  totalRecords: number;
  onApplyForInvoice: () => void;
  isGenerating: boolean;
}

export function BulkActionButtons({
  selectedCount,
  selectionMode,
  totalRecords,
  onApplyForInvoice,
  isGenerating
}: BulkActionButtonsProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium text-blue-900">
            {selectionMode === 'all_filtered' ? (
              <>已选择所有 <span className="font-bold">{totalRecords}</span> 条记录</>
            ) : (
              <>已选择 <span className="font-bold">{selectedCount}</span> 条记录</>
            )}
          </div>
          <div className="text-sm text-blue-700">可为选中的运单创建开票申请</div>
        </div>
        <Button
          onClick={onApplyForInvoice}
          disabled={isGenerating}
          className="bg-green-600 hover:bg-green-700"
        >
          <Receipt className="mr-2 h-4 w-4" />
          {isGenerating ? '生成中...' : '一键申请开票'}
        </Button>
      </div>
    </div>
  );
}

