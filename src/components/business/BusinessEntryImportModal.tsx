import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2, FileUp, AlertCircle, CheckCircle } from "lucide-react";
//【关键改动 1/4】导入 useRef 和 RefObject
import { useRef, RefObject } from "react";

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
  //【关键改动 2/4】创建对隐藏文件输入框的引用(Ref)
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileUpload(file);
      // 清空值，以便下次可以上传同一个文件
      if(e.target) {
        e.target.value = '';
      }
    }
  };

  //【关键改动 3/4】创建一个新的点击处理函数，用于我们的可见按钮
  const handleSelectFileClick = () => {
    // 这行代码会以编程方式“点击”那个被我们隐藏的输入框
    fileInputRef.current?.click();
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
                
                {/*【关键改动 4/4】修改 JSX 结构 */}
                {/* 1. 将 Ref 附加到 input 元素上。使用 style 隐藏它比 className 更可靠。 */}
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  ref={fileInputRef}
                  style={{ display: 'none' }} 
                />
                {/* 2. 移除 <label> 包装器，直接将新的点击处理函数绑定到 Button 上。 */}
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
                <span>正在预处理数据与解析文件...</span>
              </div>
              <Progress value={preprocessingProgress} className="w-full" />
            </div>
          )}
          
          {/* preview 和 processing 部分没有变化 */}
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
                      <span className="font-semibold text-red-800">无效/错误记录</span>
                  </div>
                  <div className="text-2xl font-bold text-red-600">{importData.invalid.length}</div>
                  </div>
                  
                  <div className="bg-orange-50 p-4 rounded-lg">
                  <div className="flex items-center space-x-2">
                      <AlertCircle className="h-5 w-5 text-orange-600" />
                      <span className="font-semibold text-orange-800">文件内重复</span>
                  </div>
                  <div className="text-2xl font-bold text-orange-600">{importData.duplicateCount}</div>
                  </div>
              </div>

              {importData.invalid.length > 0 && (
                  <div className="space-y-2">
                  <h4 className="font-semibold text-red-800">错误记录详情 (仅显示部分):</h4>
                  <div className="max-h-40 overflow-y-auto border rounded p-2 bg-red-50 text-xs font-mono">
                      {importData.invalid.slice(0, 10).map((row, index) => (
                      <div key={index}>
                          原表格第 {row.originalRow} 行: {row.error}
                      </div>
                      ))}
                  </div>
                  </div>
              )}

              <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={onClose} disabled={isImporting}>取消</Button>
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
                      `确认导入 ${importData.valid.length} 条记录`
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
                  <div key={index} className="whitespace-pre-wrap">
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
