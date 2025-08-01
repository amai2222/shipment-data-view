import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2, FileUp, AlertCircle, CheckCircle } from "lucide-react";
import { RefObject } from "react";

interface BusinessEntryImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  importStep: 'idle' | 'preprocessing' | 'preview' | 'processing';
  preprocessingProgress: number;
  importData: {
    valid: any[];
    invalid: any[];
    duplicateCount: number;
  };
  importLogs: string[];
  importLogRef: RefObject<HTMLDivElement>;
  onFileUpload: (file: File) => void;
  onStartImport: () => void;
  isImporting: boolean;
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
  isImporting
}: BusinessEntryImportModalProps) {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileUpload(file);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>数据导入</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {importStep === 'idle' && (
            <div className="text-center space-y-4">
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8">
                <FileUp className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">选择要导入的Excel文件</p>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <Button type="button">选择文件</Button>
                </label>
              </div>
            </div>
          )}

          {importStep === 'preprocessing' && (
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>正在预处理数据...</span>
              </div>
              <Progress value={preprocessingProgress} className="w-full" />
            </div>
          )}

          {importStep === 'preview' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="font-semibold text-green-800">有效记录</span>
                  </div>
                  <div className="text-2xl font-bold text-green-600">{importData.valid.length}</div>
                </div>
                
                <div className="bg-red-50 p-4 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <AlertCircle className="h-5 w-5 text-red-600" />
                    <span className="font-semibold text-red-800">无效记录</span>
                  </div>
                  <div className="text-2xl font-bold text-red-600">{importData.invalid.length}</div>
                </div>
                
                <div className="bg-orange-50 p-4 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <AlertCircle className="h-5 w-5 text-orange-600" />
                    <span className="font-semibold text-orange-800">重复记录</span>
                  </div>
                  <div className="text-2xl font-bold text-orange-600">{importData.duplicateCount}</div>
                </div>
              </div>

              {importData.invalid.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-red-800">无效记录详情:</h4>
                  <div className="max-h-40 overflow-y-auto border rounded p-2 bg-red-50">
                    {importData.invalid.map((item, index) => (
                      <div key={index} className="text-sm text-red-700">
                        第{item.row}行: {item.errors.join(', ')}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={onClose}>取消</Button>
                <Button 
                  onClick={onStartImport}
                  disabled={importData.valid.length === 0 || isImporting}
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      导入中...
                    </>
                  ) : (
                    `导入 ${importData.valid.length} 条有效记录`
                  )}
                </Button>
              </div>
            </div>
          )}

          {importStep === 'processing' && (
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>正在导入数据...</span>
              </div>
              
              <div 
                ref={importLogRef}
                className="bg-gray-50 p-4 rounded-lg max-h-60 overflow-y-auto font-mono text-sm"
              >
                {importLogs.map((log, index) => (
                  <div key={index} className="mb-1">
                    {log}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}