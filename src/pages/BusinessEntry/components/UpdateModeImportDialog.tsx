// Simplified Update Mode Import Dialog - disabled for now
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ImportPreviewResultWithUpdate } from '../hooks/useExcelImportWithUpdate';

interface UpdateModeImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  importStep: 'idle' | 'preprocessing' | 'preview' | 'confirmation' | 'processing';
  importPreview: ImportPreviewResultWithUpdate | null;
  importMode: 'create' | 'update';
  setImportMode: (mode: 'create' | 'update') => void;
  importLogs: string[];
  importLogRef: React.RefObject<HTMLDivElement>;
  onExecuteImport: () => void;
}

export function UpdateModeImportDialog({
  isOpen,
  onClose,
  importStep,
  importPreview,
  importMode,
  setImportMode,
  importLogs,
  importLogRef,
  onExecuteImport
}: UpdateModeImportDialogProps) {
  const { toast } = useToast();

  const handleClose = () => {
    onClose();
  };

  const handleConfirm = () => {
    toast({
      title: "功能暂时禁用",
      description: "更新模式导入功能正在维护中",
      variant: "destructive",
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>导入预览（更新模式）</DialogTitle>
        </DialogHeader>
        
        <div className="py-6">
          <div className="text-center text-muted-foreground">
            <p>更新模式导入功能正在维护中，请稍后再试。</p>
            {importPreview && (
              <div className="mt-4 text-sm">
                <p>成功记录: {importPreview.success_count}</p>
                <p>错误记录: {importPreview.error_count}</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={handleClose}>
            关闭
          </Button>
          <Button onClick={handleConfirm} disabled={importStep === 'processing'}>
            确认导入
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}