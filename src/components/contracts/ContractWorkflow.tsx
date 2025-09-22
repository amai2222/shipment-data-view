// 合同工作流管理组件
import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { GitBranch } from 'lucide-react';

interface ContractWorkflowProps {
  contractId?: string;
  mode?: 'manage' | 'view';
}

export function ContractWorkflow({ contractId, mode = 'manage' }: ContractWorkflowProps) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 暂时禁用数据加载，等待数据库表创建
    setLoading(false);
    // loadData();
  }, [contractId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">加载工作流数据中...</p>
        </div>
      </div>
    );
  }

  // 暂时显示开发中提示
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">合同工作流</h2>
          <p className="text-muted-foreground">管理合同审批和处理流程</p>
        </div>
      </div>

      <Card>
        <CardContent className="text-center py-12">
          <GitBranch className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">工作流功能开发中</h3>
          <p className="text-muted-foreground mb-4">
            合同工作流管理功能正在开发中，敬请期待。
          </p>
          <p className="text-sm text-muted-foreground">
            功能将包括：审批流程、任务分配、状态跟踪、自动化处理等
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
