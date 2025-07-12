import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CalendarIcon, TruckIcon, MapPinIcon, Plus, Edit2, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SupabaseStorage } from "@/utils/supabase";
import { LogisticsRecord, Project, Driver, Location } from "@/types";

export default function BusinessEntry() {
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [records, setRecords] = useState<LogisticsRecord[]>([]);
  const [editingRecord, setEditingRecord] = useState<LogisticsRecord | null>(null);

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
      currentCost: "",
      extraCost: "",
      payableCost: "",
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
      currentCost: formData.currentCost ? parseFloat(formData.currentCost) : undefined,
      extraCost: formData.extraCost ? parseFloat(formData.extraCost) : undefined,
      payableCost: formData.payableCost ? parseFloat(formData.payableCost) : undefined,
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
      currentCost: record.currentCost?.toString() || "",
      extraCost: record.extraCost?.toString() || "",
      payableCost: record.payableCost?.toString() || "",
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
                <Label htmlFor="currentCost">当前费用(元)</Label>
                <Input
                  id="currentCost"
                  type="number"
                  step="0.01"
                  value={formData.currentCost}
                  onChange={(e) => setFormData(prev => ({ ...prev, currentCost: e.target.value }))}
                  placeholder="请输入当前费用"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="extraCost">额外费用(元)</Label>
                <Input
                  id="extraCost"
                  type="number"
                  step="0.01"
                  value={formData.extraCost}
                  onChange={(e) => setFormData(prev => ({ ...prev, extraCost: e.target.value }))}
                  placeholder="请输入额外费用"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="payableCost">应付费用(元)</Label>
                <Input
                  id="payableCost"
                  type="number"
                  step="0.01"
                  value={formData.payableCost}
                  onChange={(e) => setFormData(prev => ({ ...prev, payableCost: e.target.value }))}
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
          <CardTitle>物流记录列表</CardTitle>
          <CardDescription>所有物流运输记录</CardDescription>
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
                      {record.payableCost && `¥${record.payableCost.toFixed(2)}`}
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-1">
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
    </div>
  );
}