/**
 * 高德地图地理编码 Edge Function
 * 安全地调用高德地图API进行地理编码
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// CORS配置 - 直接定义在文件中
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

interface GeocodingRequest {
  address: string;
  city?: string;
  batch?: boolean;
}

interface GeocodingResponse {
  status: string;
  info: string;
  infocode: string;
  count: string;
  geocodes: Geocode[];
}

interface Geocode {
  formatted_address: string;
  country: string;
  province: string;
  city: string;
  district: string;
  township: string;
  neighborhood: {
    name: string;
    type: string;
  };
  building: {
    name: string;
    type: string;
  };
  adcode: string;
  citycode: string;
  street: string;
  number: string;
  location: string;
  level: string;
}

interface LocationGeocodingData {
  id: string;
  name: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  formatted_address?: string;
  province?: string;
  city?: string;
  district?: string;
  township?: string;
  street?: string;
  street_number?: string;
  adcode?: string;
  citycode?: string;
  geocoding_status: 'pending' | 'success' | 'failed' | 'retry';
  geocoding_error?: string;
}

serve(async (req) => {
  // 处理CORS预检请求
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 验证请求方法
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { 
          status: 405, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // 获取请求数据
    const { action, data } = await req.json();

    // 初始化Supabase客户端
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // 验证用户认证
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // 获取高德地图API密钥
    const amapKey = Deno.env.get('AMAP_API_KEY');
    if (!amapKey) {
      return new Response(
        JSON.stringify({ error: 'AMAP_API_KEY not configured' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // 处理不同的操作
    switch (action) {
      case 'geocode':
        return await handleGeocode(amapKey, data);
      
      case 'batch_geocode':
        return await handleBatchGeocode(amapKey, data);
      
      case 'smart_geocode':
        return await handleSmartGeocode(amapKey, data);
      
      case 'update_location_geocoding':
        return await handleUpdateLocationGeocoding(supabaseClient, data);
      
      case 'batch_update_geocoding':
        return await handleBatchUpdateGeocoding(supabaseClient, data);
      
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
    }

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

/**
 * 处理单个地理编码请求
 */
