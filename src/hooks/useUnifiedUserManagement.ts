import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { UserRole, UserProfile } from '@/contexts/AuthContext';

interface CreateUserData {
  email: string;
  username: string;
  full_name: string;
  role: UserRole;
  password: string;
  work_wechat_userid?: string;
}

interface ExtendedUserProfile extends UserProfile {
  work_wechat_userid?: string;
  created_at?: string;
}

export function useUnifiedUserManagement() {
  const [users, setUsers] = useState<ExtendedUserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchUsers = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, username, full_name, role, is_active, created_at, work_wechat_userid, work_wechat_department')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        toast({
          title: "获取用户列表失败",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      if (data) {
        setUsers(data.map(user => ({
          id: user.id,
          email: user.email || '',
          username: user.username || user.email || '',
          full_name: user.full_name || '',
          role: user.role as UserRole,
          is_active: user.is_active ?? true,
          work_wechat_userid: user.work_wechat_userid,
          work_wechat_department: user.work_wechat_department,
          created_at: user.created_at
        })));
      }
    } catch (error) {
      console.error('获取用户列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const createUser = async (userData: CreateUserData) => {
    if (!userData.email || !userData.password || !userData.username) {
      toast({
        title: "创建失败",
        description: "请填写完整信息",
        variant: "destructive",
      });
      return false;
    }

    setLoading(true);
    try {
      // 创建用户账户
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: userData.email,
        password: userData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            username: userData.username,
            full_name: userData.full_name
          }
        }
      });

      if (authError) {
        toast({
          title: "创建用户失败",
          description: authError.message,
          variant: "destructive",
        });
        return false;
      }

      if (authData.user) {
        // 更新用户配置
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            username: userData.username,
            full_name: userData.full_name,
            role: userData.role,
            work_wechat_userid: userData.work_wechat_userid || null
          } as any)
          .eq('id', authData.user.id);

        if (profileError) {
          console.error('更新用户配置失败:', profileError);
        }
      }

      toast({
        title: "创建成功",
        description: "用户创建成功",
      });

      fetchUsers();
      return true;
    } catch (error) {
      console.error('创建用户失败:', error);
      toast({
        title: "创建失败",
        description: "创建用户时发生错误",
        variant: "destructive",
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const updateUser = async (userId: string, updates: Partial<ExtendedUserProfile>) => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('profiles')
        .update(updates as any)
        .eq('id', userId);

      if (error) {
        toast({
          title: "更新失败",
          description: error.message,
          variant: "destructive",
        });
        return false;
      }

      toast({
        title: "更新成功",
        description: "用户信息已更新",
      });

      // 只更新状态，避免重新获取所有数据
      setUsers(prev => prev.map(u => 
        u.id === userId ? { ...u, ...updates } : u
      ));
      return true;
    } catch (error) {
      console.error('更新用户失败:', error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const toggleUserStatus = async (user: ExtendedUserProfile) => {
    return updateUser(user.id, { is_active: !user.is_active });
  };

  const updateRole = async (userId: string, role: UserRole) => {
    return updateUser(userId, { role });
  };

  const resetPassword = async (userId: string, newPassword: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-reset-password', {
        body: {
          userId,
          newPassword,
        },
      });

      if (error) {
        toast({ title: '修改失败', description: error.message, variant: 'destructive' });
        return false;
      }

      toast({ title: '修改成功', description: '密码已更新' });
      return true;
    } catch (error) {
      console.error('修改密码失败:', error);
      toast({ title: '修改失败', description: '修改密码时发生错误', variant: 'destructive' });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const linkWorkWechat = async (userId: string, workWechatUserId: string) => {
    return updateUser(userId, { work_wechat_userid: workWechatUserId });
  };

  const unlinkWorkWechat = async (userId: string) => {
    return updateUser(userId, { work_wechat_userid: null });
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  return {
    users,
    loading,
    fetchUsers,
    createUser,
    updateUser,
    toggleUserStatus,
    updateRole,
    resetPassword,
    linkWorkWechat,
    unlinkWorkWechat
  };
}