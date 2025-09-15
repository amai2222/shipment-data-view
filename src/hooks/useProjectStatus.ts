// 项目状态管理 Hook
// 提供项目状态变更和自动权限分配功能

import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { ProjectStatusService, ProjectStatusChange } from '@/services/ProjectStatusService';

export interface UseProjectStatusOptions {
  onStatusChange?: (change: ProjectStatusChange) => void;
  onPermissionAssigned?: (projectId: string, userCount: number) => void;
}

export function useProjectStatus(options: UseProjectStatusOptions = {}) {
  const { toast } = useToast();
  const [updating, setUpdating] = useState(false);
  const [batchUpdating, setBatchUpdating] = useState(false);

  /**
   * 更新单个项目状态
   */
  const updateProjectStatus = useCallback(async (
    projectId: string, 
    newStatus: string
  ): Promise<ProjectStatusChange | null> => {
    try {
      setUpdating(true);
      
      const change = await ProjectStatusService.updateProjectStatus(projectId, newStatus);
      
      // 显示成功消息
      toast({
        title: "项目状态更新成功",
        description: `项目 "${change.projectName}" 状态已更新为 "${change.newStatus}"`,
      });

      // 如果状态变更为"进行中"，显示权限分配消息
      if (ProjectStatusService.shouldAssignPermissions(change.oldStatus, change.newStatus)) {
        toast({
          title: "权限自动分配",
          description: `项目 "${change.projectName}" 已为所有用户分配访问权限`,
        });
      }

      // 调用回调函数
      options.onStatusChange?.(change);

      return change;
    } catch (error) {
      console.error('更新项目状态失败:', error);
      toast({
        title: "更新失败",
        description: "项目状态更新失败，请重试",
        variant: "destructive",
      });
      return null;
    } finally {
      setUpdating(false);
    }
  }, [toast, options]);

  /**
   * 批量更新项目状态
   */
  const batchUpdateProjectStatus = useCallback(async (
    projectIds: string[], 
    newStatus: string
  ): Promise<ProjectStatusChange[]> => {
    try {
      setBatchUpdating(true);
      
      const changes = await ProjectStatusService.batchUpdateProjectStatus(projectIds, newStatus);
      
      // 统计状态变更
      const statusChanges = changes.filter(change => 
        ProjectStatusService.shouldAssignPermissions(change.oldStatus, change.newStatus)
      );

      // 显示成功消息
      toast({
        title: "批量更新成功",
        description: `已更新 ${changes.length} 个项目的状态为 "${newStatus}"`,
      });

      // 如果有权限分配，显示额外消息
      if (statusChanges.length > 0) {
        toast({
          title: "权限自动分配",
          description: `${statusChanges.length} 个项目已为所有用户分配访问权限`,
        });
      }

      // 调用回调函数
      changes.forEach(change => options.onStatusChange?.(change));

      return changes;
    } catch (error) {
      console.error('批量更新项目状态失败:', error);
      toast({
        title: "批量更新失败",
        description: "项目状态批量更新失败，请重试",
        variant: "destructive",
      });
      return [];
    } finally {
      setBatchUpdating(false);
    }
  }, [toast, options]);

  /**
   * 获取项目状态历史
   */
  const getProjectStatusHistory = useCallback(async (projectId: string) => {
    try {
      return await ProjectStatusService.getProjectStatusHistory(projectId);
    } catch (error) {
      console.error('获取项目状态历史失败:', error);
      return [];
    }
  }, []);

  /**
   * 检查状态变更是否需要权限分配
   */
  const shouldAssignPermissions = useCallback((
    oldStatus: string, 
    newStatus: string
  ): boolean => {
    return ProjectStatusService.shouldAssignPermissions(oldStatus, newStatus);
  }, []);

  return {
    // 状态
    updating,
    batchUpdating,
    
    // 方法
    updateProjectStatus,
    batchUpdateProjectStatus,
    getProjectStatusHistory,
    shouldAssignPermissions,
  };
}
