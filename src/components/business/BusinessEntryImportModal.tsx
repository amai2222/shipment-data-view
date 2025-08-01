// 文件路径: src/components/business-entry/BusinessEntryImportModal.tsx

// 1. 导入所有需要的工具和组件
import { useState, useEffect, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from 'xlsx';
import { format, isValid } from 'date-fns';
import { Project } from "@/types";

// 2. 定义组件接收的属性 (Props)
interface BusinessEntryImportModalProps {
  isOpen: boolean; // 控制弹窗是否打开
  onClose: () => void; // 关闭弹窗的回调函数
  onImportComplete: () => void; // 导入成功后的回调函数
  projects: Project[]; // 从父组件传入的项目列表，用于数据校验
}

// 3. 辅助函数：安全的日期格式化工具
const safeFormatExcelDate = (excelDate: any): string | null => {
  if (!excelDate) return null;
  if (excelDate instanceof Date && isValid(excelDate)) {
    const year = excelDate.getFullYear();
    const month = excelDate.getMonth() + 1;
    const day = excelDate.getDate();
    const monthStr = String(month).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    return `${year}-${monthStr}-${dayStr}`;
  }
  if (typeof excelDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(excelDate)) {
    return excelDate;
  }
  return null;
}

// 4. 主组件定义
export function BusinessEntryImportModal({ isOpen, onClose, onImportComplete, projects }: BusinessEntryImportModalProps) {
  // 5. 状态管理 (useState)
  const { toast } = useToast();
  const [importStep, setImportStep] = useState<'idle' | 'preprocessing' | 'preview' | 'processing'>('idle');
  const [importData, setImportData] = useState<{valid: any[], invalid: any[], duplicateCount: number}>({ valid: [], invalid: [], duplicateCount: 0 });
  const [preprocessingProgress, setPreprocessingProgress] = useState(0);
  const [importLogs, setImportLogs] = useState<string[]>([]);
  const importLogRef = useRef<HTMLDivElement>(null);
  const [isProcessingImport, setIsProcessingImport] = useState(false);

  // 6. 副作用管理 (useEffect)
  // 实时滚动日志到底部
  useEffect(() => {
    if (importLogRef.current) {
      importLogRef.current.scrollTop = importLogRef.current.scrollHeight;
    }
  }, [importLogs]);

  // 7. 核心功能函数
  // 【核心】异步分片处理函数，用于预处理Excel数据
  const processDataInChunks = (data: any[]) => {
    return new Promise<void>((resolve) => {
      let currentIndex = 0;
      const chunkSize = 50; // 每次处理50条，防止UI阻塞
      const validRows: any[] = [];
      const invalidRows: any[] = [];
      const uniqueKeys = new Set<string>();
      let duplicateCount = 0;

      function processChunk() {
        const chunk = data.slice(currentIndex, currentIndex + chunkSize);
        if (chunk.length === 0) {
          setImportData({ valid: validRows, invalid: invalidRows, duplicateCount });
          setImportStep('preview'); // 所有分片处理完毕，进入预览步骤
          toast({ title: "文件预处理完成", description: "请确认导入数据。" });
          resolve();
          return;
        }

        for (const row of chunk) {
          const rowData = { ...row, originalRow: currentIndex + 2, error: '' };
          currentIndex++;
          try {
            const projectName = rowData['项目名称']?.trim();
            const driverName = rowData['司机姓名']?.trim();
            const loadingLocation = rowData['装货地点']?.trim();
            const unloadingLocation = rowData['卸货地点']?.trim();
            const loadingDateRaw = rowData['装货日期'];

            if (!projectName || !driverName || !loadingLocation || !unloadingLocation || !loadingDateRaw) {
                throw new Error("缺少必填字段");
            }
            if (!safeFormatExcelDate(loadingDateRaw)) {
                throw new Error("“装货日期”格式不正确");
            }
            if (!projects.some(p => p.name === projectName)) {
                throw new Error(`项目 "${projectName}" 不存在`);
            }

            const uniqueKey = `${projectName}-${driverName}-${loadingLocation}-${unloadingLocation}-${safeFormatExcelDate(loadingDateRaw)}`;
            if (uniqueKeys.has(uniqueKey)) {
                rowData.error = "重复数据";
                duplicateCount++;
                invalidRows.push(rowData);
            } else {
                uniqueKeys.add(uniqueKey);
                validRows.push(rowData);
            }
          } catch (err: any) {
              rowData.error = err.message;
              invalidRows.push(rowData);
          }
        }

        setPreprocessingProgress((currentIndex / data.length) * 100);
        setTimeout(processChunk, 0); // 使用setTimeout(0)将下一个分片的处理推入事件循环，实现异步
      }
      processChunk();
    });
  };

  // 【核心】开始真正的逐条导入流程
  const startActualImport = async () => {
    setIsProcessingImport(true);
    setImportLogs([]);
    let successCount = 0;
    let errorCount = 0;

    const addLog = (message: string) => setImportLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);

    addLog(`开始导入... 共 ${importData.valid.length} 条有效记录。`);

    for (const [index, rowData] of importData.valid.entries()) {
      const rowNum = rowData.originalRow;
      addLog(`[${index + 1}/${importData.valid.length}] 正在处理 Excel 第 ${rowNum} 行...`);
      try {
        const project = projects.find(p => p.name === rowData['项目名称'].trim())!;

        const { data: driverResult, error: driverError } = await supabase.rpc('get_or_create_driver', {
            p_driver_name: rowData['司机姓名'].trim(),
            p_license_plate: rowData['车牌号']?.toString().trim() || null,
            p_phone: rowData['司机电话']?.toString().trim() || null,
            p_project_id: project.id
        });
        if (driverError || !driverResult || driverResult.length === 0) throw new Error("处理司机信息失败");
        const finalDriver = driverResult[0];
        addLog(`  -> [成功] 司机 "${finalDriver.driver_name}" 信息已确认/创建。`);

        await supabase.rpc('get_or_create_location', { p_location_name: rowData['装货地点'].trim(), p_project_id: project.id });
        addLog(`  -> [成功] 地点 "${rowData['装货地点'].trim()}" 信息已确认/创建。`);
        await supabase.rpc('get_or_create_location', { p_location_name: rowData['卸货地点'].trim(), p_project_id: project.id });
        addLog(`  -> [成功] 地点 "${rowData['卸货地点'].trim()}" 信息已确认/创建。`);

        let chainId = null;
        const chainName = rowData['合作链路']?.trim();
        if(chainName){
            const {data: chainData} = await supabase.from('partner_chains').select('id').eq('project_id', project.id).eq('chain_name', chainName).single();
            if(chainData) chainId = chainData.id;
        }

        const recordData = {
            p_project_id: project.id,
            p_project_name: project.name,
            p_chain_id: chainId,
            p_driver_id: finalDriver.driver_id,
            p_driver_name: finalDriver.driver_name,
            p_loading_location: rowData['装货地点'].trim(),
            p_unloading_location: rowData['卸货地点'].trim(),
            p_loading_date: safeFormatExcelDate(rowData['装货日期']),
            p_unloading_date: safeFormatExcelDate(rowData['卸货日期']) || safeFormatExcelDate(rowData['装货日期']),
            p_loading_weight: parseFloat(rowData['装货重量']) || null,
            p_unloading_weight: parseFloat(rowData['卸货重量']) || null,
            p_current_cost: parseFloat(rowData['运费金额']) || 0,
            p_extra_cost: parseFloat(rowData['额外费用']) || 0,
            p_license_plate: rowData['车牌号']?.toString().trim() || null,
            p_driver_phone: rowData['司机电话']?.toString().trim() || null,
            p_transport_type: rowData['运输类型']?.trim() || '实际运输',
            p_remarks: rowData['备注']?.toString().trim() || null
        };

        const { error: insertError } = await supabase.rpc('add_logistics_record_with_costs', recordData);
        if(insertError) throw insertError;

        addLog(`  -> [成功] 第 ${rowNum} 行运单已成功存入数据库。`);
        successCount++;
      } catch (err: any) {
        errorCount++;
        addLog(`  -> [错误] 第 ${rowNum} 行导入失败: ${err.message}`);
      }
    }

    addLog(`--------------------`);
    addLog(`导入流程已完成！`);
    addLog(`成功: ${successCount}条, 失败: ${errorCount}条。`);

    if (successCount > 0) {
      toast({ title: "成功", description: `成功导入 ${successCount} 条运单记录！` });
      onImportComplete();
    }
    if (errorCount > 0) {
      toast({ title: "部分失败", description: `有 ${errorCount} 条记录导入失败，详情请查看导入日志。`, variant: "destructive" });
    }
    setIsProcessingImport(false);
  };

  // 关闭并重置弹窗状态
  const handleClose = () => {
    setImportStep('idle');
    setImportData({ valid: [], invalid: [], duplicateCount: 0 });
    setPreprocessingProgress(0);
    setImportLogs([]);
    onClose();
  };

  // 8. 渲染UI (return)
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader><DialogTitle>导入运单数据</DialogTitle></DialogHeader>

        {importStep === 'preprocessing' && (
          <div className="py-8 text-center space-y-4">
            <h3 className="font-semibold">正在预处理文件...</h3>
            <Progress value={preprocessingProgress} className="w-full" />
            <p className="text-sm text-muted-foreground">已校验 {Math.round(preprocessingProgress)}%</p>
          </div>
        )}

        {importStep === 'preview' && (
          <div>
            <div className="flex justify-between items-center bg-muted p-4 rounded-md mb-4">
              <div className="space-y-1">
                <p>共发现 <strong>{importData.valid.length + importData.invalid.length}</strong> 条记录</p>
                <p className="text-green-600"><strong>{importData.valid.length}</strong> 条记录格式正确，可以导入</p>
                {importData.duplicateCount > 0 && <p className="text-yellow-600"><strong>{importData.duplicateCount}</strong> 条重复记录将被自动忽略</p>}
                {importData.invalid.length > 0 && <p className="text-red-600"><strong>{importData.invalid.length - importData.duplicateCount}</strong> 条记录存在格式错误，将被忽略</p>}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleClose}>取消</Button>
                <Button onClick={startActualImport} disabled={importData.valid.length === 0}>
                  确认并开始导入 ({importData.valid.length})
                </Button>
              </div>
            </div>
            {(importData.invalid.length > 0) && (
              <div className="mb-4">
                <h4 className="font-semibold mb-2">错误与重复记录预览 (最多显示5条)</h4>
                <div className="border rounded-md max-h-40 overflow-y-auto">
                  <Table>
                    <TableHeader><TableRow><TableHead>行号</TableHead><TableHead>项目</TableHead><TableHead>司机</TableHead><TableHead>错误原因</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {importData.invalid.slice(0, 5).map(row => (
                        <TableRow key={row.originalRow} className="bg-red-50">
                          <TableCell>{row.originalRow}</TableCell>
                          <TableCell>{row['项目名称']}</TableCell>
                          <TableCell>{row['司机姓名']}</TableCell>
                          <TableCell className="text-red-700">{row.error}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
        )}

        {importStep === 'processing' && (
          <div className="py-4 space-y-4">
            <h3 className="font-semibold">正在逐条导入数据...</h3>
            <div ref={importLogRef} className="h-64 overflow-y-auto bg-gray-900 text-white font-mono text-xs p-4 rounded-md">
              {importLogs.map((log, i) => <p key={i} className={log.includes('[错误]') ? 'text-red-400' : 'text-green-400'}>{log}</p>)}
            </div>
            {isProcessingImport === false && (
              <div className="text-center pt-4">
                <Button onClick={handleClose}>关闭</Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
