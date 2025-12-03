/**
 * 坐标系统转换工具
 * 支持 WGS-84、GCJ-02、BD-09 坐标系之间的转换
 */

/**
 * WGS-84 坐标系（GPS原始坐标系）
 * BD-09 坐标系（百度地图坐标系）
 */

/**
 * 将 WGS-84 坐标转换为 BD-09 坐标
 * 参考算法：WGS84 -> GCJ-02 -> BD-09
 * 
 * @param wgsLat WGS-84 纬度
 * @param wgsLng WGS-84 经度
 * @returns BD-09 坐标 {lat, lng}
 */
export function wgs84ToBd09(wgsLat: number, wgsLng: number): { lat: number; lng: number } {
  // 先转换为 GCJ-02（火星坐标系）
  const gcj = wgs84ToGcj02(wgsLat, wgsLng);
  
  // 再从 GCJ-02 转换为 BD-09（百度坐标系）
  return gcj02ToBd09(gcj.lat, gcj.lng);
}

/**
 * 将 BD-09 坐标转换为 WGS-84 坐标
 * 
 * @param bdLat BD-09 纬度
 * @param bdLng BD-09 经度
 * @returns WGS-84 坐标 {lat, lng}
 */
export function bd09ToWgs84(bdLat: number, bdLng: number): { lat: number; lng: number } {
  // 先转换为 GCJ-02
  const gcj = bd09ToGcj02(bdLat, bdLng);
  
  // 再从 GCJ-02 转换为 WGS-84
  return gcj02ToWgs84(gcj.lat, gcj.lng);
}

/**
 * 将 WGS-84 坐标转换为 GCJ-02 坐标（火星坐标系）
 * 
 * @param wgsLat WGS-84 纬度
 * @param wgsLng WGS-84 经度
 * @returns GCJ-02 坐标 {lat, lng}
 */
function wgs84ToGcj02(wgsLat: number, wgsLng: number): { lat: number; lng: number } {
  if (outOfChina(wgsLat, wgsLng)) {
    return { lat: wgsLat, lng: wgsLng };
  }

  let dLat = transformLat(wgsLng - 105.0, wgsLat - 35.0);
  let dLng = transformLng(wgsLng - 105.0, wgsLat - 35.0);
  const radLat = (wgsLat / 180.0) * Math.PI;
  let magic = Math.sin(radLat);
  magic = 1 - 0.00669342162296594323 * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180.0) / ((6378245.0 * (1 - 0.00669342162296594323)) / (magic * sqrtMagic) * Math.PI);
  dLng = (dLng * 180.0) / (6378245.0 / sqrtMagic * Math.cos(radLat) * Math.PI);
  const mgLat = wgsLat + dLat;
  const mgLng = wgsLng + dLng;

  return { lat: mgLat, lng: mgLng };
}

/**
 * 将 GCJ-02 坐标转换为 BD-09 坐标（百度坐标系）
 * 
 * @param gcjLat GCJ-02 纬度
 * @param gcjLng GCJ-02 经度
 * @returns BD-09 坐标 {lat, lng}
 */
function gcj02ToBd09(gcjLat: number, gcjLng: number): { lat: number; lng: number } {
  const z = Math.sqrt(gcjLng * gcjLng + gcjLat * gcjLat) + 0.00002 * Math.sin(gcjLat * Math.PI * 3000.0 / 180.0);
  const theta = Math.atan2(gcjLat, gcjLng) + 0.000003 * Math.cos(gcjLng * Math.PI * 3000.0 / 180.0);
  const bdLng = z * Math.cos(theta) + 0.0065;
  const bdLat = z * Math.sin(theta) + 0.006;

  return { lat: bdLat, lng: bdLng };
}

/**
 * 将 BD-09 坐标转换为 GCJ-02 坐标
 * 
 * @param bdLat BD-09 纬度
 * @param bdLng BD-09 经度
 * @returns GCJ-02 坐标 {lat, lng}
 */
