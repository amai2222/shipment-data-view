/**
 * 地址管理地理编码功能使用示例
 */

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { createLocationGeocodingService, LocationWithGeocoding } from '@/services/LocationGeocodingService';
import { MapPin, Navigation, CheckCircle, AlertCircle, Clock } from 'lucide-react';

export function GeocodingExample() {
  const { toast } = useToast();
  const [address, setAddress] = useState('');
  const [locations, setLocations] = useState<LocationWithGeocoding[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const geocodingService = createLocationGeocodingService(toast);

  // 加载地点数据
  useEffect(() => {
    loadLocations();
  }, []);

  const loadLocations = async () => {
    try {
      const data = await geocodingService.searchLocations('', true);
      setLocations(data);
    } catch (error) {
      console.error('加载地点失败:', error);
    }
  };

  // 添加新地点并自动地理编码
  const handleAddLocation = async () => {
    if (!address.trim()) {
      toast({
        title: "请输入地址",
        description: "地址不能为空",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const result = await geocodingService.autoGeocodeNewLocation({
        name: address,
        address: address
      });

      if (result.success) {
        setAddress('');
        await loadLocations();
      }
    } catch (error) {
      console.error('添加地点失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 手动地理编码
  const handleManualGeocoding = async (location: LocationWithGeocoding) => {
    setIsLoading(true);
    try {
      const result = await geocodingService.geocodeLocation(location.id, location.address);
      if (result.success) {
        await loadLocations();
      }
    } catch (error) {
      console.error('地理编码失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 获取状态图标
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <MapPin className="h-4 w-4 text-gray-500" />;
    }
  };

  // 获取状态颜色
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            地址管理地理编码示例
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 添加地址 */}
          <div className="flex gap-2">
            <Input
              placeholder="请输入地址（如：北京市朝阳区）"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddLocation()}
            />
            <Button 
              onClick={handleAddLocation} 
              disabled={isLoading || !address.trim()}
            >
              {isLoading ? '处理中...' : '添加地址'}
            </Button>
          </div>

          {/* 地点列表 */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">地点列表</h3>
            {locations.length === 0 ? (
              <p className="text-muted-foreground">暂无地点数据</p>
            ) : (
              <div className="grid gap-3">
                {locations.map((location) => (
                  <Card key={location.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium">{location.name}</h4>
                        {location.formatted_address && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {location.formatted_address}
                          </p>
                        )}
                        {location.latitude && location.longitude && (
                          <p className="text-xs text-muted-foreground mt-1">
                            坐标: {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          {getStatusIcon(location.geocoding_status || 'pending')}
                          <Badge className={getStatusColor(location.geocoding_status || 'pending')}>
                            {location.geocoding_status === 'success' ? '已编码' : 
                             location.geocoding_status === 'pending' ? '待编码' :
                             location.geocoding_status === 'failed' ? '编码失败' : '未知'}
                          </Badge>
                        </div>
                        {location.geocoding_status !== 'success' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleManualGeocoding(location)}
                            disabled={isLoading}
                          >
                            <Navigation className="h-3 w-3 mr-1" />
                            编码
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 使用说明 */}
      <Card>
        <CardHeader>
          <CardTitle>使用说明</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>1. 在上方输入框中输入地址，点击"添加地址"按钮</p>
          <p>2. 系统会自动调用高德地图API进行地理编码</p>
          <p>3. 编码成功后，地址会显示详细的坐标和格式化地址信息</p>
          <p>4. 如果编码失败，可以点击"编码"按钮手动重试</p>
          <p>5. 状态说明：</p>
          <ul className="ml-4 space-y-1">
            <li>• <CheckCircle className="h-3 w-3 inline text-green-500 mr-1" />已编码：地理编码成功</li>
            <li>• <Clock className="h-3 w-3 inline text-yellow-500 mr-1" />待编码：等待地理编码</li>
            <li>• <AlertCircle className="h-3 w-3 inline text-red-500 mr-1" />编码失败：地理编码失败，可重试</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
