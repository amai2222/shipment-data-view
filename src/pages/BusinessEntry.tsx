import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CalendarIcon, TruckIcon, MapPinIcon, Plus, Edit2, Trash2, Eye, Calendar, Truck, MapPin, User, Clock, Weight, DollarSign, Upload, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { LogisticsForm } from "@/components/LogisticsForm";
import { useToast } from "@/hooks/use-toast";
import { SupabaseStorage } from "@/utils/supabase";
import { supabase } from "@/integrations/supabase/client";
import { LogisticsRecord, Project } from "@/types";
import * as XLSX from 'xlsx';

export default function BusinessEntry() {
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [records, setRecords] = useState<LogisticsRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalRecords, setTotalRecords] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(50); // 每页显示50条记录
  const [filteredRecords, setFilteredRecords] = useState<LogisticsRecord[]>([]);
  const [editingRecord, setEditingRecord] = useState<LogisticsRecord | null>(null);
  const [viewingRecord, setViewingRecord] = useState<LogisticsRecord | null>(null);
  const [viewingPartnerCosts, setViewingPartnerCosts] = useState<any[]>([]);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
  const [confirmTitle, setConfirmTitle] = useState("");
  const [confirmDescription, setConfirmDescription] = useState("");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // 筛选器状态
  const [filterDriver, setFilterDriver] = useState<string>("");
  const [filterProjectId, setFilterProjectId] = useState<string>("all");
  const [filterDriverId, setFilterDriverId] = useState<string>("all");
  const [filterStartDate, setFilterStartDate] = useState<string>("");
  const [filterEndDate, setFilterEndDate] = useState<string>("");

  // 主表单状态（用于新增）
  const [formData, setFormData] = useState({
    projectId: "",
    chainId: "",
    loadingTime: "",
    loadingLocation: "",
    unloadingLocation: "",
    driverId: "",
    loadingWeight: "",
    unloadingDate: "",
    unloadingWeight: "",
    transportType: "实际运输" as "实际运输" | "退货",
    currentFee: "",
    extraFee: "",
    driverReceivable: "",
    remarks: "",
  });

  // 编辑表单状态（独立于主表单）
  const [editFormData, setEditFormData] = useState({
    projectId: "",
    chainId: "",
    loadingTime: "",
    loadingLocation: "",
    unloadingLocation: "",
    driverId: "",
    loadingWeight: "",
    unloadingDate: "",
    unloadingWeight: "",
    transportType: "实际运输" as "实际运输" | "退货",
    currentFee: "",
    extraFee: "",
    driverReceivable: "",
    remarks: "",
  });

  useEffect(() => {
    loadBasicData();
  }, []);

  useEffect(() => {
    loadRecords();
  }, [currentPage, filterStartDate, filterEndDate, filterProjectId, filterDriverId]);

  const loadBasicData = async () => {
    try {
      // 加载项目、司机、地点数据
      const [projectsResult] = await Promise.all([
        SupabaseStorage.getProjects()
      ]);

      setProjects(projectsResult);
    } catch (error) {
      console.error('加载基础数据失败:', error);
      toast({
        title: "错误",
        description: "加载基础数据失败",
        variant: "destructive",
      });
    }
  };

  const loadRecords = async () => {
    setLoading(true);
    try {
      // 使用数据库函数获取分页和筛选后的运单数据
      const projectId = filterProjectId === "all" ? null : filterProjectId;
      const driverId = filterDriverId === "all" ? null : filterDriverId;
      const startDate = filterStartDate || null;
      const endDate = filterEndDate || null;
      const offset = (currentPage - 1) * pageSize;

      const { data, error } = await supabase
        .rpc('get_filtered_logistics_records', {
          p_project_id: projectId,
          p_driver_id: driverId,
          p_start_date: startDate,
          p_end_date: endDate,
          p_limit: pageSize,
          p_offset: offset
        });

      if (error) throw error;

      if (data && data.length > 0) {
        const totalCount = data[0].total_count;
        setTotalRecords(Number(totalCount));
        
        const recordsWithoutCount = data.map(record => ({
          id: record.id,
          autoNumber: record.auto_number,
          projectId: record.project_id,
          projectName: record.project_name,
          chainId: record.chain_id,
          loadingDate: record.loading_date,
          loadingLocation: record.loading_location,
          unloadingLocation: record.unloading_location,
          driverId: record.driver_id,
          driverName: record.driver_name,
          licensePlate: record.license_plate,
          driverPhone: record.driver_phone,
          loadingWeight: record.loading_weight,
          unloadingDate: record.unloading_date,
          unloadingWeight: record.unloading_weight,
          transportType: record.transport_type as "实际运输" | "退货",
          currentFee: record.current_cost,
          extraFee: record.extra_cost,
          payableFee: record.payable_cost,
          remarks: record.remarks,
          createdAt: record.created_at,
          createdByUserId: record.created_by_user_id,
        }));
        
        setRecords(recordsWithoutCount);
        setFilteredRecords(recordsWithoutCount);
      } else {
        setRecords([]);
        setFilteredRecords([]);
        setTotalRecords(0);
      }
    } catch (error) {
      console.error('加载运单数据失败:', error);
      toast({
        title: "错误",
        description: "加载运单数据失败",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };


  const resetForm = () => {
    setFormData({
      projectId: "",
      chainId: "",
      loadingTime: "",
      loadingLocation: "",
      unloadingLocation: "",
      driverId: "",
      loadingWeight: "",
      unloadingDate: "",
      unloadingWeight: "",
      transportType: "实际运输",
      currentFee: "",
      extraFee: "",
      driverReceivable: "",
      remarks: "",
    });
    setEditingRecord(null);
  };

  const showConfirm = (title: string, description: string, action: () => void) => {
    setConfirmTitle(title);
    setConfirmDescription(description);
    setConfirmAction(() => action);
    setShowConfirmDialog(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const currentData = editingRecord ? editFormData : formData;
    if (!currentData.projectId || !currentData.chainId || !currentData.loadingTime || 
        !currentData.loadingLocation || !currentData.unloadingLocation || 
        !currentData.driverId || !currentData.loadingWeight) {
      toast({
        title: "错误",
        description: "请填写所有必填字段",
        variant: "destructive",
      });
      return;
    }

    const action = editingRecord ? "更新" : "添加";
    showConfirm(
      `${action}记录确认`,
      `确定要${action}这条物流记录吗？`,
      () => performSubmit()
    );
  };

  const performSubmit = async () => {
    const currentData = editingRecord ? editFormData : formData;
    const project = projects.find(p => p.id === currentData.projectId);

    if (!project) {
      toast({
        title: "错误", 
        description: "项目信息不存在",
        variant: "destructive",
      });
      return;
    }

    const recordData = {
      projectId: currentData.projectId,
      projectName: project.name,
      chainId: currentData.chainId,
      loadingDate: currentData.loadingTime.split('T')[0],
      loadingLocation: currentData.loadingLocation,
      unloadingLocation: currentData.unloadingLocation,
      driverId: currentData.driverId,
      driverName: "",
      licensePlate: "",
      driverPhone: "",
      loadingWeight: parseFloat(currentData.loadingWeight),
      unloadingDate: currentData.unloadingDate || undefined,
      unloadingWeight: currentData.unloadingWeight ? parseFloat(currentData.unloadingWeight) : undefined,
      transportType: currentData.transportType,
      currentFee: currentData.currentFee ? parseFloat(currentData.currentFee) : undefined,
      extraFee: currentData.extraFee ? parseFloat(currentData.extraFee) : undefined,
      payableFee: currentData.driverReceivable ? parseFloat(currentData.driverReceivable) : undefined,
      remarks: currentData.remarks || undefined,
      createdByUserId: "current-user",
    };

    try {
      if (editingRecord) {
        await SupabaseStorage.updateLogisticsRecord(editingRecord.id, recordData);
        toast({
          title: "成功",
          description: "物流记录已更新",
        });
        setEditDialogOpen(false);
      } else {
        await SupabaseStorage.addLogisticsRecord(recordData);
        toast({
          title: "成功",
          description: "物流记录已添加",
        });
      }

      resetForm();
      loadRecords(); // 使用新的分页加载函数
    } catch (error) {
        console.error('Error saving record:', error);
      toast({
        title: "保存失败",
        description: "无法保存物流记录",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (record: LogisticsRecord) => {
    setEditFormData({
      projectId: record.projectId,
      chainId: (record as any).chainId || "", 
      loadingTime: record.loadingDate,
      loadingLocation: record.loadingLocation,
      unloadingLocation: record.unloadingLocation,
      driverId: record.driverId,
      loadingWeight: record.loadingWeight.toString(),
      unloadingDate: record.unloadingDate || "",
      unloadingWeight: record.unloadingWeight?.toString() || "",
      transportType: record.transportType,
      currentFee: record.currentFee?.toString() || "",
      extraFee: record.extraFee?.toString() || "",
      driverReceivable: record.payableFee?.toString() || "",
      remarks: record.remarks || "",
    });
    setEditingRecord(record);
    setEditDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    showConfirm(
      "删除记录确认",
      "确定要删除这条记录吗？删除后无法恢复。",
      () => performDelete(id)
    );
  };

  const performDelete = async (id: string) => {
    try {
      await SupabaseStorage.deleteLogisticsRecord(id);
      toast({
        title: "成功",
        description: "记录已删除",
      });
      loadRecords(); // 使用新的分页加载函数
    } catch (error) {
      console.error('Error deleting record:', error);
      toast({
        title: "删除失败",
        description: "无法删除记录",
        variant: "destructive",
      });
    }
  };

  // Excel导入功能 - 优化错误处理和日期处理
  const handleExcelImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        let importedCount = 0;
        let duplicateCount = 0;
        const failedRows: Array<{ row: number; reason: string; data: any }> = [];

        for (const [index, row] of (jsonData as any[]).entries()) {
          try {
            const project = projects.find(p => p.name === row['项目名称']);
            if (!project) {
              failedRows.push({
                row: index + 2,
                reason: `找不到项目：${row['项目名称']}`,
                data: row
              });
              continue;
            }

            const formatDate = (dateValue: any) => {
              if (!dateValue) return '';
              
              if (dateValue instanceof Date) {
                return dateValue.toISOString().split('T')[0];
              }
              
              const dateStr = dateValue.toString();
              if (dateStr.includes('T')) {
                return dateStr.split('T')[0];
              }
              
              const parsed = new Date(dateStr);
              if (!isNaN(parsed.getTime())) {
                return parsed.toISOString().split('T')[0];
              }
              
              return dateStr;
            };

            const loadingDate = formatDate(row['装车日期']);
            const unloadingDate = row['卸车日期'] ? formatDate(row['卸车日期']) : undefined;

            let driver = await SupabaseStorage.getDrivers().then(drivers => 
              drivers.find(d => d.name === row['司机姓名'] && d.licensePlate === row['车牌号'])
            );

            if (!driver && row['司机姓名'] && row['车牌号']) {
              try {
                driver = await SupabaseStorage.addDriver({
                  name: row['司机姓名'],
                  licensePlate: row['车牌号'],
                  phone: row['司机电话'] || '',
                  projectIds: [project.id]
                });
              } catch (error) {
                failedRows.push({
                  row: index + 2,
                  reason: `无法创建司机：${row['司机姓名']} (${row['车牌号']})`,
                  data: row
                });
                continue;
              }
            }

            if (!driver) {
              failedRows.push({
                row: index + 2,
                reason: `找不到司机：${row['司机姓名']} (${row['车牌号']})`,
                data: row
              });
              continue;
            }
            
            let chainId = "";
            if (project && row['合作链路']) {
              try {
                const chains = await SupabaseStorage.getPartnerChains(project.id);
                const matchedChain = chains.find(c => c.chain_name === row['合作链路']);
                if (matchedChain) {
                  chainId = matchedChain.id;
                }
              } catch (error) {
                console.warn('Error loading partner chains for import:', error);
              }
            }

            const existingRecord = records.find(r => 
              r.projectId === project.id && 
              r.driverId === driver.id && 
              r.loadingDate === loadingDate
            );

            if (existingRecord) {
              duplicateCount++;
              continue;
            }

            const recordData = {
              projectId: project.id,
              projectName: project.name,
              chainId: chainId || undefined,
              loadingDate: loadingDate,
              loadingLocation: row['装车地点'] || '',
              unloadingLocation: row['卸车地点'] || '',
              driverId: driver.id,
              driverName: driver.name,
              licensePlate: driver.licensePlate,
              driverPhone: driver.phone,
              loadingWeight: parseFloat(row['装车重量']) || 0,
              unloadingDate: unloadingDate,
              unloadingWeight: row['卸车重量'] ? parseFloat(row['卸车重量']) : undefined,
              transportType: row['运输类型'] || '实际运输',
              currentFee: row['当前费用'] ? parseFloat(row['当前费用']) : undefined,
              extraFee: row['额外费用'] ? parseFloat(row['额外费用']) : undefined,
              payableFee: row['司机应收'] || row['应付费用'] ? parseFloat(row['司机应收'] || row['应付费用']) : undefined,
              remarks: row['备注'] || undefined,
              createdByUserId: "current-user",
            };

            await SupabaseStorage.addLogisticsRecord(recordData);
            importedCount++;
          } catch (error) {
            failedRows.push({
              row: index + 2,
              reason: `处理错误：${error instanceof Error ? error.message : '未知错误'}`,
              data: row
            });
          }
        }

        let message = `成功导入 ${importedCount} 条记录`;
        if (duplicateCount > 0) {
          message += `，跳过 ${duplicateCount} 条重复记录`;
        }
        if (failedRows.length > 0) {
          message += `，${failedRows.length} 条记录导入失败`;
          console.warn('导入失败的记录：', failedRows);
        }

        toast({
          title: "导入完成",
          description: message,
          variant: failedRows.length > 0 ? "destructive" : "default",
        });

        loadRecords(); // 使用新的分页加载函数
      } catch (error) {
        console.error('Error importing Excel:', error);
        toast({
          title: "导入失败",
          description: "Excel文件格式不正确或数据有误",
          variant: "destructive",
        });
      }
    };
    reader.readAsArrayBuffer(file);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 重置筛选条件时回到第一页
  const resetFilters = () => {
    setFilterDriver("");
    setFilterStartDate("");
    setFilterEndDate("");
    setFilterProjectId("all");
    setFilterDriverId("all");
    setCurrentPage(1);
  };

  // 下载导入模板
  const handleTemplateDownload = () => {
    try {
      const templateData = [
        {
          '项目名称': '示例项目',
          '合作链路': '默认链路',
          '装车日期': '2024-01-01',
          '装车地点': '示例装货地点',
          '卸车地点': '示例卸货地点',
          '司机姓名': '张三',
          '车牌号': '京A12345',
          '司机电话': '13800138000',
          '装车重量': '10.5',
          '卸车日期': '2024-01-02',
          '卸车重量': '10.3',
          '运输类型': '实际运输',
          '当前费用': '1000',
          '额外费用': '100',
          '司机应收': '1100',
          '备注': '示例备注'
        }
      ];

      const worksheet = XLSX.utils.json_to_sheet(templateData);
      
      const colWidths = [
        { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 15 },
        { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 12 },
        { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
        { wch: 15 }
      ];
      worksheet['!cols'] = colWidths;

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "导入模板");
      XLSX.writeFile(workbook, "物流记录导入模板.xlsx");

      toast({
        title: "模板下载成功",
        description: "请按照模板格式填写数据后导入",
      });
    } catch (error) {
      console.error('Error downloading template:', error);
      toast({
        title: "下载失败",
        description: "无法下载模板文件",
        variant: "destructive",
      });
    }
  };

  // Excel导出功能
  const handleExcelExport = () => {
    try {
      const exportData = filteredRecords.map(record => ({
        '自动编号': record.autoNumber,
        '项目名称': record.projectName,
        '装车日期': record.loadingDate,
        '装车地点': record.loadingLocation,
        '卸车地点': record.unloadingLocation,
        '司机姓名': record.driverName,
        '车牌号': record.licensePlate,
        '司机电话': record.driverPhone,
        '装车重量': record.loadingWeight,
        '卸车日期': record.unloadingDate || '',
        '卸车重量': record.unloadingWeight || '',
        '运输类型': record.transportType,
        '当前费用': record.currentFee || '',
        '额外费用': record.extraFee || '',
        '司机应收': record.payableFee || '',
        '备注': record.remarks || '',
        '创建时间': record.createdAt
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      
      const colWidths = [
        { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 15 },
        { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 12 },
        { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
        { wch: 15 }, { wch: 20 }
      ];
      worksheet['!cols'] = colWidths;

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "物流记录");
      
      const fileName = `物流记录导出_${new Date().toLocaleDateString().replace(/\//g, '-')}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      toast({
        title: "导出成功",
        description: `已导出 ${exportData.length} 条记录`,
      });
    } catch (error) {
      console.error('Error exporting Excel:', error);
      toast({
        title: "导出失败",
        description: "无法导出Excel文件",
        variant: "destructive",
      });
    }
  };

  const handleView = async (record: LogisticsRecord) => {
    setViewingRecord(record);
    
    try {
      const partnerCosts = await supabase
        .from('logistics_partner_costs')
        .select(`
          *,
          partners:partner_id (
            name
          )
        `)
        .eq('logistics_record_id', record.id);
      
      if (partnerCosts.error) {
        console.error('Error loading partner costs:', partnerCosts.error);
        setViewingPartnerCosts([]);
      } else {
        setViewingPartnerCosts(partnerCosts.data || []);
      }
    } catch (error) {
      console.error('Error loading partner costs:', error);
      setViewingPartnerCosts([]);
    }
  };

  // 计算合计
  const totalWeight = records.reduce((sum, record) => sum + record.loadingWeight, 0);
  const totalCurrentFee = records.reduce((sum, record) => sum + (record.currentFee || 0), 0);
  const totalDriverReceivable = records.reduce((sum, record) => sum + (record.payableFee || 0), 0);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">运单录入</h1>
          <p className="text-muted-foreground">管理物流运输记录</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              运单录入
            </CardTitle>
            <CardDescription>
              填写物流运输记录的详细信息
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LogisticsForm 
              formData={formData}
              setFormData={setFormData}
              projects={projects}
              onSubmit={handleSubmit}
              submitLabel="保存记录"
            />
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-medium">筛选和操作</CardTitle>
              <div className="flex gap-2">
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  <Upload className="h-4 w-4" />
                  导入Excel
                </Button>
                <Button
                  onClick={handleTemplateDownload}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  下载模板
                </Button>
                <Button
                  onClick={handleExcelExport}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  导出Excel
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 md:gap-4">
                <div className="flex items-center gap-2">
                  <Label htmlFor="filterStartDate" className="text-sm">开始日期:</Label>
                  <Input
                    id="filterStartDate"
                    type="date"
                    value={filterStartDate}
                    onChange={(e) => setFilterStartDate(e.target.value)}
                    className="w-40"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Label htmlFor="filterEndDate" className="text-sm">结束日期:</Label>
                  <Input
                    id="filterEndDate"
                    type="date"
                    value={filterEndDate}
                    onChange={(e) => setFilterEndDate(e.target.value)}
                    className="w-40"
                  />
                </div>

                <Button onClick={resetFilters} variant="outline" size="sm">
                  重置
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>运单记录</span>
                <Badge variant="secondary">{totalRecords} 条记录</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>自动编号</TableHead>
                      <TableHead>项目</TableHead>
                      <TableHead>装车日期</TableHead>
                      <TableHead>司机信息</TableHead>
                      <TableHead>装车重量</TableHead>
                      <TableHead>运输类型</TableHead>
                      <TableHead>司机应收</TableHead>
                      <TableHead>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="font-mono text-sm">{record.autoNumber}</TableCell>
                        <TableCell>{record.projectName}</TableCell>
                        <TableCell>{record.loadingDate}</TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium">{record.driverName}</div>
                            <div className="text-sm text-muted-foreground">{record.licensePlate}</div>
                          </div>
                        </TableCell>
                        <TableCell>{record.loadingWeight}吨</TableCell>
                        <TableCell>
                          <Badge variant={record.transportType === "实际运输" ? "default" : "secondary"}>
                            {record.transportType}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {record.payableFee ? `¥${record.payableFee}` : '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleView(record)}
                              className="h-8 w-8 p-0"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(record)}
                              className="h-8 w-8 p-0"
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(record.id)}
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {records.length > 0 && (
                <div className="mt-4 pt-4 border-t space-y-4">
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="font-medium">总重量: </span>
                      <span className="text-lg font-bold">{totalWeight.toFixed(1)}吨</span>
                    </div>
                    <div>
                      <span className="font-medium">总运费: </span>
                      <span className="text-lg font-bold">¥{totalCurrentFee.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="font-medium">司机应收总计: </span>
                      <span className="text-lg font-bold">¥{totalDriverReceivable.toFixed(2)}</span>
                    </div>
                  </div>
                  
                  {/* 分页控制 */}
                  {totalRecords > pageSize && (
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-muted-foreground">
                        显示第 {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, totalRecords)} 条，共 {totalRecords} 条记录
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                          disabled={currentPage <= 1}
                        >
                          <ChevronLeft className="h-4 w-4" />
                          上一页
                        </Button>
                        <span className="text-sm">
                          第 {currentPage} 页，共 {Math.ceil(totalRecords / pageSize)} 页
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(Math.min(Math.ceil(totalRecords / pageSize), currentPage + 1))}
                          disabled={currentPage >= Math.ceil(totalRecords / pageSize)}
                        >
                          下一页
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        style={{ display: 'none' }}
        onChange={handleExcelImport}
      />

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>编辑运单记录</DialogTitle>
          </DialogHeader>
          <LogisticsForm 
            formData={editFormData}
            setFormData={setEditFormData}
            projects={projects}
            onSubmit={handleSubmit}
            submitLabel="更新记录"
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewingRecord} onOpenChange={() => setViewingRecord(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>运单详情</DialogTitle>
          </DialogHeader>
          {viewingRecord && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <TruckIcon className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="font-medium">自动编号</div>
                      <div className="text-sm text-muted-foreground">{viewingRecord.autoNumber}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <MapPinIcon className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="font-medium">项目名称</div>
                      <div className="text-sm text-muted-foreground">{viewingRecord.projectName}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <CalendarIcon className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="font-medium">装车时间</div>
                      <div className="text-sm text-muted-foreground">{viewingRecord.loadingDate}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <MapPinIcon className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="font-medium">装车地点</div>
                      <div className="text-sm text-muted-foreground">{viewingRecord.loadingLocation}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <MapPinIcon className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="font-medium">卸车地点</div>
                      <div className="text-sm text-muted-foreground">{viewingRecord.unloadingLocation}</div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <User className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="font-medium">司机信息</div>
                      <div className="text-sm text-muted-foreground">
                        {viewingRecord.driverName} ({viewingRecord.licensePlate})
                      </div>
                      <div className="text-sm text-muted-foreground">{viewingRecord.driverPhone}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Weight className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="font-medium">装车重量</div>
                      <div className="text-sm text-muted-foreground">{viewingRecord.loadingWeight}吨</div>
                    </div>
                  </div>

                  {viewingRecord.unloadingDate && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <div className="font-medium">卸车时间</div>
                        <div className="text-sm text-muted-foreground">{viewingRecord.unloadingDate}</div>
                      </div>
                    </div>
                  )}

                  {viewingRecord.unloadingWeight && (
                    <div className="flex items-center gap-2">
                      <Weight className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <div className="font-medium">卸车重量</div>
                        <div className="text-sm text-muted-foreground">{viewingRecord.unloadingWeight}吨</div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <Truck className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="font-medium">运输类型</div>
                      <Badge variant={viewingRecord.transportType === "实际运输" ? "default" : "secondary"}>
                        {viewingRecord.transportType}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-lg font-medium flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  费用信息
                </h3>

                <div className="grid grid-cols-3 gap-4">
                  {viewingRecord.currentFee && (
                    <div>
                      <div className="font-medium">当前费用</div>
                      <div className="text-lg">¥{viewingRecord.currentFee}</div>
                    </div>
                  )}

                  {viewingRecord.extraFee && (
                    <div>
                      <div className="font-medium">额外费用</div>
                      <div className="text-lg">¥{viewingRecord.extraFee}</div>
                    </div>
                  )}

                  {viewingRecord.payableFee && (
                    <div>
                      <div className="font-medium">司机应收</div>
                      <div className="text-lg font-bold text-green-600">¥{viewingRecord.payableFee}</div>
                    </div>
                  )}
                </div>
              </div>

              {viewingPartnerCosts.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">合作方费用分配</h3>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>级别</TableHead>
                            <TableHead>合作方</TableHead>
                            <TableHead>基础金额</TableHead>
                            <TableHead>税率</TableHead>
                            <TableHead>应付金额</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {viewingPartnerCosts.map((cost) => (
                            <TableRow key={cost.id}>
                              <TableCell>{cost.level}</TableCell>
                              <TableCell>{(cost.partners as any)?.name || '未知'}</TableCell>
                              <TableCell>¥{cost.base_amount}</TableCell>
                              <TableCell>{(cost.tax_rate * 100).toFixed(1)}%</TableCell>
                              <TableCell className="font-medium">¥{cost.payable_amount}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </>
              )}

              {viewingRecord.remarks && (
                <>
                  <Separator />
                  <div>
                    <h3 className="text-lg font-medium mb-2">备注</h3>
                    <p className="text-muted-foreground">{viewingRecord.remarks}</p>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={showConfirmDialog}
        onOpenChange={setShowConfirmDialog}
        title={confirmTitle}
        description={confirmDescription}
        onConfirm={() => {
          if (confirmAction) {
            confirmAction();
            setShowConfirmDialog(false);
            setConfirmAction(null);
          }
        }}
      />
    </div>
  );
}