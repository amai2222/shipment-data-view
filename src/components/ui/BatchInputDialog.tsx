import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

interface BatchInputDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (values: string[]) => void;
}

export function BatchInputDialog({ isOpen, onClose, onConfirm }: BatchInputDialogProps) {
  const [inputValue, setInputValue] = useState('');

  const handleConfirm = () => {
    // 通过换行符或逗号分割，去除首尾空格，并过滤掉空字符串
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
          <DialogTitle>批量输入运单号</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <p className="text-sm text-muted-foreground mb-2">
            请粘贴运单号，用换行或逗号分隔。
          </p>
          <Textarea
            placeholder="例如:&#10;YDH-001,&#10;YDH-002&#10;YDH-003"
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
