// 角色管理服务
// 处理角色的创建、更新和删除

import { supabase } from '@/integrations/supabase/client';
import { ROLES } from '@/config/permissions';

export interface RoleCreationData {
  roleKey: string;
  label: string;
  color: string;
  description: string;
  menu_permissions: string[];
  function_permissions: string[];
  project_permissions: string[];
  data_permissions: string[];
}

export class RoleManagementService {
  /**
   * 创建新角色
   * 1. 添加到 app_role 枚举类型
   * 2. 创建权限模板
   * 3. 更新前端配置
   */
  static async createRole(roleData: RoleCreationData): Promise<void> {
    try {
      // 1. 检查角色是否已存在
      const existingRole = await this.checkRoleExists(roleData.roleKey);
      if (existingRole) {
        throw new Error(`角色 ${roleData.roleKey} 已存在`);
      }

      // 2. 添加到数据库枚举类型
      await this.addRoleToEnum(roleData.roleKey);

      // 3. 创建权限模板
      await this.createRoleTemplate(roleData);

      // 4. 为新角色创建项目分配权限
      await this.createProjectAssignments(roleData.roleKey);

    } catch (error) {
      console.error('创建角色失败:', error);
      throw error;
    }
  }

  /**
   * 检查角色是否已存在
   */
  private static async checkRoleExists(roleKey: string): Promise<boolean> {
    try {
      // 检查枚举类型中是否存在
      const { data, error } = await supabase.rpc('check_enum_value', {
        enum_name: 'app_role',
        enum_value: roleKey
      });

      if (error) {
        // 如果函数不存在，使用查询方式检查
        const { data: enumData } = await supabase
          .from('pg_enum')
          .select('enumlabel')
          .eq('enumlabel', roleKey);

        return enumData && enumData.length > 0;
      }

      return data || false;
    } catch (error) {
      console.error('检查角色存在性失败:', error);
      return false;
    }
  }

  /**
   * 添加角色到枚举类型
   */
  private static async addRoleToEnum(roleKey: string): Promise<void> {
    try {
      // 先检查枚举值是否已存在
      const { data: exists, error: checkError } = await supabase.rpc('check_enum_value', {
        enum_name: 'app_role',
        enum_value: roleKey
      });

      if (checkError) {
        throw new Error(`检查枚举值失败: ${checkError.message}`);
      }

      // 如果不存在，则添加
      if (!exists) {
        const { error } = await supabase.rpc('add_enum_value', {
          enum_name: 'app_role',
          enum_value: roleKey
        });

        if (error) {
          throw new Error(`无法添加角色到枚举类型: ${error.message}`);
        }

        // 等待一小段时间确保枚举值已提交
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error('添加角色到枚举失败:', error);
      throw error;
    }
  }

  /**
   * 创建角色权限模板
   */
  private static async createRoleTemplate(roleData: RoleCreationData): Promise<void> {
    const { error } = await supabase
      .from('role_permission_templates')
      .insert({
        role: roleData.roleKey,
        menu_permissions: roleData.menu_permissions,
        function_permissions: roleData.function_permissions,
        project_permissions: roleData.project_permissions,
        data_permissions: roleData.data_permissions,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (error) {
      throw new Error(`创建角色模板失败: ${error.message}`);
    }
  }

  /**
   * 为新角色创建项目分配权限
   */
  private static async createProjectAssignments(roleKey: string): Promise<void> {
    try {
      // 获取所有项目
      const { data: projects, error: projectsError } = await supabase
        .from('projects')
        .select('id');

      if (projectsError) {
        console.warn('获取项目列表失败:', projectsError);
        return;
      }

      if (!projects || projects.length === 0) {
        return;
      }

      // 获取管理员用户ID作为创建者
      const { data: adminUser } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'admin')
        .limit(1);

      const createdBy = adminUser?.[0]?.id;

      // 为新角色创建默认项目分配
      const assignments = projects.map(project => ({
        user_id: createdBy, // 使用管理员ID作为占位符
        project_id: project.id,
        role: roleKey,
        can_view: true,
        can_edit: roleKey === 'admin', // 只有管理员可以编辑
        can_delete: roleKey === 'admin', // 只有管理员可以删除
        created_by: createdBy
      }));

      const { error } = await supabase
        .from('user_projects')
        .insert(assignments);

      if (error) {
        console.warn('创建项目分配失败:', error);
      }
    } catch (error) {
      console.error('创建项目分配失败:', error);
    }
  }

  /**
   * 获取所有可用角色
   */
  static async getAllRoles(): Promise<Array<{ key: string; label: string; color: string }>> {
    try {
      // 从数据库获取枚举值
      const { data, error } = await supabase
        .from('pg_enum')
        .select('enumlabel')
        .eq('enumlabel', 'app_role');

      if (error) {
        // 如果查询失败，返回配置中的角色
        return Object.entries(ROLES).map(([key, role]) => ({
          key,
          label: role.label,
          color: role.color
        }));
      }

      // 合并数据库角色和配置角色
      const dbRoles = data?.map(item => item.enumlabel) || [];
      const configRoles = Object.entries(ROLES);
      
      const allRoles = configRoles.map(([key, role]) => ({
        key,
        label: role.label,
        color: role.color
      }));

      // 添加数据库中存在但配置中不存在的角色
      dbRoles.forEach(roleKey => {
        if (!configRoles.find(([key]) => key === roleKey)) {
          allRoles.push({
            key: roleKey,
            label: roleKey,
            color: 'bg-gray-500'
          });
        }
      });

      return allRoles;
    } catch (error) {
      console.error('获取角色列表失败:', error);
      // 返回配置中的角色作为后备
      return Object.entries(ROLES).map(([key, role]) => ({
        key,
        label: role.label,
        color: role.color
      }));
    }
  }

  /**
   * 删除角色
   */
  static async deleteRole(roleKey: string): Promise<void> {
    try {
      // 1. 删除权限模板
      const { error: templateError } = await supabase
        .from('role_permission_templates')
        .delete()
        .eq('role', roleKey);

      if (templateError) {
        throw new Error(`删除权限模板失败: ${templateError.message}`);
      }

      // 2. 删除项目分配
      const { error: projectError } = await supabase
        .from('user_projects')
        .delete()
        .eq('role', roleKey);

      if (projectError) {
        console.warn('删除项目分配失败:', projectError);
      }

      // 3. 更新用户角色（将使用该角色的用户改为默认角色）
      const { error: userError } = await supabase
        .from('profiles')
        .update({ role: 'operator' }) // 改为操作员
        .eq('role', roleKey);

      if (userError) {
        console.warn('更新用户角色失败:', userError);
      }

      // 注意：无法从枚举类型中删除值，这是 PostgreSQL 的限制
      console.warn(`角色 ${roleKey} 已从系统中删除，但枚举类型中的值需要手动清理`);
    } catch (error) {
      console.error('删除角色失败:', error);
      throw error;
    }
  }
}
