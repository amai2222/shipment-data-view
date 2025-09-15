// 项目状态管理组件
// 提供项目状态变更界面和自动权限分配功能

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useProjectStatus } from '@/hooks/useProjectStatus';
import { 
  Play, 
  Pause, 
  CheckCircle, 
  AlertCircle,
  Settings,
  Users,
  RefreshCw
} from 'lucide-react';

interface Project {
  id: string;
  name: string;
  project_status: string;
  manager?: string;
  start_date?: string;
  end_date?: string;
}

interface ProjectStatusManagerProps {
  projects: Project[];
  onProjectUpdate?: () => void;
}

const STATUS_OPTIONS = [
  { value: '未开始', label: '未开始', color: 'bg-gray-500' },
  { value: '进行中', label: '进行中', color: 'bg-blue-500' },
  { value: '已完成', label: '已完成', color: 'bg-green-500' },
  { value: '已暂停', label: '已暂停', color: 'bg-yellow-500' },
  { value: '已取消', label: '已取消', color: 'bg-red-500' },
];

export function ProjectStatusManager({ projects, onProjectUpdate }: ProjectStatusManagerProps) {
  const { toast } = useToast();
  const { updateProjectStatus, batchUpdateProjectStatus, updating, batchUpdating } = useProjectStatus({
    onStatusChange: (change) => {
      onProjectUpdate?.();
    }
  });

  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [showBatchDialog, setShowBatchDialog] = useState(false);
  const [batchStatus, setBatchStatus] = useState('');

  // 获取状态图标
  const getStatusIcon = (status: string) => {
    switch (status) {
      case '进行中': return <Play className="h-4 w-4" />;
      case '已完成': return <CheckCircle className="h-4 w-4" />;
      case '已暂停': return <Pause className="h-4 w-4" />;
      case '已取消': return <AlertCircle className="h-4 w-4" />;
      default: return <Settings className="h-4 w-4" />;
    }
  };

  // 获取状态颜色
  const getStatusColor = (status: string) => {
    const option = STATUS_OPTIONS.find(opt => opt.value === status);
    return option?.color || 'bg-gray-500';
  };

  // 更新单个项目状态
  const handleStatusChange = async (projectId: string, newStatus: string) => {
    const result = await updateProjectStatus(projectId, newStatus);
    if (result) {
      onProjectUpdate?.();
    }
  };

  // 批量更新项目状态
  const handleBatchStatusChange = async () => {
    if (selectedProjects.length === 0 || !batchStatus) return;

    const results = await batchUpdateProjectStatus(selectedProjects, batchStatus);
    if (results.length > 0) {
      setSelectedProjects([]);
      setShowBatchDialog(false);
      setBatchStatus('');
      onProjectUpdate?.();
    }
  };

  // 全选/取消全选
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedProjects(projects.map(p => p.id));
    } else {
      setSelectedProjects([]);
    }
  };

  // 选择项目
  const handleSelectProject = (projectId: string, checked: boolean) => {
    if (checked) {
      setSelectedProjects(prev => [...prev, projectId]);
    } else {
      setSelectedProjects(prev => prev.filter(id => id !== projectId));
    }
  };

  return (
    <div className="space-y-6">
      {/* 批量操作区域 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            批量状态管理
          </CardTitle>
          <CardDescription>
            选择项目后可以批量更新状态，状态变更为"进行中"时将自动分配权限
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="select-all"
                checked={selectedProjects.length === projects.length}
                onCheckedChange={handleSelectAll}
              />
              <Label htmlFor="select-all">全选</Label>
            </div>
            
            <span className="text-sm text-gray-500">
              已选择 {selectedProjects.length} 个项目
            </span>

            {selectedProjects.length > 0 && (
              <Dialog open={showBatchDialog} onOpenChange={setShowBatchDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" disabled={batchUpdating}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${batchUpdating ? 'animate-spin' : ''}`} />
                    批量更新状态
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>批量更新项目状态</DialogTitle>
                    <DialogDescription>
                      为 {selectedProjects.length} 个项目批量更新状态
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="batch-status">新状态</Label>
                      <Select value={batchStatus} onValueChange={setBatchStatus}>
                        <SelectTrigger>
                          <SelectValue placeholder="选择新状态" />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map(option => (
                            <SelectItem key={option.value} value={option.value}>
                              <div className="flex items-center gap-2">
                                <div className={`w-3 h-3 rounded-full ${option.color}`} />
                                {option.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {batchStatus === '进行中' && (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-center gap-2 text-blue-700">
                          <Users className="h-4 w-4" />
                          <span className="text-sm font-medium">
                            状态变更为"进行中"时将自动为所有用户分配访问权限
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setShowBatchDialog(false)}>
                        取消
                      </Button>
                      <Button 
                        onClick={handleBatchStatusChange}
                        disabled={!batchStatus || batchUpdating}
                      >
                        {batchUpdating ? '更新中...' : '确认更新'}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 项目列表 */}
      <Card>
        <CardHeader>
          <CardTitle>项目状态列表</CardTitle>
          <CardDescription>
            点击状态可以快速更新，状态变更为"进行中"时自动分配权限
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {projects.map(project => (
              <div key={project.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  <Checkbox
                    checked={selectedProjects.includes(project.id)}
                    onCheckedChange={(checked) => handleSelectProject(project.id, checked as boolean)}
                  />
                  
                  <div className="flex-1">
                    <h3 className="font-medium">{project.name}</h3>
                    {project.manager && (
                      <p className="text-sm text-gray-500">负责人: {project.manager}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <Badge className={`${getStatusColor(project.project_status)} text-white`}>
                    <div className="flex items-center gap-1">
                      {getStatusIcon(project.project_status)}
                      {project.project_status}
                    </div>
                  </Badge>

                  <Select
                    value={project.project_status}
                    onValueChange={(newStatus) => handleStatusChange(project.id, newStatus)}
                    disabled={updating}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${option.color}`} />
                            {option.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
