// 批量操作栏组件
// 用于需要批量操作的页面

import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ConfirmDialog";

export interface BulkAction {
  key: string;
  label: string;
  icon?: ReactNode;
  variant?: 'default' | 'outline' | 'destructive';
  className?: string;
  confirmTitle?: string;
  confirmDescription?: string;
  onClick: () => void | Promise<void>;
  disabled?: boolean;
  needConfirm?: boolean;
}

interface BulkActionBarProps {
  selectedCount: number;
  actions: BulkAction[];
  isProcessing?: boolean;
  className?: string;
}

export function BulkActionBar({ 
  selectedCount, 
  actions, 
  isProcessing = false,
  className = "" 
}: BulkActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="text-sm text-muted-foreground">
        已选择 {selectedCount} 个
      </span>
      {actions.map(action => {
        const button = (
          <Button
            key={action.key}
            variant={action.variant || 'outline'}
            size="sm"
            onClick={action.onClick}
            disabled={action.disabled || isProcessing}
            className={action.className}
          >
            {action.icon}
            {action.label}
          </Button>
        );

        // 如果需要确认，包装在ConfirmDialog中
        if (action.needConfirm && action.confirmTitle) {
          return (
            <ConfirmDialog
              key={action.key}
              title={action.confirmTitle}
              description={action.confirmDescription || ''}
              onConfirm={action.onClick}
            >
              {button}
            </ConfirmDialog>
          );
        }

        return button;
      })}
    </div>
  );
}

