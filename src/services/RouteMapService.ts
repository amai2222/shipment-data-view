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
  waypoints?: MapCoordinates[];  // 途径点
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
   * 获取多个地点的坐标
   */
  static async getMultipleLocationsCoordinates(addresses: string): Promise<Array<{name: string, coords: MapCoordinates | null}>> {
    const locations = addresses.split('|').map(addr => addr.trim()).filter(addr => addr.length > 0);
    const results = [];
    
    for (const location of locations) {
      const coords = await this.getLocationCoordinates(location);
      results.push({ name: location, coords });
    }
    
    return results;
  }

  /**
   * 获取路线信息（支持多地点）
   */
  static async getRouteInfo(startAddress: string, endAddress: string): Promise<RouteInfo> {
    // 获取装货地点（可能有多个）
    const loadingLocations = await this.getMultipleLocationsCoordinates(startAddress);
    // 获取卸货地点（可能有多个）
    const unloadingLocations = await this.getMultipleLocationsCoordinates(endAddress);

    // 构建所有地点的坐标序列
    const allLocations = [...loadingLocations, ...unloadingLocations];
    const validLocations = allLocations.filter(loc => loc.coords !== null);

    // 起点和终点
    const startCoords = validLocations.length > 0 ? validLocations[0].coords : undefined;
    const endCoords = validLocations.length > 0 ? validLocations[validLocations.length - 1].coords : undefined;

    return {
      startLocation: loadingLocations.map(l => l.name).join(' | '),
      endLocation: unloadingLocations.map(l => l.name).join(' | '),
      startCoords: startCoords || undefined,
      endCoords: endCoords || undefined,
      waypoints: validLocations.slice(1, -1).map(loc => loc.coords!).filter(Boolean) as MapCoordinates[]
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
            endLocation: '${routeInfo.endLocation}',
            waypoints: ${JSON.stringify((routeInfo.waypoints || []).map(wp => [wp.longitude, wp.latitude]))}
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
              
              const allMarkers = [startMarker, endMarker];
              
              // 添加途径点标记（如果有）
              if (mapConfig.waypoints && mapConfig.waypoints.length > 0) {
                mapConfig.waypoints.forEach(function(waypoint, index) {
                  const waypointMarker = new AMap.Marker({
                    position: waypoint,
                    title: '途径点 ' + (index + 1),
                    icon: new AMap.Icon({
                      size: new AMap.Size(28, 28),
                      image: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjgiIGhlaWdodD0iMjgiIHZpZXdCb3g9IjAgMCAyOCAyOCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTQiIGN5PSIxNCIgcj0iMTAiIGZpbGw9IiNmOTc5MTYiLz4KPHRleHQgeD0iMTQiIHk9IjE4IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSJ3aGl0ZSIgZm9udC1zaXplPSIxMiIgZm9udC13ZWlnaHQ9ImJvbGQiPicgKyAoaW5kZXggKyAxKSArICc8L3RleHQ+Cjwvc3ZnPg=='
                    }),
                    label: {
                      content: (index + 1).toString(),
                      offset: new AMap.Pixel(0, 0),
                      direction: 'center'
                    }
                  });
                  allMarkers.push(waypointMarker);
                });
              }
              
              map.add(allMarkers);
              
              // 生成贝塞尔曲线路径（初始显示）
              const createBezierPath = function(start, end) {
                const midLng = (start[0] + end[0]) / 2;
                const midLat = (start[1] + end[1]) / 2;
                
                // 计算控制点（在中点上方偏移，形成弧线）
                const distance = Math.sqrt(Math.pow(end[0] - start[0], 2) + Math.pow(end[1] - start[1], 2));
                const offset = distance * 0.2; // 偏移量为距离的20%
                
                const controlLat = midLat + offset;
                
                // 生成平滑曲线路径点
                const path = [];
                const steps = 50; // 曲线平滑度
                for (let i = 0; i <= steps; i++) {
                  const t = i / steps;
                  const lng = (1 - t) * (1 - t) * start[0] + 2 * (1 - t) * t * midLng + t * t * end[0];
                  const lat = (1 - t) * (1 - t) * start[1] + 2 * (1 - t) * t * controlLat + t * t * end[1];
                  path.push([lng, lat]);
                }
                return path;
              };
              
              const bezierPath = createBezierPath(mapConfig.startCoords, mapConfig.endCoords);
              
              const directPolyline = new AMap.Polyline({
                path: bezierPath,
                strokeColor: '#2563eb',
                strokeWeight: 4,
                strokeOpacity: 0.6,
                strokeStyle: 'dashed',
                strokeDasharray: [10, 5],
                zIndex: 40
              });
              
              map.add(directPolyline);
              
              // 计算并显示直线距离
              const directDistance = AMap.GeometryUtil.distance(mapConfig.startCoords, mapConfig.endCoords);
              const directDistanceKm = (directDistance / 1000).toFixed(1);
              
              const distanceLabel = new AMap.Text({
                text: directDistanceKm + ' 公里',
                anchor: 'top-right',
                position: map.getBounds().getNorthEast(),
                offset: new AMap.Pixel(-20, 20),
                style: {
                  'background-color': 'rgba(37, 99, 235, 0.9)',
                  'border': 'none',
                  'border-radius': '6px',
                  'color': '#fff',
                  'font-size': '14px',
                  'font-weight': 'bold',
                  'padding': '8px 16px',
                  'box-shadow': '0 2px 8px rgba(0,0,0,0.15)'
                }
              });
              
              map.add(distanceLabel);
              map.setFitView([startMarker, endMarker], true, [80, 80, 80, 80]);
              
              // 后台尝试获取驾车路线（带超时）
              let routeCompleted = false;
              const timeoutId = setTimeout(function() {
                if (!routeCompleted) {
                  console.log('驾车路线规划超时，使用曲线显示');
                  directPolyline.setOptions({
                    strokeStyle: 'solid',
                    strokeOpacity: 0.8,
                    strokeWeight: 5
                  });
                }
              }, 2000); // 2秒超时
              
              AMap.plugin('AMap.Driving', function() {
                const driving = new AMap.Driving({
                  map: map,
                  hideMarkers: true,
                  autoFitView: false,
                  policy: AMap.DrivingPolicy.LEAST_TIME  // 最少时间
                });
                
                // 路线规划（支持途径点）
                if (mapConfig.waypoints && mapConfig.waypoints.length > 0) {
                  // 有途径点的情况
                  driving.search(mapConfig.startCoords, mapConfig.endCoords, { waypoints: mapConfig.waypoints }, function(status, result) {
                    clearTimeout(timeoutId);
                    routeCompleted = true;
                    
                    if (status === 'complete' && result.routes && result.routes.length > 0) {
                      console.log('多点路线规划成功', result);
                      
                      map.remove(directPolyline);
                      
                      const route = result.routes[0];
                      const path = [];
                      
                      route.steps.forEach(function(step) {
                        path.push(...step.path);
                      });
                      
                      const polyline = new AMap.Polyline({
                        path: path,
                        strokeColor: '#2563eb',
                        strokeWeight: 5,
                        strokeOpacity: 0.8,
                        strokeStyle: 'solid',
                        lineJoin: 'round',
                        lineCap: 'round',
                        zIndex: 50
                      });
                      
                      map.add(polyline);
                      
                      const routeDistanceKm = (route.distance / 1000).toFixed(1);
                      distanceLabel.setText(routeDistanceKm + ' 公里');
                    } else {
                      console.log('多点路线规划失败，使用曲线显示:', status, result);
                      // 失败时将虚线改为实线曲线
                      directPolyline.setOptions({ 
                        strokeStyle: 'solid', 
                        strokeOpacity: 0.8,
                        strokeWeight: 5
                      });
                    }
                  });
                } else {
                  // 没有途径点，只有起点和终点
                  driving.search(mapConfig.startCoords, mapConfig.endCoords, function(status, result) {
                    clearTimeout(timeoutId);
                    routeCompleted = true;
                    
                    if (status === 'complete' && result.routes && result.routes.length > 0) {
                      console.log('两点路线规划成功', result);
                      
                      map.remove(directPolyline);
                      
                      const route = result.routes[0];
                      const path = [];
                      
                      route.steps.forEach(function(step) {
                        path.push(...step.path);
                      });
                      
                      const polyline = new AMap.Polyline({
                        path: path,
                        strokeColor: '#2563eb',
                        strokeWeight: 5,
                        strokeOpacity: 0.8,
                        strokeStyle: 'solid',
                        lineJoin: 'round',
                        lineCap: 'round',
                        zIndex: 50
                      });
                      
                      map.add(polyline);
                      
                      const routeDistanceKm = (route.distance / 1000).toFixed(1);
                      distanceLabel.setText(routeDistanceKm + ' 公里');
                    } else {
                      console.log('两点路线规划失败，使用曲线显示:', status, result);
                      // 失败时将虚线改为实线曲线
                      directPolyline.setOptions({ 
                        strokeStyle: 'solid', 
                        strokeOpacity: 0.8,
                        strokeWeight: 5
                      });
                    }
                  });
                }
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
