// 文件路径: src/pages/DataImportWithDuplicateCheck.tsx

// 1. 导入所有需要的工具和组件
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Download, FileUp, Loader2, ListChecks } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { Project } from "@/types";
import { ImportDialog } from '@/pages/BusinessEntry/components/ImportDialog';

// 增强的Excel日期解析函数
function parseExcelDate(dateValue: any): string {
  if (!dateValue) throw new Error('日期值为空');
  
  const dateStr = String(dateValue).trim();
  const currentYear = new Date().getFullYear();
  
  // 处理中文日期格式
  if (dateStr.match(/^\d{1,2}月\d{1,2}日$/)) {
    // 格式: 5月20日
    const match = dateStr.match(/^(\d{1,2})月(\d{1,2})日$/);
    if (match) {
      const month = parseInt(match[1], 10);
      const day = parseInt(match[2], 10);
      return `${currentYear}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    }
  }
  
  if (dateStr.match(/^\d{4}年\d{1,2}月\d{1,2}日$/)) {
    // 格式: 2025年5月20日
    const match = dateStr.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日$/);
    if (match) {
      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10);
      const day = parseInt(match[3], 10);
      return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    }
  }
  
  // 处理简化格式 (使用当前年份)
  if (dateStr.match(/^\d{1,2}\/\d{1,2}$/)) {
    // 格式: 5/20
    const [month, day] = dateStr.split('/').map(n => parseInt(n, 10));
    return `${currentYear}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
  }
  
  if (dateStr.match(/^\d{1,2}-\d{1,2}$/)) {
    // 格式: 5-20
    const [month, day] = dateStr.split('-').map(n => parseInt(n, 10));
    return `${currentYear}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
  }
  
  if (dateStr.match(/^\d{1,2}\.\d{1,2}$/)) {
    // 格式: 5.20
    const [month, day] = dateStr.split('.').map(n => parseInt(n, 10));
    return `${currentYear}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
  }
  
  // 处理标准格式
  if (dateStr.match(/^\d{4}\.\d{2}\.\d{2}$/)) {
    // 格式: 2025.01.21
    return dateStr.replace(/\./g, '-');
  }
  
  if (dateStr.match(/^\d{2}\.\d{2}\.\d{4}$/)) {
    // 格式: 21.01.2025
    const [day, month, year] = dateStr.split('.');
    return `${year}-${month}-${day}`;
  }
  
  // 处理Excel序列号日期
  if (typeof dateValue === 'number' && dateValue > 25569) {
    // Excel日期序列号 (1900年1月1日为1)
    const excelEpoch = new Date(1900, 0, 1);
    const date = new Date(excelEpoch.getTime() + (dateValue - 2) * 24 * 60 * 60 * 1000);
    return format(date, 'yyyy-MM-dd');
  }
  
  // 默认处理 - 尝试直接解析
  try {
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) {
      throw new Error('无效的日期格式');
    }
    return format(date, 'yyyy-MM-dd');
  } catch (error) {
    throw new Error(`无法解析日期格式: ${dateStr}`);
  }
}

