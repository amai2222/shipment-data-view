// 多车辆位置地图组件（使用百度地图）
import { useEffect, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';

interface VehicleLocation {
  licensePlate: string;
  lat: number;
  lng: number;
  time: number;
  address?: string;
  speed?: number;
  vehicleId?: string;
}

interface MultiVehicleLocationMapProps {
  locations: VehicleLocation[];
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
        clearOverlays: () => void;
        enableScrollWheelZoom: (enable: boolean) => void;
        enableDragging: (enable: boolean) => void;
        enableDoubleClickZoom: (enable: boolean) => void;
        enableKeyboard: (enable: boolean) => void;
        addControl: (control: unknown) => void;
        setMapType: (type: unknown) => void;
        setViewport: (points: { lng: number; lat: number }[]) => void;
        openInfoWindow: (infoWindow: unknown, point: { lng: number; lat: number }) => void;
      };
      Point: new (lng: number, lat: number) => { lng: number; lat: number };
      Marker: new (point: { lng: number; lat: number }, options?: {
        icon?: unknown;
        title?: string;
        enableDragging?: boolean;
      }) => {
        setLabel: (label: unknown) => void;
        addEventListener: (event: string, handler: () => void) => void;
      };
      Icon: new (url: string, size: { width: number; height: number }, options?: {
        anchor?: { x: number; y: number };
      }) => unknown;
      Size: new (width: number, height: number) => { width: number; height: number };
      NavigationControl: new (options?: {
        anchor?: unknown;
        type?: unknown;
      }) => unknown;
      ScaleControl: new (options?: {
        anchor?: unknown;
      }) => unknown;
      MapTypeControl: new (options?: {
        anchor?: unknown;
        mapTypes?: unknown[];
      }) => unknown;
      InfoWindow: new (content: string, options?: {
        width?: number;
        height?: number;
        title?: string;
      }) => {
        open: (map: unknown, point: { lng: number; lat: number }) => void;
        close: () => void;
      };
      Label: new (content: string, point: { lng: number; lat: number }, options?: {
        offset?: { x: number; y: number };
        style?: Record<string, string>;
      }) => {
        setStyle: (style: Record<string, string>) => void;
      };
    };
    BMap_ANCHOR_TOP_LEFT?: unknown;
    BMap_ANCHOR_BOTTOM_LEFT?: unknown;
    BMap_ANCHOR_TOP_RIGHT?: unknown;
    BMAP_NORMAL_MAP?: unknown;
    BMAP_SATELLITE_MAP?: unknown;
    BMAP_HYBRID_MAP?: unknown;
    BMAP_NAVIGATION_CONTROL_LARGE?: unknown;
  }
}

