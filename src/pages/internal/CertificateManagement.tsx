// PC端 - 证件管理（桌面完整版）

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  FileText,
  AlertTriangle,
  CheckCircle,
  Upload,
  Eye,
  Calendar,
  RefreshCw,
  Search
} from 'lucide-react';
import { format } from 'date-fns';

export default function CertificateManagement() {
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [certificates, setCertificates] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadCertificates();
  }, []);

  const loadCertificates = async () => {
    setLoading(true);
    try {
      // 车辆证件
      const { data: vehicleData } = await supabase
        .from('internal_vehicles')
        .select('license_plate, driving_license_expire_date, insurance_expire_date, annual_inspection_date')
        .order('license_plate');

      // 司机证件
      const { data: driverData } = await supabase
        .from('internal_drivers')
        .select('name, driver_license_expire_date, qualification_certificate_expire_date')
        .order('name');

      const allCerts: any[] = [];
      
      vehicleData?.forEach(v => {
        if (v.driving_license_expire_date) {
          allCerts.push({
            type: '车辆行驶证',
            owner: v.license_plate,
            expire_date: v.driving_license_expire_date
          });
        }
        if (v.insurance_expire_date) {
          allCerts.push({
            type: '车辆保险',
            owner: v.license_plate,
            expire_date: v.insurance_expire_date
          });
        }
        if (v.annual_inspection_date) {
          allCerts.push({
            type: '年检',
            owner: v.license_plate,
            expire_date: v.annual_inspection_date
          });
        }
      });

      driverData?.forEach(d => {
        if (d.driver_license_expire_date) {
          allCerts.push({
            type: '驾驶证',
            owner: d.name,
            expire_date: d.driver_license_expire_date
          });
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

  const expiringSoonCount = certificates.filter(c => isExpiringSoon(c.expire_date)).length;
  const expiredCount = certificates.filter(c => isExpired(c.expire_date)).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* 顶部操作栏 */}
      <div className="border-b bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-xl font-semibold">证件管理</h1>
            <Separator orientation="vertical" className="h-6" />
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                <span className="text-muted-foreground">即将到期</span>
                <span className="font-semibold text-yellow-600">{expiringSoonCount}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                <span className="text-muted-foreground">已过期</span>
                <span className="font-semibold text-red-600">{expiredCount}</span>
              </div>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={loadCertificates} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* 筛选栏 */}
      <div className="border-b bg-card px-6 py-3">
        <div className="flex gap-3">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索车牌号、司机姓名..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-10 h-9"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 主内容区 */}
      <div className="flex-1 overflow-auto px-6 py-4">
        <div className="border rounded-lg bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>证件类型</TableHead>
                <TableHead>所属</TableHead>
                <TableHead>到期日期</TableHead>
                <TableHead>剩余天数</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-center w-[120px]">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {certificates.map((cert, index) => {
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
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* 底部统计 */}
      <div className="border-t bg-card px-6 py-3">
        <div className="text-sm text-muted-foreground">
          共 {certificates.length} 条证件记录
        </div>
      </div>
    </div>
  );
}

