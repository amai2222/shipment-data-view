// 移动端通知页面
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MobileLayout } from '@/components/mobile/MobileLayout';
import { MobileSkeletonLoader } from '@/components/mobile/MobileSkeletonLoader';
import { NoDataState } from '@/components/mobile/MobileEmptyState';
import { useAuth } from '@/contexts/AuthContext';
import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';
import { useToast } from '@/hooks/use-toast';
import { 
  Bell, 
  AlertTriangle, 
  Info, 
  CheckCircle, 
  X,
  ArrowLeft,
  Trash2,
  Eye,
  EyeOff
} from 'lucide-react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

// 通知类型定义
interface Notification {
  id: string;
  type: 'info' | 'warning' | 'success' | 'error';
  title: string;
  message: string;
  time: string;
  isRead: boolean;
  category: 'system' | 'business' | 'finance' | 'contract';
  link?: string;
  related_id?: string;
}

export default function MobileNotifications() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('all');

  // 使用React Query获取真实通知数据
  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['user-notifications', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase.rpc('get_user_notifications', {
        p_user_id: user.id,
        p_limit: 100,
        p_offset: 0,
        p_is_read: null
      });

      if (error) throw error;

      // 转换数据格式
      return (data || []).map((item: any) => ({
        id: item.id,
        type: item.type,
        category: item.category,
        title: item.title,
        message: item.message,
        time: item.created_at,
        isRead: item.is_read,
        link: item.link,
        related_id: item.related_id
      }));
    },
    enabled: !!user?.id,
    staleTime: 30 * 1000, // 30秒刷新一次
    cacheTime: 5 * 60 * 1000,
    refetchInterval: 60 * 1000, // 每分钟自动刷新
  });

  // 获取未读数量
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['unread-notification-count', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      
      const { data, error } = await supabase.rpc('get_unread_notification_count', {
        p_user_id: user.id
      });

      if (error) throw error;
      return data || 0;
    },
    enabled: !!user?.id,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });

  // 获取通知图标
  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-orange-500" />;
      case 'error':
        return <X className="h-5 w-5 text-red-500" />;
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'info':
      default:
        return <Info className="h-5 w-5 text-blue-500" />;
    }
  };

  // 获取通知背景色
  const getNotificationBg = (type: Notification['type'], isRead: boolean) => {
    const opacity = isRead ? 'bg-opacity-30' : 'bg-opacity-50';
    switch (type) {
      case 'warning':
        return `bg-orange-100 ${opacity}`;
      case 'error':
        return `bg-red-100 ${opacity}`;
      case 'success':
        return `bg-green-100 ${opacity}`;
      case 'info':
      default:
        return `bg-blue-100 ${opacity}`;
    }
  };

  // 标记为已读
  const markAsRead = async (id: string) => {
    if (!user?.id) return;
    
    try {
      const { error } = await supabase.rpc('mark_notification_as_read', {
        p_notification_id: id,
        p_user_id: user.id
      });

      if (error) throw error;

      // 刷新通知列表
      queryClient.invalidateQueries({ queryKey: ['user-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unread-notification-count'] });
    } catch (error) {
      console.error('标记已读失败:', error);
      toast({ title: '操作失败', description: '标记已读失败', variant: 'destructive' });
    }
  };

  // 删除通知
  const deleteNotification = async (id: string) => {
    if (!user?.id) return;
    
    try {
      const { error } = await supabase.rpc('delete_notification', {
        p_notification_id: id,
        p_user_id: user.id
      });

      if (error) throw error;

      // 刷新通知列表
      queryClient.invalidateQueries({ queryKey: ['user-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unread-notification-count'] });
      
      toast({ title: '已删除', description: '通知已删除' });
    } catch (error) {
      console.error('删除通知失败:', error);
      toast({ title: '删除失败', description: '删除通知失败', variant: 'destructive' });
    }
  };

  // 全部标记为已读
  const markAllAsRead = async () => {
    if (!user?.id) return;
    
    try {
      const { error } = await supabase.rpc('mark_all_notifications_as_read', {
        p_user_id: user.id
      });

      if (error) throw error;

      // 刷新通知列表
      queryClient.invalidateQueries({ queryKey: ['user-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unread-notification-count'] });
      
      toast({ title: '操作成功', description: '所有通知已标记为已读' });
    } catch (error) {
      console.error('标记所有已读失败:', error);
      toast({ title: '操作失败', description: '标记已读失败', variant: 'destructive' });
    }
  };

  // 筛选通知
  const filteredNotifications = notifications.filter(notif => {
    switch (activeTab) {
      case 'unread':
        return !notif.isRead;
      case 'business':
        return notif.category === 'business';
      case 'finance':
        return notif.category === 'finance';
      case 'system':
        return notif.category === 'system';
      case 'contract':
        return notif.category === 'contract';
      case 'all':
      default:
        return true;
    }
  });

  // 加载状态
  if (isLoading) {
    return (
      <MobileLayout>
        <MobileSkeletonLoader count={5} type="list" />
      </MobileLayout>
    );
  }

  return (
    <MobileLayout>
      <div className="space-y-4">
        {/* 头部 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">通知中心</h1>
              {unreadCount > 0 && (
                <p className="text-sm text-muted-foreground">
                  {unreadCount} 条未读通知
                </p>
              )}
            </div>
          </div>
          
          {unreadCount > 0 && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={markAllAsRead}
            >
              全部已读
            </Button>
          )}
        </div>

        {/* 通知分类标签 */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 text-xs">
            <TabsTrigger value="all">全部</TabsTrigger>
            <TabsTrigger value="unread">
              未读
              {unreadCount > 0 && (
                <Badge variant="destructive" className="ml-1 h-4 min-w-[16px] p-0 text-xs flex items-center justify-center">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="business">业务</TabsTrigger>
            <TabsTrigger value="finance">财务</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="space-y-3 mt-4">
            {filteredNotifications.length === 0 ? (
              <NoDataState />
            ) : (
              filteredNotifications.map((notification) => (
                <Card 
                  key={notification.id}
                  className={`${getNotificationBg(notification.type, notification.isRead)} ${
                    !notification.isRead ? 'border-l-4 border-l-blue-500' : ''
                  }`}
                  onClick={() => {
                    // 点击通知时标记为已读并跳转（如果有链接）
                    if (!notification.isRead) {
                      markAsRead(notification.id);
                    }
                    if (notification.link) {
                      navigate(notification.link);
                    }
                  }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-1">
                        {getNotificationIcon(notification.type)}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <h4 className="font-semibold text-sm mb-1">
                              {notification.title}
                            </h4>
                            <p className="text-sm text-muted-foreground mb-2">
                              {notification.message}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(notification.time), 'MM月dd日 HH:mm', { locale: zhCN })}
                            </p>
                          </div>
                          
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            {!notification.isRead && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  markAsRead(notification.id);
                                }}
                                className="h-6 w-6 p-0"
                              >
                                <Eye className="h-3 w-3" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteNotification(notification.id);
                              }}
                              className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </MobileLayout>
  );
}
