/**
 * 移动端优化功能演示页面
 * 展示所有移动端优化组件的使用方法
 */

import React, { useState } from 'react';
import { EnhancedMobileLayout } from '@/components/mobile/EnhancedMobileLayout';
import { MobileCard, MobileInfoRow, MobileStatCard } from '@/components/mobile/MobileCard';
import { MobilePullToRefresh } from '@/components/mobile/MobilePullToRefresh';
import { MobileSwipeableCard } from '@/components/mobile/MobileSwipeableCard';
import { MobileTouchable, MobileButton } from '@/components/mobile/MobileTouchable';
import { MobileActionSheet } from '@/components/mobile/MobileActionSheet';
import { MobileSkeletonLoader } from '@/components/mobile/MobileSkeletonLoader';
import { NoDataState, ErrorState, SearchEmptyState } from '@/components/mobile/MobileEmptyState';
import { MobileFormField, MobileFormCard } from '@/components/mobile/MobileFormField';
import { 
  User, 
  Phone, 
  Mail, 
  Edit, 
  Trash, 
  Share2, 
  MapPin,
  Calendar,
  DollarSign,
  Truck,
  Package
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { triggerHaptic, copyToClipboard } from '@/utils/mobile';

export default function MobileOptimizationDemo() {
  const [isLoading, setIsLoading] = useState(false);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: ''
  });
  const { toast } = useToast();

  const handleRefresh = async () => {
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIsLoading(false);
    toast({ title: '刷新成功' });
  };

  const demoData = [
    { id: 1, name: '示例项目A', count: 125, amount: 58900 },
    { id: 2, name: '示例项目B', count: 89, amount: 42300 },
    { id: 3, name: '示例项目C', count: 156, amount: 71200 }
  ];

  return (
    <EnhancedMobileLayout title="移动端优化演示">
      <Tabs defaultValue="components" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="components">组件</TabsTrigger>
          <TabsTrigger value="interactions">交互</TabsTrigger>
          <TabsTrigger value="forms">表单</TabsTrigger>
        </TabsList>

        {/* 组件演示 */}
        <TabsContent value="components" className="space-y-4">
          {/* 下拉刷新 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">下拉刷新</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                在列表中向下拉动可触发刷新
              </p>
              <MobilePullToRefresh onRefresh={handleRefresh}>
                <div className="space-y-3">
                  {demoData.map(item => (
                    <MobileCard key={item.id}>
                      <div className="p-4">
                        <h3 className="font-semibold mb-2">{item.name}</h3>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">车次: {item.count}</span>
                          <span className="text-green-600 font-medium">
                            ¥{item.amount.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </MobileCard>
                  ))}
                </div>
              </MobilePullToRefresh>
            </CardContent>
          </Card>

          {/* 统计卡片 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">统计卡片</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <MobileStatCard
                  title="总车次"
                  value="1,234"
                  icon={<Truck className="h-6 w-6" />}
                  color="blue"
                  onClick={() => toast({ title: '查看详情' })}
                />
                <MobileStatCard
                  title="总金额"
                  value="¥12.3万"
                  icon={<DollarSign className="h-6 w-6" />}
                  color="green"
                  onClick={() => toast({ title: '查看详情' })}
                />
                <MobileStatCard
                  title="运输量"
                  value="8,456吨"
                  icon={<Package className="h-6 w-6" />}
                  color="purple"
                  onClick={() => toast({ title: '查看详情' })}
                />
                <MobileStatCard
                  title="项目数"
                  value="38"
                  icon={<MapPin className="h-6 w-6" />}
                  color="orange"
                  onClick={() => toast({ title: '查看详情' })}
                />
              </div>
            </CardContent>
          </Card>

          {/* 骨架屏 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">骨架屏加载</CardTitle>
            </CardHeader>
            <CardContent>
              <MobileSkeletonLoader count={2} type="card" />
            </CardContent>
          </Card>

          {/* 空状态 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">空状态</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <NoDataState onRefresh={handleRefresh} />
              <SearchEmptyState keyword="搜索词" />
              <ErrorState onRetry={handleRefresh} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* 交互演示 */}
        <TabsContent value="interactions" className="space-y-4">
          {/* 触摸反馈 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">触摸反馈</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <MobileTouchable
                onClick={() => {
                  triggerHaptic('light');
                  toast({ title: '轻触反馈' });
                }}
                className="p-4 bg-blue-50 rounded-lg text-center"
              >
                点击体验触觉反馈
              </MobileTouchable>

              <MobileTouchable
                onLongPress={() => {
                  triggerHaptic('heavy');
                  toast({ title: '长按反馈' });
                }}
                className="p-4 bg-purple-50 rounded-lg text-center"
              >
                长按体验触觉反馈
              </MobileTouchable>

              <div className="grid grid-cols-2 gap-3">
                <MobileButton
                  onClick={() => toast({ title: '默认按钮' })}
                  variant="default"
                >
                  默认
                </MobileButton>
                <MobileButton
                  onClick={() => toast({ title: '主要按钮' })}
                  variant="primary"
                >
                  主要
                </MobileButton>
                <MobileButton
                  onClick={() => toast({ title: '次要按钮' })}
                  variant="secondary"
                >
                  次要
                </MobileButton>
                <MobileButton
                  onClick={() => toast({ title: '危险按钮' })}
                  variant="destructive"
                >
                  危险
                </MobileButton>
              </div>
            </CardContent>
          </Card>

          {/* 滑动卡片 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">滑动操作</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                向左或向右滑动卡片可显示操作按钮
              </p>
              <div className="space-y-3">
                {['项目A', '项目B', '项目C'].map((name, index) => (
                  <MobileSwipeableCard
                    key={index}
                    rightActions={[
                      {
                        icon: Edit,
                        label: '编辑',
                        onClick: () => {
                          triggerHaptic('light');
                          toast({ title: `编辑${name}` });
                        }
                      },
                      {
                        icon: Trash,
                        label: '删除',
                        onClick: () => {
                          triggerHaptic('medium');
                          toast({ title: `删除${name}`, variant: 'destructive' });
                        },
                        variant: 'destructive'
                      }
                    ]}
                  >
                    <div className="p-4 bg-muted/30 rounded-lg">
                      <h3 className="font-semibold">{name}</h3>
                      <p className="text-sm text-muted-foreground">向左滑动查看操作</p>
                    </div>
                  </MobileSwipeableCard>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 操作面板 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">操作面板</CardTitle>
            </CardHeader>
            <CardContent>
              <Button onClick={() => setShowActionSheet(true)} className="w-full">
                打开操作面板
              </Button>
              
              <MobileActionSheet
                open={showActionSheet}
                onOpenChange={setShowActionSheet}
                title="选择操作"
                description="请选择要执行的操作"
                actions={[
                  {
                    icon: Edit,
                    label: '编辑',
                    onClick: () => toast({ title: '编辑' })
                  },
                  {
                    icon: Share2,
                    label: '分享',
                    onClick: async () => {
                      await copyToClipboard('分享内容');
                      toast({ title: '已复制到剪贴板' });
                    }
                  },
                  {
                    icon: Trash,
                    label: '删除',
                    onClick: () => toast({ title: '删除', variant: 'destructive' }),
                    variant: 'destructive'
                  }
                ]}
              />
            </CardContent>
          </Card>

          {/* 信息行 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">信息行组件</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <MobileInfoRow
                icon={<User className="h-4 w-4" />}
                label="司机"
                value="张三"
              />
              <MobileInfoRow
                icon={<Phone className="h-4 w-4" />}
                label="电话"
                value="13800138000"
              />
              <MobileInfoRow
                icon={<MapPin className="h-4 w-4" />}
                label="地点"
                value="北京市朝阳区"
              />
              <MobileInfoRow
                icon={<Calendar className="h-4 w-4" />}
                label="日期"
                value="2024-01-15"
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* 表单演示 */}
        <TabsContent value="forms" className="space-y-4">
          <MobileFormCard title="表单示例" description="移动端优化的表单输入">
            <MobileFormField
              label="姓名"
              value={formData.name}
              onChange={(value) => setFormData({ ...formData, name: value })}
              type="text"
              required
              placeholder="请输入姓名"
              icon={<User className="h-4 w-4" />}
            />

            <MobileFormField
              label="手机号"
              value={formData.phone}
              onChange={(value) => setFormData({ ...formData, phone: value })}
              type="tel"
              placeholder="请输入手机号"
              icon={<Phone className="h-4 w-4" />}
            />

            <MobileFormField
              label="邮箱"
              value={formData.email}
              onChange={(value) => setFormData({ ...formData, email: value })}
              type="email"
              placeholder="请输入邮箱"
              icon={<Mail className="h-4 w-4" />}
            />

            <MobileFormField
              label="类型"
              value=""
              onChange={() => {}}
              type="select"
              options={[
                { value: '1', label: '类型一' },
                { value: '2', label: '类型二' },
                { value: '3', label: '类型三' }
              ]}
            />

            <MobileFormField
              label="备注"
              value=""
              onChange={() => {}}
              type="textarea"
              rows={4}
              placeholder="请输入备注信息"
            />

            <MobileFormField
              label="启用状态"
              value={true}
              onChange={() => {}}
              type="switch"
            />

            <div className="flex space-x-3 pt-4">
              <MobileButton variant="ghost" className="flex-1">
                重置
              </MobileButton>
              <MobileButton 
                variant="primary" 
                className="flex-1"
                onClick={() => {
                  triggerHaptic('success');
                  toast({ title: '提交成功' });
                }}
              >
                提交
              </MobileButton>
            </div>
          </MobileFormCard>
        </TabsContent>
      </Tabs>
    </EnhancedMobileLayout>
  );
}

