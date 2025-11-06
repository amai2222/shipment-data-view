// PC端 - 待办事项（桌面完整版）

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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

      // 待审核费用
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

      // 待审批换车
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

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'border-red-300 bg-red-50';
      case 'medium': return 'border-yellow-300 bg-yellow-50';
      case 'low': return 'border-blue-300 bg-blue-50';
      default: return 'border-gray-300 bg-gray-50';
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="mt-4 text-sm text-muted-foreground">加载待办事项中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* 顶部操作栏 */}
      <div className="border-b bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-xl font-semibold">待办事项</h1>
            <Separator orientation="vertical" className="h-6" />
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">总待办</span>
              <span className="font-semibold text-lg text-primary">{totalCount}</span>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={loadTasks} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* 主内容区 */}
      <div className="flex-1 overflow-auto px-6 py-6">
        {tasks.length === 0 ? (
          <div className="border rounded-lg bg-card p-12 text-center">
            <CheckCircle className="h-16 w-16 mx-auto text-green-500 mb-4" />
            <p className="text-xl font-semibold text-green-700">太棒了！</p>
            <p className="text-sm text-muted-foreground mt-2">暂无待办事项</p>
          </div>
        ) : (
          <div className="space-y-4">
            {tasks.map((task, index) => {
              const Icon = getIcon(task.type);
              
              return (
                <div
                  key={index}
                  className={`border-2 rounded-lg p-6 cursor-pointer hover:shadow-lg transition-all ${getPriorityColor(task.priority)}`}
                  onClick={() => navigate(task.link)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-14 h-14 rounded-full border-2 ${getPriorityColor(task.priority)} flex items-center justify-center`}>
                        <Icon className="h-7 w-7" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold">{task.title}</h3>
                        <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge className="text-2xl px-5 py-2 bg-primary text-primary-foreground">
                        {task.count}
                      </Badge>
                      <ChevronRight className="h-6 w-6 text-muted-foreground" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
