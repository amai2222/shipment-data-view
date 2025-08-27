import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

// 1. 增强 Props 接口，使其更通用
interface BatchInputDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (values: string[]) => void;
  title: string; // 新增：动态标题
  description: string; // 新增：动态描述
  placeholder: string; // 新增：动态占位符
  initialValue?: string[]; // 新增：支持传入初始值
}

export function BatchInputDialog({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  description, 
  placeholder, 
  initialValue = [] 
}: BatchInputDialogProps) {
  const [inputValue, setInputValue] = useState('');

  // 2. 新增 useEffect，用于在弹窗打开时设置初始值
  useEffect(() => {
    if (isOpen) {
      // 将传入的数组用换行符连接成字符串
      setInputValue(initialValue.join('\n'));
    }
  }, [isOpen, initialValue]);

  const handleConfirm = () => {
    const values = inputValue
      .split(/[\n,]+/)
      .map(item => item.trim())
      .filter(item => item.length > 0);
    
    onConfirm(values);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          {/* 3. 使用 Props 替换写死的文本 */}
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <p className="text-sm text-muted-foreground mb-2">
            {description}
          </p>
          <Textarea
            placeholder={placeholder}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            rows={10}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={handleConfirm}>确认</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
