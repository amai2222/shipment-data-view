// 项目状态变更服务
// 处理项目状态变更时的自动权限分配

import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';
import { DynamicRoleService } from './DynamicRoleService';

export interface ProjectStatusChange {
  projectId: string;
  oldStatus: string;
  newStatus: string;
  projectName: string;
}

export class ProjectStatusService {
  /**
   * 更新项目状态
   * 当状态变更为"进行中"时，自动为所有用户分配访问权限
   */
  static async updateProjectStatus(
    projectId: string, 
    newStatus: string
  ): Promise<ProjectStatusChange> {
    try {
      // 1. 获取当前项目信息
      const { data: currentProject, error: fetchError } = await supabase
        .from('projects')
        .select('id, name, project_status')
        .eq('id', projectId)
        .single();

      if (fetchError) throw fetchError;
      if (!currentProject) throw new Error('项目不存在');

      const oldStatus = currentProject.project_status;

      // 2. 更新项目状态
      const { error: updateError } = await supabase
        .from('projects')
        .update({ 
          project_status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', projectId);

      if (updateError) throw updateError;

      // 3. 如果状态变更为"进行中"，自动分配权限
      if (newStatus === '进行中' && oldStatus !== '进行中') {
        await this.assignProjectToAllUsers(projectId);
      }

      return {
        projectId,
        oldStatus: oldStatus || '',
        newStatus,
        projectName: currentProject.name
      };

    } catch (error) {
      console.error('更新项目状态失败:', error);
      throw error;
    }
  }

  /**
   * 为所有用户分配项目权限
   */
  private static async assignProjectToAllUsers(projectId: string): Promise<void> {
    try {
      // 1. 获取所有活跃用户
      const { data: users, error: usersError } = await supabase
        .from('profiles')
        .select('id')
        .eq('is_active', true);

      if (usersError) throw usersError;
      if (!users || users.length === 0) return;

      // 2. 获取当前用户ID
      const currentUserId = (await supabase.auth.getUser()).data.user?.id;

      // 3. 为所有用户分配项目权限
      const assignments = users.map(user => ({
        user_id: user.id,
        project_id: projectId,
        role: DynamicRoleService.getDefaultProjectRole(),
        can_view: true,
        can_edit: true,
        can_delete: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: currentUserId
      }));

      // 4. 批量插入（使用 upsert 避免重复）
      const { error: insertError } = await supabase
        .from('user_projects')
        .upsert(assignments, { 
          onConflict: 'user_id,project_id',
          ignoreDuplicates: true 
        });

      if (insertError) throw insertError;

      console.log(`项目 ${projectId} 已为 ${users.length} 个用户分配访问权限`);

    } catch (error) {
      console.error('为所有用户分配项目权限失败:', error);
      throw error;
    }
  }

  /**
   * 批量更新项目状态
   */
  static async batchUpdateProjectStatus(
    projectIds: string[], 
    newStatus: string
  ): Promise<ProjectStatusChange[]> {
    try {
      const results: ProjectStatusChange[] = [];
      
      for (const projectId of projectIds) {
        const result = await this.updateProjectStatus(projectId, newStatus);
        results.push(result);
      }

      return results;
    } catch (error) {
      console.error('批量更新项目状态失败:', error);
      throw error;
    }
  }

  /**
   * 获取项目状态变更历史
   */
  static async getProjectStatusHistory(projectId: string): Promise<ProjectStatusChange[]> {
    try {
      // 这里可以扩展为记录项目状态变更历史
      // 目前返回空数组，未来可以实现状态变更日志
      return [];
    } catch (error) {
      console.error('获取项目状态历史失败:', error);
      throw error;
    }
  }

  /**
   * 检查项目状态变更是否需要权限分配
   */
  static shouldAssignPermissions(oldStatus: string, newStatus: string): boolean {
    return newStatus === '进行中' && oldStatus !== '进行中';
  }
}
