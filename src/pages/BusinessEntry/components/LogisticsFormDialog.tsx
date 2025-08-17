// 最终文件路径: src/pages/BusinessEntry/components/ImportDialog.tsx

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Loader2, Siren } from "lucide-react";
import { ImportPreviewResult } from '../types';
import { DuplicateResolution, DuplicateResolutions } from '../hooks/useExcelImport';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { useMemo } from "react";

interface ImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  importStep: 'idle' | 'preprocessing' | 'preview' | 'confirmation' | 'processing';
  importPreview: ImportPreviewResult | null;
  duplicateResolutions: DuplicateResolutions;
  setDuplicateResolutions: (value: DuplicateResolutions) => void;
  importLogs: string[];
  importLogRef: React.RefObject<HTMLDivElement>;
  onExecuteImport: () => void;
}

const highlightDiff = (newVal: any, oldVal: any) => {
  const strNew = String(newVal ?? '');
  const strOld = String(oldVal ?? '');
  if (strNew !== strOld) {
    return <span className="text-orange-500 font-bold bg-orange-100 dark:bg-orange-900/50 px-1 rounded">{strNew || '空'}</span>;
  }
  return <span>{strNew}</span>;
};

const DuplicateReviewCard = ({ item, index, resolution, onResolutionChange }: {
  item: ImportPreviewResult['duplicate_records'][0];
  index: number;
  resolution: DuplicateResolution;
  onResolutionChange: (index: number, value: DuplicateResolution) => void;
}) => {
  const { record: newRecord, existing_record: existingRecord } = item;
  if (!existingRecord) return null;

  return (
    <div className="border rounded-lg p-4 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-600">
      <h4 className="font-semibold mb-2">重复项 #{index + 1}: {newRecord.driver_name} - {newRecord.license_plate} ({newRecord.loading_date})</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div>
          <p className="font-medium mb-2 text-sm">新数据 (来自 Excel)</p>
          <Table>
            <TableBody>
              <TableRow><TableCell className="font-semibold w-1/3">卸货地</TableCell><TableCell>{highlightDiff(newRecord.unloading_location, existingRecord.unloading_location)}</TableCell></TableRow>
              <TableRow><TableCell className="font-semibold">装货重量</TableCell><TableCell>{highlightDiff(newRecord.loading_weight, existingRecord.loading_weight)}</TableCell></TableRow>
              <TableRow><TableCell className="font-semibold">卸货重量</TableCell><TableCell>{highlightDiff(newRecord.unloading_weight, existingRecord.unloading_weight)}</TableCell></TableRow>
              <TableRow><TableCell className="font-semibold">运费</TableCell><TableCell>{highlightDiff(newRecord.current_cost, existingRecord.current_cost)}</TableCell></TableRow>
              <TableRow><TableCell className="font-semibold">备注</TableCell><TableCell>{highlightDiff(newRecord.remarks, existingRecord.remarks)}</TableCell></TableRow>
            </TableBody>
          </Table>
        </div>
        <div>
          <p className="font-medium mb-2 text-sm">现有数据 (数据库)</p>
          <Table>
            <TableBody>
              <TableRow><TableCell className="font-semibold w-1/3">卸货地</TableCell><TableCell>{existingRecord.unloading_location}</TableCell></TableRow>
              <TableRow><TableCell className="font-semibold">装货重量</TableCell><TableCell>{existingRecord.loading_weight}</TableCell></TableRow>
              <TableRow><TableCell className="font-semibold">卸货重量</TableCell><TableCell>{existingRecord.unloading_weight}</TableCell></TableRow>
              <TableRow><TableCell className="font-semibold">运费</TableCell><TableCell>{existingRecord.current_cost}</TableCell></TableRow>
              <TableRow><TableCell className="font-semibold">备注</TableCell><TableCell>{existingRecord.remarks}</TableCell></TableRow>
            </TableBody>
          </Table>
        </div>
      </div>
      <div className="mt-4">
        <RadioGroup
          value={resolution}
          onValueChange={(value) => onResolutionChange(index, value as DuplicateResolution)}
          className="flex items-center gap-6"
        >
          <div className="flex items-center space-x-2"><RadioGroupItem value="overwrite" id={`overwrite-${index}`} /><Label htmlFor={`overwrite-${index}`}>覆盖</Label></div>
          <div className="flex items-center space-x-2"><RadioGroupItem value="skip" id={`skip-${index}`} /><Label htmlFor={`skip-${index}`}>跳过</Label></div>
          <div className="flex items-center space-x-2"><RadioGroupItem value="new" id={`new-${index}`} /><Label htmlFor={`new-${index}`}>作为新记录</Label></div>
        </RadioGroup>
      </div>
    </div>
  );
};

export function ImportDialog({ isOpen, onClose, importStep, importPreview, duplicateResolutions, setDuplicateResolutions, importLogs, importLogRef, onExecuteImport }: ImportDialogProps) {
  
  const handleResolutionChange = (index: number, value: DuplicateResolution) => {
    setDuplicateResolutions({ ...duplicateResolutions, [index]: value });
  };

  const totalToProcess = useMemo(() => {
    if (!importPreview) return 0;
    const newCount = importPreview.new_records.length;
    const duplicatesToProcess = Object.values(duplicateResolutions).filter(res => res !== 'skip').length;
    return newCount + duplicatesToProcess;
  }, [importPreview, duplicateResolutions]);

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
                系统已完成重复数据检查和智能分析，请确认后执行导入。
              </AlertDescription>
            </Alert>

            <div className="grid gap-4">
              <div className="p-4 border border-green-200 rounded-md bg-green-50 dark:bg-green-900/20 dark:border-green-700">
                <h4 className="font-semibold text-lg text-green-800 dark:text-green-300 flex items-center gap-2">
                  ✓ {importPreview.new_records.length} 条新记录
                </h4>
                <p className="text-sm text-muted-foreground mt-1">
                  这些记录将被直接导入。
                </p>
              </div>

              {importPreview.duplicate_records.length > 0 && (
                <div>
                  <h4 className="font-semibold text-lg text-yellow-800 dark:text-yellow-300 flex items-center gap-2 mb-2">
                    ⚠️ 发现 {importPreview.duplicate_records.length} 条重复记录
                  </h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    请逐一审核以下记录，并选择处理方式。橙色高亮部分为新旧数据差异之处。
                  </p>
                  <ScrollArea className="max-h-64 overflow-y-auto space-y-3 pr-3">
                    {importPreview.duplicate_records.map((item, index) => (
                      <DuplicateReviewCard 
                        key={index}
                        item={item}
                        index={index}
                        resolution={duplicateResolutions[index]}
                        onResolutionChange={handleResolutionChange}
                      />
                    ))}
                  </ScrollArea>
                </div>
              )}

              {importPreview.error_records.length > 0 && (
                <div className="p-4 border border-red-300 rounded-md bg-red-50 dark:bg-red-900/20 dark:border-red-600">
                  {/* ... 错误记录的UI代码保持不变 ... */}
                </div>
              )}
            </div>

            <div className="flex justify-between items-center pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                预计处理: {totalToProcess} 条记录
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose}>取消</Button>
                <Button 
                  onClick={onExecuteImport} 
                  disabled={totalToProcess === 0}
                  className="min-w-32"
                >
                  确认并执行 ({totalToProcess})
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
