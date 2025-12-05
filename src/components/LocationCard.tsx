// 定位结果卡片组件（带小地图）
import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Truck, MapPin, Calendar, Route, Database, Loader2, Maximize2 } from 'lucide-react';
import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';

interface LocationResult {
  licensePlate: string;
  success: boolean;
  vehicleId?: string;
  location?: {
    lat: number;
    lng: number;
    time: number;
    address?: string;
    speed?: number;
  };
  error?: string;
}

interface LocationCardProps {
  result: LocationResult;
}

// 声明全局百度地图类型
declare global {
  interface Window {
    BMap: {
      Map: new (container: string | HTMLElement) => {
        centerAndZoom: (point: { lng: number; lat: number }, zoom: number) => void;
        addOverlay: (overlay: unknown) => void;
        removeOverlay: (overlay: unknown) => void;
        enableScrollWheelZoom: (enable: boolean) => void;
      };
      Point: new (lng: number, lat: number) => { lng: number; lat: number };
      Marker: new (point: { lng: number; lat: number }, options?: {
        icon?: unknown;
        title?: string;
      }) => unknown;
      Icon: new (url: string, size: { width: number; height: number }, options?: {
        anchor?: { x: number; y: number };
      }) => unknown;
      Size: new (width: number, height: number) => { width: number; height: number };
    };
  }
}

