// 财务开票筛选器组件（简化版）
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Search, X } from 'lucide-react';

interface FilterBarProps {
  filters: any;
  onFilterChange: (filters: any) => void;
}

export function InvoiceRequestFilterBar({ filters, onFilterChange }: FilterBarProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => onFilterChange({})}>
            <X className="h-4 w-4 mr-1" />
            清除
          </Button>
          <Button size="sm">
            <Search className="h-4 w-4 mr-1" />
            搜索
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

