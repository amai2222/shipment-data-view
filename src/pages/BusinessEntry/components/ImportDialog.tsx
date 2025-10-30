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
          <div className="space-y-4">
            <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-700">
              <Siren className="h-4 w-4" />
              <AlertTitle>智能导入预览完成</AlertTitle>
              <AlertDescription>
                系统已完成重复数据检查和智能分析，请确认后执行导入。导入时将自动创建司机、地点等关联数据。
              </AlertDescription>
            </Alert>

            <div className="grid gap-4">
              {/* 新记录统计 */}
              <div className="p-4 border border-green-200 rounded-md bg-green-50 dark:bg-green-900/20 dark:border-green-700">
                <h4 className="font-semibold text-lg text-green-800 dark:text-green-300 flex items-center gap-2">
                  ✓ {importPreview.new_records.length} 条新记录
                </h4>
                <p className="text-sm text-muted-foreground mt-1">
                  这些记录在数据库中不存在，将被直接导入并自动创建相关司机、地点信息。
                </p>
              </div>

              {/* 重复记录处理 */}
              {importPreview.duplicate_records.length > 0 && (
                <div className="p-4 border border-yellow-300 rounded-md bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-600">
                  <h4 className="font-semibold text-lg text-yellow-800 dark:text-yellow-300 flex items-center gap-2">
                    ⚠️ 发现 {importPreview.duplicate_records.length} 条重复记录
                  </h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    重复判断基于：项目名称、合作链路、司机姓名、车牌号、装货地点、装货日期、装货重量。
                    如需强制导入，请勾选确认。
                  </p>
                  
                  <div className="flex items-center space-x-2 p-2 border-b mb-3 bg-white/50 dark:bg-gray-800/50 rounded">
                    <Checkbox 
                      id="select-all-duplicates" 
                      checked={
                        approvedDuplicates.size > 0 && approvedDuplicates.size === importPreview.duplicate_records.length 
                          ? true 
                          : approvedDuplicates.size > 0 ? 'indeterminate' : false
                      } 
                      onCheckedChange={handleToggleAllDuplicates} 
                    />
                    <label htmlFor="select-all-duplicates" className="font-medium cursor-pointer">
                      全选/全部取消 ({approvedDuplicates.size}/{importPreview.duplicate_records.length})
                    </label>
                  </div>
                  
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {importPreview.duplicate_records.map((item, index) => (
                      <div key={index} className="flex items-center space-x-2 p-3 rounded-md hover:bg-yellow-100 dark:hover:bg-yellow-800/30 border border-yellow-200 dark:border-yellow-700">
                        <Checkbox 
                          id={`dup-${index}`} 
                          checked={approvedDuplicates.has(index)} 
                          onCheckedChange={() => handleToggleDuplicateApproval(index)} 
                        />
                        <label htmlFor={`dup-${index}`} className="text-sm cursor-pointer flex-1">
                          <div className="font-medium">{item.record.project_name} - {item.record.driver_name}</div>
                          <div className="text-xs text-muted-foreground">
                            {item.record.loading_location} → {item.record.unloading_location} | {item.record.loading_date} | {item.record.loading_weight || 'N/A'}吨
                          </div>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 错误记录 */}
              {importPreview.error_records.length > 0 && (
                <div className="p-4 border border-red-300 rounded-md bg-red-50 dark:bg-red-900/20 dark:border-red-600">
                  <h4 className="font-semibold text-lg text-red-800 dark:text-red-300 flex items-center gap-2">
                    ❌ {importPreview.error_records.length} 条错误记录
                  </h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    这些记录因格式或数据问题将不会被导入，请修正后重新上传。
                  </p>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {importPreview.error_records.map((errorItem, index) => (
                      <div key={index} className="text-xs p-2 bg-red-100 dark:bg-red-900/30 rounded border border-red-200">
                        <div className="font-medium text-red-800 dark:text-red-300">
                          {errorItem.error}
                        </div>
                        <div className="text-red-600 dark:text-red-400 mt-1">
                          项目: {errorItem.record?.project_name || '未知'} | 司机: {errorItem.record?.driver_name || '未知'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 操作按钮 */}
            <div className="flex justify-between items-center pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                预计导入: {importPreview.new_records.length + approvedDuplicates.size} 条记录
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose}>取消</Button>
                <Button 
                  onClick={onExecuteImport} 
                  disabled={(importPreview.new_records.length + approvedDuplicates.size) === 0}
                  className="min-w-32"
                >
                  确认并导入 ({importPreview.new_records.length + approvedDuplicates.size})
                </Button>
              </div>
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
