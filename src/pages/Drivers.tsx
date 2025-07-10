import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, Truck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { LocalStorage } from "@/utils/storage";
import { Driver } from "@/types";

export default function Drivers() {
  const { toast } = useToast();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    licensePlate: "",
    phone: "",
  });

  // 加载司机数据
  useEffect(() => {
    setDrivers(LocalStorage.getDrivers());
  }, []);

  // 重置表单
  const resetForm = () => {
    setFormData({
      name: "",
      licensePlate: "",
      phone: "",
    });
    setEditingDriver(null);
  };

  // 打开编辑对话框
  const handleEdit = (driver: Driver) => {
    setFormData({
      name: driver.name,
      licensePlate: driver.licensePlate,
      phone: driver.phone,
    });
    setEditingDriver(driver);
    setIsDialogOpen(true);
  };

  // 提交表单
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.licensePlate || !formData.phone) {
      toast({
        title: "请填写所有字段",
        description: "所有字段都是必填的",
        variant: "destructive",
      });
      return;
    }

    if (editingDriver) {
      LocalStorage.updateDriver(editingDriver.id, formData);
      toast({
        title: "更新成功",
        description: "司机信息已成功更新",
      });
    } else {
      LocalStorage.addDriver(formData);
      toast({
        title: "添加成功",
        description: "新司机已成功添加",
      });
    }

    setDrivers(LocalStorage.getDrivers());
    setIsDialogOpen(false);
    resetForm();
  };

  // 删除司机
  const handleDelete = (id: string) => {
    LocalStorage.deleteDriver(id);
    setDrivers(LocalStorage.getDrivers());
    toast({
      title: "删除成功",
      description: "司机已成功删除",
    });
  };

  return (
    <div className="space-y-8">
      {/* 页面标题 */}
      <div className="bg-gradient-primary p-6 rounded-lg shadow-primary text-primary-foreground">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2 flex items-center">
              <Truck className="mr-2" />
              司机与车辆管理
            </h1>
            <p className="opacity-90">管理司机档案和车辆信息</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="secondary" onClick={resetForm}>
                <Plus className="h-4 w-4 mr-2" />
                新增司机
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>
                  {editingDriver ? "编辑司机" : "新增司机"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">司机姓名 *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({...prev, name: e.target.value}))}
                    placeholder="请输入司机姓名"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="licensePlate">车牌号 *</Label>
                  <Input
                    id="licensePlate"
                    value={formData.licensePlate}
                    onChange={(e) => setFormData(prev => ({...prev, licensePlate: e.target.value}))}
                    placeholder="请输入车牌号"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">司机电话 *</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({...prev, phone: e.target.value}))}
                    placeholder="请输入电话号码"
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                  >
                    取消
                  </Button>
                  <Button type="submit" className="bg-gradient-primary hover:bg-primary-hover">
                    {editingDriver ? "更新" : "添加"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* 司机列表 */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>司机列表</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>司机姓名</TableHead>
                  <TableHead>车牌号</TableHead>
                  <TableHead>司机电话</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {drivers.map((driver) => (
                  <TableRow key={driver.id}>
                    <TableCell className="font-medium">{driver.name}</TableCell>
                    <TableCell className="font-mono">{driver.licensePlate}</TableCell>
                    <TableCell>{driver.phone}</TableCell>
                    <TableCell>{new Date(driver.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(driver)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(driver.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {drivers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      暂无司机数据
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