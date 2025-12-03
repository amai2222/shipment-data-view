// 车辆轨迹地图组件
import { useEffect, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { RouteMapService } from '@/services/RouteMapService';

interface TrackingPoint {
  lat: number;
  lng: number;
  time: number;
  speed?: number;
  direction?: number;
  address?: string;
}

interface VehicleTrackingMapProps {
  trackingData: unknown;
  licensePlate?: string;
  loading?: boolean;
}

// 声明全局AMap类型
declare global {
  interface Window {
    AMap: {
      Map: new (container: string | HTMLElement, options?: unknown) => {
        add: (overlay: unknown) => void;
        remove: (overlay: unknown) => void;
        setFitView: (overlays: unknown[], immediately?: boolean, avoid?: number[]) => void;
        getBounds: () => {
          getNorthEast: () => [number, number];
        };
      };
      Marker: new (options?: {
        position: [number, number];
        title?: string;
        icon?: unknown;
        label?: {
          content: string;
          offset?: unknown;
          direction?: string;
        };
      }) => unknown;
      Polyline: new (options?: {
        path: [number, number][];
        strokeColor?: string;
        strokeWeight?: number;
        strokeOpacity?: number;
        strokeStyle?: string;
        lineJoin?: string;
        lineCap?: string;
        zIndex?: number;
      }) => unknown;
      Icon: new (options: {
        size: unknown;
        image: string;
      }) => unknown;
      Size: new (width: number, height: number) => unknown;
      plugin: (plugins: string[], callback: () => void) => void;
    };
  }
}

export function VehicleTrackingMap({ trackingData, licensePlate, loading }: VehicleTrackingMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<unknown>(null);
  const [mapLoading, setMapLoading] = useState(true);
  const [mapError, setMapError] = useState<string | null>(null);

  useEffect(() => {
    if (!trackingData || !mapContainerRef.current) {
      return;
    }

    // 解析轨迹数据
    const parseTrackingData = (data: unknown): TrackingPoint[] => {
      if (!data || typeof data !== 'object') {
        return [];
      }

      const dataObj = data as Record<string, unknown>;
      
      // 尝试多种可能的数据格式
      if (Array.isArray(dataObj.points)) {
        return dataObj.points as TrackingPoint[];
      }
      
      if (Array.isArray(dataObj.data)) {
        return dataObj.data as TrackingPoint[];
      }
      
      if (Array.isArray(dataObj.tracks)) {
        return dataObj.tracks as TrackingPoint[];
      }
      
      // 如果数据本身就是数组
      if (Array.isArray(data)) {
        return data as TrackingPoint[];
      }

      // 尝试从location字段解析
      if (dataObj.location && typeof dataObj.location === 'object') {
        const location = dataObj.location as Record<string, unknown>;
        if (location.gps && Array.isArray(location.gps) && location.gps.length >= 2) {
          return [{
            lat: location.gps[1] as number,
            lng: location.gps[0] as number,
            time: Date.now(),
            address: location.alias as string || location.address as string
          }];
        }
      }

      return [];
    };

    const points = parseTrackingData(trackingData);

    if (points.length === 0) {
      setMapError('未找到有效的轨迹数据');
      setMapLoading(false);
      return;
    }

    // 加载高德地图API
    const loadMap = async () => {
      if (window.AMap) {
        initMap(points);
        return;
      }

      try {
        // 获取高德地图API Key
        const amapKey = await RouteMapService.getAmapApiKey();
        if (!amapKey) {
          setMapError('未配置高德地图API Key，请先配置');
          setMapLoading(false);
          return;
        }

        const script = document.createElement('script');
        script.src = `https://webapi.amap.com/maps?v=2.0&key=${amapKey}`;
        script.async = true;
        script.onload = () => {
          if (window.AMap) {
            initMap(points);
          } else {
            setMapError('地图API加载失败');
            setMapLoading(false);
          }
        };
        script.onerror = () => {
          setMapError('地图API加载失败，请检查网络连接和API Key配置');
          setMapLoading(false);
        };
        document.head.appendChild(script);
      } catch (error) {
        console.error('加载地图API失败:', error);
        setMapError('加载地图API失败');
        setMapLoading(false);
      }
    };

    loadMap();

    function initMap(trackingPoints: TrackingPoint[]) {
      if (!mapContainerRef.current || !window.AMap) {
        return;
      }

      try {
        // 计算中心点和边界
        const lats = trackingPoints.map(p => p.lat).filter(lat => lat != null);
        const lngs = trackingPoints.map(p => p.lng).filter(lng => lng != null);
        
        if (lats.length === 0 || lngs.length === 0) {
          setMapError('轨迹数据缺少坐标信息');
          setMapLoading(false);
          return;
        }

        const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
        const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;

        // 初始化地图
        const map = new window.AMap.Map(mapContainerRef.current, {
          zoom: 13,
          center: [centerLng, centerLat],
          mapStyle: 'amap://styles/normal'
        });

        mapInstanceRef.current = map;

        // 绘制轨迹路线
        const path: [number, number][] = trackingPoints
          .filter(p => p.lat != null && p.lng != null)
          .map(p => [p.lng, p.lat]);

        if (path.length > 0) {
          const polyline = new window.AMap.Polyline({
            path: path,
            strokeColor: '#2563eb',
            strokeWeight: 4,
            strokeOpacity: 0.8,
            strokeStyle: 'solid',
            lineJoin: 'round',
            lineCap: 'round',
            zIndex: 50
          });

          map.add(polyline);
        }

        // 添加起点标记
        if (trackingPoints.length > 0) {
          const startPoint = trackingPoints[0];
          if (startPoint.lat != null && startPoint.lng != null) {
            const startTime = startPoint.time 
              ? new Date(startPoint.time).toLocaleString('zh-CN')
              : '起点';
            
            const startMarker = new window.AMap.Marker({
              position: [startPoint.lng, startPoint.lat],
              title: `起点: ${startTime}`,
              icon: new window.AMap.Icon({
                size: new window.AMap.Size(32, 32),
                image: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iMTIiIGZpbGw9IiM0Q0FGNTUiLz4KPHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4PSI4IiB5PSI4Ij4KPHBhdGggZD0iTTggMkM5LjEgMiAxMCAyLjkgMTAgNFYxMkMxMCAxMy4xIDkuMSAxNCA4IDE0QzYuOSAxNCA2IDEzLjEgNiAxMlY0QzYgMi45IDYuOSAyIDggMloiIGZpbGw9IndoaXRlIi8+Cjwvc3ZnPgo8L3N2Zz4K'
              }),
              label: {
                content: '起点',
                offset: new window.AMap.Size(0, -10),
                direction: 'top'
              }
            });
            map.add(startMarker);
          }
        }

        // 添加终点标记
        if (trackingPoints.length > 1) {
          const endPoint = trackingPoints[trackingPoints.length - 1];
          if (endPoint.lat != null && endPoint.lng != null) {
            const endTime = endPoint.time 
              ? new Date(endPoint.time).toLocaleString('zh-CN')
              : '终点';
            
            const endMarker = new window.AMap.Marker({
              position: [endPoint.lng, endPoint.lat],
              title: `终点: ${endTime}`,
              icon: new window.AMap.Icon({
                size: new window.AMap.Size(32, 32),
                image: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iMTIiIGZpbGw9IiNFRjQ0NDQiLz4KPHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4PSI4IiB5PSI4Ij4KPHBhdGggZD0iTTggMkM5LjEgMiAxMCAyLjkgMTAgNFYxMkMxMCAxMy4xIDkuMSAxNCA4IDE0QzYuOSAxNCA2IDEzLjEgNiAxMlY0QzYgMi45IDYuOSAyIDggMloiIGZpbGw9IndoaXRlIi8+Cjwvc3ZnPgo8L3N2Zz4K'
              }),
              label: {
                content: '终点',
                offset: new window.AMap.Size(0, -10),
                direction: 'top'
              }
            });
            map.add(endMarker);
          }
        }

        // 添加中间关键点标记（每隔一定数量的点标记一个）
        const markers: unknown[] = [];
        const step = Math.max(1, Math.floor(trackingPoints.length / 10)); // 最多显示10个中间点
        
        for (let i = step; i < trackingPoints.length - 1; i += step) {
          const point = trackingPoints[i];
          if (point.lat != null && point.lng != null) {
            const time = point.time 
              ? new Date(point.time).toLocaleString('zh-CN')
              : '';
            const speed = point.speed ? `${point.speed} km/h` : '';
            const title = `${time}${speed ? ` - ${speed}` : ''}`;
            
            const marker = new window.AMap.Marker({
              position: [point.lng, point.lat],
              title: title,
              icon: new window.AMap.Icon({
                size: new window.AMap.Size(20, 20),
                image: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHZpZXdCb3g9IjAgMCAyMCAyMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTAiIGN5PSIxMCIgcj0iOCIgZmlsbD0iIzI1NjNlYiIgZmlsbC1vcGFjaXR5PSIwLjciLz4KPC9zdmc+'
              })
            });
            markers.push(marker);
          }
        }

        if (markers.length > 0) {
          markers.forEach(marker => map.add(marker));
        }

        // 调整地图视野以包含所有轨迹点
        const allMarkers: unknown[] = [];
        if (trackingPoints.length > 0 && trackingPoints[0].lat != null && trackingPoints[0].lng != null) {
          allMarkers.push(new window.AMap.Marker({
            position: [trackingPoints[0].lng, trackingPoints[0].lat]
          }));
        }
        if (trackingPoints.length > 1) {
          const lastPoint = trackingPoints[trackingPoints.length - 1];
          if (lastPoint.lat != null && lastPoint.lng != null) {
            allMarkers.push(new window.AMap.Marker({
              position: [lastPoint.lng, lastPoint.lat]
            }));
          }
        }

        if (allMarkers.length > 0) {
          map.setFitView(allMarkers, false, [50, 50, 50, 50]);
        }

        setMapLoading(false);
      } catch (error) {
        console.error('地图初始化失败:', error);
        setMapError('地图初始化失败');
        setMapLoading(false);
      }
    }

    // 清理函数
    return () => {
      if (mapInstanceRef.current) {
        // 清理地图实例
        mapInstanceRef.current = null;
      }
    };
  }, [trackingData, licensePlate]);

  if (loading || mapLoading) {
    return (
      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin text-blue-500" />
              <p className="text-muted-foreground">正在加载地图...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (mapError) {
    return (
      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-center h-96">
            <div className="text-center text-muted-foreground">
              <p className="text-lg mb-2">⚠️</p>
              <p>{mapError}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div 
          ref={mapContainerRef} 
          className="w-full h-96 rounded-lg overflow-hidden"
          style={{ minHeight: '400px' }}
        />
      </CardContent>
    </Card>
  );
}