// 2. 主组件定义
export default function DataImportWithDuplicateCheck() {
  // 3. 状态管理 (useState)
  const [projects, setProjects] = useState<Project[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  
  // 重复检测相关状态
  const [importStep, setImportStep] = useState<'upload' | 'preview' | 'confirmation' | 'processing'>('upload');
  const [importPreview, setImportPreview] = useState<any>(null);
  const [approvedDuplicates, setApprovedDuplicates] = useState<Set<number>>(new Set());
  const [importLogs, setImportLogs] = useState<string[]>([]);
  const [importLogRef, setImportLogRef] = useState<HTMLDivElement | null>(null);
  const { toast } = useToast();

  // 4. 数据加载逻辑 (useCallback & useEffect)
  // 页面加载时，获取所有项目信息，用于后续的数据匹配
  const loadInitialOptions = useCallback(async () => {
    try {
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('*')
        .order('name');

      if (projectsError) {
        console.error('加载项目数据失败:', projectsError);
        return;
      }

      setProjects(projectsData || []);
    } catch (error) {
      console.error('加载初始数据时出错:', error);
    }
  }, []);

  useEffect(() => {
    loadInitialOptions();
  }, [loadInitialOptions]);

  // 5. 处理函数定义
  // 下载Excel模板文件
  const handleTemplateDownload = () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      // 表头 - 标明必填和可选字段（8个必填字段用于验重）
      ['项目名称*', '合作链路(可选)', '司机姓名*', '车牌号*', '司机电话(可选)', '装货地点*', '卸货地点*', '装货日期*', '卸货日期(可选)', '装货数量*', '卸货数量(可选)', '运费金额(可选)', '额外费用(可选)', '运输类型(可选)', '备注(可选)', '其他平台名称(可选)', '其他平台运单号(可选)'],
      // 字段说明行
      ['必填(验重)', '可选', '必填(验重)', '必填(验重)', '可选', '必填(验重)', '必填(验重)', '必填(验重)', '可选', '必填(验重)', '可选', '可选', '可选', '可选(默认:实际运输)', '可选', '可选', '可选'],
      // 计费类型说明行
      ['', '', '', '', '', '', '', '', '', '根据合作链路计费类型动态显示: 重量(吨)/发车次数/体积(立方)', '根据合作链路计费类型动态显示: 重量(吨)/发车次数/体积(立方)', '', '', '', '', '', '', ''],
      // 示例数据（包含8个必填字段，展示多种日期格式）
      ['示例项目A', '默认链路', '张三', '京A12345', '13800138000', '北京仓库', '上海仓库', '2025-01-15', '2025-01-16', '10.5', '10.2', '5000', '200', '实际运输', '正常运输', '平台A,平台B', '运单1|运单2,运单3'],
      ['示例项目B', '', '李四', '沪B67890', '13900139000', '上海仓库', '广州仓库', '5月20日', '', '15.0', '14.8', '8000', '300', '实际运输', '加急运输', '平台C', '运单4|运单5|运单6'],
      ['示例项目C', '特殊链路', '王五', '粤C11111', '13700137000', '广州仓库', '深圳仓库', '2025年12月25日', '2025年12月26日', '8.0', '7.9', '4000', '100', '实际运输', '标准运输', '', ''],
      ['示例项目D', '默认链路', '赵六', '京D22222', '13600136000', '北京仓库', '天津仓库', '3/15', '3/16', '12.0', '11.8', '6000', '250', '实际运输', '混合运输', '平台A,平台B,平台C', '运单7,运单8|运单9,运单10|运单11']
    ]);
    
    // 设置列宽
    const colWidths = [
      { wch: 18 }, // 项目名称*
      { wch: 15 }, // 合作链路(可选)
      { wch: 12 }, // 司机姓名*
      { wch: 15 }, // 车牌号(可选)
      { wch: 18 }, // 司机电话(可选)
      { wch: 18 }, // 装货地点*
      { wch: 18 }, // 卸货地点*
      { wch: 15 }, // 装货日期*
      { wch: 18 }, // 卸货日期(可选)
      { wch: 15 }, // 装货数量(可选)
      { wch: 15 }, // 卸货数量(可选)
      { wch: 15 }, // 运费金额(可选)
      { wch: 15 }, // 额外费用(可选)
      { wch: 18 }, // 运输类型(可选)
      { wch: 18 }, // 备注(可选)
      { wch: 25 }, // 其他平台名称(可选)
      { wch: 30 }  // 其他平台运单号(可选)
    ];
    ws['!cols'] = colWidths;
    
    XLSX.utils.book_append_sheet(wb, ws, "运单导入模板");
    XLSX.writeFile(wb, "运单导入模板.xlsx");
  };

  // 获取导入预览（包含重复检测）
  const getImportPreview = async (validRows: any[]) => {
    setImportStep('preview');
    try {
       const recordsToPreview = validRows.map(rowData => {
         const parsedLoadingWeight = parseFloat(rowData['装货数量']);
         const parsedUnloadingWeight = parseFloat(rowData['卸货数量']);
        const parsedCurrentCost = parseFloat(rowData['运费金额']);
        const parsedExtraCost = parseFloat(rowData['额外费用']);

        // 处理平台运单信息
        let platformTrackings = null;
        if (rowData['其他平台名称'] || rowData['其他平台运单号']) {
          const platformNames = rowData['其他平台名称']?.toString().split(',').map((name: string) => name.trim()).filter((name: string) => name) || [];
          const platformTrackingGroups = rowData['其他平台运单号']?.toString().split(',').map((group: string) => group.trim()).filter((group: string) => group) || [];
          
          const trackings = [];
          for (let i = 0; i < platformNames.length; i++) {
            const platformName = platformNames[i];
            const trackingGroup = platformTrackingGroups[i] || '';
            const trackingNumbers = trackingGroup ? trackingGroup.split('|').map((tn: string) => tn.trim()).filter((tn: string) => tn) : [];
            
            if (platformName) {
              trackings.push({
                platform: platformName,
                trackingNumbers: trackingNumbers
              });
            }
          }
          
          if (trackings.length > 0) {
            platformTrackings = trackings;
          }
        }

        return {
          project_name: rowData['项目名称']?.trim(),
          chain_name: rowData['合作链路']?.trim() || null,
          driver_name: rowData['司机姓名']?.trim(),
          license_plate: rowData['车牌号']?.toString().trim() || null,
          driver_phone: rowData['司机电话']?.toString().trim() || null,
          loading_location: rowData['装货地点']?.trim(),
          unloading_location: rowData['卸货地点']?.trim(),
          loading_date: rowData.loading_date_parsed,
          unloading_date: rowData.unloading_date_parsed,
          loading_weight: !isNaN(parsedLoadingWeight) ? parsedLoadingWeight.toString() : null,
          unloading_weight: !isNaN(parsedUnloadingWeight) ? parsedUnloadingWeight.toString() : null,
          current_cost: !isNaN(parsedCurrentCost) ? parsedCurrentCost.toString() : '0',
          extra_cost: !isNaN(parsedExtraCost) ? parsedExtraCost.toString() : '0',
          transport_type: rowData['运输类型']?.trim() || '实际运输',
          remarks: rowData['备注']?.toString().trim() || null,
          platform_trackings: platformTrackings
        };
      });

      const { data: previewResult, error } = await supabase.rpc('preview_import_with_duplicates_check', { 
        p_records: recordsToPreview 
      });
      
      if (error) throw error;

      if (previewResult && typeof previewResult === 'object' && !Array.isArray(previewResult)) {
        setImportPreview(previewResult);
      } else {
        throw new Error('预览数据格式错误');
      }
      
      setApprovedDuplicates(new Set());
      setImportStep('confirmation');
    } catch (error: any) {
      toast({ title: "预览失败", description: error.message, variant: "destructive" });
      setImportStep('upload');
    }
  };

  // 处理Excel文件导入 - 先预览再导入
  const handleExcelImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = e.target?.result;
            const workbook = XLSX.read(data, { type: 'array', cellDates: true });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);

            // 处理日期和验证数据（验证8个必填字段）
            const validRows = jsonData.filter((rowData: any) => {
                const projectName = rowData['项目名称']?.trim();
                const driverName = rowData['司机姓名']?.trim();
                const licensePlate = rowData['车牌号']?.trim();
                const loadingLocation = rowData['装货地点']?.trim();
                const unloadingLocation = rowData['卸货地点']?.trim();
                const loadingDateRaw = rowData['装货日期'];
                const loadingWeight = rowData['装货数量'];

                // 验证8个必填字段
                if (!projectName || !driverName || !licensePlate || !loadingLocation || 
                    !unloadingLocation || !loadingDateRaw || !loadingWeight) {
                    return false;
                }

                // 增强的日期处理 - 支持多种Excel日期格式
                try {
                    rowData.loading_date_parsed = parseExcelDate(loadingDateRaw);
                    rowData.unloading_date_parsed = rowData['卸货日期'] 
                        ? parseExcelDate(rowData['卸货日期'])
                        : rowData.loading_date_parsed;
                } catch (error) {
                    console.error('日期解析错误:', error, '原始值:', loadingDateRaw);
                    return false;
                }

                return true;
            });

            if (validRows.length === 0) {
                toast({ title: "错误", description: "没有找到有效的运单数据", variant: "destructive" });
                return;
            }

            // 获取导入预览
            await getImportPreview(validRows);

        } catch (error: any) {
            console.error("文件处理错误:", error);
            toast({ title: "错误", description: `文件处理失败: ${error.message}`, variant: "destructive" });
        } finally {
            setIsImporting(false);
            event.target.value = '';
        }
    };
    reader.readAsArrayBuffer(file);
  };

  // 执行最终导入
  const executeFinalImport = async () => {
    if (!importPreview) return;
    setImportStep('processing');
    setImportLogs([]);
    
    const addLog = (message: string) => setImportLogs(prev => [
      ...prev, 
      `[${new Date().toLocaleTimeString('zh-CN', { hour12: false })}] ${message}`
    ]);
    
    const finalRecordsToImport = [
      ...importPreview.new_records.map((item: any) => item.record),
      ...importPreview.duplicate_records
        .filter((_: any, index: number) => approvedDuplicates.has(index))
        .map((item: any) => item.record)
    ];

    if (finalRecordsToImport.length === 0) {
      toast({ title: "操作完成", description: "没有选中任何需要导入的记录。" });
      setImportStep('confirmation');
      return;
    }

    addLog(`准备导入 ${finalRecordsToImport.length} 条记录...`);
    addLog(`其中新记录 ${importPreview.new_records.length} 条，强制导入重复记录 ${approvedDuplicates.size} 条`);

    try {
      const { data: result, error } = await supabase.rpc('batch_import_logistics_records', {
        p_records: finalRecordsToImport
      });

      if (error) throw error;

      const successCount = result?.success_count || 0;
      const errorCount = result?.error_count || 0;

      addLog(`导入完成！成功: ${successCount} 条，失败: ${errorCount} 条`);

      if (successCount > 0) {
        toast({ 
          title: "导入成功", 
          description: `成功导入 ${successCount} 条运单记录${errorCount > 0 ? `，${errorCount} 条记录导入失败` : ''}` 
        });
      } else {
        toast({ 
          title: "导入失败", 
          description: `所有 ${errorCount} 条记录导入失败` 
        });
      }

      setImportStep('confirmation');
    } catch (error: any) {
      addLog(`导入失败: ${error.message}`);
      toast({ title: "导入失败", description: error.message, variant: "destructive" });
      setImportStep('confirmation');
    }
  };

  // 关闭导入对话框
  const closeImportModal = () => {
    setImportStep('upload');
    setImportPreview(null);
    setApprovedDuplicates(new Set());
    setImportLogs([]);
  };

  // 6. 渲染UI (return)
  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-2xl">
        <Card className="shadow-lg">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">批量导入运单数据</CardTitle>
            <CardDescription>
              请先下载模板文件，按照格式填写后，选择Excel文件进行批量导入。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-4 border-l-4 border-yellow-400 bg-yellow-50 text-yellow-800 rounded-md">
              <h4 className="font-semibold">重要提示</h4>
              <ul className="list-disc pl-5 mt-2 text-sm space-y-1">
                <li>系统会<strong>自动检测重复数据</strong>，您可以选择跳过或覆盖重复记录。</li>
                <li>重复判断基于：项目名称、合作链路、司机姓名、车牌号、装货地点、装货日期、装货重量。</li>
                <li>请确保Excel中的<strong>项目名称</strong>与系统中已有的项目名称完全一致。</li>
                <li>如果司机或地点不存在，系统将<strong>自动为您创建</strong>并关联到对应的项目中。</li>
                <li>新版本使用<strong>批量处理</strong>，导入速度更快，自动生成运单编号。</li>
              </ul>
            </div>

            <div className="grid gap-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <Download className="h-8 w-8 text-blue-600" />
                  <div>
                    <h3 className="font-semibold">下载导入模板</h3>
                    <p className="text-sm text-muted-foreground">包含示例数据和填写说明</p>
                  </div>
                </div>
                <Button onClick={handleTemplateDownload} variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  下载模板
                </Button>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <FileUp className="h-8 w-8 text-green-600" />
                  <div>
                    <h3 className="font-semibold">选择Excel文件</h3>
                    <p className="text-sm text-muted-foreground">支持.xlsx和.xls格式</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleExcelImport}
                    disabled={isImporting}
                    className="hidden"
                    id="file-upload"
                  />
                  <Label htmlFor="file-upload" className="cursor-pointer">
                    <Button asChild disabled={isImporting}>
                      <span>
                        {isImporting ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            处理中...
                          </>
                        ) : (
                          <>
                            <FileUp className="h-4 w-4 mr-2" />
                            选择文件
                          </>
                        )}
                      </span>
                    </Button>
                  </Label>
                </div>
              </div>
            </div>

             <div className="p-4 border-l-4 border-blue-400 bg-blue-50 text-blue-800 rounded-md">
               <h4 className="font-semibold">导入流程说明</h4>
               <ol className="list-decimal pl-5 mt-2 text-sm space-y-1">
                 <li><strong>下载模板</strong>：点击"下载模板"按钮获取Excel模板文件</li>
                 <li><strong>填写数据</strong>：按照模板格式填写运单信息，特别注意平台运单信息的格式</li>
                 <li><strong>选择文件</strong>：点击"选择文件"按钮上传填写好的Excel文件</li>
                 <li><strong>预览确认</strong>：系统会显示重复数据检测结果，您可以选择跳过或覆盖重复记录</li>
                 <li><strong>执行导入</strong>：确认后系统开始批量导入数据</li>
                 <li><strong>查看结果</strong>：导入完成后查看成功和失败的统计信息</li>
               </ol>
             </div>

             <div className="p-4 border rounded-md">
               <h4 className="font-semibold flex items-center"><ListChecks className="mr-2 h-4 w-4"/>字段填写说明</h4>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                 <div>
                   <h5 className="font-medium text-red-600 mb-2">必填字段 (*)</h5>
                   <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                     <li><strong>项目名称</strong>：必须与系统中已有的项目名称完全一致</li>
                     <li><strong>司机姓名</strong>：如果系统中不存在，将自动创建新司机</li>
                     <li><strong>装货地点</strong>：如果系统中不存在，将自动创建新地点</li>
                     <li><strong>卸货地点</strong>：如果系统中不存在，将自动创建新地点</li>
                     <li><strong>装货日期</strong>：支持多种格式，如 2025-01-21、5月20日、2025年5月20日、3/15 等</li>
                   </ul>
                 </div>
                 <div>
                   <h5 className="font-medium text-green-600 mb-2">可选字段</h5>
                   <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                     <li><strong>合作链路</strong>：留空则使用默认链路</li>
                     <li><strong>车牌号/司机电话</strong>：用于司机信息完善</li>
                     <li><strong>卸货日期</strong>：留空则使用装货日期</li>
                     <li><strong>数量/费用</strong>：根据合作链路的计费类型，数量字段会动态显示为"重量(吨)"、"发车次数"或"体积(立方)"</li>
                     <li><strong>运输类型</strong>：留空则默认为"实际运输"</li>
                     <li><strong>其他平台信息</strong>：按格式填写平台名称和运单号</li>
                   </ul>
                 </div>
               </div>
             </div>
          </CardContent>
        </Card>
      </div>

      {/* 导入对话框 */}
      <ImportDialog
        isOpen={importStep !== 'upload'}
        onClose={closeImportModal}
        importStep={importStep}
        importPreview={importPreview}
        approvedDuplicates={approvedDuplicates}
        setApprovedDuplicates={setApprovedDuplicates}
        importLogs={importLogs}
        importLogRef={importLogRef}
        onExecuteImport={executeFinalImport}
      />
    </div>
  );
}
