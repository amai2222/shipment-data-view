// 付款申请筛选器组件（简化版）
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Search, X } from 'lucide-react';

interface PaymentRequestFilterBarProps {
  filters: any;
  projects: any[];
  partners: any[];
  onFilterChange: (key: string, value: any) => void;
  onSearch: () => void;
  onClear: () => void;
}

export function PaymentRequestFilterBar({
  filters,
  projects,
  partners,
  onFilterChange,
  onSearch,
  onClear
}: PaymentRequestFilterBarProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-end gap-2">
          <Button onClick={onClear} variant="outline" size="sm">
            <X className="h-4 w-4 mr-1" />
            清除筛选
          </Button>
          <Button onClick={onSearch} size="sm">
            <Search className="h-4 w-4 mr-1" />
            搜索
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

