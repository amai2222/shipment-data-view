// 移动端通知页面
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MobileLayout } from '@/components/mobile/MobileLayout';
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
  category: 'system' | 'business' | 'finance';
}

// 模拟通知数据
const mockNotifications: Notification[] = [
  {
    id: '1',
    type: 'warning',
    title: '付款申请待审批',
    message: '有5笔付款申请等待您的审批，总金额¥125,000',
    time: '2024-01-15T10:30:00Z',
    isRead: false,
    category: 'finance'
  },
  {
    id: '2',
    type: 'info',
    title: '新运单录入',
    message: '司机张师傅提交了新的运输单据，请及时处理',
    time: '2024-01-15T09:15:00Z',
    isRead: false,
    category: 'business'
  },
  {
    id: '3',
    type: 'success',
    title: '项目完成',
    message: '项目"煤炭运输A"已顺利完成，总运量达到10,000吨',
    time: '2024-01-15T08:45:00Z',
    isRead: true,
    category: 'business'
  },
  {
    id: '4',
    type: 'error',
    title: '系统异常',
    message: '数据同步出现异常，部分数据可能存在延迟',
    time: '2024-01-14T16:20:00Z',
    isRead: false,
    category: 'system'
  },
  {
    id: '5',
    type: 'info',
    title: '合同到期提醒',
    message: '合同"HT202401001"将于3天后到期，请及时续签',
    time: '2024-01-14T14:10:00Z',
    isRead: true,
    category: 'business'
  }
];

export default function MobileNotifications() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>(mockNotifications);
  const [activeTab, setActiveTab] = useState('all');

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
  const markAsRead = (id: string) => {
    setNotifications(prev => 
      prev.map(notif => 
        notif.id === id ? { ...notif, isRead: true } : notif
      )
    );
  };

  // 删除通知
  const deleteNotification = (id: string) => {
    setNotifications(prev => prev.filter(notif => notif.id !== id));
  };

  // 全部标记为已读
  const markAllAsRead = () => {
    setNotifications(prev => 
      prev.map(notif => ({ ...notif, isRead: true }))
    );
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
      case 'all':
      default:
        return true;
    }
  });

  const unreadCount = notifications.filter(n => !n.isRead).length;

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
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="all">全部</TabsTrigger>
            <TabsTrigger value="unread">
              未读
              {unreadCount > 0 && (
                <Badge variant="destructive" className="ml-1 h-4 w-4 p-0 text-xs">
                  {unreadCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="business">业务</TabsTrigger>
            <TabsTrigger value="finance">财务</TabsTrigger>
            <TabsTrigger value="system">系统</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="space-y-3 mt-4">
            {filteredNotifications.length === 0 ? (
              <Card>
                <CardContent className="text-center py-8">
                  <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">暂无通知</h3>
                  <p className="text-muted-foreground">
                    {activeTab === 'unread' ? '所有通知都已读完' : '当前分类下没有通知'}
                  </p>
                </CardContent>
              </Card>
            ) : (
              filteredNotifications.map((notification) => (
                <Card 
                  key={notification.id}
                  className={`${getNotificationBg(notification.type, notification.isRead)} ${
                    !notification.isRead ? 'border-l-4 border-l-blue-500' : ''
                  }`}
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
                          
                          <div className="flex items-center gap-1">
                            {!notification.isRead && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => markAsRead(notification.id)}
                                className="h-6 w-6 p-0"
                              >
                                <Eye className="h-3 w-3" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteNotification(notification.id)}
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
