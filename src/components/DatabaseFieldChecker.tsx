// 数据库字段检查组件
// 文件: src/components/DatabaseFieldChecker.tsx

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Database, 
  CheckCircle, 
  XCircle, 
  RefreshCw,
  Table,
  Columns
} from 'lucide-react';

interface TableColumn {
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
}

export function DatabaseFieldChecker() {
  const { toast } = useToast();
  const [profilesColumns, setProfilesColumns] = useState<TableColumn[]>([]);
  const [loading, setLoading] = useState(false);

  // 检查 profiles 表结构
  const checkProfilesTable = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .rpc('get_table_columns', { table_name: 'profiles' });

      if (error) {
        // 如果 RPC 函数不存在，使用直接查询
        const { data: directData, error: directError } = await supabase
          .from('information_schema.columns')
          .select('column_name, data_type, is_nullable, column_default')
          .eq('table_schema', 'public')
          .eq('table_name', 'profiles')
          .order('ordinal_position');

        if (directError) {
          throw directError;
        }

        setProfilesColumns(directData || []);
      } else {
        setProfilesColumns(data || []);
      }

      toast({
        title: "检查完成",
        description: `profiles 表包含 ${profilesColumns.length} 个字段`,
      });

    } catch (error) {
      console.error('检查表结构失败:', error);
      toast({
        title: "检查失败",
        description: "无法获取表结构信息",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // 获取实际用户数据示例
  const getSampleUserData = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .limit(1);

      if (error) throw error;

      console.log('实际用户数据示例:', data);
      toast({
        title: "数据示例",
        description: "用户数据示例已输出到控制台",
      });

    } catch (error) {
      console.error('获取用户数据失败:', error);
    }
  };

  useEffect(() => {
    checkProfilesTable();
  }, []);

  const getColumnTypeColor = (dataType: string) => {
    switch (dataType.toLowerCase()) {
      case 'uuid':
        return 'bg-purple-100 text-purple-800';
      case 'text':
        return 'bg-blue-100 text-blue-800';
      case 'boolean':
        return 'bg-green-100 text-green-800';
      case 'timestamp with time zone':
        return 'bg-orange-100 text-orange-800';
      case 'integer[]':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getColumnIcon = (columnName: string) => {
    if (columnName.includes('email')) return '📧';
    if (columnName.includes('name')) return '👤';
    if (columnName.includes('role')) return '🔑';
    if (columnName.includes('wechat')) return '💬';
    if (columnName.includes('avatar')) return '🖼️';
    if (columnName.includes('active')) return '✅';
    if (columnName.includes('created') || columnName.includes('updated')) return '📅';
    return '📋';
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            数据库字段检查器
          </CardTitle>
          <CardDescription>
            检查 profiles 表的实际字段结构，确保前端与数据库一致
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center mb-4">
            <div className="text-sm text-gray-600">
              profiles 表字段: {profilesColumns.length} 个
            </div>
            <div className="space-x-2">
              <Button 
                onClick={checkProfilesTable} 
                disabled={loading}
                variant="outline"
                size="sm"
              >
                {loading ? (
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                刷新表结构
              </Button>
              <Button 
                onClick={getSampleUserData}
                variant="outline"
                size="sm"
              >
                <Table className="h-4 w-4 mr-2" />
                查看数据示例
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {profilesColumns.map((column, index) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-lg">{getColumnIcon(column.column_name)}</span>
                  <div>
                    <div className="font-medium">{column.column_name}</div>
                    <div className="text-sm text-gray-600">
                      类型: {column.data_type} | 
                      可空: {column.is_nullable === 'YES' ? '是' : '否'}
                      {column.column_default && ` | 默认值: ${column.column_default}`}
                    </div>
                  </div>
                </div>
                <Badge className={getColumnTypeColor(column.data_type)}>
                  {column.data_type}
                </Badge>
              </div>
            ))}
          </div>

          {profilesColumns.length === 0 && !loading && (
            <div className="text-center py-8 text-gray-500">
              <Columns className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>无法获取表结构信息</p>
              <p className="text-sm">请检查数据库连接或权限</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 字段说明 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            字段说明
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span><strong>id</strong> - 用户唯一标识符 (UUID)</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span><strong>email</strong> - 用户邮箱地址</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span><strong>full_name</strong> - 用户姓名</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span><strong>role</strong> - 用户角色 (admin, operator, viewer 等)</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span><strong>is_active</strong> - 账户是否启用</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span><strong>work_wechat_userid</strong> - 企业微信用户ID</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span><strong>work_wechat_department</strong> - 企业微信部门数组</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span><strong>avatar_url</strong> - 用户头像URL</span>
            </div>
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-600" />
              <span><strong>phone</strong> - 手机号 (数据库中没有此字段)</span>
            </div>
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-600" />
              <span><strong>department</strong> - 部门 (数据库中没有此字段)</span>
            </div>
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-600" />
              <span><strong>position</strong> - 职位 (数据库中没有此字段)</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default DatabaseFieldChecker;
