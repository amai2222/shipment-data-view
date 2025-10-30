// 司机管理 - 完整重构版本
import { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/PageHeader';
import { Users, Plus, Edit, Trash2, Search, Upload, Download, FileImage } from 'lucide-react';
import { useDriverData } from './hooks/useDriverData';
import { useDebounce } from '@/hooks/useDebounce';
import { LoadingState } from '@/components/common';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DriverPhotoUpload, DriverPhotos } from '@/components/DriverPhotoUpload';
import { VehiclePhotoUpload, VehiclePhotos } from '@/components/VehiclePhotoUpload';
import * as XLSX from 'xlsx';
import { useToast } from '@/hooks/use-toast';

export default function Drivers() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 500);
  const { drivers, loading, fetchDrivers, createDriver, updateDriver, deleteDriver } = useDriverData();
  
  // 对话框状态
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    license_plate: '',
    bank_account: '',
    address: '',
  });

  // 照片状态
  const [driverPhotos, setDriverPhotos] = useState<DriverPhotos>({
    id_card_photos: [],
    driver_license_photos: [],
    qualification_certificate_photos: []
  });
  const [vehiclePhotos, setVehiclePhotos] = useState<VehiclePhotos>({
    driving_license_photos: [],
    transport_license_photos: []
  });

  // Excel导入/导出
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchDrivers(debouncedSearch);
  }, [debouncedSearch, fetchDrivers]);

  // 重置表单
  const resetForm = () => {
    setFormData({
      name: '',
      phone: '',
      license_plate: '',
      bank_account: '',
      address: '',
    });
    setDriverPhotos({
      id_card_photos: [],
      driver_license_photos: [],
      qualification_certificate_photos: []
    });
    setVehiclePhotos({
      driving_license_photos: [],
      transport_license_photos: []
    });
    setEditingDriver(null);
  };

  // 打开新建对话框
  const handleCreate = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  // 打开编辑对话框
  const handleEdit = (driver: any) => {
    setEditingDriver(driver);
    setFormData({
      name: driver.name || '',
      phone: driver.phone || '',
      license_plate: driver.license_plate || '',
      bank_account: driver.bank_account || '',
      address: driver.address || '',
    });
    // 加载已有照片
    setDriverPhotos({
      id_card_photos: driver.id_card_photos || [],
      driver_license_photos: driver.driver_license_photos || [],
      qualification_certificate_photos: driver.qualification_certificate_photos || []
    });
    setVehiclePhotos({
      driving_license_photos: driver.driving_license_photos || [],
      transport_license_photos: driver.transport_license_photos || []
    });
    setIsDialogOpen(true);
  };

  // 提交表单
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 合并基础信息和照片信息
    const driverData = {
      ...formData,
      ...driverPhotos,
      ...vehiclePhotos,
    };
    
    const success = editingDriver
      ? await updateDriver(editingDriver.id, driverData)
      : await createDriver(driverData);
    
    if (success) {
      setIsDialogOpen(false);
      resetForm();
      fetchDrivers(debouncedSearch);
    }
  };

  // 删除司机
  const handleDelete = async (id: string) => {
    const success = await deleteDriver(id);
    if (success) {
      fetchDrivers(debouncedSearch);
    }
  };

  // Excel导入
  const handleExcelImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

        let importedCount = 0;
        for (const row of jsonData) {
          const driverData = {
            name: row['姓名'] || row['司机姓名'] || '',
            phone: row['电话'] || row['司机电话'] || '',
            license_plate: row['车牌号'] || '',
            bank_account: row['银行账号'] || '',
            address: row['地址'] || '',
          };

          if (driverData.name) {
            await createDriver(driverData);
            importedCount++;
          }
        }

        toast({ title: "导入完成", description: `成功导入 ${importedCount} 个司机` });
        fetchDrivers(debouncedSearch);
      } catch (error) {
        toast({ title: "导入失败", variant: "destructive" });
      }
    };
    reader.readAsArrayBuffer(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Excel导出
  const handleExcelExport = () => {
    try {
      const exportData = drivers.map((driver: any) => ({
        '姓名': driver.name,
        '电话': driver.phone || '',
        '车牌号': driver.license_plate || '',
        '银行账号': driver.bank_account || '',
        '地址': driver.address || '',
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, '司机列表');
      const fileName = `司机列表_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      
      toast({ title: "导出成功", description: `已导出 ${drivers.length} 条记录` });
    } catch (error) {
      toast({ title: "导出失败", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4 p-4 md:p-6">
      <PageHeader title="司机管理" description="管理司机信息" icon={Users} iconColor="text-blue-600" />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>司机列表 ({drivers.length})</CardTitle>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索司机姓名、电话、车牌..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleExcelImport} className="hidden" />
              <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4 mr-2" />
                导入Excel
              </Button>
              <Button variant="outline" onClick={handleExcelExport}>
                <Download className="h-4 w-4 mr-2" />
                导出Excel
              </Button>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={handleCreate}>
                    <Plus className="mr-2 h-4 w-4" />
                    添加司机
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[700px] max-h-[90vh]">
                  <DialogHeader>
                    <DialogTitle>{editingDriver ? '编辑司机' : '添加司机'}</DialogTitle>
                  </DialogHeader>
                  <Tabs defaultValue="basic" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="basic">基础信息</TabsTrigger>
                      <TabsTrigger value="driver-photos" className="flex items-center gap-2">
                        <FileImage className="h-4 w-4" />
                        司机证件
                      </TabsTrigger>
                      <TabsTrigger value="vehicle-photos" className="flex items-center gap-2">
                        <FileImage className="h-4 w-4" />
                        车辆证件
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="basic">
                      <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="name">姓名 *</Label>
                            <Input 
                              id="name" 
                              value={formData.name} 
                              onChange={(e) => setFormData({...formData, name: e.target.value})}
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="phone">电话</Label>
                            <Input 
                              id="phone" 
                              value={formData.phone} 
                              onChange={(e) => setFormData({...formData, phone: e.target.value})}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="license_plate">车牌号</Label>
                            <Input 
                              id="license_plate" 
                              value={formData.license_plate} 
                              onChange={(e) => setFormData({...formData, license_plate: e.target.value})}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="bank_account">银行账号</Label>
                            <Input 
                              id="bank_account" 
                              value={formData.bank_account} 
                              onChange={(e) => setFormData({...formData, bank_account: e.target.value})}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="address">地址</Label>
                            <Input 
                              id="address" 
                              value={formData.address} 
                              onChange={(e) => setFormData({...formData, address: e.target.value})}
                            />
                          </div>
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>取消</Button>
                          <Button type="submit">{editingDriver ? '更新' : '创建'}</Button>
                        </div>
                      </form>
                    </TabsContent>

                    <TabsContent value="driver-photos">
                      <DriverPhotoUpload
                        driverName={formData.name || '未命名司机'}
                        licensePlate={formData.license_plate || '未知车牌'}
                        driverId={editingDriver?.id}
                        photos={driverPhotos}
                        onPhotosChange={setDriverPhotos}
                      />
                    </TabsContent>

                    <TabsContent value="vehicle-photos">
                      <VehiclePhotoUpload
                        driverName={formData.name || '未命名司机'}
                        licensePlate={formData.license_plate || '未知车牌'}
                        driverId={editingDriver?.id}
                        photos={vehiclePhotos}
                        onPhotosChange={setVehiclePhotos}
                      />
                    </TabsContent>
                  </Tabs>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <LoadingState /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>姓名</TableHead>
                  <TableHead>电话</TableHead>
                  <TableHead>车牌号</TableHead>
                  <TableHead>银行账号</TableHead>
                  <TableHead>地址</TableHead>
                  <TableHead className="text-center">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {drivers.map((driver: any) => (
                  <TableRow key={driver.id}>
                    <TableCell className="font-medium">{driver.name}</TableCell>
                    <TableCell>{driver.phone || '-'}</TableCell>
                    <TableCell className="font-mono">{driver.license_plate || '-'}</TableCell>
                    <TableCell className="font-mono text-sm">{driver.bank_account || '-'}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{driver.address || '-'}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleEdit(driver)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <ConfirmDialog
                          title="确认删除"
                          description={`确定要删除司机"${driver.name}"吗？此操作不可撤销。`}
                          onConfirm={() => handleDelete(driver.id)}
                        >
                          <Button variant="destructive" size="sm">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </ConfirmDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
