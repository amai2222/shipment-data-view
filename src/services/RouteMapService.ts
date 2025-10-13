import { supabase } from '@/integrations/supabase/client';

export interface MapCoordinates {
  latitude: number;
  longitude: number;
}

export interface RouteInfo {
  startLocation: string;
  endLocation: string;
  startCoords?: MapCoordinates;
  endCoords?: MapCoordinates;
  distance?: number;
  duration?: number;
}

/**
 * 路线地图服务
 * 用于获取地址坐标和规划路线
 */
export class RouteMapService {
  /**
   * 从locations表获取地点坐标（只读取已有数据，不进行地理编码）
   */
  static async getLocationCoordinates(address: string): Promise<MapCoordinates | null> {
    try {
      // 只从locations表读取已编码的数据
      const { data: location, error } = await supabase
        .from('locations')
        .select('latitude, longitude, geocoding_status')
        .eq('name', address)
        .single();

      if (!error && location && location.latitude && location.longitude && location.geocoding_status === 'success') {
        return {
          latitude: location.latitude,
          longitude: location.longitude
        };
      }

      // 如果没有已编码的数据，返回null（不进行地理编码）
      return null;
    } catch (error) {
      console.error('读取地点坐标失败:', error);
      return null;
    }
  }


  /**
   * 获取路线信息
   */
  static async getRouteInfo(startAddress: string, endAddress: string): Promise<RouteInfo> {
    const startCoords = await this.getLocationCoordinates(startAddress);
    const endCoords = await this.getLocationCoordinates(endAddress);

    return {
      startLocation: startAddress,
      endLocation: endAddress,
      startCoords: startCoords || undefined,
      endCoords: endCoords || undefined
    };
  }

  /**
   * 检查是否有完整的地理编码数据
   */
  static hasCompleteGeocodingData(routeInfo: RouteInfo): boolean {
    return !!(routeInfo.startCoords && routeInfo.endCoords);
  }

  /**
   * 获取高德地图API密钥
   */
  static async getAmapApiKey(): Promise<string | null> {
    try {
      const { data, error } = await supabase.functions.invoke('amap-geocoding', {
        body: {
          action: 'get_api_key',
          data: {}
        }
      });

      if (error) {
        console.error('获取API密钥失败:', error);
        return null;
      }

      return data?.apiKey || null;
    } catch (error) {
      console.error('获取API密钥异常:', error);
      return null;
    }
  }

