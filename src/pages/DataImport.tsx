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

// 2. 主组件定义
export default function DataImport() {
  // 3. 状态管理 (useState)
  const [projects, setProjects] = useState<Project[]>([]);
  const [isImporting, setIsImporting] = useState(false);
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
    // 定义模板的表头和一行示例数据
    const templateData = [{
      '项目名称': '（必填）',
      '合作链路': '（选填）',
      '司机姓名': '（必填）',
      '车牌号': '（选填）',
      '司机电话': '（选填）',
      '装货地点': '（必填）',
      '卸货地点': '（必填）',
      '装货日期': 'YYYY-MM-DD',
      '卸货日期': 'YYYY-MM-DD (选填)',
      '运输类型': '实际运输 / 退货',
      '装货重量': '（数字）',
      '卸货重量': '（数字）',
      '运费金额': '（数字）',
      '额外费用': '（数字）',
      '备注': '（选填）',
    }];
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "运单导入模板");
    XLSX.writeFile(wb, "运单导入模板.xlsx");
  };

  // 处理Excel文件导入
  const handleExcelImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    toast({ title: "加载", description: "正在读取并处理Excel文件..." });

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = e.target?.result;
            // 使用 `cellDates: true` 来确保日期被正确解析为Date对象
            const workbook = XLSX.read(data, { type: 'array', cellDates: true });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);

            let successCount = 0;
            let errorCount = 0;
            const errors: string[] = [];

            toast({ title: "处理", description: `文件读取成功，共 ${jsonData.length} 条记录，开始逐条导入...` });

            // 逐行遍历Excel数据
            for (const [index, row] of jsonData.entries()) {
                const rowNum = index + 2; // 计算在Excel中的实际行号
                const rowData: any = row;
                
                try {
                    // 提取并校验必填字段
                    const projectName = rowData['项目名称']?.trim();
                    const driverName = rowData['司机姓名']?.trim();
                    const loadingLocation = rowData['装货地点']?.trim();
                    const unloadingLocation = rowData['卸货地点']?.trim();
                    const loadingDateRaw = rowData['装货日期'];

                    if (!projectName || !driverName || !loadingLocation || !unloadingLocation || !loadingDateRaw) {
                        throw new Error("缺少必填字段（项目/司机/地点/装货日期）");
                    }
                    
                    // 匹配项目ID
                    const project = projects.find(p => p.name === projectName);
                    if (!project) {
                        throw new Error(`未找到匹配的项目 "${projectName}"`);
                    }

                    // 智能处理司机：如果不存在，则创建并关联到当前项目
                    const { data: driverResult, error: driverError } = await supabase.rpc('get_or_create_driver', {
                        p_driver_name: driverName,
                        p_license_plate: rowData['车牌号']?.toString().trim() || null,
                        p_phone: rowData['司机电话']?.toString().trim() || null,
                        p_project_id: project.id
                    });
                    if (driverError || !driverResult || driverResult.length === 0) throw new Error("处理司机信息失败");
                    const finalDriver = driverResult[0];

                    // 智能处理地点：如果不存在，则创建并关联到当前项目
                    await supabase.rpc('get_or_create_location', { p_location_name: loadingLocation, p_project_id: project.id });
                    await supabase.rpc('get_or_create_location', { p_location_name: unloadingLocation, p_project_id: project.id });

                    // 查找合作链路ID（如果提供了的话）
                    let chainId = null;
                    const chainName = rowData['合作链路']?.trim();
                    if(chainName){
                        const {data: chainData} = await supabase.from('partner_chains').select('id').eq('project_id', project.id).eq('chain_name', chainName).single();
                        if(chainData) chainId = chainData.id;
                    }

                    // 准备要插入数据库的最终数据
                    const recordData = {
                        p_project_id: project.id,
                        p_project_name: projectName,
                        p_chain_id: chainId,
                        p_driver_id: finalDriver.driver_id,
                        p_driver_name: finalDriver.driver_name,
                        p_loading_location: loadingLocation,
                        p_unloading_location: unloadingLocation,
                        p_loading_date: format(new Date(loadingDateRaw), 'yyyy-MM-dd'),
                        p_unloading_date: rowData['卸货日期'] ? format(new Date(rowData['卸货日期']), 'yyyy-MM-dd') : format(new Date(loadingDateRaw), 'yyyy-MM-dd'),
                        p_loading_weight: parseFloat(rowData['装货重量']) || null,
                        p_unloading_weight: parseFloat(rowData['卸货重量']) || null,
                        p_current_cost: parseFloat(rowData['运费金额']) || 0,
                        p_extra_cost: parseFloat(rowData['额外费用']) || 0,
                        p_license_plate: rowData['车牌号']?.toString().trim() || null,
                        p_driver_phone: rowData['司机电话']?.toString().trim() || null,
                        p_transport_type: rowData['运输类型']?.trim() || '实际运输',
                        p_remarks: rowData['备注']?.toString().trim() || null
                    };
                    
                    // 调用我们之前创建的、功能强大的“新增运单”函数
                    const { error: insertError } = await supabase.rpc('add_logistics_record_with_costs', recordData);
                    if(insertError) throw insertError;

                    successCount++;
                } catch (err: any) {
                    errorCount++;
                    errors.push(`第 ${rowNum} 行: ${err.message}`);
                }
            }

            // 最终的结果反馈
            if(errorCount > 0){
                console.error("导入失败的详细信息:", errors);
                toast({ 
                    title: "导入完成", 
                    description: `导入完成，但有 ${errorCount} 条记录失败。前几条错误: ${errors.slice(0, 3).join('; ')}...`,
                    variant: "destructive"
                });
            }
            if(successCount > 0){
                toast({ title: "成功", description: `成功导入 ${successCount} 条运单记录！` });
                // 可以在这里增加一个跳转到运单管理页面的按钮
            }

        } catch (error) {
            toast({ title: "错误", description: "文件处理失败，请检查文件格式是否与模板一致。", variant: "destructive" });
        } finally {
            setIsImporting(false);
            event.target.value = ''; // 清空文件选择，以便可以再次选择同一个文件
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
                    <li>**运输类型**: 填写“实际运输”或“退货”。</li>
                    <li>**运费金额 / 额外费用**: 只填写数字即可。</li>
                </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
