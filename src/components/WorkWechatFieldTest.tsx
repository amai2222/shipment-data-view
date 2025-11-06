// 企业微信字段测试组件
// 文件: src/components/WorkWechatFieldTest.tsx

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';
import { 
  Building2, 
  CheckCircle, 
  XCircle, 
  RefreshCw,
  Database
} from 'lucide-react';

interface UserWechatData {
  id: string;
  full_name: string;
  email: string;
  role: string;
  work_wechat_userid: string | null;
  work_wechat_department: number[] | null;
  is_active: boolean;
}

export function WorkWechatFieldTest() {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserWechatData[]>([]);
  const [loading, setLoading] = useState(false);

  // 加载用户数据并显示企业微信字段
  const loadUsers = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, work_wechat_userid, work_wechat_department, is_active')
        .order('full_name');

      if (error) {
        throw error;
      }

      setUsers(data || []);

      toast({
        title: "加载成功",
        description: `成功加载 ${data?.length || 0} 个用户的企业微信数据`,
      });

    } catch (error) {
      console.error('加载用户数据失败:', error);
      toast({
        title: "加载失败",
        description: "无法加载用户企业微信数据",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const getWechatStatus = (user: UserWechatData) => {
    if (!user.work_wechat_userid) {
      return {
        text: '未关联',
        color: 'text-gray-500 border-gray-300',
        icon: <XCircle className="h-3 w-3 mr-1" />
      };
    }

    if (!user.is_active) {
      return {
        text: '已关联但禁用',
        color: 'text-orange-500 border-orange-300',
        icon: <XCircle className="h-3 w-3 mr-1" />
      };
    }

    return {
      text: '已关联',
      color: 'text-green-700 border-green-300',
      icon: <CheckCircle className="h-3 w-3 mr-1" />
    };
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            企业微信字段测试
          </CardTitle>
          <CardDescription>
            测试从数据库加载的企业微信字段是否正确显示
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center mb-4">
            <div className="text-sm text-gray-600">
              共 {users.length} 个用户
            </div>
            <Button 
              onClick={loadUsers} 
              disabled={loading}
              variant="outline"
              size="sm"
            >
              {loading ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              刷新数据
            </Button>
          </div>

          <div className="space-y-3">
            {users.map(user => {
              const wechatStatus = getWechatStatus(user);
              return (
                <div key={user.id} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Building2 className="h-4 w-4 text-gray-400" />
                      <div>
                        <div className="font-medium">{user.full_name}</div>
                        <div className="text-sm text-gray-600">{user.email}</div>
                        <div className="text-xs text-gray-500">
                          角色: {user.role} | 
                          状态: {user.is_active ? '启用' : '禁用'}
                        </div>
                        {user.work_wechat_userid && (
                          <div className="text-xs text-blue-600 mt-1">
                            企业微信ID: {user.work_wechat_userid}
                            {user.work_wechat_department && user.work_wechat_department.length > 0 && (
                              <span className="ml-2">
                                部门: [{user.work_wechat_department.join(', ')}]
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <Badge variant="outline" className={wechatStatus.color}>
                      {wechatStatus.icon}
                      {wechatStatus.text}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>

          {users.length === 0 && !loading && (
            <div className="text-center py-8 text-gray-500">
              <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>暂无用户数据</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default WorkWechatFieldTest;
