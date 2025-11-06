// PC端 - 证件管理（参考操作日志布局）

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import {
  FileText,
  AlertTriangle,
  CheckCircle,
  Upload,
  Eye,
  Calendar,
  RefreshCw,
  Search,
  Filter
} from 'lucide-react';
import { format } from 'date-fns';

export default function CertificateManagement() {
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [certificates, setCertificates] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  useEffect(() => {
    loadCertificates();
  }, []);

  const loadCertificates = async () => {
    setLoading(true);
    try {
      const { data: vehicleData } = await supabase
        .from('internal_vehicles')
        .select('license_plate, driving_license_expire_date, insurance_expire_date, annual_inspection_date')
        .order('license_plate');

      const { data: driverData } = await supabase
        .from('internal_drivers')
        .select('name, driver_license_expire_date, qualification_certificate_expire_date')
        .order('name');

      const allCerts: any[] = [];
      
      vehicleData?.forEach(v => {
        if (v.driving_license_expire_date) {
          allCerts.push({ type: '车辆行驶证', owner: v.license_plate, expire_date: v.driving_license_expire_date });
        }
        if (v.insurance_expire_date) {
          allCerts.push({ type: '车辆保险', owner: v.license_plate, expire_date: v.insurance_expire_date });
        }
        if (v.annual_inspection_date) {
          allCerts.push({ type: '年检', owner: v.license_plate, expire_date: v.annual_inspection_date });
        }
      });

      driverData?.forEach(d => {
        if (d.driver_license_expire_date) {
          allCerts.push({ type: '驾驶证', owner: d.name, expire_date: d.driver_license_expire_date });
        }
      });

      setCertificates(allCerts);
    } finally {
      setLoading(false);
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

  const paginatedCerts = filteredCerts.slice((page - 1) * pageSize, page * pageSize);
  const totalPages = Math.ceil(filteredCerts.length / pageSize);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">证件管理</h1>
        <p className="text-muted-foreground">管理车辆和司机的各类证件，跟踪到期提醒</p>
      </div>

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
                  </SelectContent>
                </Select>
              </div>
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
                        <TableCell className="text-center">
                          <div className="flex gap-1 justify-center">
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
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

          {/* 分页 */}
          {!loading && filteredCerts.length > 0 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                显示 {((page - 1) * pageSize) + 1}-{Math.min(page * pageSize, filteredCerts.length)} 条，共 {filteredCerts.length} 条
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                  上一页
                </Button>
                <span className="text-sm flex items-center">第 {page} / {totalPages} 页</span>
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                  下一页
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