export function MultiVehicleLocationMap({ locations, loading }: MultiVehicleLocationMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<unknown>(null);
  const markersRef = useRef<unknown[]>([]);
  const scriptLoadingRef = useRef(false);
  const [mapLoading, setMapLoading] = useState(true);
  const [mapError, setMapError] = useState<string | null>(null);

  useEffect(() => {
    const container = mapContainerRef.current;
    
    // 重置状态
    setMapLoading(true);
    setMapError(null);
    
    if (!container) {
      console.log('⚠️ 地图容器未准备好');
      setMapLoading(false);
      return;
    }

    // 过滤有效的定位数据
    const validLocations = locations.filter(
      loc => loc.lat !== 0 && loc.lng !== 0 && 
             loc.lat >= -90 && loc.lat <= 90 && 
             loc.lng >= -180 && loc.lng <= 180
    );

    if (validLocations.length === 0) {
      console.log('⚠️ 没有有效的定位数据');
      setMapError('没有有效的车辆定位数据');
      setMapLoading(false);
      return;
    }

    // 加载百度地图API
    const loadMap = async () => {
      console.log('🟢 开始加载地图，车辆数量:', validLocations.length);
      
      setMapLoading(true);
      
      // 如果 BMap 已存在，直接初始化地图
      if (window.BMap) {
        console.log('✅ 百度地图API已加载，直接初始化地图');
        initMap(validLocations);
        return;
      }
      
      // 检查脚本标签是否已经存在
      const existingScript = document.querySelector('script[src*="api.map.baidu.com"]');
      if (existingScript) {
        console.log('⏳ 百度地图API脚本标签已存在，等待加载完成...');
        
        if (scriptLoadingRef.current) {
          const checkInterval = setInterval(() => {
            if (window.BMap) {
              clearInterval(checkInterval);
              console.log('✅ 百度地图API加载完成，开始初始化地图');
              scriptLoadingRef.current = false;
              initMap(validLocations);
            }
          }, 100);
          
          setTimeout(() => {
            clearInterval(checkInterval);
            if (!window.BMap) {
              console.error('❌ 等待脚本加载超时');
              setMapError('地图API加载超时，请刷新页面重试');
              setMapLoading(false);
              scriptLoadingRef.current = false;
            }
          }, 10000);
          
          return;
        }
      }
      
      console.log('⏳ 百度地图API未加载，开始加载API...');
      scriptLoadingRef.current = true;

      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      
      const clearTimeoutIfNeeded = () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
      };

      timeoutId = setTimeout(() => {
        console.error('地图加载超时（30秒）');
        setMapError('地图加载超时，请检查网络连接或刷新页面重试');
        setMapLoading(false);
        timeoutId = null;
      }, 30000);

      try {
        // 从 Supabase Edge Function 获取百度地图API Key
        let baiduMapKey: string | null = null;
        
        try {
          console.log('开始获取百度地图API Key...');
          const { data, error } = await supabase.functions.invoke('baidu-map-key', {
            method: 'GET'
          });

          if (error) {
            console.error('获取百度地图API Key失败:', error);
          } else if (data) {
            if (data.error) {
              console.error('Edge Function 返回错误:', data.error);
            } else if (data.apiKey) {
              baiduMapKey = data.apiKey;
              console.log('成功获取百度地图API Key');
            }
          }
        } catch (error) {
          console.error('调用 Edge Function 异常:', error);
        }
        
        if (!baiduMapKey) {
          baiduMapKey = process.env.REACT_APP_BAIDU_MAP_KEY || null;
          if (baiduMapKey) {
            console.log('从环境变量获取百度地图API Key');
          }
        }
        
        if (!baiduMapKey) {
          console.error('未配置百度地图API Key');
          clearTimeoutIfNeeded();
          setMapError('未配置百度地图API Key');
          setMapLoading(false);
          return;
        }

        // 生成唯一的回调函数名
        const callbackName = `initBaiduMapMulti_${Date.now()}`;
        
        console.log('📝 设置百度地图API回调函数:', callbackName);
        (window as unknown as Record<string, () => void>)[callbackName] = () => {
          console.log('✅ 百度地图API回调函数被调用！');
          clearTimeoutIfNeeded();
          scriptLoadingRef.current = false;
          
          delete (window as unknown as Record<string, () => void>)[callbackName];
          
          setTimeout(() => {
            if (window.BMap) {
              console.log('✅ 百度地图API加载成功，开始初始化地图');
              initMap(validLocations);
            } else {
              console.error('❌ 百度地图API加载失败：BMap未定义');
              setMapError('地图API加载失败：BMap未定义');
              setMapLoading(false);
            }
          }, 100);
        };
        
        const script = document.createElement('script');
        const apiUrl = `https://api.map.baidu.com/api?v=3.0&ak=${baiduMapKey}&callback=${callbackName}`;
        console.log('📥 加载百度地图API脚本:', apiUrl);
        script.src = apiUrl;
        script.async = true;
        script.defer = true;
        
        script.onload = () => {
          console.log('✅ 百度地图API脚本加载完成');
        };
        
        script.onerror = () => {
          console.error('❌ 百度地图API脚本加载失败');
          clearTimeoutIfNeeded();
          scriptLoadingRef.current = false;
          setMapError('地图API加载失败');
          setMapLoading(false);
          delete (window as unknown as Record<string, () => void>)[callbackName];
        };
        
        document.head.appendChild(script);
      } catch (error) {
        console.error('加载地图API失败:', error);
        clearTimeoutIfNeeded();
        setMapError(`加载地图API失败: ${error instanceof Error ? error.message : String(error)}`);
        setMapLoading(false);
      }
    };

    loadMap();

    function initMap(vehicleLocations: VehicleLocation[]) {
      if (!mapContainerRef.current) {
        console.error('地图容器未初始化');
        setMapError('地图容器未初始化');
        setMapLoading(false);
        return;
      }
      
      // 清理旧的地图实例
      if (mapInstanceRef.current) {
        console.log('🧹 清理旧的地图实例');
        try {
          if (mapContainerRef.current) {
            mapContainerRef.current.innerHTML = '';
          }
          mapInstanceRef.current = null;
          markersRef.current = [];
        } catch (error) {
          console.warn('⚠️ 清理旧地图实例时出错:', error);
        }
      }
      
      mapContainerRef.current.innerHTML = '';
      console.log('✅ 已清空地图容器内容');
      
      if (!window.BMap) {
        console.error('百度地图API未加载');
        setMapError('百度地图API加载失败，请刷新页面重试');
        setMapLoading(false);
        return;
      }

      try {
        console.log('开始初始化百度地图，车辆数量:', vehicleLocations.length);
        
        // 计算所有车辆的中心点和边界
        const lats = vehicleLocations.map(loc => loc.lat);
        const lngs = vehicleLocations.map(loc => loc.lng);
        
        const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
        const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;

        console.log('地图中心点:', { centerLat, centerLng });

        // 初始化百度地图
        const map = new window.BMap.Map(mapContainerRef.current);
        const centerPoint = new window.BMap.Point(centerLng, centerLat);
        
        // 设置地图中心点和缩放级别
        map.centerAndZoom(centerPoint, 13);
        
        // 启用地图控件
        // @ts-expect-error - 百度地图API方法在运行时可用
        map.enableScrollWheelZoom(true);
        // @ts-expect-error - 百度地图API方法在运行时可用
        map.enableDragging(true);
        // @ts-expect-error - 百度地图API方法在运行时可用
        map.enableDoubleClickZoom(true);
        // @ts-expect-error - 百度地图API方法在运行时可用
        map.enableKeyboard(true);
        
        // 添加地图控件
        // @ts-expect-error - 百度地图API在运行时可用
        const navControl = new window.BMap.NavigationControl({
          // @ts-expect-error - 百度地图API常量在运行时可用
          anchor: window.BMap_ANCHOR_TOP_LEFT,
          // @ts-expect-error - 百度地图API常量在运行时可用
          type: window.BMap_NAVIGATION_CONTROL_LARGE
        });
        // @ts-expect-error - 百度地图API方法在运行时可用
        map.addControl(navControl);
        
        // @ts-expect-error - 百度地图API在运行时可用
        const scaleControl = new window.BMap.ScaleControl({
          // @ts-expect-error - 百度地图API常量在运行时可用
          anchor: window.BMap_ANCHOR_BOTTOM_LEFT
        });
        // @ts-expect-error - 百度地图API方法在运行时可用
        map.addControl(scaleControl);
        
        // @ts-expect-error - 百度地图API在运行时可用
        const mapTypeControl = new window.BMap.MapTypeControl({
          // @ts-expect-error - 百度地图API常量在运行时可用
          anchor: window.BMap_ANCHOR_TOP_RIGHT,
          // @ts-expect-error - 百度地图API常量在运行时可用
          mapTypes: [window.BMAP_NORMAL_MAP, window.BMAP_SATELLITE_MAP, window.BMAP_HYBRID_MAP]
        });
        // @ts-expect-error - 百度地图API方法在运行时可用
        map.addControl(mapTypeControl);
        
        // @ts-expect-error - 百度地图API方法在运行时可用
        map.setMapType(window.BMAP_NORMAL_MAP);
        
        mapInstanceRef.current = map;

        // 为每个车辆添加标记
        const allPoints: { lng: number; lat: number }[] = [];
        const markers: unknown[] = [];

        vehicleLocations.forEach((location, index) => {
          const point = new window.BMap.Point(location.lng, location.lat);
          allPoints.push({ lng: location.lng, lat: location.lat });

          // 创建自定义图标（使用不同颜色区分车辆）
          const colors = ['#2563eb', '#dc2626', '#16a34a', '#ca8a04', '#9333ea', '#ea580c', '#0891b2', '#be123c'];
          const color = colors[index % colors.length];
          
          // 创建标记
          const marker = new window.BMap.Marker(point, {
            title: `${location.licensePlate} - ${location.address || '未知地址'}`
          });

          // 添加标签显示车牌号
          const label = new window.BMap.Label(location.licensePlate, {
            offset: new window.BMap.Size(0, -35)
          });
          label.setStyle({
            color: '#fff',
            backgroundColor: color,
            border: 'none',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: 'bold',
            whiteSpace: 'nowrap'
          });
          marker.setLabel(label);

          // 添加信息窗口
          const infoContent = `
            <div style="padding: 8px; min-width: 200px;">
              <div style="font-weight: bold; margin-bottom: 8px; color: ${color};">
                ${location.licensePlate}
              </div>
              <div style="font-size: 12px; color: #666; line-height: 1.6;">
                ${location.address ? `<div>地址：${location.address}</div>` : ''}
                <div>坐标：${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}</div>
                <div>时间：${new Date(location.time).toLocaleString('zh-CN')}</div>
                ${location.speed !== undefined ? `<div>速度：${location.speed} km/h</div>` : ''}
              </div>
            </div>
          `;
          
          const infoWindow = new window.BMap.InfoWindow(infoContent, {
            width: 250,
            height: 'auto',
            title: location.licensePlate
          });

          // 点击标记显示信息窗口
          // @ts-expect-error - 百度地图API方法在运行时可用
          marker.addEventListener('click', () => {
            // @ts-expect-error - 百度地图API方法在运行时可用
            map.openInfoWindow(infoWindow, point);
          });

          map.addOverlay(marker);
          markers.push(marker);
        });

        markersRef.current = markers;

        // 调整地图视图以包含所有标记
        setTimeout(() => {
          if (allPoints.length > 0) {
            console.log('🔄 调整地图视图以包含所有车辆位置');
            try {
              // @ts-expect-error - 百度地图API方法在运行时可用
              map.setViewport(allPoints.map(p => new window.BMap.Point(p.lng, p.lat)));
              console.log('✅ 地图视图已调整到所有车辆位置范围');
            } catch (err) {
              console.warn('⚠️ setViewport 失败，使用 centerAndZoom:', err);
              map.centerAndZoom(centerPoint, 13);
            }
          } else {
            map.centerAndZoom(centerPoint, 13);
          }
        }, 100);
        
        console.log('✅ 地图和所有车辆标记初始化完成');
        setMapLoading(false);
      } catch (error) {
        console.error('❌ 地图初始化失败:', error);
        setMapError(`地图初始化失败: ${error instanceof Error ? error.message : String(error)}`);
        setMapLoading(false);
      }
    }

    // 清理函数
    return () => {
      console.log('🧹 MultiVehicleLocationMap 清理函数执行');
      if (mapInstanceRef.current) {
        if (container) {
          container.innerHTML = '';
        }
        mapInstanceRef.current = null;
        markersRef.current = [];
      }
      scriptLoadingRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locations]);

  return (
    <Card>
      <CardContent className="p-0">
        <div className="relative w-full h-96 rounded-lg overflow-hidden" style={{ minHeight: '500px' }}>
          {/* 地图容器 - 始终渲染 */}
          <div 
            ref={mapContainerRef} 
            className="w-full h-full"
            style={{ minHeight: '500px' }}
          />
          
          {/* 加载遮罩层 */}
          {(loading || mapLoading) && (
            <div className="absolute inset-0 bg-white bg-opacity-90 flex items-center justify-center z-10">
              <div className="text-center">
                <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin text-blue-500" />
                <p className="text-muted-foreground">正在加载地图...</p>
              </div>
            </div>
          )}
          
          {/* 错误遮罩层 */}
          {mapError && !loading && !mapLoading && (
            <div className="absolute inset-0 bg-white bg-opacity-95 flex items-center justify-center z-10">
              <div className="text-center text-muted-foreground p-4">
                <p className="text-lg mb-2">⚠️</p>
                <p className="whitespace-pre-line">{mapError}</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