export function LocationCard({ result }: LocationCardProps) {
  const [mapDialogOpen, setMapDialogOpen] = useState(false);
  const [baiduMapKey, setBaiduMapKey] = useState<string | null>(null);
  const [mapLoading, setMapLoading] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const smallMapRef = useRef<HTMLDivElement>(null);
  const largeMapRef = useRef<HTMLDivElement>(null);
  const smallMapInstanceRef = useRef<unknown>(null);
  const largeMapInstanceRef = useRef<unknown>(null);
  const markerRef = useRef<unknown>(null);

  // 注入样式以隐藏百度地图 Logo 和版权信息
  useEffect(() => {
    const styleId = 'baidu-map-hide-logo';
    // 检查样式是否已存在
    if (document.getElementById(styleId)) {
      return;
    }

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      /* 隐藏百度地图 Logo */
      .anchorBL {
        display: none !important;
      }

      /* 隐藏版权文本信息 (© 2025 Baidu ...) */
      .BMap_cpyCtrl {
        display: none !important;
      }

      /* 如果上面的不生效，尝试隐藏该区域的所有 span */
      .BMap_copy {
        display: none !important;
      }
    `;
    document.head.appendChild(style);

    // 清理函数
    return () => {
      const existingStyle = document.getElementById(styleId);
      if (existingStyle) {
        existingStyle.remove();
      }
    };
  }, []);

  // 加载百度地图API
  useEffect(() => {
    const loadBaiduMapAPI = async () => {
      if (!window.BMap) {
        try {
          // 从 Supabase Edge Function 获取百度地图API Key
          const { data, error } = await supabase.functions.invoke('baidu-map-key', {
            method: 'GET'
          });

          if (error || !data?.apiKey) {
            console.error('获取百度地图API Key失败:', error);
            setMapError('无法加载地图API Key');
            return;
          }

          setBaiduMapKey(data.apiKey);

          // 动态加载百度地图API
          const script = document.createElement('script');
          script.src = `https://api.map.baidu.com/api?v=3.0&ak=${data.apiKey}&callback=initBaiduMap`;
          script.async = true;
          script.defer = true;

          // 创建全局回调函数
          (window as { initBaiduMap?: () => void }).initBaiduMap = () => {
            console.log('✅ 百度地图API加载成功');
            setMapLoading(false);
          };

          script.onerror = () => {
            console.error('❌ 百度地图API加载失败');
            setMapError('地图API加载失败');
            setMapLoading(false);
          };

          document.head.appendChild(script);
          setMapLoading(true);
        } catch (error) {
          console.error('加载百度地图API异常:', error);
          setMapError('地图加载异常');
          setMapLoading(false);
        }
      } else {
        setMapLoading(false);
      }
    };

    loadBaiduMapAPI();
  }, []);

  // 初始化小地图
  useEffect(() => {
    if (!result.success || !result.location || !window.BMap || !smallMapRef.current || mapLoading) {
      return;
    }

    try {
      const { lat, lng } = result.location;
      
      // 创建地图实例
      const map = new window.BMap.Map(smallMapRef.current);
      const point = new window.BMap.Point(lng, lat);
      
      // 设置地图中心和缩放级别
      map.centerAndZoom(point, 15);
      map.enableScrollWheelZoom(true);
      
      // 添加标记
      const marker = new window.BMap.Marker(point, {
        title: result.licensePlate
      });
      map.addOverlay(marker);
      
      smallMapInstanceRef.current = map;
      markerRef.current = marker;
    } catch (error) {
      console.error('初始化小地图失败:', error);
      setMapError('地图初始化失败');
    }

    // 清理函数
    return () => {
      if (smallMapInstanceRef.current && markerRef.current) {
        try {
          (smallMapInstanceRef.current as { removeOverlay: (overlay: unknown) => void }).removeOverlay(markerRef.current);
        } catch (e) {
          console.error('清理小地图失败:', e);
        }
      }
    };
  }, [result, mapLoading]);

  // 初始化大地图（弹窗）- 需要等待弹窗完全打开后再初始化
  useEffect(() => {
    if (!mapDialogOpen || !result.success || !result.location || !window.BMap) {
      // 如果弹窗关闭，清理地图实例
      if (!mapDialogOpen && largeMapInstanceRef.current) {
        try {
          // 清理地图实例
          largeMapInstanceRef.current = null;
          markerRef.current = null;
        } catch (e) {
          console.error('清理大地图失败:', e);
        }
      }
      return;
    }

    // 设置加载状态
    setMapLoading(true);
    setMapError(null);

    // 等待弹窗完全打开，DOM 渲染完成后再初始化地图
    const initLargeMap = () => {
      // 检查容器是否存在
      if (!largeMapRef.current) {
        console.warn('大地图容器尚未准备好，延迟初始化...');
        setTimeout(initLargeMap, 100);
        return;
      }

      try {
        const { lat, lng } = result.location;
        console.log('初始化大地图:', { lat, lng, licensePlate: result.licensePlate });
        
        // 如果已有地图实例，先清理
        if (largeMapInstanceRef.current) {
          try {
            (largeMapInstanceRef.current as { removeOverlay?: (overlay: unknown) => void }).removeOverlay?.(markerRef.current);
          } catch (e) {
            console.warn('清理旧地图实例失败:', e);
          }
        }
        
        // 创建地图实例
        const map = new window.BMap.Map(largeMapRef.current);
        const point = new window.BMap.Point(lng, lat);
        
        // 设置地图中心和缩放级别
        map.centerAndZoom(point, 15);
        map.enableScrollWheelZoom(true);
        
        // 添加标记
        const marker = new window.BMap.Marker(point, {
          title: result.licensePlate
        });
        map.addOverlay(marker);
        
        largeMapInstanceRef.current = map;
        markerRef.current = marker;
        
        console.log('✅ 大地图初始化成功');
        setMapError(null);
        setMapLoading(false);
      } catch (error) {
        console.error('初始化大地图失败:', error);
        setMapError(`地图初始化失败: ${error instanceof Error ? error.message : String(error)}`);
        setMapLoading(false);
      }
    };

    // 延迟初始化，确保弹窗 DOM 已完全渲染（增加延迟时间）
    const timer = setTimeout(initLargeMap, 300);
    
    // 清理函数
    return () => {
      clearTimeout(timer);
      if (!mapDialogOpen && largeMapInstanceRef.current) {
        try {
          if (markerRef.current) {
            (largeMapInstanceRef.current as { removeOverlay?: (overlay: unknown) => void }).removeOverlay?.(markerRef.current);
          }
          largeMapInstanceRef.current = null;
          markerRef.current = null;
        } catch (e) {
          console.error('清理大地图失败:', e);
        }
      }
    };
  }, [mapDialogOpen, result]);

  if (!result.success) {
    return (
      <Card className="border-red-200 bg-red-50/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Truck className="h-4 w-4" />
              {result.licensePlate}
            </span>
            <span className="text-xs bg-red-500 text-white px-2 py-1 rounded">失败</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-red-600">
            <p className="font-medium">错误：</p>
            <p className="text-muted-foreground">{result.error || '未知错误'}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!result.location) {
    return null;
  }

  const { lat, lng, time, address, speed } = result.location;

  return (
    <>
      <Card className="border-green-200 bg-green-50/50 hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Truck className="h-4 w-4" />
              {result.licensePlate}
            </span>
            <span className="text-xs bg-green-500 text-white px-2 py-1 rounded">成功</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* 小地图 */}
          <div className="relative w-full h-32 rounded-lg overflow-hidden border border-gray-200 cursor-pointer group"
               onClick={() => setMapDialogOpen(true)}>
            <div ref={smallMapRef} className="w-full h-full" />
            {mapLoading && (
              <div className="absolute inset-0 bg-white bg-opacity-90 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
              </div>
            )}
            {mapError && (
              <div className="absolute inset-0 bg-white bg-opacity-90 flex items-center justify-center text-sm text-muted-foreground">
                {mapError}
              </div>
            )}
            {/* 点击提示遮罩 */}
            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all flex items-center justify-center">
              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2 text-white bg-black bg-opacity-50 px-3 py-1 rounded">
                <Maximize2 className="h-4 w-4" />
                <span className="text-xs">点击查看大地图</span>
              </div>
            </div>
          </div>

          {/* 详细信息 */}
          <div className="space-y-1 text-sm">
            <div className="flex items-center gap-2">
              <MapPin className="h-3 w-3 text-muted-foreground" />
              <span className="font-medium">坐标：</span>
              <span className="text-muted-foreground">
                {lat.toFixed(6)}, {lng.toFixed(6)}
              </span>
            </div>
            {address && (
              <div className="flex items-start gap-2">
                <MapPin className="h-3 w-3 text-muted-foreground mt-0.5" />
                <span className="font-medium">地址：</span>
                <span className="text-muted-foreground text-xs">{address}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Calendar className="h-3 w-3 text-muted-foreground" />
              <span className="font-medium">时间：</span>
              <span className="text-muted-foreground">
                {new Date(time).toLocaleString('zh-CN')}
              </span>
            </div>
            {speed !== undefined && (
              <div className="flex items-center gap-2">
                <Route className="h-3 w-3 text-muted-foreground" />
                <span className="font-medium">速度：</span>
                <span className="text-muted-foreground">{speed} km/h</span>
              </div>
            )}
            {result.vehicleId && (
              <div className="flex items-center gap-2">
                <Database className="h-3 w-3 text-muted-foreground" />
                <span className="font-medium">车辆ID：</span>
                <span className="text-muted-foreground text-xs">{result.vehicleId}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 大地图弹窗 */}
      <Dialog open={mapDialogOpen} onOpenChange={setMapDialogOpen}>
        <DialogContent className="max-w-4xl w-full h-[80vh] p-0 flex flex-col">
          <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              {result.licensePlate} - 位置详情
            </DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6 flex-1 relative overflow-hidden">
            <div 
              ref={largeMapRef} 
              className="w-full h-full rounded-lg border border-gray-200" 
              style={{ minHeight: '500px' }}
            />
            {(!window.BMap || mapLoading) && !mapError && (
              <div className="absolute inset-0 bg-white bg-opacity-90 flex items-center justify-center z-10">
                <div className="text-center">
                  <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin text-blue-500" />
                  <p className="text-muted-foreground">
                    {!window.BMap ? '正在加载地图API...' : '正在初始化地图...'}
                  </p>
                </div>
              </div>
            )}
            {mapError && (
              <div className="absolute inset-0 bg-white bg-opacity-95 flex items-center justify-center z-10">
                <div className="text-center text-muted-foreground p-4">
                  <p className="text-lg mb-2">⚠️</p>
                  <p className="whitespace-pre-line">{mapError}</p>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

