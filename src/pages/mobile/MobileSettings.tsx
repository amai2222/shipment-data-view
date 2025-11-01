// 移动端设置页面 - 对标桌面端设置菜单
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
import { useSimplePermissions } from '@/hooks/useSimplePermissions';
import { 
  ArrowLeft,
  User,
  Shield,
  Bell,
  Database,
  HelpCircle,
  LogOut,
  ChevronRight,
  Settings,
  Lock,
  Eye,
  Moon,
  Globe,
  Download,
  Trash2,
  RefreshCw,
  Users,
  FileText,
  History,
  Smartphone,
  Palette,
  Volume2,
  Wifi,
  Battery,
  Fingerprint
} from 'lucide-react';

export default function MobileSettings() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const { hasMenuAccess, isAdmin } = useUnifiedPermissions();
  
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
    },
    mobile: {
      vibration: true,
      autoRotate: false,
      wifiOnly: false,
      batteryOptimization: true
    }
  });

  // 设置项配置 - 对标桌面端设置菜单结构
  const settingsGroups = [
    {
      title: '个人设置',
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
        }
      ]
    },
    {
      title: '系统管理',
      description: '对标桌面端设置菜单',
      items: [
        {
          id: 'user-management',
          title: '用户管理',
          description: '管理系统用户',
          icon: Users,
          action: () => navigate('/m/settings/users'),
          showChevron: true,
          requiresPermission: true,
          roles: ['admin']
        },
        {
          id: 'permissions',
          title: '权限配置',
          description: '配置用户权限',
          icon: Shield,
          action: () => navigate('/m/settings/permissions'),
          showChevron: true,
          requiresPermission: true,
          roles: ['admin']
        },
        {
          id: 'contract-permissions',
          title: '合同权限',
          description: '合同相关权限管理',
          icon: FileText,
          action: () => navigate('/m/settings/contract-permissions'),
          showChevron: true,
          requiresPermission: true,
          roles: ['admin']
        },
        {
          id: 'role-templates',
          title: '角色模板',
          description: '管理角色权限模板',
          icon: Settings,
          action: () => navigate('/m/settings/role-templates'),
          showChevron: true,
          requiresPermission: true,
          roles: ['admin']
        },
        {
          id: 'integrated-user-management',
          title: '集成用户管理',
          description: '统一用户权限管理',
          icon: User,
          action: () => navigate('/m/settings/integrated'),
          showChevron: true,
          requiresPermission: true,
          roles: ['admin']
        },
        {
          id: 'audit-logs',
          title: '操作日志',
          description: '查看系统操作记录',
          icon: History,
          action: () => navigate('/m/settings/audit-logs'),
          showChevron: true,
          requiresPermission: true,
          roles: ['admin']
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
          icon: FileText,
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
          icon: Database,
          toggle: true,
          value: settings.notifications.finance,
          onChange: (value: boolean) => setSettings(prev => ({
            ...prev,
            notifications: { ...prev.notifications, finance: value }
          }))
        },
        {
          id: 'sound-notifications',
          title: '声音提醒',
          description: '通知声音和震动',
          icon: Volume2,
          toggle: true,
          value: settings.mobile.vibration,
          onChange: (value: boolean) => setSettings(prev => ({
            ...prev,
            mobile: { ...prev.mobile, vibration: value }
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
        },
        {
          id: 'theme',
          title: '主题样式',
          description: '自定义界面主题',
          icon: Palette,
          action: () => navigate('/m/theme'),
          showChevron: true
        }
      ]
    },
    {
      title: '移动端专属',
      description: '移动设备特殊设置',
      items: [
        {
          id: 'auto-rotate',
          title: '自动旋转',
          description: '自动旋转屏幕',
          icon: Smartphone,
          toggle: true,
          value: settings.mobile.autoRotate,
          onChange: (value: boolean) => setSettings(prev => ({
            ...prev,
            mobile: { ...prev.mobile, autoRotate: value }
          }))
        },
        {
          id: 'wifi-only',
          title: '仅WiFi同步',
          description: '仅在WiFi环境下同步数据',
          icon: Wifi,
          toggle: true,
          value: settings.mobile.wifiOnly,
          onChange: (value: boolean) => setSettings(prev => ({
            ...prev,
            mobile: { ...prev.mobile, wifiOnly: value }
          }))
        },
        {
          id: 'battery-optimization',
          title: '省电模式',
          description: '优化电池使用',
          icon: Battery,
          toggle: true,
          value: settings.mobile.batteryOptimization,
          onChange: (value: boolean) => setSettings(prev => ({
            ...prev,
            mobile: { ...prev.mobile, batteryOptimization: value }
          }))
        },
        {
          id: 'biometric',
          title: '生物识别',
          description: '指纹或面部识别登录',
          icon: Fingerprint,
          action: () => {
            toast({
              title: '功能开发中',
              description: '生物识别功能正在开发中'
            });
          },
          showChevron: true
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

  // 权限检查函数
  const hasPermission = (roles?: string[]) => {
    if (!roles || roles.length === 0) return true;
    return isAdmin || roles.includes(user?.user_metadata?.role);
  };

  // 过滤设置组，只显示有权限的项目
  const filteredSettingsGroups = settingsGroups.map(group => ({
    ...group,
    items: group.items.filter(item => {
      if (item.requiresPermission && item.roles) {
        return hasPermission(item.roles);
      }
      return true;
    })
  })).filter(group => group.items.length > 0);

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
        {filteredSettingsGroups.map((group) => (
          <div key={group.title}>
            <div className="mb-3">
              <h2 className="text-lg font-semibold text-muted-foreground">
                {group.title}
              </h2>
              {group.description && (
                <p className="text-sm text-muted-foreground mt-1">
                  {group.description}
                </p>
              )}
            </div>
            <Card>
              <CardContent className="p-0">
                {group.items.map((item, index) => (
                  <div key={item.id}>
                    <div 
                      className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={item.toggle ? undefined : item.action}
                    >
                      <div className="flex-shrink-0">
                        <item.icon className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{item.title}</h4>
                          {item.requiresPermission && (
                            <Badge variant="outline" className="text-xs">
                              管理员
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
                ))}
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
