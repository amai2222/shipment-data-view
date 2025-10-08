// 测试组件 - 验证导入是否工作
// 文件: src/components/TestContractPermissionImport.tsx

import React from 'react';
import { ContractPermissionServiceSimple } from '@/services/contractPermissionServiceSimple';
import { useContractPermissionRealtime } from '@/hooks/useContractPermissionRealtime';

export function TestContractPermissionImport() {
  const { isConnected, error } = useContractPermissionRealtime();

  const testService = async () => {
    try {
      const result = await ContractPermissionServiceSimple.getUserContractPermissions('test-user-id');
    } catch (error) {
      console.error('服务调用失败:', error);
    }
  };

  return (
    <div className="p-4 border rounded-lg">
      <h3 className="text-lg font-semibold mb-2">导入测试</h3>
      <div className="space-y-2">
        <p>实时连接状态: {isConnected ? '已连接' : '未连接'}</p>
        {error && <p className="text-red-500">错误: {error}</p>}
        <button 
          onClick={testService}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          测试服务调用
        </button>
      </div>
    </div>
  );
}

export default TestContractPermissionImport;
