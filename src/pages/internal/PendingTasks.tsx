// PC端 - 待办事项（参考操作日志布局）

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';
import {
  Bell,
  FileText,
  Truck,
  AlertTriangle,
  CheckCircle,
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

      setTasks(taskList);
    } catch (error) {
      console.error('加载待办失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high': return <Badge className="bg-red-100 text-red-800">高</Badge>;
      case 'medium': return <Badge className="bg-yellow-100 text-yellow-800">中</Badge>;
      case 'low': return <Badge className="bg-blue-100 text-blue-800">低</Badge>;
      default: return <Badge>-</Badge>;
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

  const totalCount = tasks.reduce((sum, t) => sum + t.count, 0);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">待办事项</h1>
        <p className="text-muted-foreground">查看需要处理的任务和提醒</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                待办汇总
              </CardTitle>
              <CardDescription>
                共 {totalCount} 个待办事项
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={loadTasks} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
      </Card>

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
        <div className="space-y-4">
          {tasks.map((task, index) => {
            const Icon = getIcon(task.type);
            
            return (
              <Card 
                key={index}
                className="cursor-pointer hover:shadow-lg transition-all border-l-4 border-l-primary"
                onClick={() => navigate(task.link)}
              >
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <Icon className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-semibold">{task.title}</h3>
                          {getPriorityBadge(task.priority)}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge className="text-2xl px-4 py-2 bg-primary text-primary-foreground">
                        {task.count}
                      </Badge>
                      <ChevronRight className="h-6 w-6 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
