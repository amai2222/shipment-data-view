// Update Mode Import Dialog with full functionality
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { ImportPreviewResultWithUpdate } from '../hooks/useExcelImportWithUpdate';
import { RefreshCw, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

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
    if (!importPreview) {
      toast({
        title: "错误",
        description: "没有可导入的数据",
        variant: "destructive",
      });
      return;
    }

    onExecuteImport();
  };

  const renderPreviewContent = () => {
    if (!importPreview) return null;

    return (
      <div className="space-y-4">
        {/* 统计信息 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-3 border rounded-lg bg-green-50">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium">成功</span>
            </div>
            <div className="text-2xl font-bold text-green-600">
              {importPreview.success_count}
            </div>
          </div>
          
          <div className="p-3 border rounded-lg bg-red-50">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-600" />
              <span className="text-sm font-medium">失败</span>
            </div>
            <div className="text-2xl font-bold text-red-600">
              {importPreview.error_count}
            </div>
          </div>

          <div className="p-3 border rounded-lg bg-blue-50">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium">新增</span>
            </div>
            <div className="text-2xl font-bold text-blue-600">
              {importPreview.inserted_count}
            </div>
          </div>

          <div className="p-3 border rounded-lg bg-orange-50">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-orange-600" />
              <span className="text-sm font-medium">更新</span>
            </div>
            <div className="text-2xl font-bold text-orange-600">
              {importPreview.updated_count}
            </div>
          </div>
        </div>

        {/* 错误详情 */}
        {importPreview.error_details && importPreview.error_details.length > 0 && (
          <Alert className="border-red-200 bg-red-50">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <div className="font-medium">发现 {importPreview.error_details.length} 个错误：</div>
                <ScrollArea className="h-32">
                  {importPreview.error_details.map((error: any, index: number) => (
                    <div key={index} className="text-sm text-red-700">
                      第{error.record_index}行: {error.error_message}
                    </div>
                  ))}
                </ScrollArea>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* 重复记录 */}
        {importPreview.duplicate_records && importPreview.duplicate_records.length > 0 && (
          <Alert className="border-yellow-200 bg-yellow-50">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <div className="font-medium">发现 {importPreview.duplicate_records.length} 条重复记录：</div>
                <ScrollArea className="h-32">
                  {importPreview.duplicate_records.map((record: any, index: number) => (
                    <div key={index} className="text-sm text-yellow-700">
                      运单号: {record.auto_number} - 司机: {record.driver_name}
                    </div>
                  ))}
                </ScrollArea>
              </div>
            </AlertDescription>
          </Alert>
        )}
      </div>
    );
  };

  const renderProcessingContent = () => {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
        </div>
        <div className="text-center">
          <h3 className="text-lg font-semibold">正在处理导入...</h3>
          <p className="text-sm text-muted-foreground">请稍候，不要关闭窗口</p>
        </div>
        
        {/* 日志显示 */}
        <div className="space-y-2">
          <h4 className="font-medium">处理日志：</h4>
          <ScrollArea className="h-40 border rounded p-3" ref={importLogRef}>
            <div className="space-y-1">
              {importLogs.map((log, index) => (
                <div key={index} className="text-sm font-mono text-gray-600">
                  {log}
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {importStep === 'preprocessing' && '处理Excel文件'}
            {importStep === 'preview' && '导入预览'}
            {importStep === 'processing' && '正在导入'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* 处理中状态 */}
          {importStep === 'preprocessing' && (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
              <span className="ml-2">正在处理Excel文件...</span>
            </div>
          )}

          {/* 预览状态 */}
          {importStep === 'preview' && (
            <>
              {/* 导入模式选择 */}
              <div className="space-y-3">
                <Label className="text-base font-medium">选择导入模式：</Label>
                <RadioGroup value={importMode} onValueChange={(value) => setImportMode(value as 'create' | 'update')}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="create" id="create" />
                    <Label htmlFor="create" className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      创建新记录
                      <Badge variant="outline" className="text-xs">默认</Badge>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="update" id="update" />
                    <Label htmlFor="update" className="flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 text-orange-600" />
                      更新现有记录
                      <Badge variant="outline" className="text-xs">保留运单号</Badge>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <Separator />

              {/* 预览内容 */}
              {renderPreviewContent()}
            </>
          )}

          {/* 处理中状态 */}
          {importStep === 'processing' && renderProcessingContent()}

          {/* 操作按钮 */}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={handleClose}>
              取消
            </Button>
            {importStep === 'preview' && (
              <Button 
                onClick={handleConfirm}
                disabled={!importPreview || importPreview.success_count === 0}
              >
                确认导入
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
        
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