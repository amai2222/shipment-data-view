// PC端 - 待办事项
// 功能：汇总所有需要处理的事项（费用审核、换车申请、证件到期等）

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/PageHeader';
import {
  Bell,
  FileText,
  Truck,
  AlertTriangle,
  Calendar,
  ChevronRight,
  RefreshCw
} from 'lucide-react';

interface PendingTask {
  type: string;
  title: string;
  description: string;
  count: number;
  priority: 'high' | 'medium' | 'low';
  link: string;
}

export default function PendingTasks() {
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState<PendingTask[]>([]);

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    setLoading(true);
    try {
      const taskList: PendingTask[] = [];

      // 1. 待审核费用申请
      const { count: expenseCount } = await supabase
        .from('internal_driver_expense_applications')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      if (expenseCount && expenseCount > 0) {
        taskList.push({
          type: 'expense',
          title: '费用申请待审核',
          description: `${expenseCount}个司机费用申请等待审核`,
          count: expenseCount,
          priority: 'high',
          link: '/internal/expense-approval'
        });
      }

      // 2. 待审批换车申请
      const { count: changeCount } = await supabase
        .from('internal_vehicle_change_applications')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      if (changeCount && changeCount > 0) {
        taskList.push({
          type: 'vehicle_change',
          title: '换车申请待审批',
          description: `${changeCount}个司机换车申请等待审批`,
          count: changeCount,
          priority: 'medium',
          link: '/internal/vehicle-change-approval'
        });
      }

      // 3. 证件即将到期
      const thirtyDaysLater = new Date();
      thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);

      const { data: expiringCerts } = await supabase
        .from('internal_drivers')
        .select('driver_license_expire_date')
        .lte('driver_license_expire_date', thirtyDaysLater.toISOString())
        .gt('driver_license_expire_date', new Date().toISOString());

      const certCount = expiringCerts?.length || 0;
      if (certCount > 0) {
        taskList.push({
          type: 'certificate',
          title: '证件即将到期',
          description: `${certCount}个驾驶证将在30天内到期`,
          count: certCount,
          priority: 'high',
          link: '/internal/certificates'
        });
      }

      setTasks(taskList);
    } catch (error) {
      console.error('加载待办失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'expense': return FileText;
      case 'vehicle_change': return Truck;
      case 'certificate': return AlertTriangle;
      default: return Bell;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="待办事项"
        description="查看需要处理的任务和提醒"
        icon={Bell}
        iconColor="text-orange-600"
      >
        <Button variant="outline" size="sm" onClick={loadTasks} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          刷新
        </Button>
      </PageHeader>

      {/* 待办统计 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-red-50 to-orange-50 border-red-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-600">高优先级</p>
                <p className="text-3xl font-bold mt-2 text-red-700">
                  {tasks.filter(t => t.priority === 'high').length}
                </p>
              </div>
              <AlertTriangle className="h-10 w-10 text-red-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-yellow-50 to-amber-50 border-yellow-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-yellow-600">中优先级</p>
                <p className="text-3xl font-bold mt-2 text-yellow-700">
                  {tasks.filter(t => t.priority === 'medium').length}
                </p>
              </div>
              <Bell className="h-10 w-10 text-yellow-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600">总待办</p>
                <p className="text-3xl font-bold mt-2 text-blue-700">{tasks.length}</p>
              </div>
              <FileText className="h-10 w-10 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 待办列表 */}
      <div className="space-y-4">
        {loading ? (
          <Card>
            <CardContent className="p-12 text-center">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground mt-4">加载中...</p>
            </CardContent>
          </Card>
        ) : tasks.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
              <p className="text-lg font-medium">太棒了！</p>
              <p className="text-sm text-muted-foreground mt-2">暂无待办事项</p>
            </CardContent>
          </Card>
        ) : (
          tasks.map((task, index) => {
            const Icon = getIcon(task.type);
            
            return (
              <Card 
                key={index}
                className={`cursor-pointer hover:shadow-lg transition-all ${getPriorityColor(task.priority)} border-2`}
                onClick={() => navigate(task.link)}
              >
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-14 h-14 rounded-full ${getPriorityColor(task.priority)} flex items-center justify-center`}>
                        <Icon className="h-6 w-6" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold">{task.title}</h3>
                        <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge className={`text-2xl px-4 py-2 ${getPriorityColor(task.priority)}`}>
                        {task.count}
                      </Badge>
                      <ChevronRight className="h-6 w-6 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}

