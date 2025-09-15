// 简化占位符组件
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Props {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  waybillId?: string;
}

export function WaybillDetailDialog({ open = false, onOpenChange, waybillId }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>运单详情</DialogTitle>
        </DialogHeader>
        <div className="p-4">
          <p>运单详情对话框 (占位符)</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}