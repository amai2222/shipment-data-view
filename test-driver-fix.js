// 司机数据加载问题测试和验证脚本
// 文件: test-driver-fix.js

import { supabase } from './src/integrations/supabase/client.js';

async function testDriverFix() {
  console.log('🔍 开始测试司机数据修复...');
  
  const results = {
    connection: false,
    rpcFunction: false,
    directQuery: false,
    projectAssociation: false,
    errorDetails: []
  };
  
  try {
    // 1. 测试基本连接
    console.log('1. 测试Supabase连接...');
    const { data: connectionTest, error: connectionError } = await supabase
      .from('drivers')
      .select('count', { count: 'exact', head: true });
    
    if (connectionError) {
      console.error('❌ 连接失败:', connectionError);
      results.errorDetails.push(`连接失败: ${connectionError.message}`);
    } else {
      console.log('✅ 连接成功，司机总数:', connectionTest);
      results.connection = true;
    }
    
    // 2. 测试RPC函数
    console.log('2. 测试get_drivers_paginated RPC函数...');
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_drivers_paginated', {
      p_page_number: 1,
      p_page_size: 5,
      p_search_text: ''
    });
    
    if (rpcError) {
      console.error('❌ RPC函数调用失败:', rpcError);
      results.errorDetails.push(`RPC函数失败: ${rpcError.message}`);
    } else {
      console.log('✅ RPC函数调用成功');
      console.log('返回数据:', rpcData);
      results.rpcFunction = true;
    }
    
    // 3. 测试直接查询
    console.log('3. 测试直接查询drivers表...');
    const { data: directData, error: directError } = await supabase
      .from('drivers')
      .select('id, name, license_plate, phone, created_at')
      .limit(5);
    
    if (directError) {
      console.error('❌ 直接查询失败:', directError);
      results.errorDetails.push(`直接查询失败: ${directError.message}`);
    } else {
      console.log('✅ 直接查询成功');
      console.log('司机数据:', directData);
      results.directQuery = true;
    }
    
    // 4. 测试项目关联
    console.log('4. 测试司机项目关联...');
    const { data: projectData, error: projectError } = await supabase
      .from('driver_projects')
      .select('driver_id, project_id')
      .limit(5);
    
    if (projectError) {
      console.error('❌ 项目关联查询失败:', projectError);
      results.errorDetails.push(`项目关联失败: ${projectError.message}`);
    } else {
      console.log('✅ 项目关联查询成功');
      console.log('关联数据:', projectData);
      results.projectAssociation = true;
    }
    
    // 5. 测试搜索功能
    console.log('5. 测试搜索功能...');
    const { data: searchData, error: searchError } = await supabase.rpc('get_drivers_paginated', {
      p_page_number: 1,
      p_page_size: 10,
      p_search_text: 'test'
    });
    
    if (searchError) {
      console.error('❌ 搜索功能失败:', searchError);
      results.errorDetails.push(`搜索功能失败: ${searchError.message}`);
    } else {
      console.log('✅ 搜索功能正常');
    }
    
    // 6. 生成测试报告
    console.log('\n📊 测试报告:');
    console.log('='.repeat(50));
    console.log(`连接状态: ${results.connection ? '✅ 正常' : '❌ 失败'}`);
    console.log(`RPC函数: ${results.rpcFunction ? '✅ 正常' : '❌ 失败'}`);
    console.log(`直接查询: ${results.directQuery ? '✅ 正常' : '❌ 失败'}`);
    console.log(`项目关联: ${results.projectAssociation ? '✅ 正常' : '❌ 失败'}`);
    
    if (results.errorDetails.length > 0) {
      console.log('\n❌ 错误详情:');
      results.errorDetails.forEach((error, index) => {
        console.log(`${index + 1}. ${error}`);
      });
    }
    
    const allPassed = results.connection && results.rpcFunction && results.directQuery;
    console.log(`\n🎯 总体状态: ${allPassed ? '✅ 修复成功' : '❌ 需要进一步修复'}`);
    
    return results;
    
  } catch (error) {
    console.error('💥 测试过程中发生错误:', error);
    results.errorDetails.push(`测试过程错误: ${error.message}`);
    return results;
  }
}

// 运行测试
testDriverFix().then(results => {
  if (typeof window !== 'undefined') {
    // 浏览器环境
    window.driverTestResults = results;
    console.log('测试结果已保存到 window.driverTestResults');
  }
});

export { testDriverFix };
