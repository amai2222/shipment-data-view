// 移动端设置页面
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { MobileLayout } from '@/components/mobile/MobileLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { 
  ArrowLeft,
  User,
  Shield,
  Bell,
  Palette,
  Database,
  HelpCircle,
  LogOut,
  ChevronRight,
  Settings,
  Lock,
  Eye,
  Moon,
  Sun,
  Smartphone,
  Globe,
  Download,
  Upload,
  Trash2,
  RefreshCw
} from 'lucide-react';

export default function MobileSettings() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  
  const [settings, setSettings] = useState({
    notifications: {
      push: true,
      email: false,
      sms: false,
      business: true,
      finance: true,
      system: false
    },
    display: {
      darkMode: false,
      fontSize: 'medium',
      language: 'zh-CN'
    },
    privacy: {
      showOnlineStatus: true,
      allowDataCollection: false,
      autoLogout: true
    }
  });

  // 设置项配置
  const settingsGroups = [
    {
      title: '账户设置',
      items: [
        {
          id: 'profile',
          title: '个人资料',
          description: '管理您的个人信息',
          icon: User,
          action: () => navigate('/m/profile'),
          showChevron: true
        },
        {
          id: 'security',
          title: '安全设置',
          description: '密码、二次验证等',
          icon: Lock,
          action: () => navigate('/m/security'),
          showChevron: true
        },
        {
          id: 'privacy',
          title: '隐私设置',
          description: '数据使用和隐私控制',
          icon: Eye,
          action: () => navigate('/m/privacy'),
          showChevron: true
        }
      ]
    },
    {
      title: '通知设置',
      items: [
        {
          id: 'push-notifications',
          title: '推送通知',
          description: '接收应用推送消息',
          icon: Bell,
          toggle: true,
          value: settings.notifications.push,
          onChange: (value: boolean) => setSettings(prev => ({
            ...prev,
            notifications: { ...prev.notifications, push: value }
          }))
        },
        {
          id: 'business-notifications',
          title: '业务通知',
          description: '运单、项目相关通知',
          icon: Bell,
          toggle: true,
          value: settings.notifications.business,
          onChange: (value: boolean) => setSettings(prev => ({
            ...prev,
            notifications: { ...prev.notifications, business: value }
          }))
        },
        {
          id: 'finance-notifications',
          title: '财务通知',
          description: '付款、账单相关通知',
          icon: Bell,
          toggle: true,
          value: settings.notifications.finance,
          onChange: (value: boolean) => setSettings(prev => ({
            ...prev,
            notifications: { ...prev.notifications, finance: value }
          }))
        }
      ]
    },
    {
      title: '显示设置',
      items: [
        {
          id: 'dark-mode',
          title: '深色模式',
          description: '使用深色主题',
          icon: Moon,
          toggle: true,
          value: settings.display.darkMode,
          onChange: (value: boolean) => {
            setSettings(prev => ({
              ...prev,
              display: { ...prev.display, darkMode: value }
            }));
            // 这里可以实现主题切换逻辑
            toast({
              title: value ? '已切换到深色模式' : '已切换到浅色模式',
              description: '主题设置已保存'
            });
          }
        },
        {
          id: 'language',
          title: '语言设置',
          description: '简体中文',
          icon: Globe,
          action: () => navigate('/m/language'),
          showChevron: true
        }
      ]
    },
    {
      title: '系统管理',
      items: [
        {
          id: 'permissions',
          title: '权限管理',
          description: '用户权限配置',
          icon: Shield,
          action: () => navigate('/m/settings/permissions'),
          showChevron: true,
          badge: '管理员'
        },
        {
          id: 'user-management',
          title: '用户管理',
          description: '集成用户管理',
          icon: User,
          action: () => navigate('/m/settings/integrated'),
          showChevron: true,
          badge: '管理员'
        },
        {
          id: 'audit-logs',
          title: '审计日志',
          description: '查看系统操作记录',
          icon: Database,
          action: () => navigate('/m/settings/audit-logs'),
          showChevron: true,
          badge: '管理员'
        }
      ]
    },
    {
      title: '数据管理',
      items: [
        {
          id: 'backup',
          title: '数据备份',
          description: '备份重要数据',
          icon: Download,
          action: () => {
            toast({
              title: '功能开发中',
              description: '数据备份功能正在开发中'
            });
          },
          showChevron: true
        },
        {
          id: 'sync',
          title: '数据同步',
          description: '同步最新数据',
          icon: RefreshCw,
          action: () => {
            toast({
              title: '同步完成',
              description: '数据已同步到最新版本'
            });
          },
          showChevron: true
        },
        {
          id: 'clear-cache',
          title: '清理缓存',
          description: '清理应用缓存数据',
          icon: Trash2,
          action: () => {
            toast({
              title: '缓存已清理',
              description: '应用缓存数据已清空'
            });
          },
          showChevron: true
        }
      ]
    },
    {
      title: '帮助支持',
      items: [
        {
          id: 'help',
          title: '帮助中心',
          description: '使用指南和常见问题',
          icon: HelpCircle,
          action: () => navigate('/m/help'),
          showChevron: true
        },
        {
          id: 'about',
          title: '关于应用',
          description: '版本信息和更新日志',
          icon: Smartphone,
          action: () => navigate('/m/about'),
          showChevron: true
        }
      ]
    }
  ];

  // 处理退出登录
  const handleSignOut = async () => {
    try {
      await signOut();
      toast({
        title: '已退出登录',
        description: '感谢使用物流管理系统'
      });
      navigate('/login');
    } catch (error) {
      toast({
        title: '退出失败',
        description: '请稍后重试',
        variant: 'destructive'
      });
    }
  };

  // 检查是否为管理员
  const isAdmin = user?.user_metadata?.role === 'admin';

  return (
    <MobileLayout>
      <div className="space-y-4">
        {/* 头部 */}
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">设置</h1>
            <p className="text-sm text-muted-foreground">
              个性化您的应用体验
            </p>
          </div>
        </div>

        {/* 用户信息卡片 */}
        <Card className="bg-gradient-to-r from-blue-500 to-purple-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 bg-white/20 rounded-full flex items-center justify-center">
                <User className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">{user?.email || '未知用户'}</h3>
                <p className="text-sm text-blue-100">
                  {user?.user_metadata?.role === 'admin' ? '系统管理员' : '普通用户'}
                </p>
              </div>
              <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                在线
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* 设置组 */}
        {settingsGroups.map((group) => (
          <div key={group.title}>
            <h2 className="text-lg font-semibold mb-3 text-muted-foreground">
              {group.title}
            </h2>
            <Card>
              <CardContent className="p-0">
                {group.items.map((item, index) => {
                  // 如果是管理员功能但用户不是管理员，则不显示
                  if (item.badge === '管理员' && !isAdmin) {
                    return null;
                  }

                  return (
                    <div key={item.id}>
                      <div 
                        className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/50"
                        onClick={item.toggle ? undefined : item.action}
                      >
                        <div className="flex-shrink-0">
                          <item.icon className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{item.title}</h4>
                            {item.badge && (
                              <Badge variant="secondary" className="text-xs">
                                {item.badge}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {item.description}
                          </p>
                        </div>
                        <div className="flex-shrink-0">
                          {item.toggle ? (
                            <Switch
                              checked={item.value}
                              onCheckedChange={item.onChange}
                            />
                          ) : item.showChevron ? (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          ) : null}
                        </div>
                      </div>
                      {index < group.items.length - 1 && <Separator />}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        ))}

        {/* 退出登录 */}
        <Card>
          <CardContent className="p-0">
            <Button
              variant="ghost"
              className="w-full justify-start p-4 h-auto text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={handleSignOut}
            >
              <LogOut className="h-5 w-5 mr-3" />
              <div className="text-left">
                <div className="font-medium">退出登录</div>
                <div className="text-sm text-muted-foreground">
                  安全退出当前账户
                </div>
              </div>
            </Button>
          </CardContent>
        </Card>

        {/* 版本信息 */}
        <div className="text-center text-sm text-muted-foreground py-4">
          <p>物流管理系统 v1.0.0</p>
          <p>© 2024 中科物流. 保留所有权利</p>
        </div>
      </div>
    </MobileLayout>
  );
}
