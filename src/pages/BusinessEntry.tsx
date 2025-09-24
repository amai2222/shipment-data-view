import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus } from 'lucide-react';

const BusinessEntry = () => {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            运单管理
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            运单管理功能正在开发中，请使用移动端进行运单录入操作。
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default BusinessEntry;
