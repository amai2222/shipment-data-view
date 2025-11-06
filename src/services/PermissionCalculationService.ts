import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';
import { PROJECT_ROLE_PERMISSIONS } from './ProjectAssignmentService';

export interface UserEffectivePermissions {
  menu: string[];
  function: string[];
  project: string[];
  data: string[];
  total: number;
}

export class PermissionCalculationService {
  /**
   * 计算用户的有效权限（包括角色模板权限、用户自定义权限和项目分配权限）
   */
  static async getUserEffectivePermissions(userId: string): Promise<UserEffectivePermissions> {
    try {
      // 1. 获取用户信息
      const { data: user, error: userError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();

      if (userError) throw userError;
      if (!user) throw new Error('用户不存在');

      // 2. 获取角色模板权限
      const { data: roleTemplate, error: roleError } = await supabase
        .from('role_permission_templates')
        .select('menu_permissions, function_permissions, project_permissions, data_permissions')
        .eq('role', user.role)
        .single();

      if (roleError) throw roleError;

      // 3. 获取用户自定义权限
      const { data: userPermissions, error: userPermError } = await supabase
        .from('user_permissions')
        .select('menu_permissions, function_permissions, project_permissions, data_permissions')
        .eq('user_id', userId)
        .single();

      if (userPermError && userPermError.code !== 'PGRST116') {
        throw userPermError;
      }

      // 4. 获取用户项目分配权限
      const { data: projectAssignments, error: projectError } = await supabase
        .from('user_projects')
        .select('role')
        .eq('user_id', userId);

      if (projectError) throw projectError;

      // 5. 计算有效权限
      const effectivePermissions = this.calculateEffectivePermissions(
        roleTemplate,
        userPermissions,
        projectAssignments || []
      );

      return effectivePermissions;
    } catch (error) {
      console.error('计算用户有效权限失败:', error);
      throw error;
    }
  }

  /**
   * 计算有效权限
   */
  private static calculateEffectivePermissions(
    roleTemplate: any,
    userPermissions: any,
    projectAssignments: any[]
  ): UserEffectivePermissions {
    // 基础权限（角色模板或用户自定义权限）
    const basePermissions = {
      menu: userPermissions?.menu_permissions || roleTemplate?.menu_permissions || [],
      function: userPermissions?.function_permissions || roleTemplate?.function_permissions || [],
      project: userPermissions?.project_permissions || roleTemplate?.project_permissions || [],
      data: userPermissions?.data_permissions || roleTemplate?.data_permissions || []
    };

    // 项目分配权限
    const projectRolePermissions = new Set<string>();
    
    // 收集所有项目角色的权限
    projectAssignments.forEach(assignment => {
      const rolePermissions = PROJECT_ROLE_PERMISSIONS[assignment.role as keyof typeof PROJECT_ROLE_PERMISSIONS];
      if (rolePermissions) {
        rolePermissions.additionalPermissions.forEach(permission => {
          projectRolePermissions.add(permission);
        });
      }
    });

    // 合并权限（项目分配权限是额外的，不替换基础权限）
    const effectivePermissions = {
      menu: [...basePermissions.menu],
      function: [...basePermissions.function],
      project: [...basePermissions.project, ...Array.from(projectRolePermissions)],
      data: [...basePermissions.data]
    };

    // 计算总数
    const total = effectivePermissions.menu.length + 
                  effectivePermissions.function.length + 
                  effectivePermissions.project.length + 
                  effectivePermissions.data.length;

    return {
      ...effectivePermissions,
      total
    };
  }

  /**
   * 获取用户权限统计
   */
  static async getUserPermissionStats(userId: string): Promise<{
    total: number;
    menu: number;
    function: number;
    project: number;
    data: number;
    projectAssignments: number;
  }> {
    try {
      const effectivePermissions = await this.getUserEffectivePermissions(userId);
      
      return {
        total: effectivePermissions.total,
        menu: effectivePermissions.menu.length,
        function: effectivePermissions.function.length,
        project: effectivePermissions.project.length,
        data: effectivePermissions.data.length,
        projectAssignments: effectivePermissions.project.length - (effectivePermissions.project.length - Array.from(new Set(effectivePermissions.project)).length)
      };
    } catch (error) {
      console.error('获取用户权限统计失败:', error);
      throw error;
    }
  }

  /**
   * 检查用户是否有特定权限
   */
  static async hasPermission(userId: string, permission: string): Promise<boolean> {
    try {
      const effectivePermissions = await this.getUserEffectivePermissions(userId);
      
      return effectivePermissions.menu.includes(permission) ||
             effectivePermissions.function.includes(permission) ||
             effectivePermissions.project.includes(permission) ||
             effectivePermissions.data.includes(permission);
    } catch (error) {
      console.error('检查用户权限失败:', error);
      return false;
    }
  }
}