  /**
   * 生成地图HTML（包含坐标信息）
   */
  static generateMapHTML(routeInfo: RouteInfo, apiKey?: string): string {
    const hasCoords = this.hasCompleteGeocodingData(routeInfo);
    
    if (!hasCoords) {
      return `
        <div style="text-align: center; color: #6b7280; padding: 20px;">
          <div style="font-size: 24px; margin-bottom: 10px;">🗺️</div>
          <div>运输路线: ${routeInfo.startLocation} → ${routeInfo.endLocation}</div>
          <div style="font-size: 12px; margin-top: 5px; color: #9ca3af;">地点坐标未获取，无法显示地图轨迹</div>
        </div>
      `;
    }

    const startLng = routeInfo.startCoords!.longitude;
    const startLat = routeInfo.startCoords!.latitude;
    const endLng = routeInfo.endCoords!.longitude;
    const endLat = routeInfo.endCoords!.latitude;

    return `
      <div id="route-map" style="width: 100%; height: 300px; border: 1px solid #d1d5db; border-radius: 8px; background: #f9fafb;">
        <div style="text-align: center; color: #6b7280; padding: 20px;">
          <div style="font-size: 24px; margin-bottom: 10px;">🗺️</div>
          <div>运输路线: ${routeInfo.startLocation} → ${routeInfo.endLocation}</div>
          <div style="font-size: 12px; margin-top: 5px;">地图加载中...</div>
        </div>
      </div>
      
      <script>
        (function() {
          const mapContainer = document.getElementById('route-map');
          if (!mapContainer) return;
          
          // 地图配置
          const mapConfig = {
            startCoords: [${startLng}, ${startLat}],
            endCoords: [${endLng}, ${endLat}],
            startLocation: '${routeInfo.startLocation}',
            endLocation: '${routeInfo.endLocation}'
          };
          
          // 动态加载高德地图API
          const script = document.createElement('script');
          script.src = 'https://webapi.amap.com/maps?v=2.0&key=${apiKey || 'YOUR_AMAP_KEY'}';
          script.onload = function() {
            try {
              // 初始化地图
              const map = new AMap.Map('route-map', {
                zoom: 10,
                center: mapConfig.startCoords,
                mapStyle: 'amap://styles/normal'
              });
              
              // 添加起点标记
              const startMarker = new AMap.Marker({
                position: mapConfig.startCoords,
                title: '起点: ' + mapConfig.startLocation,
                icon: new AMap.Icon({
                  size: new AMap.Size(32, 32),
                  image: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iMTIiIGZpbGw9IiM0Q0FGNTUiLz4KPHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4PSI4IiB5PSI4Ij4KPHBhdGggZD0iTTggMkM5LjEgMiAxMCAyLjkgMTAgNFYxMkMxMCAxMy4xIDkuMSAxNCA4IDE0QzYuOSAxNCA2IDEzLjEgNiAxMlY0QzYgMi45IDYuOSAyIDggMloiIGZpbGw9IndoaXRlIi8+Cjwvc3ZnPgo8L3N2Zz4K'
                })
              });
              
              // 添加终点标记
              const endMarker = new AMap.Marker({
                position: mapConfig.endCoords,
                title: '终点: ' + mapConfig.endLocation,
                icon: new AMap.Icon({
                  size: new AMap.Size(32, 32),
                  image: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iMTIiIGZpbGw9IiNFRjQ0NDQiLz4KPHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4PSI4IiB5PSI4Ij4KPHBhdGggZD0iTTggMkM5LjEgMiAxMCAyLjkgMTAgNFYxMkMxMCAxMy4xIDkuMSAxNCA4IDE0QzYuOSAxNCA2IDEzLjEgNiAxMlY0QzYgMi45IDYuOSAyIDggMloiIGZpbGw9IndoaXRlIi8+Cjwvc3ZnPgo8L3N2Zz4K'
                })
              });
              
              map.add([startMarker, endMarker]);
              
              // 绘制直线连接
              const polyline = new AMap.Polyline({
                path: [mapConfig.startCoords, mapConfig.endCoords],
                strokeColor: '#2563eb',  // 蓝色线条
                strokeWeight: 4,
                strokeOpacity: 0.8,
                strokeStyle: 'solid',
                lineJoin: 'round',
                lineCap: 'round',
                zIndex: 50
              });
              
              map.add(polyline);
              
              // 计算直线距离
              const distance = AMap.GeometryUtil.distance(mapConfig.startCoords, mapConfig.endCoords);
              const distanceKm = (distance / 1000).toFixed(1);
              
              // 显示距离信息
              const infoWindow = new AMap.InfoWindow({
                content: '<div style="padding: 8px; font-size: 13px; font-weight: 500;">距离: ' + distanceKm + ' 公里</div>',
                offset: new AMap.Pixel(0, -30)
              });
              
              // 在线路中点显示距离
              const midLng = (mapConfig.startCoords[0] + mapConfig.endCoords[0]) / 2;
              const midLat = (mapConfig.startCoords[1] + mapConfig.endCoords[1]) / 2;
              infoWindow.open(map, [midLng, midLat]);
              
              // 调整地图视野
              map.setFitView([startMarker, endMarker], true, [60, 60, 60, 60]);
              
            } catch (error) {
              console.error('地图初始化失败:', error);
              mapContainer.innerHTML = '<div style="text-align: center; color: #6b7280; padding: 20px;"><div style="font-size: 24px; margin-bottom: 10px;">🗺️</div><div>地图加载失败</div><div style="font-size: 12px; margin-top: 5px;">请检查网络连接</div></div>';
            }
          };
          
          script.onerror = function() {
            console.error('高德地图API加载失败');
            mapContainer.innerHTML = '<div style="text-align: center; color: #6b7280; padding: 20px;"><div style="font-size: 24px; margin-bottom: 10px;">🗺️</div><div>地图加载失败</div><div style="font-size: 12px; margin-top: 5px;">请检查网络连接</div></div>';
          };
          
          document.head.appendChild(script);
        })();
      </script>
    `;
  }
}