function bd09ToGcj02(bdLat: number, bdLng: number): { lat: number; lng: number } {
  const x = bdLng - 0.0065;
  const y = bdLat - 0.006;
  const z = Math.sqrt(x * x + y * y) - 0.00002 * Math.sin(y * Math.PI * 3000.0 / 180.0);
  const theta = Math.atan2(y, x) - 0.000003 * Math.cos(x * Math.PI * 3000.0 / 180.0);
  const gcjLng = z * Math.cos(theta);
  const gcjLat = z * Math.sin(theta);

  return { lat: gcjLat, lng: gcjLng };
}

/**
 * 将 GCJ-02 坐标转换为 WGS-84 坐标（反向转换）
 * 
 * @param gcjLat GCJ-02 纬度
 * @param gcjLng GCJ-02 经度
 * @returns WGS-84 坐标 {lat, lng}
 */
function gcj02ToWgs84(gcjLat: number, gcjLng: number): { lat: number; lng: number } {
  if (outOfChina(gcjLat, gcjLng)) {
    return { lat: gcjLat, lng: gcjLng };
  }

  let dLat = transformLat(gcjLng - 105.0, gcjLat - 35.0);
  let dLng = transformLng(gcjLng - 105.0, gcjLat - 35.0);
  const radLat = (gcjLat / 180.0) * Math.PI;
  let magic = Math.sin(radLat);
  magic = 1 - 0.00669342162296594323 * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180.0) / ((6378245.0 * (1 - 0.00669342162296594323)) / (magic * sqrtMagic) * Math.PI);
  dLng = (dLng * 180.0) / (6378245.0 / sqrtMagic * Math.cos(radLat) * Math.PI);
  
  // 反向计算
  const wgsLat = gcjLat - dLat;
  const wgsLng = gcjLng - dLng;

  return { lat: wgsLat, lng: wgsLng };
}

/**
 * 判断坐标是否在中国以外
 */
function outOfChina(lat: number, lng: number): boolean {
  return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;
}

/**
 * 纬度转换
 */
function transformLat(lng: number, lat: number): number {
  let ret = -100.0 + 2.0 * lng + 3.0 * lat + 0.2 * lat * lat + 0.1 * lng * lat + 0.2 * Math.sqrt(Math.abs(lng));
  ret += ((20.0 * Math.sin(6.0 * lng * Math.PI) + 20.0 * Math.sin(2.0 * lng * Math.PI)) * 2.0) / 3.0;
  ret += ((20.0 * Math.sin(lat * Math.PI) + 40.0 * Math.sin(lat / 3.0 * Math.PI)) * 2.0) / 3.0;
  ret += ((160.0 * Math.sin(lat / 12.0 * Math.PI) + 320 * Math.sin(lat * Math.PI / 30.0)) * 2.0) / 3.0;
  return ret;
}

/**
 * 经度转换
 */
function transformLng(lng: number, lat: number): number {
  let ret = 300.0 + lng + 2.0 * lat + 0.1 * lng * lng + 0.1 * lng * lat + 0.1 * Math.sqrt(Math.abs(lng));
  ret += ((20.0 * Math.sin(6.0 * lng * Math.PI) + 20.0 * Math.sin(2.0 * lng * Math.PI)) * 2.0) / 3.0;
  ret += ((20.0 * Math.sin(lng * Math.PI) + 40.0 * Math.sin(lng / 3.0 * Math.PI)) * 2.0) / 3.0;
  ret += ((150.0 * Math.sin(lng / 12.0 * Math.PI) + 300.0 * Math.sin(lng / 30.0 * Math.PI)) * 2.0) / 3.0;
  return ret;
}

/**
 * 批量转换 WGS-84 坐标数组到 BD-09 坐标数组
 * 
 * @param points 轨迹点数组
 * @returns 转换后的轨迹点数组
 */
export function convertPointsWgs84ToBd09(
  points: Array<{ lat: number; lng: number; [key: string]: unknown }>
): Array<{ lat: number; lng: number; [key: string]: unknown }> {
  return points.map(point => {
    const converted = wgs84ToBd09(point.lat, point.lng);
    return {
      ...point,
      lat: converted.lat,
      lng: converted.lng
    };
  });
}

