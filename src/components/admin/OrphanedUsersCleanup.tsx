import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertTriangle, Trash2, RefreshCw } from 'lucide-react';

interface OrphanedUser {
  auth_user_id: string;
  email: string;
  created_at: string;
  action: string;
}

/**
 * 孤立用户清理工具
 * 用于查找和清理在 auth.users 中存在但在 profiles 中不存在的用户
 */
export function OrphanedUsersCleanup() {
  const [orphanedUsers, setOrphanedUsers] = useState<OrphanedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const { toast } = useToast();

  // 查询孤立用户
  const fetchOrphanedUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('cleanup_orphaned_auth_users');

      if (error) {
        throw error;
      }

      setOrphanedUsers(data || []);

      if (data && data.length > 0) {
        toast({
          title: "发现孤立用户",
          description: `找到 ${data.length} 个孤立的认证用户`,
          variant: "default",
        });
      } else {
        toast({
          title: "检查完成",
          description: "没有发现孤立用户",
        });
      }
    } catch (error: any) {
      console.error('查询孤立用户失败:', error);
      toast({
        title: "查询失败",
        description: error.message || "无法查询孤立用户",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // 删除单个孤立用户
  const handleDeleteOrphanedUser = async (email: string) => {
    try {
      const { data, error } = await supabase.rpc('delete_auth_user_by_email', {
        p_email: email
      });

      if (error) {
        throw error;
      }

      if (data?.success) {
        toast({
          title: "删除成功",
          description: `已删除孤立用户: ${email}`,
        });

        // 重新查询
        fetchOrphanedUsers();
      } else {
        throw new Error(data?.error || '删除失败');
      }
    } catch (error: any) {
      console.error('删除孤立用户失败:', error);
      toast({
        title: "删除失败",
        description: error.message || "删除孤立用户失败",
        variant: "destructive",
      });
    } finally {
      setShowDeleteDialog(false);
      setSelectedEmail(null);
    }
  };

  // 初始加载
  useEffect(() => {
    fetchOrphanedUsers();
  }, []);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              孤立用户清理工具
            </CardTitle>
            <CardDescription>
              查找和清理在 auth.users 中存在但在 profiles 中不存在的用户
            </CardDescription>
          </div>
          <Button
            onClick={fetchOrphanedUsers}
            disabled={loading}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {orphanedUsers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {loading ? '正在检查...' : '没有发现孤立用户'}
          </div>
        ) : (
          <>
            <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                    发现 {orphanedUsers.length} 个孤立用户
                  </p>
                  <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                    这些用户在认证系统中存在，但业务表中没有记录。通常是因为注册失败或删除不完整导致。
                  </p>
                </div>
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>邮箱</TableHead>
                  <TableHead>用户ID</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orphanedUsers.map((user) => (
                  <TableRow key={user.auth_user_id}>
                    <TableCell className="font-medium">{user.email}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {user.auth_user_id}
                    </TableCell>
                    <TableCell>
                      {new Date(user.created_at).toLocaleString('zh-CN')}
                    </TableCell>
                    <TableCell>
                      <Badge variant="destructive">孤立</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        onClick={() => {
                          setSelectedEmail(user.email);
                          setShowDeleteDialog(true);
                        }}
                        variant="destructive"
                        size="sm"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        清理
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}

        {/* 删除确认对话框 */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>确认删除孤立用户？</AlertDialogTitle>
              <AlertDialogDescription>
                您确定要删除认证系统中的用户 <strong>{selectedEmail}</strong> 吗？
                <br />
                <br />
                此操作将：
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>从 auth.users 表中删除该用户</li>
                  <li>释放该邮箱，允许重新注册</li>
                  <li>此操作不可撤销</li>
                </ul>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => selectedEmail && handleDeleteOrphanedUser(selectedEmail)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                确认删除
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}

