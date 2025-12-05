// 车辆轨迹地图组件（使用百度地图）
import { useEffect, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';
// Edge Function 已经处理了坐标转换，前端不需要再次转换

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
  // 🔴 组件渲染时立即打印日志
  console.log('🚀 VehicleTrackingMap 组件渲染');
  console.log('🚀 Props:', { trackingData, licensePlate, loading });
  console.log('🚀 trackingData 类型:', typeof trackingData);
  console.log('🚀 trackingData 是否为数组:', Array.isArray(trackingData));
  console.log('🚀 trackingData 是否为 null:', trackingData === null);
  console.log('🚀 trackingData 是否为 undefined:', trackingData === undefined);
  
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<unknown>(null);
  const scriptLoadingRef = useRef(false); // 🔴 跟踪脚本是否正在加载
  const [mapLoading, setMapLoading] = useState(true);
  const [mapError, setMapError] = useState<string | null>(null);

  useEffect(() => {
    console.log('🔵 VehicleTrackingMap useEffect 触发');
    console.log('trackingData:', trackingData);
    console.log('mapContainerRef.current:', mapContainerRef.current);
    console.log('mapLoading:', mapLoading);
    console.log('mapError:', mapError);
    
    // 🔴 修复 linter 警告：在 cleanup 函数中使用变量保存 ref 值
    const container = mapContainerRef.current;
    
    // 重置状态
    setMapLoading(true);
    setMapError(null);
    
    if (!trackingData) {
      console.log('⚠️ trackingData 为空，等待数据...');
      setMapLoading(false);
      return;
    }
    
    if (!container) {
      console.log('⚠️ 地图容器未准备好，等待DOM元素...');
      setMapLoading(false);
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
            // 如果坐标值很大（> 90），说明可能是未转换的格式，需要除以600000
            // 例如：12525696 / 600000 = 20.87616（合理的纬度值）
            lat = Math.abs(latValue) > 90 ? (Math.abs(latValue) > 1000 ? latValue / 600000 : latValue) : latValue;
          } else if (point.latitude !== undefined) {
            const latValue = typeof point.latitude === 'string' ? parseFloat(point.latitude) : (point.latitude as number);
            lat = Math.abs(latValue) > 90 ? (Math.abs(latValue) > 1000 ? latValue / 600000 : latValue) : latValue;
          }
          
          // 🔴 修复：支持 lng、longitude 和 lon 三种字段名
          if (point.lng !== undefined) {
            const lngValue = typeof point.lng === 'string' ? parseFloat(point.lng) : (point.lng as number);
            // 如果坐标值很大（> 180），说明可能是未转换的格式，需要除以600000
            lng = Math.abs(lngValue) > 180 ? (Math.abs(lngValue) > 1000 ? lngValue / 600000 : lngValue) : lngValue;
          } else if (point.lon !== undefined) {
            // ✅ 新增：支持 lon 字段（GPS硬件常用格式）
            const lngValue = typeof point.lon === 'string' ? parseFloat(point.lon) : (point.lon as number);
            lng = Math.abs(lngValue) > 180 ? (Math.abs(lngValue) > 1000 ? lngValue / 600000 : lngValue) : lngValue;
          } else if (point.longitude !== undefined) {
            const lngValue = typeof point.longitude === 'string' ? parseFloat(point.longitude) : (point.longitude as number);
            lng = Math.abs(lngValue) > 180 ? (Math.abs(lngValue) > 1000 ? lngValue / 600000 : lngValue) : lngValue;
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
            lat = Math.abs(latValue) > 90 ? (Math.abs(latValue) > 1000 ? latValue / 600000 : latValue) : latValue;
          } else if (point.latitude !== undefined) {
            const latValue = typeof point.latitude === 'string' ? parseFloat(point.latitude) : (point.latitude as number);
            lat = Math.abs(latValue) > 90 ? (Math.abs(latValue) > 1000 ? latValue / 600000 : latValue) : latValue;
          }
          
          if (point.lng !== undefined) {
            const lngValue = typeof point.lng === 'string' ? parseFloat(point.lng) : (point.lng as number);
            lng = Math.abs(lngValue) > 180 ? (Math.abs(lngValue) > 1000 ? lngValue / 600000 : lngValue) : lngValue;
          } else if (point.lon !== undefined) {
            const lngValue = typeof point.lon === 'string' ? parseFloat(point.lon) : (point.lon as number);
            lng = Math.abs(lngValue) > 180 ? (Math.abs(lngValue) > 1000 ? lngValue / 600000 : lngValue) : lngValue;
          } else if (point.longitude !== undefined) {
            const lngValue = typeof point.longitude === 'string' ? parseFloat(point.longitude) : (point.longitude as number);
            lng = Math.abs(lngValue) > 180 ? (Math.abs(lngValue) > 1000 ? lngValue / 600000 : lngValue) : lngValue;
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

    const points = parseTrackingData(trackingData);

    console.log('解析后的轨迹点数量:', points.length);
    if (points.length > 0) {
      console.log('第一个轨迹点（解析后，WGS-84坐标）:', points[0]);
      
      // Edge Function 已经进行了坐标转换（WGS-84 -> BD-09），直接使用
      console.log('第一个轨迹点（Edge Function已转换，BD-09坐标）:', points[0]);
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
      console.log('🟢 开始加载地图，轨迹点数量:', points.length);
      console.log('🟢 当前 mapLoading 状态:', mapLoading);
      
      // 确保加载状态为 true
      setMapLoading(true);
      
      // 🔴 修复：检查百度地图API是否已加载，同时检查脚本标签是否已存在
      // 如果 BMap 已存在，直接初始化地图
      if (window.BMap) {
        console.log('✅ 百度地图API已加载（window.BMap存在），直接初始化地图');
        initMap(points);
        return;
      }
      
      // 🔴 修复：检查脚本标签是否已经存在，避免重复加载导致竞争状态
      const existingScript = document.querySelector('script[src*="api.map.baidu.com"]');
      if (existingScript) {
        console.log('⏳ 百度地图API脚本标签已存在，等待加载完成...');
        
        // 如果脚本正在加载，等待其完成
        if (scriptLoadingRef.current) {
          console.log('⏳ 脚本正在加载中，等待加载完成...');
          // 设置一个轮询检查，等待 BMap 加载完成
          const checkInterval = setInterval(() => {
            if (window.BMap) {
              clearInterval(checkInterval);
              console.log('✅ 百度地图API加载完成，开始初始化地图');
              scriptLoadingRef.current = false;
              initMap(points);
            }
          }, 100); // 每100ms检查一次
          
          // 设置超时，避免无限等待
          setTimeout(() => {
            clearInterval(checkInterval);
            if (!window.BMap) {
              console.error('❌ 等待脚本加载超时');
              setMapError('地图API加载超时，请刷新页面重试');
              setMapLoading(false);
              scriptLoadingRef.current = false;
            }
          }, 10000); // 10秒超时
          
          return;
        }
      }
      
      console.log('⏳ 百度地图API未加载，开始加载API...');
      scriptLoadingRef.current = true; // 🔴 标记脚本正在加载

      // 设置超时机制，防止无限加载
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
      }, 30000); // 30秒超时

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
          clearTimeoutIfNeeded();
          setMapError('未配置百度地图API Key。请按以下步骤配置：\n1. 在 Supabase Dashboard 的 Edge Functions 设置中添加 BAIDU_MAP_KEY 环境变量\n2. 部署 baidu-map-key Edge Function\n3. 刷新页面');
          setMapLoading(false);
          return;
        }

        // 加载百度地图API
        // 生成唯一的回调函数名，避免多次加载冲突
        const callbackName = `initBaiduMap_${Date.now()}`;
        
        // 设置全局回调函数
        console.log('📝 设置百度地图API回调函数:', callbackName);
        (window as unknown as Record<string, () => void>)[callbackName] = () => {
          console.log('✅ 百度地图API回调函数被调用！');
          clearTimeoutIfNeeded(); // 清除超时定时器
          scriptLoadingRef.current = false; // 🔴 标记脚本加载完成
          
          // 清理回调函数
          delete (window as unknown as Record<string, () => void>)[callbackName];
          
          // 延迟一下确保 BMap 完全初始化
          setTimeout(() => {
            console.log('🔍 检查 window.BMap:', typeof window.BMap, window.BMap);
            if (window.BMap) {
              console.log('✅ 百度地图API加载成功，BMap已定义，开始初始化地图');
              initMap(points);
            } else {
              console.error('❌ 百度地图API加载失败：BMap未定义');
              setMapError('地图API加载失败：BMap未定义。请检查API Key配置和网络连接');
              setMapLoading(false);
            }
          }, 100);
        };
        
        const script = document.createElement('script');
        // 🔴 使用 HTTPS 协议，确保在 HTTPS 网站中正常加载
        // 使用 v=3.0 版本，支持更多功能
        const apiUrl = `https://api.map.baidu.com/api?v=3.0&ak=${baiduMapKey}&callback=${callbackName}`;
        console.log('📥 加载百度地图API脚本:', apiUrl);
        console.log('📥 API Key:', baiduMapKey ? `${baiduMapKey.substring(0, 8)}...` : '未设置');
        script.src = apiUrl;
        script.async = true;
        script.defer = true; // 延迟加载，确保DOM完全加载后再执行
        
        script.onload = () => {
          console.log('✅ 百度地图API脚本加载完成（onload事件）');
          // 检查脚本加载后的网络请求状态
          console.log('📡 检查百度地图API网络请求状态...');
        };
        
        script.onerror = (error) => {
          console.error('❌ 百度地图API脚本加载失败（onerror事件）:', error);
          console.error('📡 请在浏览器 Network 标签中检查以下请求:');
          console.error('  - 请求URL:', apiUrl);
          console.error('  - 检查请求是否返回 200 状态码');
          console.error('  - 检查是否有权限错误（如：Invalid AK 等）');
          clearTimeoutIfNeeded();
          scriptLoadingRef.current = false; // 🔴 标记脚本加载失败
          setMapError('地图API加载失败。请检查：1) 浏览器 Network 标签中的请求是否返回 200；2) 是否有权限错误（如 Invalid AK）');
          setMapLoading(false);
          // 清理回调函数
          delete (window as unknown as Record<string, () => void>)[callbackName];
        };
        
        console.log('📤 将脚本添加到 document.head');
        document.head.appendChild(script);
        console.log('✅ 脚本已添加到 document.head');
      } catch (error) {
        console.error('加载地图API失败:', error);
        clearTimeoutIfNeeded();
        setMapError(`加载地图API失败: ${error instanceof Error ? error.message : String(error)}`);
        setMapLoading(false);
      }
    };

    loadMap();

    function initMap(trackingPoints: TrackingPoint[]) {
      if (!mapContainerRef.current) {
        console.error('地图容器未初始化');
        setMapError('地图容器未初始化');
        setMapLoading(false);
        return;
      }
      
      // 🔴 核心修复：清理旧的地图实例，避免重复初始化导致的 DOM 冲突
      // 如果存在旧的地图实例，先销毁它
      if (mapInstanceRef.current) {
        console.log('🧹 检测到旧的地图实例，正在清理...');
        try {
          // 百度地图实例可以通过 clearOverlays 和 removeOverlay 清理
          // 但最安全的方式是直接清空容器
          if (mapContainerRef.current) {
            mapContainerRef.current.innerHTML = '';
          }
          mapInstanceRef.current = null;
          console.log('✅ 旧地图实例已清理');
        } catch (error) {
          console.warn('⚠️ 清理旧地图实例时出错（可忽略）:', error);
          // 即使清理失败，也继续初始化新地图
        }
      }
      
      // 🔴 最优先：清空地图容器内容，这通常能解决 90% 的 React 地图不显示问题
      mapContainerRef.current.innerHTML = '';
      console.log('✅ 已清空地图容器内容');
      
      if (!window.BMap) {
        console.error('百度地图API未加载，BMap未定义');
        setMapError('百度地图API加载失败，请刷新页面重试');
        setMapLoading(false);
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
        
        // 设置地图中心点和缩放级别
        map.centerAndZoom(centerPoint, 13);
        
        // 🔴 启用地图控件（必需，否则地图可能不显示）
        // @ts-expect-error - 百度地图API方法在运行时可用
        map.enableScrollWheelZoom(true); // 启用滚轮缩放
        // @ts-expect-error - 百度地图API方法在运行时可用
        map.enableDragging(true); // 启用拖拽
        // @ts-expect-error - 百度地图API方法在运行时可用
        map.enableDoubleClickZoom(true); // 启用双击缩放
        // @ts-expect-error - 百度地图API方法在运行时可用
        map.enableKeyboard(true); // 启用键盘操作
        
        // 🔴 添加地图控件（缩放、平移等）
        // @ts-expect-error - 百度地图API在运行时可用
        const navControl = new window.BMap.NavigationControl({
          // @ts-expect-error - 百度地图API常量在运行时可用
          anchor: window.BMap_ANCHOR_TOP_LEFT,
          // @ts-expect-error - 百度地图API常量在运行时可用
          type: window.BMap_NAVIGATION_CONTROL_LARGE
        });
        // @ts-expect-error - 百度地图API方法在运行时可用
        map.addControl(navControl);
        
        // 🔴 添加比例尺控件
        // @ts-expect-error - 百度地图API在运行时可用
        const scaleControl = new window.BMap.ScaleControl({
          // @ts-expect-error - 百度地图API常量在运行时可用
          anchor: window.BMap_ANCHOR_BOTTOM_LEFT
        });
        // @ts-expect-error - 百度地图API方法在运行时可用
        map.addControl(scaleControl);
        
        // 🔴 添加地图类型控件（可选，允许切换地图类型）
        // @ts-expect-error - 百度地图API在运行时可用
        const mapTypeControl = new window.BMap.MapTypeControl({
          // @ts-expect-error - 百度地图API常量在运行时可用
          anchor: window.BMap_ANCHOR_TOP_RIGHT,
          // @ts-expect-error - 百度地图API常量在运行时可用
          mapTypes: [window.BMAP_NORMAL_MAP, window.BMAP_SATELLITE_MAP, window.BMAP_HYBRID_MAP]
        });
        // @ts-expect-error - 百度地图API方法在运行时可用
        map.addControl(mapTypeControl);
        
        // 🔴 设置默认地图类型为普通地图（确保底图显示）
        // @ts-expect-error - 百度地图API方法在运行时可用
        map.setMapType(window.BMAP_NORMAL_MAP);
        
        // 🔴 检查地图容器尺寸（如果容器尺寸为0，地图可能不显示）
        const container = mapContainerRef.current;
        if (container) {
          const rect = container.getBoundingClientRect();
          const computedStyle = window.getComputedStyle(container);
          console.log('🗺️ 地图容器尺寸检查:');
          console.log('  - getBoundingClientRect:', { width: rect.width, height: rect.height });
          console.log('  - computedStyle width:', computedStyle.width);
          console.log('  - computedStyle height:', computedStyle.height);
          console.log('  - computedStyle display:', computedStyle.display);
          console.log('  - computedStyle visibility:', computedStyle.visibility);
          
          if (rect.width === 0 || rect.height === 0) {
            console.error('❌ 地图容器尺寸为0！这会导致地图无法显示！');
            console.error('  - 容器宽度:', rect.width, '高度:', rect.height);
            setMapError(`地图容器尺寸为0（宽:${rect.width}px, 高:${rect.height}px）。请检查CSS样式，确保容器有明确的宽度和高度。`);
            setMapLoading(false);
            return;
          } else {
            console.log('✅ 地图容器尺寸正常:', { width: rect.width, height: rect.height });
          }
        }

        console.log('✅ 百度地图初始化完成，已添加所有控件');

        mapInstanceRef.current = map;

        // 绘制轨迹路线
        // 🔴 先过滤有效点，同时保留原始数据用于标记
        const validPoints = trackingPoints.filter(p => p.lat != null && p.lng != null && p.lat !== 0 && p.lng !== 0);
        const path = validPoints.map(p => new window.BMap.Point(p.lng, p.lat));
        
        console.log('轨迹路径点数:', path.length);
        console.log('轨迹路径前3个点:', path.slice(0, 3));
        
        // 🔴 延迟一下，确保地图完全加载后再设置视图
        setTimeout(() => {
          if (path.length > 0) {
            console.log('🔄 调整地图视图以包含所有轨迹点，轨迹点数量:', path.length);
            try {
              // @ts-expect-error - 百度地图API方法在运行时可用
              map.setViewport(path);
              console.log('✅ 百度地图视图已调整到轨迹范围');
            } catch (err) {
              console.warn('⚠️ setViewport 失败，尝试使用 centerAndZoom:', err);
              // 如果 setViewport 失败，使用计算的中心点和合适的缩放级别
              map.centerAndZoom(centerPoint, 13);
            }
          } else {
            console.warn('⚠️ 没有有效的轨迹点，使用默认中心点');
            map.centerAndZoom(centerPoint, 13);
          }
        }, 100);

        if (path.length > 0) {
          console.log('开始绘制轨迹路线，点数:', path.length);
          const polyline = new window.BMap.Polyline(path, {
            strokeColor: '#2563eb',
            strokeWeight: 4,
            strokeOpacity: 0.8,
            strokeStyle: 'solid'
          });

          map.addOverlay(polyline);
          console.log('✅ 轨迹路线已添加到地图');
        } else {
          console.warn('⚠️ 没有有效的轨迹点可以绘制');
        }

        // 🔴 添加起点标记 - 使用过滤后的有效点的第一个点，确保与轨迹线一致
        if (validPoints.length > 0) {
          const startPoint = validPoints[0];
          const startTime = startPoint.time 
            ? new Date(startPoint.time).toLocaleString('zh-CN')
            : '起点';
          
          // 使用轨迹线的第一个点（path[0]）来确保标记位置与轨迹线完全一致
          const startMarker = new window.BMap.Marker(path[0], {
            title: `起点: ${startTime}`
          });
          map.addOverlay(startMarker);
          console.log('✅ 起点标记已添加，位置:', { lng: startPoint.lng, lat: startPoint.lat });
        }

        // 🔴 添加终点标记 - 使用过滤后的有效点的最后一个点，确保与轨迹线一致
        if (validPoints.length > 1) {
          const endPoint = validPoints[validPoints.length - 1];
          const endTime = endPoint.time 
            ? new Date(endPoint.time).toLocaleString('zh-CN')
            : '终点';
          
          // 使用轨迹线的最后一个点（path[path.length - 1]）来确保标记位置与轨迹线完全一致
          const endMarker = new window.BMap.Marker(path[path.length - 1], {
            title: `终点: ${endTime}`
          });
          map.addOverlay(endMarker);
          console.log('✅ 终点标记已添加，位置:', { lng: endPoint.lng, lat: endPoint.lat });
        }
        
        // 🔴 地图初始化完成，设置为非加载状态
        console.log('✅ 地图和轨迹初始化完成');
        setMapLoading(false);
      } catch (error) {
        console.error('❌ 地图初始化失败:', error);
        setMapError(`地图初始化失败: ${error instanceof Error ? error.message : String(error)}`);
        console.log('❌ 设置 mapLoading = false (错误情况)');
        setMapLoading(false);
      }
    }

    // 清理函数
    return () => {
      console.log('🧹 VehicleTrackingMap 清理函数执行');
      // 🔴 使用闭包中保存的 container 变量
      if (mapInstanceRef.current) {
        // 清理地图实例
        console.log('🧹 清理地图实例');
        if (container) {
          container.innerHTML = '';
        }
        mapInstanceRef.current = null;
      }
      // 重置脚本加载状态
      scriptLoadingRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackingData, licensePlate]);

  // 🔴 渲染前打印状态
  console.log('🎨 VehicleTrackingMap 准备渲染');
  console.log('🎨 loading:', loading);
  console.log('🎨 mapLoading:', mapLoading);
  console.log('🎨 mapError:', mapError);
  console.log('🎨 mapContainerRef.current:', mapContainerRef.current);

  // 🔴 关键修复：地图容器必须始终渲染，否则 useEffect 中无法访问
  // 使用遮罩层显示加载状态和错误状态，而不是隐藏容器
  return (
    <Card>
      <CardContent className="p-0">
        <div className="relative w-full h-96 rounded-lg overflow-hidden" style={{ minHeight: '400px' }}>
          {/* 地图容器 - 始终渲染 */}
          <div 
            ref={mapContainerRef} 
            className="w-full h-full"
            style={{ minHeight: '400px' }}
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

