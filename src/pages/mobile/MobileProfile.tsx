// 移动端 - 个人资料
// 功能：查看和修改个人信息、上传头像

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MobileLayout } from '@/components/mobile/MobileLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';
import {
  ArrowLeft,
  Camera,
  User,
  Mail,
  Phone,
  Save,
  Loader2
} from 'lucide-react';

export default function MobileProfile() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    avatar_url: ''
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || '',
        phone: (user?.user_metadata?.phone || user?.phone) || '',
        avatar_url: profile.avatar_url || ''
      });
    }
  }, [profile, user]);

  const handleSave = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name,
          avatar_url: formData.avatar_url,
          updated_at: new Date().toISOString()
        })
        .eq('id', user?.id);

      if (error) throw error;

      toast({ title: '保存成功', description: '个人资料已更新' });
      
    } catch (error: any) {
      toast({ title: '保存失败', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const getInitials = () => {
    if (formData.full_name) {
      return formData.full_name.substring(0, 2).toUpperCase();
    }
    return profile?.role?.substring(0, 2).toUpperCase() || 'U';
  };

  return (
    <MobileLayout>
      <div className="space-y-4 pb-6">
        {/* 头部 */}
        <div className="flex items-center gap-4 bg-white p-4 rounded-lg shadow-sm sticky top-0 z-10">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold flex-1">个人资料</h1>
        </div>

        {/* 头像部分 */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col items-center space-y-4">
              <div className="relative">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={formData.avatar_url} />
                  <AvatarFallback className="text-2xl bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                    {getInitials()}
                  </AvatarFallback>
                </Avatar>
                <Button
                  size="sm"
                  className="absolute bottom-0 right-0 rounded-full h-8 w-8 p-0"
                  onClick={() => {
                    toast({ title: '功能开发中', description: '头像上传功能即将上线' });
                  }}
                >
                  <Camera className="h-4 w-4" />
                </Button>
              </div>
              <div className="text-center">
                <p className="font-semibold text-lg">{formData.full_name || '未设置姓名'}</p>
                <p className="text-sm text-muted-foreground">{profile?.email}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 个人信息 */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-5 w-5" />
              <h2 className="font-semibold">基本信息</h2>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>姓名</Label>
              <Input
                value={formData.full_name}
                onChange={e => setFormData({...formData, full_name: e.target.value})}
                placeholder="输入您的姓名"
              />
            </div>

            <div>
              <Label>邮箱</Label>
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-md">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{profile?.email}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">邮箱不可修改</p>
            </div>

            <div>
              <Label>用户名</Label>
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-md">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{profile?.username || '-'}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">用户名不可修改</p>
            </div>

            <div>
              <Label>角色</Label>
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-md">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{profile?.role}</span>
              </div>
            </div>

            <Button 
              onClick={handleSave} 
              disabled={loading}
              className="w-full"
            >
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              保存修改
            </Button>
          </CardContent>
        </Card>
      </div>
    </MobileLayout>
  );
}

