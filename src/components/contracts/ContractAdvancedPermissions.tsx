import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Shield, Plus } from 'lucide-react';

interface Permission {
  id: string;
  contract_id?: string;
  user_id?: string;
  department?: string;
  permission_type: 'view' | 'edit' | 'delete' | 'download' | 'admin';
  field_permissions?: any;
  file_permissions?: any;
  created_at: string;
  updated_at?: string;
}

export function ContractAdvancedPermissions() {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);

  const { toast } = useToast();

  useEffect(() => {
    loadPermissions();
  }, []);

  const loadPermissions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('contract_permissions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      const formattedData = (data || []).map(item => ({
        ...item,
        permission_type: item.permission_type as 'view' | 'edit' | 'delete' | 'download' | 'admin'
      }));
      setPermissions(formattedData);
    } catch (error) {
      console.error('Error loading permissions:', error);
      toast({
        title: "错误",
        description: "加载权限列表失败",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">高级权限管理</h2>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          添加权限
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Shield className="h-5 w-5 mr-2" />
            权限列表
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">加载中...</div>
          ) : permissions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              暂无权限记录
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>权限类型</TableHead>
                  <TableHead>部门</TableHead>
                  <TableHead>创建时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {permissions.map((permission) => (
                  <TableRow key={permission.id}>
                    <TableCell>
                      <Badge variant="secondary">{permission.permission_type}</Badge>
                    </TableCell>
                    <TableCell>{permission.department || '-'}</TableCell>
                    <TableCell>{permission.created_at}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}