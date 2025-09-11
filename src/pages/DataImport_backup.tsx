// 文件路径: src/pages/DataImport.tsx

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

// 2. 主组件定义
export default function DataImport() {
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
      const { data: projectsData } = await supabase.from('projects').select('id, name');
      setProjects(projectsData as Project[] || []);
    } catch (error) {
      toast({ title: "错误", description: "加载项目列表失败，导入功能可能受限", variant: "destructive" });
    }
  }, [toast]);

  // 页面首次加载时，执行一次数据获取
  useEffect(() => {
    loadInitialOptions();
  }, [loadInitialOptions]);

  // 5. 核心功能函数
  // 下载Excel模板
  const handleTemplateDownload = () => {
    // 定义模板的表头和示例数据
    const templateData = [
      {
        '项目名称': '示例项目A',
        '合作链路': '合作方A-链路1',
        '司机姓名': '张三',
        '车牌号': '京A12345',
        '司机电话': '13800138000',
        '装货地点': '北京仓库',
        '卸货地点': '上海仓库',
        '装货日期': '2025-01-20',
        '卸货日期': '2025-01-21',
        '运输类型': '实际运输',
        '装货重量': '25.5',
        '卸货重量': '25.3',
        '运费金额': '1500.00',
        '额外费用': '100.00',
        '备注': '正常运输',
        '其他平台名称': '货拉拉,满帮,运满满',
        '其他平台运单号': 'HL20250120001,MB20250120001,YM20250120001',
        '其他平台运单号说明': '逗号分隔不同平台，|分隔同一平台的多个运单号'
      },
      {
        '项目名称': '示例项目B',
        '合作链路': '',
        '司机姓名': '李四',
        '车牌号': '沪B67890',
        '司机电话': '13900139000',
        '装货地点': '上海仓库',
        '卸货地点': '广州仓库',
        '装货日期': '2025-01-20',
        '卸货日期': '',
        '运输类型': '实际运输',
        '装货重量': '30.0',
        '卸货重量': '29.8',
        '运费金额': '2000.00',
        '额外费用': '0.00',
        '备注': '',
        '其他平台名称': '货拉拉',
        '其他平台运单号': 'HL20250120002|HL20250120003',
        '其他平台运单号说明': '一个平台可以有多个运单号，用|分隔'
      },
      {
        '项目名称': '示例项目C',
        '合作链路': '合作方B-链路2',
        '司机姓名': '王五',
        '车牌号': '粤C11111',
        '司机电话': '13700137000',
        '装货地点': '广州仓库',
        '卸货地点': '深圳仓库',
        '装货日期': '2025-01-20',
        '卸货日期': '2025-01-20',
        '运输类型': '退货',
        '装货重量': '15.0',
        '卸货重量': '15.0',
        '运费金额': '800.00',
        '额外费用': '-50.00',
        '备注': '退货运输',
        '其他平台名称': '滴滴货运',
        '其他平台运单号': '',
        '其他平台运单号说明': '只有平台名称，无运单号'
      },
      {
        '项目名称': '示例项目D',
        '合作链路': '合作方C-链路3',
        '司机姓名': '赵六',
        '车牌号': '苏D22222',
        '司机电话': '13600136000',
        '装货地点': '南京仓库',
        '卸货地点': '苏州仓库',
        '装货日期': '2025-01-20',
        '卸货日期': '2025-01-21',
        '运输类型': '实际运输',
        '装货重量': '22.0',
        '卸货重量': '21.8',
        '运费金额': '1300.00',
        '额外费用': '50.00',
        '备注': '混合平台运单',
        '其他平台名称': '货拉拉,满帮,滴滴货运',
        '其他平台运单号': 'HL20250120004|HL20250120005,MB20250120004,',
        '其他平台运单号说明': '货拉拉2个运单号，满帮1个运单号，滴滴货运无运单号'
      }
    ];
    
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    
    // 设置列宽
    const colWidths = [
      { wch: 15 }, // 项目名称
      { wch: 15 }, // 合作链路
      { wch: 12 }, // 司机姓名
      { wch: 12 }, // 车牌号
      { wch: 15 }, // 司机电话
      { wch: 12 }, // 装货地点
      { wch: 12 }, // 卸货地点
      { wch: 12 }, // 装货日期
      { wch: 12 }, // 卸货日期
      { wch: 12 }, // 运输类型
      { wch: 12 }, // 装货重量
      { wch: 12 }, // 卸货重量
      { wch: 12 }, // 运费金额
      { wch: 12 }, // 额外费用
      { wch: 15 }, // 备注
      { wch: 20 }, // 其他平台名称
      { wch: 25 }, // 其他平台运单号
      { wch: 30 }  // 其他平台运单号说明
    ];
    ws['!cols'] = colWidths;
    
    XLSX.utils.book_append_sheet(wb, ws, "运单导入模板");
    XLSX.writeFile(wb, "运单导入模板.xlsx");
  };

  // 处理Excel文件导入 - 使用批量处理RPC
  const handleExcelImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    toast({ title: "加载", description: "正在读取并处理Excel文件..." });

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = e.target?.result;
            const workbook = XLSX.read(data, { type: 'array', cellDates: true });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);

            toast({ title: "处理", description: `文件读取成功，共 ${jsonData.length} 条记录，开始批量导入...` });

            // 准备批量导入的数据
            const batchRecords = [];
            for (const [index, row] of jsonData.entries()) {
                const rowData: any = row;
                
                try {
                    // 提取并校验必填字段
                    const projectName = rowData['项目名称']?.trim();
                    const driverName = rowData['司机姓名']?.trim();
                    const loadingLocation = rowData['装货地点']?.trim();
                    const unloadingLocation = rowData['卸货地点']?.trim();
                    const loadingDateRaw = rowData['装货日期'];

                    if (!projectName || !driverName || !loadingLocation || !unloadingLocation || !loadingDateRaw) {
                        continue; // 跳过无效记录，让后端处理错误
                    }

                    // 处理可选字段：平台运单信息
                    let platformTrackings = null;
                    if (rowData['其他平台名称'] || rowData['其他平台运单号']) {
                        const platformTrackingsList = [];
                        
                        // 解析平台名称（逗号分隔不同平台）
                        const platforms = (rowData['其他平台名称'] || '').toString().split(',').map(p => p.trim()).filter(p => p);
                        
                        if (platforms.length > 0) {
                            if (rowData['其他平台运单号']) {
                                // 解析运单号（逗号分隔不同平台，|分隔同一平台的多个运单号）
                                const trackingNumbersStr = (rowData['其他平台运单号'] || '').toString();
                                
                                // 按逗号分割不同平台的运单号组合
                                const platformTrackingGroups = trackingNumbersStr.split(',').map(group => group.trim()).filter(group => group);
                                
                                // 处理每个平台
                                for (let i = 0; i < platforms.length; i++) {
                                    const platform = platforms[i];
                                    let trackingNumbers = [];
                                    
                                    // 如果对应的运单号组合存在
                                    if (i < platformTrackingGroups.length) {
                                        const trackingGroup = platformTrackingGroups[i];
                                        // 按|分割同一平台的多个运单号
                                        trackingNumbers = trackingGroup.split('|').map(tn => tn.trim()).filter(tn => tn);
                                    }
                                    
                                    platformTrackingsList.push({
                                        platform: platform,
                                        trackingNumbers: trackingNumbers
                                    });
                                }
                            } else {
                                // 只有平台名称，无运单号
                                platforms.forEach(platform => {
                                    platformTrackingsList.push({
                                        platform: platform,
                                        trackingNumbers: []
                                    });
                                });
                            }
                        }
                        
                        // 过滤掉空的平台运单信息
                        platformTrackings = platformTrackingsList.filter(pt => 
                            pt.platform && pt.platform.trim() !== ''
                        );
                        
                        // 如果过滤后为空，设置为null
                        if (platformTrackings.length === 0) {
                            platformTrackings = null;
                        }
                    }

                    // 准备批量导入的记录数据
                    const recordData = {
                        project_name: projectName,
                        chain_name: rowData['合作链路']?.trim() || null,
                        driver_name: driverName,
                        license_plate: rowData['车牌号']?.toString().trim() || null,
                        driver_phone: rowData['司机电话']?.toString().trim() || null,
                        loading_location: loadingLocation,
                        unloading_location: unloadingLocation,
                        loading_date: format(new Date(loadingDateRaw), 'yyyy-MM-dd'),
                        unloading_date: rowData['卸货日期'] ? format(new Date(rowData['卸货日期']), 'yyyy-MM-dd') : format(new Date(loadingDateRaw), 'yyyy-MM-dd'),
                        loading_weight: rowData['装货重量'] ? parseFloat(rowData['装货重量']).toString() : null,
                        unloading_weight: rowData['卸货重量'] ? parseFloat(rowData['卸货重量']).toString() : null,
                        current_cost: rowData['运费金额'] ? parseFloat(rowData['运费金额']).toString() : '0',
                        extra_cost: rowData['额外费用'] ? parseFloat(rowData['额外费用']).toString() : '0',
                        transport_type: rowData['运输类型']?.trim() || '实际运输',
                        remarks: rowData['备注']?.toString().trim() || null,
                        // 可选字段
                        platform_trackings: platformTrackings
                    };
                    
                    batchRecords.push(recordData);
                } catch (err: any) {
                    console.warn(`第 ${index + 2} 行数据格式错误: ${err.message}`);
                }
            }

            // 调用批量导入RPC函数
            const { data: result, error: batchError } = await supabase.rpc('batch_import_logistics_records', {
                p_records: batchRecords
            });

            if (batchError) {
                throw batchError;
            }

            // 处理批量导入结果
            const successCount = (result as any).success_count || 0;
            const errorCount = (result as any).error_count || 0;
            const errors = (result as any).errors || [];

            if (errorCount > 0) {
                console.error("导入失败的详细信息:", errors);
                toast({ 
                    title: "导入完成", 
                    description: `批量导入完成，成功 ${successCount} 条，失败 ${errorCount} 条。`,
                    variant: errorCount > successCount ? "destructive" : "default"
                });
            } else {
                toast({ title: "成功", description: `批量导入成功完成！共导入 ${successCount} 条运单记录。` });
            }

        } catch (error: any) {
            console.error("批量导入错误:", error);
            toast({ title: "错误", description: `批量导入失败: ${error.message}`, variant: "destructive" });
        } finally {
            setIsImporting(false);
            event.target.value = '';
        }
    };
    reader.readAsArrayBuffer(file);
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
                <li>系统会根据**项目名称**、**司机姓名**和**地点名称**自动匹配或创建新记录。</li>
                <li>请确保Excel中的**项目名称**与系统中已有的项目名称完全一致。</li>
                <li>如果司机或地点不存在，系统将**自动为您创建**并关联到对应的项目中。</li>
                <li>新版本使用**批量处理**，导入速度更快，自动生成运单编号。</li>
              </ul>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button variant="outline" onClick={handleTemplateDownload} className="w-full sm:w-auto">
                <Download className="mr-2 h-4 w-4" />
                下载模板文件
              </Button>

              <Button asChild className="w-full sm:w-auto" disabled={isImporting}>
                <Label htmlFor="excel-upload" className="cursor-pointer">
                  {isImporting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FileUp className="mr-2 h-4 w-4" />
                  )}
                  {isImporting ? '正在导入...' : '选择Excel文件并开始导入'}
                  <Input 
                    id="excel-upload" 
                    type="file" 
                    className="hidden" 
                    onChange={handleExcelImport} 
                    accept=".xlsx, .xls" 
                    disabled={isImporting}
                  />
                </Label>
              </Button>
            </div>

            <div className="p-4 border rounded-md">
                <h4 className="font-semibold flex items-center"><ListChecks className="mr-2 h-4 w-4"/>模板字段说明</h4>
                <ul className="list-disc pl-5 mt-2 text-sm text-muted-foreground space-y-1">
                    <li>**项目名称**: 必须与系统中已有的项目名称完全一致。</li>
                    <li>**司机姓名**: 如果系统中不存在，将自动创建新司机。</li>
                    <li>**装/卸货地点**: 如果系统中不存在，将自动创建新地点。</li>
                    <li>**装货日期**: 格式为 YYYY-MM-DD。</li>
                    <li>**运输类型**: 填写"实际运输"或"退货"。</li>
                    <li>**运费金额 / 额外费用**: 只填写数字即可。</li>
                </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}