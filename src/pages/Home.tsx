import { useState, useEffect } from "react";
import { initializeSampleData } from "@/utils/sampleData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CalendarIcon, Edit, Trash2, Save, X } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { LocalStorage } from "@/utils/storage";
import { Project, Driver, Location, LogisticsRecord } from "@/types";

export default function Home() {
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [records, setRecords] = useState<LogisticsRecord[]>([]);
  const [isEditing, setIsEditing] = useState<string | null>(null);

  // 表单状态
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
    currentCost: "",
    extraCost: "",
    payableCost: "",
    remarks: "",
  });

  const [loadingDate, setLoadingDate] = useState<Date>();
  const [unloadingDate, setUnloadingDate] = useState<Date>();

  // 加载数据
  useEffect(() => {
    // 初始化示例数据
    initializeSampleData();
    
    setProjects(LocalStorage.getProjects());
    setDrivers(LocalStorage.getDrivers());
    setLocations(LocalStorage.getLocations());
    setRecords(LocalStorage.getLogisticsRecords());
  }, []);

  // 重置表单
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
      currentCost: "",
      extraCost: "",
      payableCost: "",
      remarks: "",
    });
    setLoadingDate(undefined);
    setUnloadingDate(undefined);
  };

  // 司机选择联动
  const handleDriverChange = (driverId: string) => {
    const driver = drivers.find(d => d.id === driverId);
    setFormData(prev => ({
      ...prev,
      driverId,
    }));
  };

  // 获取选中司机信息
  const getSelectedDriver = () => {
    return drivers.find(d => d.id === formData.driverId);
  };

  // 提交表单
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.projectId || !formData.loadingTime || !formData.loadingLocation || 
        !formData.unloadingLocation || !formData.driverId || !formData.loadingWeight) {
      toast({
        title: "请填写必填字段",
        description: "项目、装车时间、装车地、卸货地、司机和装货净重为必填项",
        variant: "destructive",
      });
      return;
    }

    const project = projects.find(p => p.id === formData.projectId);
    const driver = drivers.find(d => d.id === formData.driverId);

    if (!project || !driver) {
      toast({
        title: "数据错误",
        description: "请检查项目和司机信息",
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
      currentCost: formData.currentCost ? parseFloat(formData.currentCost) : undefined,
      extraCost: formData.extraCost ? parseFloat(formData.extraCost) : undefined,
      payableCost: formData.payableCost ? parseFloat(formData.payableCost) : undefined,
      remarks: formData.remarks || undefined,
      createdByUserId: "current_user", // 模拟当前用户ID
    };

    if (isEditing) {
      LocalStorage.updateLogisticsRecord(isEditing, recordData);
      setIsEditing(null);
      toast({
        title: "更新成功",
        description: "记录已成功更新",
      });
    } else {
      LocalStorage.addLogisticsRecord(recordData);
      toast({
        title: "添加成功",
        description: "新记录已成功添加",
      });
    }

    setRecords(LocalStorage.getLogisticsRecords());
    resetForm();
  };

  // 编辑记录
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
      currentCost: record.currentCost?.toString() || "",
      extraCost: record.extraCost?.toString() || "",
      payableCost: record.payableCost?.toString() || "",
      remarks: record.remarks || "",
    });
    setIsEditing(record.id);
  };

  // 删除记录
  const handleDelete = (id: string) => {
    LocalStorage.deleteLogisticsRecord(id);
    setRecords(LocalStorage.getLogisticsRecords());
    toast({
      title: "删除成功",
      description: "记录已成功删除",
    });
  };

  return (
    <div className="space-y-8">
      {/* 页面标题 */}
      <div className="bg-gradient-primary p-6 rounded-lg shadow-primary text-primary-foreground">
        <h1 className="text-2xl font-bold mb-2">物流业务录入</h1>
        <p className="opacity-90">录入运输记录，系统将自动生成编号并关联相关信息</p>
      </div>

      {/* 业务表单 */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <span>{isEditing ? "编辑" : "新增"}运输记录</span>
            {isEditing && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsEditing(null);
                  resetForm();
                }}
              >
                <X className="h-4 w-4 mr-1" />
                取消编辑
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* 自动编号 */}
              <div className="space-y-2">
                <Label>自动编号</Label>
                <Input
                  value={isEditing ? records.find(r => r.id === isEditing)?.autoNumber || "" : LocalStorage.generateAutoNumber()}
                  disabled
                  className="bg-muted"
                />
              </div>

              {/* 项目名称 */}
              <div className="space-y-2">
                <Label>项目名称 *</Label>
                <Select value={formData.projectId} onValueChange={(value) => setFormData(prev => ({...prev, projectId: value}))}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择项目" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 装车时间 */}
              <div className="space-y-2">
                <Label>装车时间 *</Label>
                <Input
                  type="datetime-local"
                  value={formData.loadingTime}
                  onChange={(e) => setFormData(prev => ({...prev, loadingTime: e.target.value}))}
                />
              </div>

              {/* 装车地 */}
              <div className="space-y-2">
                <Label>装车地 *</Label>
                <Select value={formData.loadingLocation} onValueChange={(value) => setFormData(prev => ({...prev, loadingLocation: value}))}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择装车地" />
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

              {/* 卸货地 */}
              <div className="space-y-2">
                <Label>卸货地 *</Label>
                <Select value={formData.unloadingLocation} onValueChange={(value) => setFormData(prev => ({...prev, unloadingLocation: value}))}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择卸货地" />
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

              {/* 司机姓名 */}
              <div className="space-y-2">
                <Label>司机姓名 *</Label>
                <Select value={formData.driverId} onValueChange={handleDriverChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择司机" />
                  </SelectTrigger>
                  <SelectContent>
                    {drivers.map((driver) => (
                      <SelectItem key={driver.id} value={driver.id}>
                        {driver.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 车牌号（自动填充） */}
              <div className="space-y-2">
                <Label>车牌号</Label>
                <Input
                  value={getSelectedDriver()?.licensePlate || ""}
                  disabled
                  className="bg-muted"
                />
              </div>

              {/* 司机电话（自动填充） */}
              <div className="space-y-2">
                <Label>司机电话</Label>
                <Input
                  value={getSelectedDriver()?.phone || ""}
                  disabled
                  className="bg-muted"
                />
              </div>

              {/* 装货净重 */}
              <div className="space-y-2">
                <Label>装货净重(吨) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.loadingWeight}
                  onChange={(e) => setFormData(prev => ({...prev, loadingWeight: e.target.value}))}
                />
              </div>

              {/* 卸货日期 */}
              <div className="space-y-2">
                <Label>卸货日期</Label>
                <Input
                  type="date"
                  value={formData.unloadingDate}
                  onChange={(e) => setFormData(prev => ({...prev, unloadingDate: e.target.value}))}
                />
              </div>

              {/* 卸货净重 */}
              <div className="space-y-2">
                <Label>卸货净重(吨)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.unloadingWeight}
                  onChange={(e) => setFormData(prev => ({...prev, unloadingWeight: e.target.value}))}
                />
              </div>

              {/* 运输类别 */}
              <div className="space-y-2">
                <Label>运输类别 *</Label>
                <Select value={formData.transportType} onValueChange={(value: "实际运输" | "退货") => setFormData(prev => ({...prev, transportType: value}))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="实际运输">实际运输</SelectItem>
                    <SelectItem value="退货">退货</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 当次费用 */}
              <div className="space-y-2">
                <Label>当次费用(元)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.currentCost}
                  onChange={(e) => setFormData(prev => ({...prev, currentCost: e.target.value}))}
                />
              </div>

              {/* 额外费用 */}
              <div className="space-y-2">
                <Label>额外费用(元)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.extraCost}
                  onChange={(e) => setFormData(prev => ({...prev, extraCost: e.target.value}))}
                />
              </div>

              {/* 应付费用 */}
              <div className="space-y-2">
                <Label>应付费用(元)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.payableCost}
                  onChange={(e) => setFormData(prev => ({...prev, payableCost: e.target.value}))}
                />
              </div>
            </div>

            {/* 备注 */}
            <div className="space-y-2">
              <Label>备注</Label>
              <Textarea
                value={formData.remarks}
                onChange={(e) => setFormData(prev => ({...prev, remarks: e.target.value}))}
                rows={3}
              />
            </div>

            <Button type="submit" className="bg-gradient-primary hover:bg-primary-hover shadow-primary">
              <Save className="h-4 w-4 mr-2" />
              {isEditing ? "更新记录" : "保存记录"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* 数据列表 */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>运输记录列表</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>自动编号</TableHead>
                  <TableHead>项目</TableHead>
                  <TableHead>装车时间</TableHead>
                  <TableHead>装车地</TableHead>
                  <TableHead>卸货地</TableHead>
                  <TableHead>司机</TableHead>
                  <TableHead>车牌号</TableHead>
                  <TableHead>装货重量</TableHead>
                  <TableHead>运输类别</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-mono">{record.autoNumber}</TableCell>
                    <TableCell>{record.projectName}</TableCell>
                    <TableCell>{new Date(record.loadingTime).toLocaleString()}</TableCell>
                    <TableCell>{record.loadingLocation}</TableCell>
                    <TableCell>{record.unloadingLocation}</TableCell>
                    <TableCell>{record.driverName}</TableCell>
                    <TableCell>{record.licensePlate}</TableCell>
                    <TableCell>{record.loadingWeight}吨</TableCell>
                    <TableCell>
                      <span className={cn(
                        "px-2 py-1 rounded-full text-xs font-medium",
                        record.transportType === "实际运输" 
                          ? "bg-green-100 text-green-800" 
                          : "bg-orange-100 text-orange-800"
                      )}>
                        {record.transportType}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(record)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(record.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {records.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                      暂无记录
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}