async function handleGeocode(amapKey: string, request: GeocodingRequest): Promise<Response> {
  try {
    const params = new URLSearchParams({
      key: amapKey,
      address: request.address,
      output: 'JSON',
      ...(request.city && { city: request.city }),
      ...(request.batch && { batch: request.batch.toString() })
    });

    const url = `https://restapi.amap.com/v3/geocode/geo?${params}`;
    const response = await fetch(url);
    const data: GeocodingResponse = await response.json();

    if (data.status !== '1') {
      throw new Error(`地理编码失败: ${data.info}`);
    }

    return new Response(
      JSON.stringify({ success: true, data }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
}

/**
 * 处理批量地理编码请求
 */
async function handleBatchGeocode(amapKey: string, addresses: string[]): Promise<Response> {
  try {
    const results = [];
    
    // 限制并发数量，避免API限制
    const batchSize = 5;
    for (let i = 0; i < addresses.length; i += batchSize) {
      const batch = addresses.slice(i, i + batchSize);
      const batchPromises = batch.map(async (address) => {
        try {
          const response = await handleGeocode(amapKey, { address });
          const result = await response.json();
          return { address, ...result };
        } catch (error) {
          return { address, success: false, error: error.message };
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults as any[]);
      
      // 添加延迟避免API限制
      if (i + batchSize < addresses.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
}

/**
 * 处理智能地理编码请求
 */
async function handleSmartGeocode(amapKey: string, request: { address: string; city?: string }): Promise<Response> {
  try {
    const { address, city } = request;
    
    // 预处理地址
    const processedAddress = preprocessAddress(address);
    
    // 尝试多种策略
    const strategies = [
      // 策略1: 直接编码
      () => geocodeWithStrategy(amapKey, processedAddress, city),
      
      // 策略2: 提取城市后编码
      () => {
        const extractedCity = extractCityFromAddress(processedAddress);
        return geocodeWithStrategy(amapKey, removeCityFromAddress(processedAddress), extractedCity || city);
      },
      
      // 策略3: 模糊匹配（去掉详细地址）
      () => {
        const simplifiedAddress = simplifyAddress(processedAddress);
        return geocodeWithStrategy(amapKey, simplifiedAddress, city);
      },
      
      // 策略4: 只使用主要地名
      () => {
        const mainLocation = extractMainLocation(processedAddress);
        return geocodeWithStrategy(amapKey, mainLocation, city);
      }
    ];

    let lastError: Error | null = null;
    
    for (const strategy of strategies) {
      try {
        const result = await strategy();
        
        // 检查结果质量
        if (isValidGeocodingResult(result)) {
          return new Response(
            JSON.stringify({ success: true, data: result }),
            { 
              status: 200, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }
      } catch (error) {
        lastError = error as Error;
        console.warn('地理编码策略失败:', error);
      }
    }
    
    throw lastError || new Error('所有地理编码策略都失败了');
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
}

/**
 * 更新地点地理编码信息
 */
async function handleUpdateLocationGeocoding(supabaseClient: any, data: LocationGeocodingData): Promise<Response> {
  try {
    const { error } = await supabaseClient
      .from('locations')
      .update({
        address: data.address,
        latitude: data.latitude,
        longitude: data.longitude,
        formatted_address: data.formatted_address,
        province: data.province,
        city: data.city,
        district: data.district,
        township: data.township,
        street: data.street,
        street_number: data.street_number,
        adcode: data.adcode,
        citycode: data.citycode,
        geocoding_status: data.geocoding_status,
        geocoding_updated_at: new Date().toISOString(),
        geocoding_error: data.geocoding_error
      })
      .eq('id', data.id);

    if (error) {
      throw new Error(`更新地理编码信息失败: ${error.message}`);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
}

/**
 * 批量更新地点地理编码信息
 */
async function handleBatchUpdateGeocoding(supabaseClient: any, locations: LocationGeocodingData[]): Promise<Response> {
  try {
    const { data: result, error } = await supabaseClient
      .rpc('batch_update_location_geocoding', { 
        p_locations: JSON.stringify(locations) 
      });

    if (error) {
      throw new Error(`批量更新地理编码失败: ${error.message}`);
    }

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
}

/**
 * 预处理地址，清理特殊字符和格式
 */
function preprocessAddress(address: string): string {
  if (!address) return '';
  
  // 移除多余的空白字符
  let cleaned = address.trim().replace(/\s+/g, ' ');
  
  // 移除特殊字符（保留中文、英文、数字、常用标点）
  cleaned = cleaned.replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s\-|]/g, '');
  
  // 限制长度（高德地图API建议不超过100字符）
  if (cleaned.length > 100) {
    cleaned = cleaned.substring(0, 100);
  }
  
  return cleaned;
}

/**
 * 使用指定策略进行地理编码
 */
async function geocodeWithStrategy(amapKey: string, address: string, city?: string): Promise<GeocodingResponse> {
  // 预处理地址
  const cleanedAddress = preprocessAddress(address);
  
  const params = new URLSearchParams({
    key: amapKey,
    address: cleanedAddress,
    output: 'JSON',
    ...(city && { city })
  });

  const url = `https://restapi.amap.com/v3/geocode/geo?${params}`;
  const response = await fetch(url);
  const data: GeocodingResponse = await response.json();

  if (data.status !== '1') {
    console.error(`高德地图API错误 - 地址: ${address}, 状态: ${data.status}, 信息: ${data.info}`);
    throw new Error(`地理编码失败: ${data.info} (状态码: ${data.status})`);
  }

  return data;
}

/**
 * 从地址中提取城市信息
 */
function extractCityFromAddress(address: string): string | null {
  const cityPatterns = [
    /([^省]+省)?([^市]+市)/,
    /([^自治区]+自治区)?([^市]+市)/,
    /([^特别行政区]+特别行政区)/,
    /([^州]+州)/,
    /([^县]+县)/
  ];
  
  for (const pattern of cityPatterns) {
    const match = address.match(pattern);
    if (match) {
      return match[0];
    }
  }
  
  return null;
}

/**
 * 从地址中移除城市信息
 */
function removeCityFromAddress(address: string): string {
  const cityPatterns = [
    /([^省]+省)?([^市]+市)/,
    /([^自治区]+自治区)?([^市]+市)/,
    /([^特别行政区]+特别行政区)/,
    /([^州]+州)/,
    /([^县]+县)/
  ];
  
  let result = address;
  for (const pattern of cityPatterns) {
    result = result.replace(pattern, '');
  }
  
  return result.trim();
}

/**
 * 简化地址 - 保留主要地理信息
 */
function simplifyAddress(address: string): string {
  const patterns = [
    /\d+号/, // 门牌号
    /\d+弄/, // 弄号
    /\d+幢/, // 幢号
    /\d+单元/, // 单元
    /\d+室/, // 室号
    /[A-Z]\d+/, // 字母数字组合
    /\d+层/, // 楼层
    /地下\d+/, // 地下层
  ];
  
  let result = address;
  patterns.forEach(pattern => {
    result = result.replace(pattern, '');
  });
  
  return result.trim();
}

/**
 * 提取主要地点信息
 */
function extractMainLocation(address: string): string {
  const provinceMatch = address.match(/([^省]+省)/);
  const cityMatch = address.match(/([^市]+市)/);
  const districtMatch = address.match(/([^区县]+[区县])/);
  
  const parts: string[] = [];
  if (provinceMatch) parts.push(provinceMatch[1]);
  if (cityMatch) parts.push(cityMatch[1]);
  if (districtMatch) parts.push(districtMatch[1]);
  
  return parts.length > 0 ? parts.join('') : address;
}

/**
 * 验证地理编码结果质量
 */
function isValidGeocodingResult(result: GeocodingResponse): boolean {
  if (!result.geocodes || result.geocodes.length === 0) {
    return false;
  }
  
  const geocode = result.geocodes[0];
  
  // 检查坐标是否有效
  if (!geocode.location) {
    return false;
  }
  
  const [longitude, latitude] = geocode.location.split(',').map(Number);
  if (isNaN(latitude) || isNaN(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return false;
  }
  
  // 检查地址级别（level字段表示精确度）
  const validLevels = ['国家', '省', '市', '区县', '乡镇', '街道', '门牌号'];
  if (geocode.level && !validLevels.includes(geocode.level)) {
    return false;
  }
  
  return true;
}
