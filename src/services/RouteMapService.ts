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
              
              // 添加货车路线规划
              AMap.plugin('AMap.TruckDriving', function() {
                const truckDriving = new AMap.TruckDriving({
                  map: map,
                  hideMarkers: true,
                  autoFitView: false,
                  // 货车参数配置
                  size: 2,  // 货车大小：1-微型，2-轻型，3-中型，4-重型
                  width: 2.5,  // 车宽（米）
                  height: 3.0, // 车高（米）
                  load: 0.9,   // 核定载重（吨）
                  weight: 5.0, // 总重（吨）
                  axis: 2,     // 轴数
                  policy: 0    // 0-速度优先，1-费用优先，2-距离优先，3-速度优先（不走高速）
                });
                
                truckDriving.search(mapConfig.startCoords, mapConfig.endCoords, function(status, result) {
                  if (status === 'complete') {
                    console.log('路线规划成功', result);
                    
                    // 绘制路线
                    if (result.routes && result.routes.length > 0) {
                      const route = result.routes[0];
                      const path = [];
                      
                      // 获取路线所有坐标点
                      route.steps.forEach(function(step) {
                        const segmentPath = step.path;
                        path.push(...segmentPath);
                      });
                      
                      // 绘制路线折线
                      const polyline = new AMap.Polyline({
                        path: path,
                        strokeColor: '#2563eb',  // 蓝色线条
                        strokeWeight: 6,         // 线条宽度
                        strokeOpacity: 0.8,      // 透明度
                        strokeStyle: 'solid',    // 实线
                        lineJoin: 'round',       // 线条连接处样式
                        lineCap: 'round',        // 线条端点样式
                        zIndex: 50
                      });
                      
                      map.add(polyline);
                      
                      // 添加货车路线信息显示
                      const distance = (route.distance / 1000).toFixed(1); // 转换为公里
                      const duration = Math.ceil(route.time / 60); // 转换为分钟
                      const tolls = route.tolls ? '¥' + route.tolls : '暂无'; // 过路费
                      const tollDistance = route.toll_distance ? (route.toll_distance / 1000).toFixed(1) + '公里' : '暂无'; // 收费路段
                      
                      let infoContent = '<div style="padding: 10px; font-size: 12px; min-width: 200px;">';
                      infoContent += '<div style="font-weight: bold; margin-bottom: 8px; color: #2563eb;">🚚 货车路线信息</div>';
                      infoContent += '<div style="margin: 4px 0;">📏 距离: ' + distance + ' 公里</div>';
                      infoContent += '<div style="margin: 4px 0;">⏱️ 时长: ' + duration + ' 分钟</div>';
                      infoContent += '<div style="margin: 4px 0;">💰 过路费: ' + tolls + '</div>';
                      infoContent += '<div style="margin: 4px 0;">🛣️ 收费路段: ' + tollDistance + '</div>';
                      
                      // 如果有限行信息
                      if (route.restriction) {
                        infoContent += '<div style="margin-top: 8px; padding: 4px; background: #fef2f2; border-left: 3px solid #ef4444; font-size: 11px;">';
                        infoContent += '⚠️ 限行提示: ' + route.restriction;
                        infoContent += '</div>';
                      }
                      
                      infoContent += '</div>';
                      
                      const infoWindow = new AMap.InfoWindow({
                        content: infoContent,
                        offset: new AMap.Pixel(0, -30)
                      });
                      
                      // 在路线中点显示信息窗口
                      const midIndex = Math.floor(path.length / 2);
                      infoWindow.open(map, path[midIndex]);
                    }
                    
                    // 调整地图视野以包含所有标记和路线
                    map.setFitView([startMarker, endMarker], true, [60, 60, 60, 60]);
                  } else {
                    console.log('路线规划失败，绘制直线连接:', result);
                    
                    // 如果路线规划失败，绘制直线连接
                    const polyline = new AMap.Polyline({
                      path: [mapConfig.startCoords, mapConfig.endCoords],
                      strokeColor: '#10b981',  // 绿色虚线
                      strokeWeight: 4,
                      strokeOpacity: 0.6,
                      strokeStyle: 'dashed',
                      strokeDasharray: [10, 5],
                      zIndex: 50
                    });
                    
                    map.add(polyline);
                    map.setFitView([startMarker, endMarker], true, [60, 60, 60, 60]);
                  }
                });
              });
              
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
