import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CalendarIcon, TruckIcon, MapPinIcon, Plus, Edit2, Trash2, Eye, Calendar, Truck, MapPin, User, Clock, Weight, DollarSign, Upload, Download } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { SupabaseStorage } from "@/utils/supabase";
import { LogisticsRecord, Project, Driver, Location } from "@/types";
import * as XLSX from 'xlsx';

export default function BusinessEntry() {
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [records, setRecords] = useState<LogisticsRecord[]>([]);
  const [editingRecord, setEditingRecord] = useState<LogisticsRecord | null>(null);
  const [viewingRecord, setViewingRecord] = useState<LogisticsRecord | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    projectId: "",
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
    payableFee: "",
    remarks: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [loadedProjects, loadedDrivers, loadedLocations, loadedRecords] = await Promise.all([
        SupabaseStorage.getProjects(),
        SupabaseStorage.getDrivers(),
        SupabaseStorage.getLocations(),
        SupabaseStorage.getLogisticsRecords()
      ]);
      setProjects(loadedProjects);
      setDrivers(loadedDrivers);
      setLocations(loadedLocations);
      setRecords(loadedRecords);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "加载失败",
        description: "无法加载数据",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      projectId: "",
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
      payableFee: "",
      remarks: "",
    });
    setEditingRecord(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.projectId || !formData.loadingTime || !formData.loadingLocation || 
        !formData.unloadingLocation || !formData.driverId || !formData.loadingWeight) {
      toast({
        title: "错误",
        description: "请填写所有必填字段",
        variant: "destructive",
      });
      return;
    }

    const project = projects.find(p => p.id === formData.projectId);
    const driver = drivers.find(d => d.id === formData.driverId);

    if (!project || !driver) {
      toast({
        title: "错误", 
        description: "项目或司机信息不存在",
        variant: "destructive",
      });
      return;
    }

    const recordData = {
      projectId: formData.projectId,
      projectName: project.name,
      loadingTime: formData.loadingTime,
      loadingLocation: formData.loadingLocation,
      unloadingLocation: formData.unloadingLocation,
      driverId: formData.driverId,
      driverName: driver.name,
      licensePlate: driver.licensePlate,
      driverPhone: driver.phone,
      loadingWeight: parseFloat(formData.loadingWeight),
      unloadingDate: formData.unloadingDate || undefined,
      unloadingWeight: formData.unloadingWeight ? parseFloat(formData.unloadingWeight) : undefined,
      transportType: formData.transportType,
      currentFee: formData.currentFee ? parseFloat(formData.currentFee) : undefined,
      extraFee: formData.extraFee ? parseFloat(formData.extraFee) : undefined,
      payableFee: formData.payableFee ? parseFloat(formData.payableFee) : undefined,
      remarks: formData.remarks || undefined,
      createdByUserId: "current-user",
    };

    try {
      if (editingRecord) {
        await SupabaseStorage.updateLogisticsRecord(editingRecord.id, recordData);
        toast({
          title: "成功",
          description: "物流记录已更新",
        });
      } else {
        await SupabaseStorage.addLogisticsRecord(recordData);
        toast({
          title: "成功",
          description: "物流记录已添加",
        });
      }

      resetForm();
      await loadData();
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
    setFormData({
      projectId: record.projectId,
      loadingTime: record.loadingTime,
      loadingLocation: record.loadingLocation,
      unloadingLocation: record.unloadingLocation,
      driverId: record.driverId,
      loadingWeight: record.loadingWeight.toString(),
      unloadingDate: record.unloadingDate || "",
      unloadingWeight: record.unloadingWeight?.toString() || "",
      transportType: record.transportType,
      currentFee: record.currentFee?.toString() || "",
      extraFee: record.extraFee?.toString() || "",
      payableFee: record.payableFee?.toString() || "",
      remarks: record.remarks || "",
    });
    setEditingRecord(record);
  };

  const handleDelete = async (id: string) => {
    if (confirm("确定要删除这条记录吗？")) {
      try {
        await SupabaseStorage.deleteLogisticsRecord(id);
        toast({
          title: "成功",
          description: "记录已删除",
        });
        await loadData();
      } catch (error) {
        console.error('Error deleting record:', error);
        toast({
          title: "删除失败",
          description: "无法删除记录",
          variant: "destructive",
        });
      }
    }
  };

  // Excel导入功能
  const handleExcelImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        let importedCount = 0;
        let duplicateCount = 0;

        for (const row of jsonData as any[]) {
          // 查找项目和司机
          const project = projects.find(p => p.name === row['项目名称']);
          const driver = drivers.find(d => d.name === row['司机姓名'] && d.licensePlate === row['车牌号']);

          if (!project || !driver) {
            console.warn(`跳过行：无法找到匹配的项目或司机`, row);
            continue;
          }

          // 检查是否已存在相同记录（基于项目、司机、装车时间）
          const existingRecord = records.find(r => 
            r.projectId === project.id && 
            r.driverId === driver.id && 
            r.loadingTime === row['装车时间']
          );

          if (existingRecord) {
            duplicateCount++;
            continue;
          }

          const recordData = {
            projectId: project.id,
            projectName: project.name,
            loadingTime: row['装车时间'],
            loadingLocation: row['装车地点'],
            unloadingLocation: row['卸车地点'],
            driverId: driver.id,
            driverName: driver.name,
            licensePlate: driver.licensePlate,
            driverPhone: driver.phone,
            loadingWeight: parseFloat(row['装车重量']) || 0,
            unloadingDate: row['卸车日期'] || undefined,
            unloadingWeight: row['卸车重量'] ? parseFloat(row['卸车重量']) : undefined,
            transportType: row['运输类型'] || '实际运输',
            currentFee: row['当前费用'] ? parseFloat(row['当前费用']) : undefined,
            extraFee: row['额外费用'] ? parseFloat(row['额外费用']) : undefined,
            payableFee: row['应付费用'] ? parseFloat(row['应付费用']) : undefined,
            remarks: row['备注'] || undefined,
            createdByUserId: "current-user",
          };

          await SupabaseStorage.addLogisticsRecord(recordData);
          importedCount++;
        }

        toast({
          title: "导入完成",
          description: `成功导入 ${importedCount} 条记录，跳过 ${duplicateCount} 条重复记录`,
        });

        await loadData();
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
    
    // 清空文件输入
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Excel导出功能
  const handleExcelExport = () => {
    try {
      const exportData = records.map(record => ({
        '自动编号': record.autoNumber,
        '项目名称': record.projectName,
        '装车时间': record.loadingTime,
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
        '应付费用': record.payableFee || '',
        '备注': record.remarks || '',
        '创建时间': new Date(record.createdAt).toLocaleString()
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, '物流记录');

      const fileName = `物流记录_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      toast({
        title: "导出成功",
        description: `已导出 ${records.length} 条记录到 ${fileName}`,
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

  return (
    <div className="space-y-8">
      <div className="flex items-center space-x-3">
        <div className="p-2 bg-gradient-primary rounded-lg shadow-primary">
          <TruckIcon className="h-6 w-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-foreground">核心业务录入</h1>
          <p className="text-muted-foreground">录入和管理物流运输记录</p>
        </div>
      </div>

      {/* 录入表单 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Plus className="h-5 w-5" />
            <span>{editingRecord ? "编辑记录" : "新增记录"}</span>
          </CardTitle>
          <CardDescription>
            {editingRecord ? "修改现有物流记录信息" : "录入新的物流运输记录"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="project">项目 *</Label>
                <Select value={formData.projectId} onValueChange={(value) => setFormData(prev => ({ ...prev, projectId: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择项目" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name} - {project.manager}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="loadingTime">装车时间 *</Label>
                <Input
                  id="loadingTime"
                  type="datetime-local"
                  value={formData.loadingTime}
                  onChange={(e) => setFormData(prev => ({ ...prev, loadingTime: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="loadingLocation">装车地点 *</Label>
                <Select value={formData.loadingLocation} onValueChange={(value) => setFormData(prev => ({ ...prev, loadingLocation: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择装车地点" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((location) => (
                      <SelectItem key={location.id} value={location.name}>
                        {location.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="unloadingLocation">卸车地点 *</Label>
                <Select value={formData.unloadingLocation} onValueChange={(value) => setFormData(prev => ({ ...prev, unloadingLocation: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择卸车地点" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((location) => (
                      <SelectItem key={location.id} value={location.name}>
                        {location.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="driver">司机 *</Label>
                <Select value={formData.driverId} onValueChange={(value) => setFormData(prev => ({ ...prev, driverId: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择司机" />
                  </SelectTrigger>
                  <SelectContent>
                    {drivers.map((driver) => (
                      <SelectItem key={driver.id} value={driver.id}>
                        {driver.name} - {driver.licensePlate}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="loadingWeight">装车重量(吨) *</Label>
                <Input
                  id="loadingWeight"
                  type="number"
                  step="0.1"
                  value={formData.loadingWeight}
                  onChange={(e) => setFormData(prev => ({ ...prev, loadingWeight: e.target.value }))}
                  placeholder="请输入装车重量"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="unloadingDate">卸车日期</Label>
                <Input
                  id="unloadingDate"
                  type="date"
                  value={formData.unloadingDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, unloadingDate: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="unloadingWeight">卸车重量(吨)</Label>
                <Input
                  id="unloadingWeight"
                  type="number"
                  step="0.1"
                  value={formData.unloadingWeight}
                  onChange={(e) => setFormData(prev => ({ ...prev, unloadingWeight: e.target.value }))}
                  placeholder="请输入卸车重量"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="transportType">运输类型</Label>
                <Select value={formData.transportType} onValueChange={(value: "实际运输" | "退货") => setFormData(prev => ({ ...prev, transportType: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="实际运输">实际运输</SelectItem>
                    <SelectItem value="退货">退货</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="currentFee">当前费用(元)</Label>
                <Input
                  id="currentFee"
                  type="number"
                  step="0.01"
                  value={formData.currentFee}
                  onChange={(e) => setFormData(prev => ({ ...prev, currentFee: e.target.value }))}
                  placeholder="请输入当前费用"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="extraFee">额外费用(元)</Label>
                <Input
                  id="extraFee"
                  type="number"
                  step="0.01"
                  value={formData.extraFee}
                  onChange={(e) => setFormData(prev => ({ ...prev, extraFee: e.target.value }))}
                  placeholder="请输入额外费用"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="payableFee">应付费用(元)</Label>
                <Input
                  id="payableFee"
                  type="number"
                  step="0.01"
                  value={formData.payableFee}
                  onChange={(e) => setFormData(prev => ({ ...prev, payableFee: e.target.value }))}
                  placeholder="请输入应付费用"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="remarks">备注</Label>
              <Textarea
                id="remarks"
                value={formData.remarks}
                onChange={(e) => setFormData(prev => ({ ...prev, remarks: e.target.value }))}
                placeholder="请输入备注信息"
                rows={3}
              />
            </div>

            <div className="flex space-x-2">
              <Button type="submit">
                {editingRecord ? "更新记录" : "保存记录"}
              </Button>
              {editingRecord && (
                <Button type="button" variant="outline" onClick={resetForm}>
                  取消编辑
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* 记录列表 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>物流记录列表</CardTitle>
              <CardDescription>所有物流运输记录</CardDescription>
            </div>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center space-x-2"
              >
                <Upload className="h-4 w-4" />
                <span>导入Excel</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExcelExport}
                className="flex items-center space-x-2"
              >
                <Download className="h-4 w-4" />
                <span>导出Excel</span>
              </Button>
              <input
                type="file"
                ref={fileInputRef}
                accept=".xlsx,.xls"
                onChange={handleExcelImport}
                style={{ display: 'none' }}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>单号</TableHead>
                  <TableHead>项目</TableHead>
                  <TableHead>装车时间</TableHead>
                  <TableHead>路线</TableHead>
                  <TableHead>司机</TableHead>
                  <TableHead>重量</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>费用</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">{record.autoNumber}</TableCell>
                    <TableCell>{record.projectName}</TableCell>
                    <TableCell>{new Date(record.loadingTime).toLocaleString()}</TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-1 text-sm">
                        <MapPinIcon className="h-3 w-3" />
                        <span>{record.loadingLocation}</span>
                        <span>→</span>
                        <span>{record.unloadingLocation}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{record.driverName}</div>
                        <div className="text-sm text-muted-foreground">{record.licensePlate}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div>装: {record.loadingWeight}吨</div>
                        {record.unloadingWeight && (
                          <div className="text-sm text-muted-foreground">卸: {record.unloadingWeight}吨</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={record.transportType === "实际运输" ? "default" : "secondary"}>
                        {record.transportType}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {record.payableFee && `¥${record.payableFee.toFixed(2)}`}
                    </TableCell>
                     <TableCell>
                       <div className="flex space-x-1">
                         <Button
                           variant="ghost"
                           size="sm"
                           onClick={() => setViewingRecord(record)}
                           title="查看详情"
                         >
                           <Eye className="h-4 w-4" />
                         </Button>
                         <Button
                           variant="ghost"
                           size="sm"
                           onClick={() => handleEdit(record)}
                         >
                           <Edit2 className="h-4 w-4" />
                         </Button>
                         <Button
                           variant="ghost"
                           size="sm"
                           onClick={() => handleDelete(record.id)}
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
          {records.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              暂无物流记录
            </div>
          )}
        </CardContent>
      </Card>

      {/* 记录详情对话框 */}
      <Dialog open={!!viewingRecord} onOpenChange={() => setViewingRecord(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>物流记录详情</DialogTitle>
          </DialogHeader>
          {viewingRecord && (
            <div className="grid gap-6">
              {/* 基本信息 */}
              <div className="grid gap-4">
                <h3 className="font-semibold text-lg">基本信息</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">自动编号</span>
                    </div>
                    <p className="font-medium">{viewingRecord.autoNumber}</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Truck className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">项目名称</span>
                    </div>
                    <p className="font-medium">{viewingRecord.projectName}</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">装车时间</span>
                    </div>
                    <p className="font-medium">{viewingRecord.loadingTime}</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">卸车日期</span>
                    </div>
                    <p className="font-medium">{viewingRecord.unloadingDate || "未填写"}</p>
                  </div>
                </div>
              </div>

              {/* 位置信息 */}
              <div className="grid gap-4">
                <h3 className="font-semibold text-lg">位置信息</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">装车地点</span>
                    </div>
                    <p className="font-medium">{viewingRecord.loadingLocation}</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">卸车地点</span>
                    </div>
                    <p className="font-medium">{viewingRecord.unloadingLocation}</p>
                  </div>
                </div>
              </div>

              {/* 司机信息 */}
              <div className="grid gap-4">
                <h3 className="font-semibold text-lg">司机信息</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">司机姓名</span>
                    </div>
                    <p className="font-medium">{viewingRecord.driverName}</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Truck className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">车牌号</span>
                    </div>
                    <p className="font-medium">{viewingRecord.licensePlate}</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">联系电话</span>
                    </div>
                    <p className="font-medium">{viewingRecord.driverPhone}</p>
                  </div>
                </div>
              </div>

              {/* 重量信息 */}
              <div className="grid gap-4">
                <h3 className="font-semibold text-lg">重量信息</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Weight className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">装车重量</span>
                    </div>
                    <p className="font-medium">{viewingRecord.loadingWeight ? `${viewingRecord.loadingWeight}吨` : "未填写"}</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Weight className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">卸车重量</span>
                    </div>
                    <p className="font-medium">{viewingRecord.unloadingWeight ? `${viewingRecord.unloadingWeight}吨` : "未填写"}</p>
                  </div>
                </div>
              </div>

              {/* 费用信息 */}
              <div className="grid gap-4">
                <h3 className="font-semibold text-lg">费用信息</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">当前费用</span>
                    </div>
                    <p className="font-medium">{viewingRecord.currentFee ? `¥${viewingRecord.currentFee.toFixed(2)}` : "未填写"}</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">额外费用</span>
                    </div>
                    <p className="font-medium">{viewingRecord.extraFee ? `¥${viewingRecord.extraFee.toFixed(2)}` : "未填写"}</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">应付费用</span>
                    </div>
                    <p className="font-medium">{viewingRecord.payableFee ? `¥${viewingRecord.payableFee.toFixed(2)}` : "未填写"}</p>
                  </div>
                </div>
              </div>

              {/* 其他信息 */}
              <div className="grid gap-4">
                <h3 className="font-semibold text-lg">其他信息</h3>
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Truck className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">运输类型</span>
                    </div>
                    <Badge variant={viewingRecord.transportType === "实际运输" ? "default" : "secondary"}>
                      {viewingRecord.transportType}
                    </Badge>
                  </div>
                  {viewingRecord.remarks && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">备注</span>
                      </div>
                      <p className="font-medium bg-muted p-3 rounded-md">{viewingRecord.remarks}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}