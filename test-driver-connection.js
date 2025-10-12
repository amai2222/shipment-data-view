// 测试司机数据连接脚本
import { supabase } from './src/integrations/supabase/client.js';

async function testDriverConnection() {
  console.log('🔍 开始测试司机数据连接...');
  
  try {
    // 1. 测试基本连接
    console.log('1. 测试Supabase连接...');
    const { data: connectionTest, error: connectionError } = await supabase
      .from('drivers')
      .select('count', { count: 'exact', head: true });
    
    if (connectionError) {
      console.error('❌ 连接失败:', connectionError);
      return;
    }
    
    console.log('✅ 连接成功，司机总数:', connectionTest);
    
    // 2. 测试RPC函数
    console.log('2. 测试get_drivers_paginated RPC函数...');
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_drivers_paginated', {
      p_page_number: 1,
      p_page_size: 5,
      p_search_text: ''
    });
    
    if (rpcError) {
      console.error('❌ RPC函数调用失败:', rpcError);
      console.error('错误详情:', {
        code: rpcError.code,
        message: rpcError.message,
        details: rpcError.details,
        hint: rpcError.hint
      });
      return;
    }
    
    console.log('✅ RPC函数调用成功');
    console.log('返回数据:', rpcData);
    
    // 3. 测试直接查询
    console.log('3. 测试直接查询drivers表...');
    const { data: directData, error: directError } = await supabase
      .from('drivers')
      .select('id, name, license_plate, phone, created_at')
      .limit(5);
    
    if (directError) {
      console.error('❌ 直接查询失败:', directError);
      return;
    }
    
    console.log('✅ 直接查询成功');
    console.log('司机数据:', directData);
    
    // 4. 测试项目关联
    console.log('4. 测试司机项目关联...');
    const { data: projectData, error: projectError } = await supabase
      .from('driver_projects')
      .select('driver_id, project_id')
      .limit(5);
    
    if (projectError) {
      console.error('❌ 项目关联查询失败:', projectError);
    } else {
      console.log('✅ 项目关联查询成功');
      console.log('关联数据:', projectData);
    }
    
    console.log('🎉 所有测试完成！');
    
  } catch (error) {
    console.error('💥 测试过程中发生错误:', error);
  }
}

// 运行测试
testDriverConnection();
