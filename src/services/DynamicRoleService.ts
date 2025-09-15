import { ROLES } from '@/config/permissions';

// 项目角色权限配置模板
export interface ProjectRolePermissionTemplate {
  additionalPermissions: string[];
  can_view: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

// 动态生成项目角色权限映射
export class DynamicRoleService {
  /**
   * 根据系统角色动态生成项目角色权限映射
   */
  static generateProjectRolePermissions(): Record<string, ProjectRolePermissionTemplate> {
    const projectRolePermissions: Record<string, ProjectRolePermissionTemplate> = {};
    
    // 遍历系统所有角色
    Object.keys(ROLES).forEach(role => {
      projectRolePermissions[role] = this.getDefaultProjectPermissions(role);
    });
    
    return projectRolePermissions;
  }

  /**
   * 根据角色类型获取默认项目权限
   */
  private static getDefaultProjectPermissions(role: string): ProjectRolePermissionTemplate {
    // 根据角色类型设置不同的默认权限
    switch (role) {
      case 'admin':
        return {
          additionalPermissions: [
            'project_access',
            'project.view_all', 
            'project.admin',
            'project_data',
            'project_data.view_financial',
            'project_data.edit_financial', 
            'project_data.view_operational',
            'project_data.edit_operational'
          ],
          can_view: true,
          can_edit: true,
          can_delete: true
        };
      
      case 'finance':
        return {
          additionalPermissions: [
            'project_access',
            'project.view_all',
            'project_data',
            'project_data.view_financial',
            'project_data.edit_financial'
          ],
          can_view: true,
          can_edit: true,
          can_delete: false
        };
      
      case 'business':
        return {
          additionalPermissions: [
            'project_access',
            'project.view_assigned',
            'project.manage',
            'project_data',
            'project_data.view_operational',
            'project_data.edit_operational'
          ],
          can_view: true,
          can_edit: true,
          can_delete: false
        };
      
      case 'operator':
        return {
          additionalPermissions: [
            'project_access',
            'project.view_assigned',
            'project_data',
            'project_data.view_operational'
          ],
          can_view: true,
          can_edit: true,
          can_delete: false
        };
      
      case 'partner':
        return {
          additionalPermissions: [
            'project_access',
            'project.view_assigned',
            'project_data',
            'project_data.view_operational'
          ],
          can_view: true,
          can_edit: false,
          can_delete: false
        };
      
      case 'viewer':
        return {
          additionalPermissions: [
            'project_access',
            'project.view_all',
            'project_data',
            'project_data.view_financial',
            'project_data.view_operational'
          ],
          can_view: true,
          can_edit: false,
          can_delete: false
        };
      
      // 默认权限（用于新增角色）
      default:
        return {
          additionalPermissions: [
            'project_access',
            'project.view_assigned',
            'project_data',
            'project_data.view_operational'
          ],
          can_view: true,
          can_edit: false,
          can_delete: false
        };
    }
  }

  /**
   * 获取所有系统角色列表
   */
  static getAllSystemRoles(): string[] {
    return Object.keys(ROLES);
  }

  /**
   * 获取角色显示名称
   */
  static getRoleDisplayName(role: string): string {
    return ROLES[role as keyof typeof ROLES]?.label || role;
  }

  /**
   * 获取角色颜色
   */
  static getRoleColor(role: string): string {
    return ROLES[role as keyof typeof ROLES]?.color || 'bg-gray-500';
  }

  /**
   * 检查角色是否存在
   */
  static isValidRole(role: string): boolean {
    return role in ROLES;
  }

  /**
   * 获取默认项目角色（用于新用户）
   */
  static getDefaultProjectRole(): string {
    return 'operator'; // 默认使用操作员角色
  }

  /**
   * 生成角色选择选项（用于UI组件）
   */
  static generateRoleSelectOptions(): Array<{ value: string; label: string; color: string }> {
    return Object.entries(ROLES).map(([key, role]) => ({
      value: key,
      label: role.label,
      color: role.color
    }));
  }
}
