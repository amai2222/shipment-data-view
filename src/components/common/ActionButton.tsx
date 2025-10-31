// 统一操作按钮组件
// 带确认对话框支持的操作按钮

import { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ConfirmDialog';

export interface ActionButtonConfig {
  label: string;
  icon?: ReactNode;
  onClick: () => void | Promise<void>;
  variant?: 'default' | 'outline' | 'destructive' | 'ghost';
  className?: string;
  disabled?: boolean;
  needConfirm?: boolean;
  confirmTitle?: string;
  confirmDescription?: string;
  title?: string; // tooltip
}

interface ActionButtonProps extends ActionButtonConfig {
  size?: 'sm' | 'default' | 'lg';
}

export function ActionButton({
  label,
  icon,
  onClick,
  variant = 'default',
  className = '',
  disabled = false,
  needConfirm = false,
  confirmTitle,
  confirmDescription,
  title,
  size = 'sm'
}: ActionButtonProps) {
  // ✅ 修复：如果需要确认，button不应该直接绑定onClick
  const button = (
    <Button
      variant={variant}
      size={size}
      onClick={needConfirm ? undefined : onClick}  // ✅ 关键修复：需要确认时不绑定onClick
      disabled={disabled}
      className={className}
      title={title}
    >
      {icon}
      {label}
    </Button>
  );

  if (needConfirm && confirmTitle) {
    return (
      <ConfirmDialog
        title={confirmTitle}
        description={confirmDescription || ''}
        onConfirm={onClick}  // ✅ onClick只在确认后执行
      >
        {button}
      </ConfirmDialog>
    );
  }

  return button;
}

// 操作按钮组
interface ActionButtonsProps {
  actions: ActionButtonConfig[];
  size?: 'sm' | 'default' | 'lg';
  className?: string;
}

export function ActionButtons({ actions, size = 'sm', className = '' }: ActionButtonsProps) {
  return (
    <div className={`flex items-center justify-center gap-3 flex-wrap ${className}`}>
      {actions.map((action, index) => (
        <ActionButton key={index} {...action} size={size} />
      ))}
    </div>
  );
}

