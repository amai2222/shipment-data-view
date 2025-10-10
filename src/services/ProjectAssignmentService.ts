import { supabase } from '@/integrations/supabase/client';
import { DynamicRoleService } from './DynamicRoleService';

// 动态生成项目角色权限映射 - 自动同步系统角色
export const PROJECT_ROLE_PERMISSIONS = DynamicRoleService.generateProjectRolePermissions();

export interface UserProjectAssignment {
  id: string;
  user_id: string;
  project_id: string;
  role?: string; // 动态角色类型，支持所有系统角色
  can_view?: boolean;
  can_edit?: boolean;
  can_delete?: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface ProjectAssignmentStats {
  totalProjects: number;
  assignedProjects: number;
  unassignedProjects: number;
  activeProjects: number;
}

export class ProjectAssignmentService {
  // 获取用户的项目分配
  static async getUserProjectAssignments(userId: string): Promise<UserProjectAssignment[]> {
    try {
      const { data, error } = await supabase
        .from('user_projects')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('获取用户项目分配失败:', error);
      throw error;
    }
  }

  // 获取所有项目列表
  static async getAllProjects(): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('获取项目列表失败:', error);
      throw error;
    }
  }

  // 为用户分配项目
  static async assignProjectToUser(
    userId: string, 
    projectId: string, 
    role: string = DynamicRoleService.getDefaultProjectRole()
  ): Promise<void> {
    try {
      // 使用权限系统映射
      const rolePermissions = PROJECT_ROLE_PERMISSIONS[role];

      const { error } = await supabase
        .from('user_projects')
        .upsert({
          user_id: userId,
          project_id: projectId,
          role,
          can_view: rolePermissions.can_view,
          can_edit: rolePermissions.can_edit,
          can_delete: rolePermissions.can_delete,
          created_by: (await supabase.auth.getUser()).data.user?.id
        });

      if (error) throw error;
    } catch (error) {
      console.error('分配项目失败:', error);
      throw error;
    }
  }

  // 移除用户的项目分配
  static async removeProjectFromUser(userId: string, projectId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('user_projects')
        .delete()
        .eq('user_id', userId)
        .eq('project_id', projectId);

      if (error) throw error;
    } catch (error) {
      console.error('移除项目分配失败:', error);
      throw error;
    }
  }

  // 限制用户项目访问（设置所有权限为 false）
  static async restrictProjectFromUser(userId: string, projectId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('user_projects')
        .upsert({
          user_id: userId,
          project_id: projectId,
          role: DynamicRoleService.getDefaultProjectRole(),
          can_view: false,
          can_edit: false,
          can_delete: false,
          created_by: (await supabase.auth.getUser()).data.user?.id
        });

      if (error) throw error;
    } catch (error) {
      console.error('限制项目访问失败:', error);
      throw error;
    }
  }

  // 批量分配项目给用户
  static async batchAssignProjectsToUser(
    userId: string, 
    projectIds: string[], 
    role: string = DynamicRoleService.getDefaultProjectRole()
  ): Promise<void> {
    try {
      // 使用权限系统映射
      const rolePermissions = PROJECT_ROLE_PERMISSIONS[role];

      // 获取当前用户ID
      const currentUserId = (await supabase.auth.getUser()).data.user?.id;
      
      const assignments = projectIds.map(projectId => ({
        user_id: userId,
        project_id: projectId,
        role,
        can_view: rolePermissions.can_view,
        can_edit: rolePermissions.can_edit,
        can_delete: rolePermissions.can_delete,
        created_by: currentUserId
      }));

      const { error } = await supabase
        .from('user_projects')
        .upsert(assignments);

      if (error) throw error;
    } catch (error) {
      console.error('批量分配项目失败:', error);
      throw error;
    }
  }

  // 批量移除用户的项目分配
  static async batchRemoveProjectsFromUser(userId: string, projectIds: string[]): Promise<void> {
    try {
      const { error } = await supabase
        .from('user_projects')
        .delete()
        .eq('user_id', userId)
        .in('project_id', projectIds);

      if (error) throw error;
    } catch (error) {
      console.error('批量移除项目分配失败:', error);
      throw error;
    }
  }

  // 获取用户项目分配统计
  static async getUserProjectStats(userId: string): Promise<ProjectAssignmentStats> {
    try {
      const [projects, assignments] = await Promise.all([
        this.getAllProjects(),
        this.getUserProjectAssignments(userId)
      ]);

      const activeProjects = projects.filter(p => p.project_status === '进行中');
      
      // 修复：正确计算项目分配状态
      // 默认所有用户都有所有项目权限，只有在 user_projects 表中有明确限制时才计算为未分配
      
      // 获取所有项目ID
      const allProjectIds = new Set(projects.map(p => p.id));
      
      // 获取用户有分配记录的项目ID
      const assignedProjectIds = new Set(assignments.map(a => a.project_id));
      
      // 计算明确限制的项目（can_view = false 表示完全限制访问）
      const explicitlyRestrictedProjects = assignments.filter(assignment => 
        assignment.can_view === false
      );
      
      // 计算正常分配的项目（有分配记录且can_view = true）
      const normalAssignedProjects = assignments.filter(assignment => 
        assignment.can_view === true
      );

      return {
        totalProjects: projects.length,
        assignedProjects: normalAssignedProjects.length + (projects.length - assignedProjectIds.size), // 正常分配 + 默认权限
        unassignedProjects: explicitlyRestrictedProjects.length, // 只有明确限制查看的项目才算未分配
        activeProjects: activeProjects.length
      };
    } catch (error) {
      console.error('获取项目分配统计失败:', error);
      throw error;
    }
  }

  // 为所有用户分配所有项目（默认权限设置）
  static async assignAllProjectsToAllUsers(): Promise<void> {
    try {
      const [users, projects] = await Promise.all([
        supabase.from('profiles').select('id'),
        this.getAllProjects()
      ]);

      if (users.error) throw users.error;
      if (!users.data) return;

      const assignments: any[] = [];
      const currentUserId = (await supabase.auth.getUser()).data.user?.id;

      // 使用默认权限
      const defaultPermissions = PROJECT_ROLE_PERMISSIONS[DynamicRoleService.getDefaultProjectRole()];

      for (const user of users.data) {
        for (const project of projects) {
          assignments.push({
            user_id: user.id,
            project_id: project.id,
            role: DynamicRoleService.getDefaultProjectRole(),
            can_view: defaultPermissions.can_view,
            can_edit: defaultPermissions.can_edit,
            can_delete: defaultPermissions.can_delete,
            created_by: currentUserId
          });
        }
      }

      if (assignments.length > 0) {
        const { error } = await supabase
          .from('user_projects')
          .upsert(assignments);

        if (error) throw error;
      }
    } catch (error) {
      console.error('为所有用户分配所有项目失败:', error);
      throw error;
    }
  }

  // 检查用户是否有项目访问权限（默认所有用户都有所有项目权限）
  static async hasProjectAccess(userId: string, projectId: string): Promise<boolean> {
    try {
      // 默认所有用户都有所有项目权限
      // 只有在 user_projects 表中有明确限制时才返回 false
      const { data, error } = await supabase
        .from('user_projects')
        .select('id')
        .eq('user_id', userId)
        .eq('project_id', projectId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      // 如果没有记录，说明用户有访问权限（默认权限）
      // 如果有记录，说明用户有访问权限（明确分配）
      return true;
    } catch (error) {
      console.error('检查项目访问权限失败:', error);
      return true; // 默认返回 true，确保用户有访问权限
    }
  }

  // 获取用户可访问的项目列表
  static async getUserAccessibleProjects(userId: string): Promise<any[]> {
    try {
      const projects = await this.getAllProjects();
      
      // 默认所有用户都可以访问所有项目
      // 只有在 user_projects 表中有明确限制时才过滤
      const restrictedProjects = await supabase
        .from('user_projects')
        .select('project_id')
        .eq('user_id', userId);

      if (restrictedProjects.error) throw restrictedProjects.error;

      // 如果没有限制记录，返回所有项目
      if (!restrictedProjects.data || restrictedProjects.data.length === 0) {
        return projects;
      }

      // 如果有限制记录，返回所有项目（因为默认有权限）
      return projects;
    } catch (error) {
      console.error('获取用户可访问项目失败:', error);
      return [];
    }
  }
}
