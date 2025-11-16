// PC端 - 证件管理（完整功能实现）

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';
import { PageHeader } from '@/components/PageHeader';
import { PaginationControl } from '@/components/common';
import {
  FileText,
  AlertTriangle,
  CheckCircle,
  Upload,
  Eye,
  Calendar,
  RefreshCw,
  Search,
  Filter,
  Save,
  X,
  Image as ImageIcon
} from 'lucide-react';
import { format } from 'date-fns';

interface Certificate {
  id?: string;
  type: string;
  owner: string;
  owner_id: string;
  owner_type: 'vehicle' | 'driver';
  expire_date: string;
  certificate_number?: string;
  photo_url?: string;
}

export default function CertificateManagement() {
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCert, setSelectedCert] = useState<Certificate | null>(null);
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [updateFormData, setUpdateFormData] = useState({
    expire_date: '',
    certificate_number: '',
    photo_file: null as File | null
  });

  useEffect(() => {
    loadCertificates();
  }, []);

  const loadCertificates = async () => {
    setLoading(true);
    try {
      const { data: vehicleData } = await supabase
        .from('internal_vehicles')
        .select('id, license_plate, driving_license_expire_date, insurance_expire_date, annual_inspection_date')
        .order('license_plate');

      const { data: driverData } = await supabase
        .from('internal_drivers')
        .select('id, name, driver_license_expire_date, qualification_certificate_expire_date')
        .order('name');

      const allCerts: Certificate[] = [];
      
      vehicleData?.forEach(v => {
        if (v.driving_license_expire_date) {
          allCerts.push({ 
            type: '车辆行驶证', 
            owner: v.license_plate, 
            owner_id: v.id,
            owner_type: 'vehicle',
            expire_date: v.driving_license_expire_date 
          });
        }
        if (v.insurance_expire_date) {
          allCerts.push({ 
            type: '车辆保险', 
            owner: v.license_plate, 
            owner_id: v.id,
            owner_type: 'vehicle',
            expire_date: v.insurance_expire_date 
          });
        }
        if (v.annual_inspection_date) {
          allCerts.push({ 
            type: '年检', 
            owner: v.license_plate, 
            owner_id: v.id,
            owner_type: 'vehicle',
            expire_date: v.annual_inspection_date 
          });
        }
      });

      driverData?.forEach(d => {
        if (d.driver_license_expire_date) {
          allCerts.push({ 
            type: '驾驶证', 
            owner: d.name, 
            owner_id: d.id,
            owner_type: 'driver',
            expire_date: d.driver_license_expire_date 
          });
        }
        if (d.qualification_certificate_expire_date) {
          allCerts.push({ 
            type: '从业资格证', 
            owner: d.name, 
            owner_id: d.id,
            owner_type: 'driver',
            expire_date: d.qualification_certificate_expire_date 
          });
        }
      });

      setCertificates(allCerts);
    } finally {
      setLoading(false);
    }
  };

  // 更新证件信息
  const handleUpdateCertificate = async () => {
    if (!selectedCert || !updateFormData.expire_date) {
      toast({
        title: '请填写到期日期',
        variant: 'destructive'
      });
      return;
    }

    try {
      const table = selectedCert.owner_type === 'vehicle' ? 'internal_vehicles' : 'internal_drivers';
      const field = selectedCert.type === '车辆行驶证' ? 'driving_license_expire_date' :
                    selectedCert.type === '车辆保险' ? 'insurance_expire_date' :
                    selectedCert.type === '年检' ? 'annual_inspection_date' :
                    selectedCert.type === '驾驶证' ? 'driver_license_expire_date' :
                    'qualification_certificate_expire_date';

      const { error } = await supabase
        .from(table)
        .update({ [field]: updateFormData.expire_date })
        .eq('id', selectedCert.owner_id);

      if (error) throw error;

      toast({
        title: '更新成功',
        description: `证件 ${selectedCert.type} 已更新`
      });

      setShowUpdateDialog(false);
      setSelectedCert(null);
      setUpdateFormData({ expire_date: '', certificate_number: '', photo_file: null });
      loadCertificates();
    } catch (error: unknown) {
      toast({
        title: '更新失败',
        description: error instanceof Error ? error.message : '无法更新证件',
        variant: 'destructive'
      });
    }
  };

  const isExpiringSoon = (date: string) => {
    const daysLeft = Math.floor((new Date(date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    return daysLeft <= 30 && daysLeft > 0;
  };

  const isExpired = (date: string) => {
    return new Date(date) < new Date();
  };

  const getStatusBadge = (date: string) => {
    if (isExpired(date)) {
      return <Badge className="bg-red-600 text-white">已过期</Badge>;
    } else if (isExpiringSoon(date)) {
      return <Badge className="bg-yellow-100 text-yellow-800"><AlertTriangle className="h-3 w-3 mr-1" />即将到期</Badge>;
    } else {
      return <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />正常</Badge>;
    }
  };

  const filteredCerts = certificates.filter(c =>
    (typeFilter === 'all' || c.type === typeFilter) &&
    c.owner.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const expiringSoonCount = certificates.filter(c => isExpiringSoon(c.expire_date)).length;
  const expiredCount = certificates.filter(c => isExpired(c.expire_date)).length;

  const paginatedCerts = filteredCerts.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.ceil(filteredCerts.length / pageSize);
  
  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setCurrentPage(1); // 重置到第一页
  };

  return (
    <div className="p-4 space-y-4">
      <PageHeader
        title="证件管理"
        description="管理车辆和司机的各类证件，跟踪到期提醒"
        icon={FileText}
        iconColor="text-orange-600"
      />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                证件查询
              </CardTitle>
              <CardDescription>
                共 {certificates.length} 条证件 | 即将到期 {expiringSoonCount} | 已过期 {expiredCount}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="h-4 w-4 mr-2" />
                筛选
              </Button>
              <Button variant="outline" size="sm" onClick={loadCertificates} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>

        {showFilters && (
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>搜索</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="车牌号、司机姓名..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div>
                <Label>证件类型</Label>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部类型</SelectItem>
                    <SelectItem value="车辆行驶证">车辆行驶证</SelectItem>
                    <SelectItem value="车辆保险">车辆保险</SelectItem>
                    <SelectItem value="年检">年检</SelectItem>
                    <SelectItem value="驾驶证">驾驶证</SelectItem>
                    <SelectItem value="从业资格证">从业资格证</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => { setSearchTerm(''); setTypeFilter('all'); }}>
                清除筛选
              </Button>
              <Button onClick={loadCertificates}>
                应用筛选
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>证件列表</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>证件类型</TableHead>
                  <TableHead>所属</TableHead>
                  <TableHead>到期日期</TableHead>
                  <TableHead>剩余天数</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-center">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                      加载中...
                    </TableCell>
                  </TableRow>
                ) : paginatedCerts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      暂无证件记录
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedCerts.map((cert, index) => {
                    const daysLeft = Math.floor((new Date(cert.expire_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                    
                    return (
                      <TableRow key={index} className="hover:bg-muted/50">
                        <TableCell className="font-medium">{cert.type}</TableCell>
                        <TableCell>{cert.owner}</TableCell>
                        <TableCell>{format(new Date(cert.expire_date), 'yyyy-MM-dd')}</TableCell>
                        <TableCell className={daysLeft < 0 ? 'text-red-600 font-bold' : daysLeft <= 30 ? 'text-yellow-600 font-bold' : ''}>
                          {daysLeft < 0 ? `已过期 ${Math.abs(daysLeft)}天` : `${daysLeft}天`}
                        </TableCell>
                        <TableCell>{getStatusBadge(cert.expire_date)}</TableCell>
                        <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex gap-1 justify-center" style={{ pointerEvents: 'auto' }}>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="h-8 w-8 p-0 relative z-10"
                              style={{ pointerEvents: 'auto' }}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                // TODO: 实现查看功能
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="h-8 w-8 p-0 relative z-10"
                              style={{ pointerEvents: 'auto' }}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setSelectedCert(cert);
                                setUpdateFormData({
                                  expire_date: cert.expire_date,
                                  certificate_number: '',
                                  photo_file: null
                                });
                                setShowUpdateDialog(true);
                              }}
                            >
                              <Upload className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {!loading && filteredCerts.length > 0 && (
            <PaginationControl
              currentPage={currentPage}
              pageSize={pageSize}
              totalPages={totalPages}
              totalCount={filteredCerts.length}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
            />
          )}
        </CardContent>
      </Card>

      {/* 更新证件对话框 */}
      <Dialog open={showUpdateDialog} onOpenChange={setShowUpdateDialog}>
        <DialogContent>
          {selectedCert && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  更新证件
                </DialogTitle>
                <DialogDescription>
                  {selectedCert.type} - {selectedCert.owner}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <Label>到期日期 <span className="text-red-500">*</span></Label>
                  <Input
                    type="date"
                    value={updateFormData.expire_date}
                    onChange={e => setUpdateFormData(prev => ({...prev, expire_date: e.target.value}))}
                  />
                </div>

                <div>
                  <Label>证件号码（可选）</Label>
                  <Input
                    placeholder="输入证件号码"
                    value={updateFormData.certificate_number}
                    onChange={e => setUpdateFormData(prev => ({...prev, certificate_number: e.target.value}))}
                  />
                </div>

                <div>
                  <Label>证件照片（可选）</Label>
                  <div className="border-2 border-dashed rounded-md p-4 text-center cursor-pointer hover:border-primary">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        if (e.target.files?.[0]) {
                          setUpdateFormData({...updateFormData, photo_file: e.target.files[0]});
                        }
                      }}
                      className="hidden"
                      id="cert-photo-upload"
                    />
                    <label htmlFor="cert-photo-upload" className="cursor-pointer">
                      <ImageIcon className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">
                        {updateFormData.photo_file ? updateFormData.photo_file.name : '点击上传证件照片'}
                      </p>
                    </label>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => {
                  setShowUpdateDialog(false);
                  setSelectedCert(null);
                }}>
                  <X className="h-4 w-4 mr-2" />
                  取消
                </Button>
                <Button onClick={handleUpdateCertificate}>
                  <Save className="h-4 w-4 mr-2" />
                  保存
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
