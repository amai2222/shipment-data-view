import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle } from 'lucide-react';
import { triggerHaptic } from '@/utils/mobile';

interface MobileConfirmDialogProps {
  trigger: React.ReactNode;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'warning' | 'danger';
  onConfirm: () => void | Promise<void>;
  disabled?: boolean;
}

export function MobileConfirmDialog({
  trigger,
  title,
  description,
  confirmText = '确认',
  cancelText = '取消',
  variant = 'default',
  onConfirm,
  disabled = false
}: MobileConfirmDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    // 触觉反馈
    if (variant === 'danger') {
      triggerHaptic('error');
    } else if (variant === 'warning') {
      triggerHaptic('warning');
    } else {
      triggerHaptic('success');
    }

    setLoading(true);
    try {
      await onConfirm();
      setOpen(false);
    } catch (error) {
      console.error('操作失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    triggerHaptic('light');
    setOpen(false);
  };

  // 根据variant确定颜色
  const getVariantStyles = () => {
    switch (variant) {
      case 'danger':
        return {
          icon: <AlertCircle className="h-12 w-12 text-red-600 mb-2" />,
          confirmClass: 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white min-h-[48px] shadow-lg hover:shadow-xl active:scale-95 transition-all duration-200 rounded-xl font-medium'
        };
      case 'warning':
        return {
          icon: <AlertCircle className="h-12 w-12 text-orange-600 mb-2" />,
          confirmClass: 'bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white min-h-[48px] shadow-lg hover:shadow-xl active:scale-95 transition-all duration-200 rounded-xl font-medium'
        };
      default:
        return {
          icon: <CheckCircle className="h-12 w-12 text-green-600 mb-2" />,
          confirmClass: 'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white min-h-[48px] shadow-lg hover:shadow-xl active:scale-95 transition-all duration-200 rounded-xl font-medium'
        };
    }
  };

  const styles = getVariantStyles();

  return (
    <>
      <div
        onClick={() => {
          if (!disabled) {
            triggerHaptic('light');
            setOpen(true);
          }
        }}
      >
        {trigger}
      </div>
      
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[90vw] sm:max-w-md rounded-2xl p-0">
          <div className="p-6 text-center">
            {/* 图标 */}
            <div className="flex justify-center">
              {styles.icon}
            </div>
            
            {/* 标题 */}
            <DialogHeader className="space-y-2 mb-4">
              <DialogTitle className="text-xl font-bold text-center">
                {title}
              </DialogTitle>
              <DialogDescription className="text-base text-center whitespace-pre-line leading-relaxed">
                {description}
              </DialogDescription>
            </DialogHeader>
          </div>

          {/* 按钮区域 */}
          <DialogFooter className="p-4 pt-0 gap-3 flex-col sm:flex-col">
            <Button
              onClick={handleConfirm}
              disabled={loading}
              className={styles.confirmClass}
              size="lg"
            >
              {loading ? '处理中...' : confirmText}
            </Button>
            <Button
              onClick={handleCancel}
              disabled={loading}
              variant="outline"
              size="lg"
              className="min-h-[48px] border-2 active:scale-95 transition-all duration-200 rounded-xl font-medium"
            >
              {cancelText}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

