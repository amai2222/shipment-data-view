// 简化占位符组件
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Props {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  user?: any;
  onSave?: (user: any) => void;
}

export function EnterpriseUserEditDialog({ open = false, onOpenChange, user, onSave }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>编辑用户</DialogTitle>
        </DialogHeader>
        <div className="p-4">
          <p>企业用户编辑对话框 (占位符)</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}