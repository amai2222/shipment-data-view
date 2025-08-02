// src/pages/BusinessEntry/components/ImportDialog.tsx

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Siren } from "lucide-react";
import { ImportPreviewResult } from '../types';

interface ImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  importStep: 'idle' | 'preprocessing' | 'preview' | 'confirmation' | 'processing';
  importPreview: ImportPreviewResult | null;
  approvedDuplicates: Set<number>;
  setApprovedDuplicates: React.Dispatch<React.SetStateAction<Set<number>>>;
  importLogs: string[];
  importLogRef: React.RefObject<HTMLDivElement>;
  onExecuteImport: () => void;
}

export function ImportDialog({ isOpen, onClose, importStep, importPreview, approvedDuplicates, setApprovedDuplicates, importLogs, importLogRef, onExecuteImport }: ImportDialogProps) {
  
  const handleToggleDuplicateApproval = (index: number) => setApprovedDuplicates(prev => {
    const newSet = new Set(prev);
    if (newSet.has(index)) newSet.delete(index);
    else newSet.add(index);
    return newSet;
  });

  const handleToggleAllDuplicates = (checked: boolean | 'indeterminate') => {
    if (!importPreview) return;
    if (checked === true) {
      setApprovedDuplicates(new Set(importPreview.duplicate_records.map((_, i) => i)));
    } else {
      setApprovedDuplicates(new Set());
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader><DialogTitle>导入运单数据</DialogTitle></DialogHeader>
        {(importStep === 'preprocessing' || importStep === 'preview') && (
          <div className="py-8 text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-muted-foreground">{importStep === 'preprocessing' ? '正在检查文件内容...' : '正在获取导入预览，请稍候...'}</p>
          </div>
        )}
        {importStep === 'confirmation' && importPreview && (
          <div>
            <Alert className="mb-4 bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-700"><Siren className="h-4 w-4" /><AlertTitle>请确认导入操作</AlertTitle><AlertDescription>系统已完成预检查，请审核后执行最终导入。</AlertDescription></Alert>
            <div className="mb-4 p-4 border rounded-md"><h4 className="font-semibold text-lg">{importPreview.new_records.length} 条新记录</h4><p className="text-sm text-muted-foreground">这些记录在数据库中不存在，将被直接导入。</p></div>
            {importPreview.duplicate_records.length > 0 && (
              <div className="mb-4 p-4 border border-yellow-300 rounded-md bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-600">
                <h4 className="font-semibold text-lg text-yellow-800 dark:text-yellow-300">发现 {importPreview.duplicate_records.length} 条疑似重复记录</h4>
                <p className="text-sm text-muted-foreground mb-4">系统检测到数据库中可能已存在这些记录。如果您确认需要再次导入，请手动勾选。</p>
                <div className="flex items-center space-x-2 p-2 border-b mb-2"><Checkbox id="select-all-duplicates" checked={approvedDuplicates.size > 0 && approvedDuplicates.size === importPreview.duplicate_records.length ? true : approvedDuplicates.size > 0 ? 'indeterminate' : false} onCheckedChange={handleToggleAllDuplicates} /><label htmlFor="select-all-duplicates" className="font-medium cursor-pointer">全选/全部取消</label></div>
                <div className="max-h-40 overflow-y-auto pr-2">{importPreview.duplicate_records.map((item, index) => (<div key={index} className="flex items-center space-x-2 p-2 rounded-md hover:bg-yellow-100 dark:hover:bg-yellow-800/30"><Checkbox id={`dup-${index}`} checked={approvedDuplicates.has(index)} onCheckedChange={() => handleToggleDuplicateApproval(index)} /><label htmlFor={`dup-${index}`} className="text-sm cursor-pointer w-full">{`${item.record.driver_name} | ${item.record.loading_location} | ${item.record.loading_date} | ${item.record.loading_weight || 'N/A'}吨`}</label></div>))}</div>
              </div>
            )}
            {importPreview.error_records.length > 0 && (<div className="mb-4 p-4 border border-red-300 rounded-md bg-red-50 dark:bg-red-900/20 dark:border-red-600"><h4 className="font-semibold text-lg text-red-800 dark:text-red-300">{importPreview.error_records.length} 条错误记录</h4><p className="text-sm text-muted-foreground mb-2">这些记录因格式或数据问题将不会被导入。</p></div>)}
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={onClose}>取消</Button>
              <Button onClick={onExecuteImport} disabled={(importPreview.new_records.length + approvedDuplicates.size) === 0}>确认并导入 ({importPreview.new_records.length + approvedDuplicates.size})</Button>
            </div>
          </div>
        )}
        {importStep === 'processing' && (
          <div className="py-4 space-y-4">
            <h3 className="font-semibold">正在执行最终导入...</h3>
            <div ref={importLogRef} className="h-64 overflow-y-auto bg-gray-900 text-white font-mono text-xs p-4 rounded-md">
              {importLogs.map((log, i) => <p key={i} className={log.includes('失败') || log.includes('error') ? 'text-red-400' : 'text-green-400'}>{log}</p>)}
            </div>
            <div className="text-center pt-4"><Button onClick={onClose}>关闭</Button></div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
