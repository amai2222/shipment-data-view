// 文件路径: src/pages/InvoiceAudit.tsx
// 版本: 开票审核页面
// 描述: 开票审核功能，暂时显示开发中

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/PageHeader';
import { FileText, Construction } from 'lucide-react';

export default function InvoiceAudit() {
  return (
    <div className="space-y-6">
      <PageHeader 
        title="开票审核" 
        description="审核和管理开票申请单"
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            开票审核功能
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Construction className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">功能开发中</h3>
            <p className="text-muted-foreground mb-4">
              开票审核功能正在开发中，敬请期待...
            </p>
            <div className="text-sm text-muted-foreground">
              <p>预计功能包括：</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>开票申请单审核</li>
                <li>开票状态管理</li>
                <li>开票金额审核</li>
                <li>开票流程跟踪</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
