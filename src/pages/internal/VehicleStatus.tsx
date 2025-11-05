// PC端 - 车辆状态（桌面完整版）

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  Truck,
  CheckCircle,
  Wrench,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';

export default function VehicleStatus() {
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [vehicles, setVehicles] = useState<any[]>([]);

  useEffect(() => {
    loadVehicles();
  }, []);

  const loadVehicles = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('internal_vehicles')
        .select('license_plate, vehicle_status, current_mileage, updated_at')
        .order('license_plate');
      setVehicles(data || []);
    } finally {
      setLoading(false);
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'active':
        return { label: '正常使用', color: 'bg-green-100 text-green-800', icon: CheckCircle };
      case 'maintenance':
        return { label: '维修中', color: 'bg-yellow-100 text-yellow-800', icon: Wrench };
      case 'retired':
        return { label: '已报废', color: 'bg-gray-100 text-gray-800', icon: AlertTriangle };
      default:
        return { label: status, color: 'bg-gray-100 text-gray-800', icon: Truck };
    }
  };

  const stats = {
    active: vehicles.filter(v => v.vehicle_status === 'active').length,
    maintenance: vehicles.filter(v => v.vehicle_status === 'maintenance').length,
    retired: vehicles.filter(v => v.vehicle_status === 'retired').length
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="border-b bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-xl font-semibold">车辆状态</h1>
            <Separator orientation="vertical" className="h-6" />
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-muted-foreground">正常</span>
                <span className="font-semibold text-green-600">{stats.active}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                <span className="text-muted-foreground">维修</span>
                <span className="font-semibold text-yellow-600">{stats.maintenance}</span>
              </div>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={loadVehicles} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 py-4">
        <div className="border rounded-lg bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>车牌号</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">当前里程</TableHead>
                <TableHead>最后更新</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vehicles.map((v, i) => {
                const config = getStatusConfig(v.vehicle_status);
                const Icon = config.icon;
                return (
                  <TableRow key={i} className="hover:bg-muted/50">
                    <TableCell className="font-semibold">{v.license_plate}</TableCell>
                    <TableCell>
                      <Badge className={config.color}>
                        <Icon className="h-3 w-3 mr-1" />
                        {config.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {v.current_mileage ? `${(v.current_mileage / 10000).toFixed(1)}万公里` : '-'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {v.updated_at ? format(new Date(v.updated_at), 'yyyy-MM-dd HH:mm') : '-'}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="border-t bg-card px-6 py-3">
        <div className="text-sm text-muted-foreground">
          共 {vehicles.length} 辆车辆
        </div>
      </div>
    </div>
  );
}

