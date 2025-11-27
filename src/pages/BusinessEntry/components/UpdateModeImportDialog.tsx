// 支持更新模式的导入对话框
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Loader2, Siren, RefreshCw, Plus, Copy } from "lucide-react";
import { ImportPreviewResultWithUpdate } from '../hooks/useExcelImportWithUpdate';
import { useToast } from "@/hooks/use-toast";

interface UpdateModeImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  importStep: 'idle' | 'preprocessing' | 'preview' | 'confirmation' | 'processing' | 'completed';
  importPreview: ImportPreviewResultWithUpdate | null;
  importMode: 'create' | 'update';
  setImportMode: (mode: 'create' | 'update') => void;
  importLogs: string[];
  importLogRef: React.RefObject<HTMLDivElement>;
  onExecuteImport: () => void;
  // 新增：被勾选的重复记录索引集合与设置器
  approvedDuplicates: Set<number>;
  setApprovedDuplicates: (value: Set<number>) => void;
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
  onExecuteImport,
  approvedDuplicates,
  setApprovedDuplicates
}: UpdateModeImportDialogProps) {
  const { toast } = useToast();
  
  const toggleDuplicate = (index: number) => {
    const next = new Set(approvedDuplicates);
    if (next.has(index)) next.delete(index); else next.add(index);
    setApprovedDuplicates(next);
  };
  
  // 复制新记录的 JSON 数据
  const copyNewRecordsJSON = () => {
    if (!importPreview || importPreview.new_records.length === 0) {
      toast({
        title: "无新记录",
        description: "没有新记录可复制",
        variant: "destructive"
      });
      return;
    }
    
    // 提取新记录的 record 字段
    const newRecordsData = importPreview.new_records.map(item => item.record);
    const jsonString = JSON.stringify(newRecordsData, null, 2);
    
    // 复制到剪贴板
    navigator.clipboard.writeText(jsonString).then(() => {
      toast({
        title: "复制成功",
        description: `已复制 ${importPreview.new_records.length} 条新记录的 JSON 数据到剪贴板`,
      });
    }).catch((err) => {
      console.error('复制失败:', err);
      toast({
        title: "复制失败",
        description: "无法复制到剪贴板，请查看浏览器控制台",
        variant: "destructive"
      });
      // 如果复制失败，在控制台输出
      console.log('新记录 JSON 数据:', jsonString);
    });
  };

  const toggleAllDuplicates = (checked: boolean) => {
    if (!importPreview) return;
    if (checked) {
      setApprovedDuplicates(new Set(importPreview.update_records.map((_, i) => i)));
    } else {
      setApprovedDuplicates(new Set());
    }
  };

  // 计算实际会导入的记录数量
  const getActualImportCount = () => {
    if (!importPreview) return 0;
    return importPreview.new_records.length + 
           (importMode === 'update' ? approvedDuplicates.size : 0);
  };

  // 检查全选框的状态
  const isAllDuplicatesSelected = () => {
    if (!importPreview || importPreview.update_records.length === 0) return false;
    return approvedDuplicates.size === importPreview.update_records.length;
  };

  const isSomeDuplicatesSelected = () => {
    return approvedDuplicates.size > 0 && approvedDuplicates.size < (importPreview?.update_records.length || 0);
  };

  
  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Excel导入 - 运单维护
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {/* 预处理阶段 */}
          {importStep === 'preprocessing' && (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                <p className="text-lg font-medium">正在解析Excel文件...</p>
                <p className="text-sm text-muted-foreground">请稍候，系统正在处理您的数据</p>
              </div>
            </div>
          )}

          {/* 预览阶段 */}
          {importStep === 'preview' && (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                <p className="text-lg font-medium">正在分析数据...</p>
                <p className="text-sm text-muted-foreground">系统正在检查重复记录和验证数据</p>
              </div>
            </div>
          )}

          {/* 确认阶段 */}
          {importStep === 'confirmation' && importPreview && (
            <div className="space-y-6">
              {/* 导入模式选择 */}
              <div className="p-4 border rounded-lg bg-blue-50 dark:bg-blue-900/20">
                <h3 className="font-semibold text-lg mb-4">选择导入模式</h3>
                <RadioGroup value={importMode} onValueChange={(value) => setImportMode(value as 'create' | 'update')}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="create" id="create-mode" />
                    <Label htmlFor="create-mode" className="flex-1">
                      <div className="font-medium">全部创建新记录 (生成新运单号)</div>
                      <div className="text-sm text-muted-foreground">
                        为所有记录创建新的运单，即使存在重复记录也会强制创建
                      </div>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="update" id="update-mode" />
                    <Label htmlFor="update-mode" className="flex-1">
                      <div className="font-medium">全部更新现有记录 (保留运单号,更新其他字段)</div>
                      <div className="text-sm text-muted-foreground">
                        对于重复记录，更新现有记录的其他字段，保留原有运单号
                      </div>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* 数据统计 */}
              <div className="grid gap-4 md:grid-cols-3">
                {/* 新记录统计 */}
                <div className="p-4 border border-green-200 rounded-md bg-green-50 dark:bg-green-900/20 dark:border-green-700">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <h4 className="font-semibold text-lg text-green-800 dark:text-green-300 flex items-center gap-2">
                        <Plus className="h-5 w-5" />
                        {importPreview.new_records.length} 条新记录
                      </h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        这些记录在数据库中不存在，将被直接导入。
                      </p>
                    </div>
                    {importPreview.new_records.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={copyNewRecordsJSON}
                        className="shrink-0"
                        title="复制新记录的 JSON 数据用于调试"
                      >
                        <Copy className="h-4 w-4 mr-1" />
                        复制 JSON
                      </Button>
                    )}
                  </div>
                </div>

                {/* 更新记录统计 */}
                {importPreview.update_records.length > 0 && (
                  <div className="p-4 border border-yellow-300 rounded-md bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-600">
                    <h4 className="font-semibold text-lg text-yellow-800 dark:text-yellow-300 flex items-center gap-2">
                      <RefreshCw className="h-5 w-5" />
                      {importPreview.update_records.length} 条重复记录
                    </h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      这些记录在数据库中已存在，将根据选择的模式处理。
                    </p>
                  </div>
                )}

                {/* 错误记录统计 */}
                {importPreview.error_records.length > 0 && (
                  <div className="p-4 border border-red-300 rounded-md bg-red-50 dark:bg-red-900/20 dark:border-red-600">
                    <h4 className="font-semibold text-lg text-red-800 dark:text-red-300 flex items-center gap-2">
                      <Siren className="h-5 w-5" />
                      {importPreview.error_records.length} 条错误记录
                    </h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      这些记录存在数据错误，无法导入。
                    </p>
                  </div>
                )}
              </div>

              {/* 重复记录详情（支持逐条勾选） */}
              {importPreview.update_records.length > 0 && (
                <div className="p-4 border border-yellow-300 rounded-md bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-600">
                  <h4 className="font-semibold text-lg text-yellow-800 dark:text-yellow-300 mb-4">
                    重复记录详情
                  </h4>
                  <div className="flex items-center justify-between mb-2 text-sm">
                    <div>
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isAllDuplicatesSelected()}
                          ref={(input) => {
                            if (input) input.indeterminate = isSomeDuplicatesSelected();
                          }}
                          onChange={(e) => toggleAllDuplicates(e.currentTarget.checked)}
                        />
                        <span>全选重复记录</span>
                      </label>
                    </div>
                    <div className="text-muted-foreground">
                      已选择 {approvedDuplicates.size} / {importPreview.update_records.length}
                    </div>
                  </div>
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {importPreview.update_records.map((item, index) => (
                      <div key={index} className="p-3 bg-white dark:bg-gray-800 rounded border border-yellow-200 dark:border-yellow-700">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-medium text-sm">
                            {item.record.project_name} - {item.record.driver_name}
                          </div>
                          <div className="text-xs text-muted-foreground bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                            现有运单号: {item.existing_auto_number}
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground mb-2">
                          {item.record.loading_location} → {item.record.unloading_location} | {item.record.loading_date} | {item.record.loading_weight || 'N/A'}吨
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="text-xs text-yellow-700 dark:text-yellow-300">
                            处理方式: {importMode === 'create' ? '已跳过(创建模式不导入重复)' : (approvedDuplicates.has(index) ? '更新现有记录' : '跳过此记录')}
                          </div>
                          {importMode === 'update' && (
                            <label className="inline-flex items-center gap-2 text-xs">
                              <input
                                type="checkbox"
                                checked={approvedDuplicates.has(index)}
                                onChange={() => toggleDuplicate(index)}
                              />
                              <span>勾选以更新</span>
                            </label>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 错误记录详情 */}
              {importPreview.error_records.length > 0 && (
                <div className="p-4 border border-red-300 rounded-md bg-red-50 dark:bg-red-900/20 dark:border-red-600">
                  <h4 className="font-semibold text-lg text-red-800 dark:text-red-300 mb-4">
                    错误记录详情
                  </h4>
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {importPreview.error_records.map((item, index) => (
                      <div key={index} className="p-3 bg-white dark:bg-gray-800 rounded border border-red-200 dark:border-red-700">
                        <div className="font-medium text-sm mb-1">
                          {item.record.project_name || '未知项目'} - {item.record.driver_name || '未知司机'}
                        </div>
                        <div className="text-xs text-red-600 dark:text-red-400">
                          错误: {item.error}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 导入摘要 */}
              <div className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-800">
                <h4 className="font-semibold text-lg mb-2">导入摘要</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>预计导入:</span>
                    <span className="font-medium">{getActualImportCount()} 条记录</span>
                  </div>
                  <div className="flex justify-between">
                    <span>·新记录:</span>
                    <span className="font-medium text-green-600">{importPreview.new_records.length}条</span>
                  </div>
                  <div className="flex justify-between">
                    <span>·{importMode === 'create' ? '跳过重复记录' : '更新重复记录(勾选)'}:</span>
                    <span className="font-medium text-yellow-600">{importMode === 'update' ? approvedDuplicates.size : importPreview.update_records.length}条</span>
                  </div>
                  {importPreview.error_records.length > 0 && (
                    <div className="flex justify-between">
                      <span>·错误记录:</span>
                      <span className="font-medium text-red-600">{importPreview.error_records.length}条 (不会导入)</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 处理阶段 */}
          {importStep === 'processing' && (
            <div className="space-y-4">
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                  <p className="text-lg font-medium">正在导入数据...</p>
                  <p className="text-sm text-muted-foreground">请稍候，系统正在处理您的数据</p>
                </div>
              </div>

              {/* 导入日志 */}
              {importLogs.length > 0 && (
                <div className="border rounded-lg">
                  <div className="p-3 border-b bg-gray-50 dark:bg-gray-800">
                    <h4 className="font-semibold">导入日志</h4>
                  </div>
                  <div 
                    ref={importLogRef}
                    className="p-3 max-h-64 overflow-y-auto bg-gray-900 text-green-400 font-mono text-sm"
                  >
                    {importLogs.map((log, index) => (
                      <div key={index}>{log}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 完成阶段 */}
          {importStep === 'completed' && (
            <div className="space-y-4">
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  {(() => {
                    // 从日志中解析成功和失败数量
                    const successLog = importLogs.find(log => log.includes('导入完成！成功:') && log.includes('失败:'));
                    if (successLog) {
                      const successMatch = successLog.match(/成功: (\d+)/);
                      const failMatch = successLog.match(/失败: (\d+)/);
                      const successCount = successMatch ? parseInt(successMatch[1]) : 0;
                      const failCount = failMatch ? parseInt(failMatch[1]) : 0;
                      const totalCount = successCount + failCount;
                      
                      if (failCount === 0) {
                        // 全部成功
                        return (
                          <>
                            <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                              <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                            <p className="text-lg font-medium text-green-600">导入完成！</p>
                            <p className="text-sm text-muted-foreground">所有数据已成功导入并处理</p>
                          </>
                        );
                      } else if (successCount === 0) {
                        // 全部失败
                        return (
                          <>
                            <div className="h-16 w-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                              <svg className="h-8 w-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </div>
                            <p className="text-lg font-medium text-red-600">导入失败！</p>
                            <p className="text-sm text-muted-foreground">所有 {failCount} 条记录导入失败</p>
                          </>
                        );
                      } else {
                        // 部分成功
                        return (
                          <>
                            <div className="h-16 w-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                              <svg className="h-8 w-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                              </svg>
                            </div>
                            <p className="text-lg font-medium text-yellow-600">部分导入成功！</p>
                            <p className="text-sm text-muted-foreground">
                              成功导入 {successCount} 条，失败 {failCount} 条（共 {totalCount} 条）
                            </p>
                          </>
                        );
                      }
                    } else {
                      // 默认显示（无法解析日志时）
                      return (
                        <>
                          <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="h-8 w-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <p className="text-lg font-medium text-gray-600">导入完成！</p>
                          <p className="text-sm text-muted-foreground">请查看下方日志了解详细信息</p>
                        </>
                      );
                    }
                  })()}
                </div>
              </div>

              {/* 导入日志 */}
              {importLogs.length > 0 && (
                <div className="border rounded-lg">
                  <div className="p-3 border-b bg-gray-50 dark:bg-gray-800">
                    <h4 className="font-semibold">导入日志</h4>
                  </div>
                  <div 
                    ref={importLogRef}
                    className="p-3 max-h-64 overflow-y-auto bg-gray-900 text-green-400 font-mono text-sm"
                  >
                    {importLogs.map((log, index) => (
                      <div key={index}>{log}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="flex justify-end space-x-2 pt-4 border-t">
          {importStep === 'completed' ? (
            <Button onClick={onClose} className="bg-green-600 hover:bg-green-700">
              完成
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={onClose} disabled={importStep === 'processing'}>
                取消
              </Button>
              {importStep === 'confirmation' && (
                <Button 
                  onClick={onExecuteImport}
                  disabled={!importPreview || getActualImportCount() === 0}
                >
                  确认并导入 ({getActualImportCount()})
                </Button>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
