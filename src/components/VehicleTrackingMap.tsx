// 车辆轨迹地图组件（使用百度地图）
import { useEffect, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';
import { convertPointsWgs84ToBd09 } from '@/utils/coordinateConverter';

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

// 声明全局百度地图类型
declare global {
  interface Window {
    BMap: {
      Map: new (container: string | HTMLElement) => {
        centerAndZoom: (point: { lng: number; lat: number }, zoom: number) => void;
        addOverlay: (overlay: unknown) => void;
        removeOverlay: (overlay: unknown) => void;
        getViewport: (points: { lng: number; lat: number }[]) => {
          center: { lng: number; lat: number };
          zoom: number;
        };
        setViewport: (viewport: { center: { lng: number; lat: number }; zoom: number }[]) => void;
      };
      Point: new (lng: number, lat: number) => { lng: number; lat: number };
      Marker: new (point: { lng: number; lat: number }, options?: {
        icon?: unknown;
        title?: string;
        enableDragging?: boolean;
      }) => unknown;
      Polyline: new (points: { lng: number; lat: number }[], options?: {
        strokeColor?: string;
        strokeWeight?: number;
        strokeOpacity?: number;
        strokeStyle?: string;
      }) => unknown;
      Icon: new (url: string, size: { width: number; height: number }, options?: {
        anchor?: { x: number; y: number };
      }) => unknown;
      Size: new (width: number, height: number) => { width: number; height: number };
    };
  }
}

export function VehicleTrackingMap({ trackingData, licensePlate, loading }: VehicleTrackingMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<unknown>(null);
  const [mapLoading, setMapLoading] = useState(true);
  const [mapError, setMapError] = useState<string | null>(null);

  useEffect(() => {
    console.log('VehicleTrackingMap useEffect 触发，trackingData:', trackingData);
    console.log('mapContainerRef.current:', mapContainerRef.current);
    
    if (!trackingData) {
      console.log('trackingData 为空，等待数据...');
      return;
    }
    
    if (!mapContainerRef.current) {
      console.log('地图容器未准备好，等待DOM元素...');
      return;
    }

    // 解析轨迹数据
    const parseTrackingData = (data: unknown): TrackingPoint[] => {
      console.log('开始解析轨迹数据，数据类型:', typeof data, '是否为数组:', Array.isArray(data));
      console.log('原始数据:', JSON.stringify(data, null, 2));
      
      if (!data) {
        console.log('轨迹数据为空');
        return [];
      }
      
      if (typeof data !== 'object') {
        console.log('轨迹数据不是对象，类型:', typeof data);
        return [];
      }

      const dataObj = data as Record<string, unknown>;
      console.log('数据对象键:', Object.keys(dataObj));
      
      // 如果数据本身就是数组（Edge Function 直接返回数组）
      if (Array.isArray(data)) {
        console.log(`数据是数组，长度: ${data.length}`);
        if (data.length === 0) {
          console.log('数组为空');
          return [];
        }
        
        // Edge Function 已经转换过数据格式，直接使用（lat/lng 已经是转换后的坐标）
        const points = (data as unknown[]).map((item: unknown, index: number) => {
          const point = item as Record<string, unknown>;
          
          // Edge Function 已经返回转换后的格式，直接使用 lat/lng
          // 支持多种可能的字段名
          let lat: number = 0;
          let lng: number = 0;
          
          // 🔴 提取坐标值：支持字符串和数字格式
          if (point.lat !== undefined) {
            const latValue = typeof point.lat === 'string' ? parseFloat(point.lat) : (point.lat as number);
            // 如果坐标值很大（> 90 或 > 1000），说明可能是未转换的格式，需要除以1000000
            // 例如：20876161 / 1000000 = 20.876161（合理的纬度值）
            lat = Math.abs(latValue) > 90 ? (Math.abs(latValue) > 1000000 ? latValue / 1000000 : latValue) : latValue;
          } else if (point.latitude !== undefined) {
            const latValue = typeof point.latitude === 'string' ? parseFloat(point.latitude) : (point.latitude as number);
            lat = Math.abs(latValue) > 90 ? (Math.abs(latValue) > 1000000 ? latValue / 1000000 : latValue) : latValue;
          }
          
          if (point.lng !== undefined) {
            const lngValue = typeof point.lng === 'string' ? parseFloat(point.lng) : (point.lng as number);
            // 如果坐标值很大（> 180 或 > 1000），说明可能是未转换的格式
            lng = Math.abs(lngValue) > 180 ? (Math.abs(lngValue) > 1000000 ? lngValue / 1000000 : lngValue) : lngValue;
          } else if (point.longitude !== undefined) {
            const lngValue = typeof point.longitude === 'string' ? parseFloat(point.longitude) : (point.longitude as number);
            lng = Math.abs(lngValue) > 180 ? (Math.abs(lngValue) > 1000000 ? lngValue / 1000000 : lngValue) : lngValue;
          }
          
          // 记录前几个点的坐标转换情况（用于调试）
          if (index < 3) {
            console.log(`点 ${index} 坐标解析:`, {
              rawLat: point.lat,
              rawLng: point.lng || point.lon,
              convertedLat: lat,
              convertedLng: lng
            });
          }
          
          const time = (point.time as number) ?? Date.now();
          const speed = point.speed as number | undefined;
          const direction = point.direction as number | undefined;
          const address = point.address as string | undefined;
          
          if (index === 0 || index === data.length - 1) {
            console.log(`点 ${index} 坐标: lat=${lat}, lng=${lng}, time=${time}`);
          }
          
          return {
            lat,
            lng,
            time,
            speed,
            direction,
            address
          };
        }).filter(p => {
          // 过滤掉无效坐标：坐标必须在有效范围内
          const isValid = p.lat !== 0 && p.lng !== 0 && 
                         p.lat >= -90 && p.lat <= 90 && 
                         p.lng >= -180 && p.lng <= 180;
          if (!isValid && (p.lat !== 0 || p.lng !== 0)) {
            console.warn(`过滤无效坐标: lat=${p.lat}, lng=${p.lng}`);
          }
          return isValid;
        });
        
        console.log(`过滤后的有效点数: ${points.length}`);
        return points;
      }
      
      // 尝试多种可能的数据格式
      if (Array.isArray(dataObj.points)) {
        console.log(`从 points 字段提取数据，长度: ${dataObj.points.length}`);
        return dataObj.points as TrackingPoint[];
      }
      
      if (Array.isArray(dataObj.data)) {
        console.log(`从 data 字段提取数据，长度: ${dataObj.data.length}`);
        return dataObj.data as TrackingPoint[];
      }
      
      if (Array.isArray(dataObj.tracks)) {
        console.log(`从 tracks 字段提取数据，长度: ${dataObj.tracks.length}`);
        return dataObj.tracks as TrackingPoint[];
      }
      
      if (Array.isArray(dataObj.result)) {
        console.log(`从 result 字段提取数据，长度: ${dataObj.result.length}`);
        // result 字段可能是原始格式，需要转换（Edge Function可能已经转换过了）
        return (dataObj.result as unknown[]).map((item: unknown, index: number) => {
          const point = item as Record<string, unknown>;
          
          // 提取坐标，支持字符串和数字格式
          let lat: number = 0;
          let lng: number = 0;
          
          if (point.lat !== undefined) {
            const latValue = typeof point.lat === 'string' ? parseFloat(point.lat) : (point.lat as number);
            // 如果坐标值很大（> 90），说明可能是未转换的格式
            lat = Math.abs(latValue) > 90 ? (Math.abs(latValue) > 1000000 ? latValue / 1000000 : latValue) : latValue;
          } else if (point.latitude !== undefined) {
            const latValue = typeof point.latitude === 'string' ? parseFloat(point.latitude) : (point.latitude as number);
            lat = Math.abs(latValue) > 90 ? (Math.abs(latValue) > 1000000 ? latValue / 1000000 : latValue) : latValue;
          }
          
          if (point.lng !== undefined) {
            const lngValue = typeof point.lng === 'string' ? parseFloat(point.lng) : (point.lng as number);
            lng = Math.abs(lngValue) > 180 ? (Math.abs(lngValue) > 1000000 ? lngValue / 1000000 : lngValue) : lngValue;
          } else if (point.lon !== undefined) {
            const lngValue = typeof point.lon === 'string' ? parseFloat(point.lon) : (point.lon as number);
            lng = Math.abs(lngValue) > 180 ? (Math.abs(lngValue) > 1000000 ? lngValue / 1000000 : lngValue) : lngValue;
          } else if (point.longitude !== undefined) {
            const lngValue = typeof point.longitude === 'string' ? parseFloat(point.longitude) : (point.longitude as number);
            lng = Math.abs(lngValue) > 180 ? (Math.abs(lngValue) > 1000000 ? lngValue / 1000000 : lngValue) : lngValue;
          }
          
          const time = (point.time as number) ?? Date.now();
          
          if (index < 3) {
            console.log(`result字段点 ${index} 坐标解析:`, {
              rawLat: point.lat || point.latitude,
              rawLng: point.lng || point.lon || point.longitude,
              convertedLat: lat,
              convertedLng: lng
            });
          }
          
          return {
            lat,
            lng,
            time,
            speed: point.speed as number | undefined,
            direction: point.direction as number | undefined,
            address: point.address as string | undefined
          };
        }).filter(p => {
          // 过滤掉无效坐标
          const isValid = p.lat !== 0 && p.lng !== 0 && 
                         p.lat >= -90 && p.lat <= 90 && 
                         p.lng >= -180 && p.lng <= 180;
          return isValid;
        });
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

      console.error('无法解析轨迹数据，数据键:', Object.keys(dataObj));
      console.error('完整数据对象:', dataObj);
      return [];
    };

    let points = parseTrackingData(trackingData);

    console.log('解析后的轨迹点数量:', points.length);
    if (points.length > 0) {
      console.log('第一个轨迹点（Edge Function处理后）:', points[0]);
      
      // 🔴 坐标系统转换：将 WGS-84 坐标系转换为 BD-09 坐标系（百度地图坐标系）
      // 注意：Edge Function 已经进行了坐标转换（WGS-84 -> BD-09）
      // 如果 Edge Function 没有转换或需要前端再次转换，可以取消下面的注释
      // console.log('开始坐标转换：WGS-84 -> BD-09');
      // points = convertPointsWgs84ToBd09(points);
      // console.log('坐标转换完成');
      
      console.log('第一个轨迹点（最终坐标，应该是 BD-09）:', points[0]);
      console.log('最后一个轨迹点:', points[points.length - 1]);
      console.log('轨迹点坐标范围（BD-09）:', {
        minLat: Math.min(...points.map(p => p.lat)),
        maxLat: Math.max(...points.map(p => p.lat)),
        minLng: Math.min(...points.map(p => p.lng)),
        maxLng: Math.max(...points.map(p => p.lng))
      });
    }

    if (points.length === 0) {
      console.error('未找到有效的轨迹数据');
      console.error('原始数据类型:', typeof trackingData, '是否为数组:', Array.isArray(trackingData));
      if (trackingData && typeof trackingData === 'object') {
        console.error('数据对象的键:', Object.keys(trackingData));
      }
      console.error('原始数据内容（前1000字符）:', JSON.stringify(trackingData).substring(0, 1000));
      setMapError('未找到有效的轨迹数据。可能原因：1) 该时间段内车辆没有行驶轨迹；2) API返回数据为空；3) 数据格式不匹配。请尝试调整查询日期范围，并查看浏览器控制台获取详细信息。');
      setMapLoading(false);
      return;
    }

    // 加载百度地图API
    const loadMap = async () => {
      if (window.BMap) {
        initMap(points);
        return;
      }

      try {
        // 从 Supabase Edge Function 获取百度地图API Key
        let baiduMapKey: string | null = null;
        
        try {
          console.log('开始获取百度地图API Key...');
          const { data, error } = await supabase.functions.invoke('baidu-map-key', {
            method: 'GET'
          });

          console.log('Edge Function 响应:', { data, error });

          if (error) {
            console.error('获取百度地图API Key失败:', error);
            console.error('错误详情:', {
              message: error.message,
              context: error.context,
              status: error.status
            });
          } else if (data) {
            if (data.error) {
              console.error('Edge Function 返回错误:', data.error);
            } else if (data.apiKey) {
              baiduMapKey = data.apiKey;
              console.log('成功获取百度地图API Key');
            } else {
              console.warn('Edge Function 返回数据中没有 apiKey 字段:', data);
            }
          }
        } catch (error) {
          console.error('调用 Edge Function 异常:', error);
        }
        
        // 如果 Edge Function 获取失败，尝试从环境变量获取（开发环境备用）
        if (!baiduMapKey) {
          baiduMapKey = process.env.REACT_APP_BAIDU_MAP_KEY || null;
          if (baiduMapKey) {
            console.log('从环境变量获取百度地图API Key');
          }
        }
        
        if (!baiduMapKey) {
          console.error('未配置百度地图API Key');
          setMapError('未配置百度地图API Key。请按以下步骤配置：\n1. 在 Supabase Dashboard 的 Edge Functions 设置中添加 BAIDU_MAP_KEY 环境变量\n2. 部署 baidu-map-key Edge Function\n3. 刷新页面');
          setMapLoading(false);
          return;
        }

        // 加载百度地图API
        // 生成唯一的回调函数名，避免多次加载冲突
        const callbackName = `initBaiduMap_${Date.now()}`;
        
        // 设置全局回调函数
        (window as unknown as Record<string, () => void>)[callbackName] = () => {
          if (window.BMap) {
            console.log('百度地图API加载成功');
            // 清理回调函数
            delete (window as unknown as Record<string, () => void>)[callbackName];
            initMap(points);
          } else {
            console.error('百度地图API加载失败：BMap未定义');
            setMapError('地图API加载失败');
            setMapLoading(false);
          }
        };
        
        const script = document.createElement('script');
        script.src = `https://api.map.baidu.com/api?v=3.0&ak=${baiduMapKey}&callback=${callbackName}`;
        script.async = true;
        
        script.onerror = () => {
          console.error('百度地图API脚本加载失败');
          setMapError('地图API加载失败，请检查网络连接和API Key配置');
          setMapLoading(false);
          // 清理回调函数
          delete (window as unknown as Record<string, () => void>)[callbackName];
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
      if (!mapContainerRef.current || !window.BMap) {
        console.error('地图容器或BMap未初始化');
        return;
      }

      try {
        console.log('开始初始化百度地图，轨迹点数量:', trackingPoints.length);
        
        // 计算中心点和边界
        const lats = trackingPoints.map(p => p.lat).filter(lat => lat != null && lat !== 0);
        const lngs = trackingPoints.map(p => p.lng).filter(lng => lng != null && lng !== 0);
        
        if (lats.length === 0 || lngs.length === 0) {
          console.error('轨迹数据缺少有效坐标信息', { lats, lngs });
          setMapError('轨迹数据缺少坐标信息');
          setMapLoading(false);
          return;
        }

        const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
        const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;

        console.log('地图中心点:', { centerLat, centerLng });

        // 初始化百度地图
        const map = new window.BMap.Map(mapContainerRef.current);
        const centerPoint = new window.BMap.Point(centerLng, centerLat);
        map.centerAndZoom(centerPoint, 13);

        mapInstanceRef.current = map;

        // 绘制轨迹路线
        const path = trackingPoints
          .filter(p => p.lat != null && p.lng != null && p.lat !== 0 && p.lng !== 0)
          .map(p => new window.BMap.Point(p.lng, p.lat));

        console.log('轨迹路径点数:', path.length);

        if (path.length > 0) {
          const polyline = new window.BMap.Polyline(path, {
            strokeColor: '#2563eb',
            strokeWeight: 4,
            strokeOpacity: 0.8,
            strokeStyle: 'solid'
          });

          map.addOverlay(polyline);
        }

        // 添加起点标记
        if (trackingPoints.length > 0) {
          const startPoint = trackingPoints[0];
          if (startPoint.lat != null && startPoint.lng != null && startPoint.lat !== 0 && startPoint.lng !== 0) {
            const startTime = startPoint.time 
              ? new Date(startPoint.time).toLocaleString('zh-CN')
              : '起点';
            
            const startPointObj = new window.BMap.Point(startPoint.lng, startPoint.lat);
            const startMarker = new window.BMap.Marker(startPointObj, {
              title: `起点: ${startTime}`
            });
            map.addOverlay(startMarker);
          }
        }

        // 添加终点标记
        if (trackingPoints.length > 1) {
          const endPoint = trackingPoints[trackingPoints.length - 1];
          if (endPoint.lat != null && endPoint.lng != null && endPoint.lat !== 0 && endPoint.lng !== 0) {
            const endTime = endPoint.time 
              ? new Date(endPoint.time).toLocaleString('zh-CN')
              : '终点';
            
            const endPointObj = new window.BMap.Point(endPoint.lng, endPoint.lat);
            const endMarker = new window.BMap.Marker(endPointObj, {
              title: `终点: ${endTime}`
            });
            map.addOverlay(endMarker);
          }
        }

        // 调整地图视野以包含所有轨迹点
        if (path.length > 0) {
          const viewport = map.getViewport(path);
          map.centerAndZoom(viewport.center, viewport.zoom);
        }

        console.log('百度地图初始化成功');
        setMapLoading(false);
      } catch (error) {
        console.error('地图初始化失败:', error);
        setMapError(`地图初始化失败: ${error instanceof Error ? error.message : String(error)}`);
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

