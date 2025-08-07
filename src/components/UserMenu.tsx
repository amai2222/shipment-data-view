import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { User, LogOut, UserCheck, Key } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export function UserMenu() {
  const { profile, signOut, switchUser } = useAuth();
  const [isSwitchDialogOpen, setIsSwitchDialogOpen] = useState(false);
  const [switchData, setSwitchData] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSignOut = async () => {
    await signOut();
  };

  const handleSwitchUser = async () => {
    if (!switchData.username || !switchData.password) {
      toast({
        title: "切换失败",
        description: "请输入用户名和密码",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const result = await switchUser(switchData.username, switchData.password);
      if (result.error) {
        toast({
          title: "切换失败",
          description: result.error,
          variant: "destructive",
        });
      } else {
        toast({
          title: "切换成功",
          description: "已成功切换用户",
        });
        setIsSwitchDialogOpen(false);
        setSwitchData({ username: '', password: '' });
      }
    } catch (error) {
      toast({
        title: "切换失败",
        description: "切换用户时发生错误",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!profile) return null;

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getRoleLabel = (role: string) => {
    const roleMap = {
      admin: '管理员',
      finance: '财务',
      business: '业务',
      operator: '操作员',
      partner: '合作方'
    };
    return roleMap[role as keyof typeof roleMap] || role;
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-10 w-10 rounded-full">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-gradient-primary text-white">
                {getInitials(profile.full_name || profile.username)}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end" forceMount>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">
                {profile.full_name || profile.username}
              </p>
              <p className="text-xs leading-none text-muted-foreground">
                {profile.email}
              </p>
              <p className="text-xs leading-none text-muted-foreground">
                {getRoleLabel(profile.role)}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setIsSwitchDialogOpen(true)}>
            <UserCheck className="mr-2 h-4 w-4" />
            切换用户
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            退出登录
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isSwitchDialogOpen} onOpenChange={setIsSwitchDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>切换用户</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="switch-username">用户名</Label>
              <Input
                id="switch-username"
                value={switchData.username}
                onChange={(e) => setSwitchData(prev => ({ ...prev, username: e.target.value }))}
                placeholder="请输入用户名"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="switch-password">密码</Label>
              <Input
                id="switch-password"
                type="password"
                value={switchData.password}
                onChange={(e) => setSwitchData(prev => ({ ...prev, password: e.target.value }))}
                placeholder="请输入密码"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSwitchUser} disabled={loading} className="flex-1">
                {loading ? '切换中...' : '切换用户'}
              </Button>
              <Button variant="outline" onClick={() => {
                setIsSwitchDialogOpen(false);
                setSwitchData({ username: '', password: '' });
              }}>
                取消
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}