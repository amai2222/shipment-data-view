// 车辆轨迹查询页面
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Search, MapPin, Calendar, Truck, Route } from 'lucide-react';

export default function VehicleTracking() {
  const { toast } = useToast();
  const [licensePlate, setLicensePlate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!licensePlate.trim()) {
      toast({
        title: "请输入车牌号",
        description: "请先输入要查询的车牌号",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      // TODO: 实现车辆轨迹查询逻辑
      // 这里需要调用相应的API或RPC函数来获取车辆轨迹数据
      
      toast({
        title: "查询成功",
        description: `正在查询车牌号 ${licensePlate} 的轨迹信息...`
      });
    } catch (error) {
      console.error('查询车辆轨迹失败:', error);
      toast({
        title: "查询失败",
        description: error instanceof Error ? error.message : '无法查询车辆轨迹',
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">车辆轨迹查询</h1>
          <p className="text-muted-foreground mt-2">
            根据车牌号和时间范围查询车辆的行驶轨迹
          </p>
        </div>
      </div>

      {/* 查询条件卡片 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            查询条件
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="licensePlate" className="flex items-center gap-2">
                <Truck className="h-4 w-4" />
                车牌号
              </Label>
              <Input
                id="licensePlate"
                placeholder="请输入车牌号"
                value={licensePlate}
                onChange={(e) => setLicensePlate(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSearch();
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="startDate" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                开始日期
              </Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                结束日期
              </Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button 
              onClick={handleSearch} 
              disabled={loading}
              className="min-w-[120px]"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  查询中...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  查询
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 轨迹显示区域 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Route className="h-5 w-5" />
            轨迹信息
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            <div className="text-center">
              <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>请输入查询条件并点击查询按钮</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

