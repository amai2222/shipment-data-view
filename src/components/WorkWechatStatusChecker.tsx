// 企业微信关联状态检查组件
// 文件: src/components/WorkWechatStatusChecker.tsx

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Building2, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  User
} from 'lucide-react';

interface WorkWechatStatusCheckerProps {
  userId?: string;
  showAllUsers?: boolean;
}

interface UserWechatStatus {
  id: string;
  full_name: string;
  email: string;
  work_wechat_userid: string | null;
  work_wechat_department: number[] | null;
  is_active: boolean;
}

export function WorkWechatStatusChecker({ 
  userId, 
  showAllUsers = false 
}: WorkWechatStatusCheckerProps) {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserWechatStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    linked: 0,
    unlinked: 0,
    activeLinked: 0
  });

  // 加载企业微信关联状态
  const loadWechatStatus = async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('profiles')
        .select('id, full_name, email, work_wechat_userid, work_wechat_department, is_active')
        .order('full_name');

      if (userId) {
        query = query.eq('id', userId);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      const usersData = (data || []).map(user => ({
        ...user,
        work_wechat_userid: user.work_wechat_userid || null,
        work_wechat_department: user.work_wechat_department || null
      }));

      setUsers(usersData);

      // 计算统计信息
      const total = usersData.length;
      const linked = usersData.filter(u => u.work_wechat_userid).length;
      const unlinked = total - linked;
      const activeLinked = usersData.filter(u => u.work_wechat_userid && u.is_active).length;

      setStats({ total, linked, unlinked, activeLinked });

    } catch (error) {
      console.error('加载企业微信状态失败:', error);
      toast({
        title: "加载失败",
        description: "无法加载企业微信关联状态",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWechatStatus();
  }, [userId]);

  const getStatusBadge = (user: UserWechatStatus) => {
    if (!user.work_wechat_userid) {
      return (
        <Badge variant="outline" className="text-gray-500 border-gray-300">
          <XCircle className="h-3 w-3 mr-1" />
          未关联
        </Badge>
      );
    }

    if (!user.is_active) {
      return (
        <Badge variant="outline" className="text-orange-500 border-orange-300">
          <AlertTriangle className="h-3 w-3 mr-1" />
          已关联但禁用
        </Badge>
      );
    }

    return (
      <Badge variant="outline" className="text-green-700 border-green-300">
        <CheckCircle className="h-3 w-3 mr-1" />
        已关联
      </Badge>
    );
  };

  const getStatusIcon = (user: UserWechatStatus) => {
    if (!user.work_wechat_userid) {
      return <XCircle className="h-4 w-4 text-gray-400" />;
    }
    if (!user.is_active) {
      return <AlertTriangle className="h-4 w-4 text-orange-500" />;
    }
    return <CheckCircle className="h-4 w-4 text-green-600" />;
  };

  return (
    <div className="space-y-4">
      {/* 统计概览 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            企业微信关联统计
          </CardTitle>
          <CardDescription>
            查看用户企业微信关联状态和统计信息
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
              <div className="text-sm text-blue-700">总用户数</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{stats.linked}</div>
              <div className="text-sm text-green-700">已关联</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-600">{stats.unlinked}</div>
              <div className="text-sm text-gray-700">未关联</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{stats.activeLinked}</div>
              <div className="text-sm text-purple-700">活跃关联</div>
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <Button 
              onClick={loadWechatStatus} 
              disabled={loading}
              variant="outline"
              size="sm"
            >
              {loading ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              刷新状态
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 关联率提示 */}
      {stats.total > 0 && (
        <Alert>
          <Building2 className="h-4 w-4" />
          <AlertDescription>
            企业微信关联率: <strong>{((stats.linked / stats.total) * 100).toFixed(1)}%</strong>
            {stats.unlinked > 0 && (
              <span className="text-orange-600 ml-2">
                ({stats.unlinked} 个用户尚未关联企业微信)
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* 用户列表 */}
      {showAllUsers && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              用户企业微信状态
            </CardTitle>
            <CardDescription>
              所有用户的企业微信关联状态详情
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {users.map(user => (
                <div key={user.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(user)}
                    <div>
                      <div className="font-medium">{user.full_name}</div>
                      <div className="text-sm text-gray-600">{user.email}</div>
                      {user.work_wechat_userid && (
                        <div className="text-xs text-gray-500">
                          企业微信ID: {user.work_wechat_userid}
                          {user.work_wechat_department && user.work_wechat_department.length > 0 && ` (部门: ${user.work_wechat_department.join(', ')})`}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(user)}
                    {user.work_wechat_userid && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          // 可以添加跳转到企业微信管理页面的功能
                          toast({
                            title: "企业微信管理",
                            description: "跳转到企业微信管理页面",
                          });
                        }}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default WorkWechatStatusChecker;
