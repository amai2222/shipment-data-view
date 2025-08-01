// 文件路径: src/components/business/BusinessEntryImportModal.tsx

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, FileUp, AlertCircle, CheckCircle, AlertTriangle } from "lucide-react";
import { useRef, RefObject } from "react";

interface BusinessEntryImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  importStep: 'idle' | 'preprocessing' | 'preview' | 'processing';
  preprocessingProgress: number;
  importData: {
    valid: any[];
    invalid: any[];
    duplicates: any[];
  };
  importLogs: string[];
  importLogRef: RefObject<HTMLDivElement>;
  onFileUpload: (file: File) => void;
  onStartImport: () => void;
  isImporting: boolean;
  forceImportDuplicates: boolean;
  onForceImportDuplicatesChange: (checked: boolean) => void;
}

export function BusinessEntryImportModal({
  isOpen,
  onClose,
  importStep,
  preprocessingProgress,
  importData,
  importLogs,
  importLogRef,
  onFileUpload,
  onStartImport,
  isImporting,
  forceImportDuplicates,
  onForceImportDuplicatesChange
}: BusinessEntryImportModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileUpload(file);
      if(e.target) e.target.value = '';
    }
  };

  const handleSelectFileClick = () => {
    fileInputRef.current?.click();
  };

  const totalToImport = importData.valid.length + (forceImportDuplicates ? importData.duplicates.length : 0);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>数据导入</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {importStep === 'idle' && (
            <div className="text-center space-y-4">
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8">
                <FileUp className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">选择要导入的Excel文件</p>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  ref={fileInputRef}
                  style={{ display: 'none' }} 
                />
                <Button type="button" onClick={handleSelectFileClick}>
                  选择文件
                </Button>
              </div>
            </div>
          )}

          {importStep === 'preprocessing' && (
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>正在安全解析文件并与数据库预校验...</span>
              </div>
              <Progress value={preprocessingProgress} className="w-full" />
            </div>
          )}

          {importStep === 'preview' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-green-50 p-4 rounded-lg border-l-4 border-green-500">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="font-semibold text-green-800">新记录</span>
                  </div>
                  <div className="text-2xl font-bold text-green-600">{importData.valid.length}</div>
                  <p className="text-xs text-green-700">可直接导入</p>
                </div>
                
                <div className="bg-yellow-50 p-4 rounded-lg border-l-4 border-yellow-500">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-600" />
                    <span className="font-semibold text-yellow-800">数据库已存在</span>
                  </div>
                  <div className="text-2xl font-bold text-yellow-600">{importData.duplicates.length}</div>
                   <p className="text-xs text-yellow-700">可选择性强制导入</p>
                </div>

                <div className="bg-red-50 p-4 rounded-lg border-l-4 border-red-500">
                  <div className="flex items-center space-x-2">
                    <AlertCircle className="h-5 w-5 text-red-600" />
                    <span className="font-semibold text-red-800">格式错误</span>
                  </div>
                  <div className="text-2xl font-bold text-red-600">{importData.invalid.length}</div>
                  <p className="text-xs text-red-700">将被忽略，无法导入</p>
                </div>
              </div>

              {importData.duplicates.length > 0 && (
                <div className="flex items-center space-x-3 my-4 p-4 bg-yellow-50/50 border border-yellow-200 rounded-lg">
                  <Checkbox
                    id="force-import"
                    checked={forceImportDuplicates}
                    onCheckedChange={onForceImportDuplicatesChange}
                  />
                  <label htmlFor="force-import" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    同时导入这 {importData.duplicates.length} 条已存在的记录（不推荐）
                  </label>
                </div>
              )}

              {importData.invalid.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-red-800">格式错误详情 (仅显示前 10 条):</h4>
                  <div className="max-h-40 overflow-y-auto border rounded p-2 bg-red-50/50 font-mono text-xs">
                    {importData.invalid.slice(0, 10).map((item, index) => (
                      <div key={index} className="text-red-700">
                        文件第 {item.originalRow} 行: {item.error}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-4">
                <Button variant="outline" onClick={onClose}>取消</Button>
                <Button 
                  onClick={onStartImport}
                  disabled={totalToImport === 0 || isImporting}
                >
                  {isImporting ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> 导入中...</>
                  ) : (
                    `确认导入 ${totalToImport} 条记录`
                  )}
                </Button>
              </div>
            </div>
          )}

          {importStep === 'processing' && (
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>正在执行批量导入...</span>
              </div>
              <div 
                ref={importLogRef}
                className="bg-gray-900 text-white p-4 rounded-lg max-h-60 overflow-y-auto font-mono text-xs"
              >
                {importLogs.map((log, index) => (
                  <div key={index} className="whitespace-pre-wrap">{log}</div>
                ))}
              </div>
              <Button onClick={onClose} className="w-full">完成</Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

