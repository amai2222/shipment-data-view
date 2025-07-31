// FILE: /src/integrations/supabase/api.ts

import { supabase } from './client';
import { BusinessData, BusinessDataInsert } from '@/types';

// 定义 getBusinessData 的参数类型
interface GetBusinessDataParams {
  from: string;
  to: string;
  projectIds?: string[];
  driverIds?: string[];
  loadingLocationIds?: string[];
  unloadingLocationIds?: string[];
}

/**
 * 获取业务数据，并关联 projects, drivers, locations 表
 * 支持复合筛选
 */
export const getBusinessData = async (params: GetBusinessDataParams): Promise<BusinessData[]> => {
  const { from, to, projectIds, driverIds, loadingLocationIds, unloadingLocationIds } = params;

  // 基础查询，关联了所有需要的表
  let query = supabase
    .from('business_entries')
    .select(`
      id,
      date,
      projects (id, name),
      drivers (id, name),
      loading_locations:locations!business_entries_loading_location_id_fkey (id, name),
      unloading_locations:locations!business_entries_unloading_location_id_fkey (id, name),
      goods_name,
      freight_cost,
      unit_price
    `)
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: false });

  // 动态添加筛选条件
  if (projectIds && projectIds.length > 0) {
    query = query.in('project_id', projectIds);
  }
  if (driverIds && driverIds.length > 0) {
    query = query.in('driver_id', driverIds);
  }
  if (loadingLocationIds && loadingLocationIds.length > 0) {
    query = query.in('loading_location_id', loadingLocationIds);
  }
  if (unloadingLocationIds && unloadingLocationIds.length > 0) {
    query = query.in('unloading_location_id', unloadingLocationIds);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching business data:', error);
    throw error;
  }

  // 格式化返回的数据以匹配 BusinessData 类型
  return data.map(item => ({
    id: item.id,
    date: item.date,
    projects_id: item.projects.id,
    projects_name: item.projects.name,
    drivers_id: item.drivers.id,
    drivers_name: item.drivers.name,
    loading_location_id: item.loading_locations.id,
    loading_location_name: item.loading_locations.name,
    unloading_location_id: item.unloading_locations.id,
    unloading_location_name: item.unloading_locations.name,
    goods_name: item.goods_name,
    freight_cost: item.freight_cost,
    unit_price: item.unit_price,
  }));
};


/**
 * 插入或更新业务数据
 */
export const upsertBusinessEntry = async (entry: BusinessDataInsert) => {
  const { data, error } = await supabase.from('business_entries').upsert(entry).select();
  if (error) throw error;
  return data;
};

/**
 * 删除业务数据
 */
export const deleteBusinessEntry = async (id: string) => {
  const { data, error } = await supabase.from('business_entries').delete().eq('id', id);
  if (error) throw error;
  return data;
};
