import React from 'react';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { X, LucideIcon } from 'lucide-react';

interface ActionSheetAction {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  variant?: 'default' | 'destructive' | 'outline';
  disabled?: boolean;
}

interface MobileActionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  actions: ActionSheetAction[];
  showCancel?: boolean;
  cancelLabel?: string;
}

export function MobileActionSheet({
  open,
  onOpenChange,
  title,
  description,
  actions,
  showCancel = true,
  cancelLabel = '取消'
}: MobileActionSheetProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        {(title || description) && (
          <DrawerHeader className="text-left">
            {title && <DrawerTitle>{title}</DrawerTitle>}
            {description && <DrawerDescription>{description}</DrawerDescription>}
          </DrawerHeader>
        )}
        
        <div className="p-4 space-y-2">
          {actions.map((action, index) => {
            const Icon = action.icon;
            return (
              <Button
                key={index}
                variant={action.variant || 'outline'}
                className={cn(
                  'w-full h-12 justify-start text-base',
                  action.variant === 'destructive' && 'text-red-600'
                )}
                onClick={() => {
                  action.onClick();
                  onOpenChange(false);
                }}
                disabled={action.disabled}
              >
                {Icon && <Icon className="h-5 w-5 mr-3" />}
                {action.label}
              </Button>
            );
          })}
        </div>

        {showCancel && (
          <DrawerFooter>
            <DrawerClose asChild>
              <Button variant="outline" className="w-full h-12 text-base">
                {cancelLabel}
              </Button>
            </DrawerClose>
          </DrawerFooter>
        )}
      </DrawerContent>
    </Drawer>
  );
}

// 简化版操作表
export function SimpleMobileActionSheet({
  open,
  onOpenChange,
  children,
  title
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        {title && (
          <DrawerHeader className="relative">
            <DrawerTitle>{title}</DrawerTitle>
            <DrawerClose asChild>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-4 top-4"
              >
                <X className="h-5 w-5" />
              </Button>
            </DrawerClose>
          </DrawerHeader>
        )}
        <div className="p-4 max-h-[80vh] overflow-y-auto">
          {children}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

