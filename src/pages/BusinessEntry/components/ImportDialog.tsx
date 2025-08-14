// 文件路径: src/pages/BusinessEntry/components/ImportDialog.tsx
// 描述: [健壮性修复] 此版本修复了 "Cannot read properties of undefined (reading 'length')" 错误。
//       通过在渲染预览数据前添加必要的空值检查，确保组件在等待数据时不会崩溃。

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { ImportPreviewResult } from '../types';

interface ImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  importStep: 'idle' | 'preprocessing' | 'preview' | 'confirmation' | 'processing';
  importPreview: ImportPreviewResult | null;
  approvedDuplicates: Set<number>;
  setApprovedDuplicates: (updater: (prev: Set<number>) => Set<number>) => void;
  importLogs: string[];
  importLogRef: React.RefObject<HTMLDivElement>;
  onExecuteImport: () => void;
}

export const ImportDialog: React.FC<ImportDialogProps> = ({
  isOpen,
  onClose,
  importStep,
  importPreview,
  approvedDuplicates,
  setApprovedDuplicates,
  importLogs,
  importLogRef,
  onExecuteImport,
}) => {

  const handleDuplicateToggle = (index: number, checked: boolean) => {
    setApprovedDuplicates(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(index);
      } else {
        newSet.delete(index);
      }
      return newSet;
    });
  };

  const renderContent = () => {
    switch (importStep) {
      case 'preprocessing':
      case 'preview':
        return (
          <div className="flex flex-col items-center justify-center h-48">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="mt-4 text-muted-foreground">
              {importStep === 'preprocessing' ? '正在预处理文件...' : '正在生成预览...'}
            </p>
          </div>
        );

      case 'confirmation':
        // [核心修复] 在访问 importPreview 之前，进行严格的空值检查
        if (!importPreview) {
          return (
            <div className="flex flex-col items-center justify-center h-48">
              <XCircle className="h-12 w-12 text-destructive" />
              <p className="mt-4 text-muted-foreground">无法加载预览数据。</p>
            </div>
          );
        }

        const newRecordsCount = importPreview.new_records?.length || 0;
        const duplicateRecordsCount = importPreview.duplicate_records?.length || 0;

        return (
          <div>
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md text-sm">
              <p className="font-semibold">预览结果:</p>
              <p><CheckCircle className="inline-block h-4 w-4 mr-2 text-green-600" />发现 <span className="font-bold">{newRecordsCount}</span> 条新记录。</p>
              <p><AlertTriangle className="inline-block h-4 w-4 mr-2 text-yellow-600" />发现 <span className="font-bold">{duplicateRecordsCount}</span> 条可能重复的记录。</p>
            </div>
            
            {duplicateRecordsCount > 0 && (
              <div>
                <h4 className="font-semibold mb-2">重复记录处理:</h4>
                <p className="text-xs text-muted-foreground mb-2">请勾选您确认需要导入的重复记录。</p>
                <div className="max-h-60 overflow-y-auto space-y-2 border p-2 rounded-md">
                  {importPreview.duplicate_records.map((item, index) => (
                    <div key={index} className="flex items-center space-x-2 p-2 bg-muted/50 rounded">
                      <Checkbox
                        id={`dup-${index}`}
                        checked={approvedDuplicates.has(index)}
                        onCheckedChange={(checked) => handleDuplicateToggle(index, !!checked)}
                      />
                      <label htmlFor={`dup-${index}`} className="text-sm cursor-pointer">
                        司机: {item.record.driver_name}, 日期: {item.record.loading_date}, 金额: {item.record.current_cost}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );

      case 'processing':
        return (
          <div>
            <h4 className="font-semibold mb-2">正在执行最终导入...</h4>
            <div ref={importLogRef} className="max-h-80 overflow-y-auto bg-gray-900 text-white font-mono text-xs p-4 rounded-md">
              {importLogs.map((log, index) => (
                <p key={index}>{log}</p>
              ))}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const isProcessing = importStep === 'preprocessing' || importStep === 'preview' || importStep === 'processing';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>导入运单数据</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          {renderContent()}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" onClick={onClose} disabled={isProcessing}>
              {importStep === 'processing' ? '关闭' : '取消'}
            </Button>
          </DialogClose>
          {importStep === 'confirmation' && (
            <Button onClick={onExecuteImport} disabled={isProcessing}>
              {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              执行最终导入
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
