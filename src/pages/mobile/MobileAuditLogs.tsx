import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MobileLayout } from '@/components/mobile/MobileLayout';
import { useAuditLogs, AuditLog, AuditLogFilters } from '@/hooks/useAuditLogs';
import { useOptimizedPermissions } from '@/hooks/useOptimizedPermissions';
import { 
  Search, 
  Filter, 
  Eye, 
  RefreshCw, 
  User,
  Shield,
  Settings,
  FileText,
  Building2,
  Database
} from 'lucide-react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

export default function MobileAuditLogs() {
  const { auditLogs, loading, totalCount, page, setPage, pageSize, loadAuditLogs, getActionOptions, getPermissionTypeOptions } = useAuditLogs();
  const { users } = useOptimizedPermissions();
  
  const [filters, setFilters] = useState<AuditLogFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [actionOptions, setActionOptions] = useState<string[]>([]);
  const [permissionTypeOptions, setPermissionTypeOptions] = useState<string[]>([]);

  // 加载选项数据
  useEffect(() => {
    const loadOptions = async () => {
      const [actions, types] = await Promise.all([
        getActionOptions(),
        getPermissionTypeOptions()
      ]);
      setActionOptions(actions);
      setPermissionTypeOptions(types);
    };
    loadOptions();
  }, [getActionOptions, getPermissionTypeOptions]);

  // 应用过滤器
  const applyFilters = () => {
    setPage(1);
    loadAuditLogs(filters);
  };

  // 清除过滤器
  const clearFilters = () => {
    setFilters({});
    setPage(1);
    loadAuditLogs({});
  };

  // 获取操作类型图标
  const getActionIcon = (action: string) => {
    switch (action) {
      case 'grant':
        return <Shield className="h-4 w-4 text-green-600" />;
      case 'revoke':
        return <Shield className="h-4 w-4 text-red-600" />;
      case 'modify':
        return <Settings className="h-4 w-4 text-blue-600" />;
      case 'inherit':
        return <User className="h-4 w-4 text-purple-600" />;
      default:
        return <FileText className="h-4 w-4 text-gray-600" />;
    }
  };

  // 获取权限类型图标
  const getPermissionTypeIcon = (type: string) => {
    switch (type) {
      case 'menu':
        return <FileText className="h-4 w-4 text-blue-600" />;
      case 'function':
        return <Settings className="h-4 w-4 text-green-600" />;
      case 'project':
        return <Building2 className="h-4 w-4 text-purple-600" />;
      case 'data':
        return <Database className="h-4 w-4 text-orange-600" />;
      default:
        return <Shield className="h-4 w-4 text-gray-600" />;
    }
  };

  // 获取操作类型标签
  const getActionBadge = (action: string) => {
    const variants = {
      grant: 'default',
      revoke: 'destructive',
      modify: 'secondary',
      inherit: 'outline'
    } as const;

    const labels = {
      grant: '授权',
      revoke: '撤销',
      modify: '修改',
      inherit: '继承'
    };

    return (
      <Badge variant={variants[action as keyof typeof variants] || 'outline'} className="text-xs">
        {labels[action as keyof typeof labels] || action}
      </Badge>
    );
  };

  // 获取权限类型标签
  const getPermissionTypeBadge = (type: string) => {
    const labels = {
      menu: '菜单',
      function: '功能',
      project: '项目',
      data: '数据'
    };

    return (
      <Badge variant="outline" className="text-xs">
        {labels[type as keyof typeof labels] || type}
      </Badge>
    );
  };

  return (
    <MobileLayout>
      <div className="space-y-4">
        {/* 页面标题 */}
        <div>
          <h1 className="text-xl font-bold">操作日志</h1>
          <p className="text-sm text-muted-foreground">查看系统用户的操作记录</p>
        </div>

        {/* 操作栏 */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  日志查询
                </CardTitle>
                <CardDescription className="text-xs">
                  共 {totalCount} 条记录
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                >
                  <Filter className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadAuditLogs(filters)}
                  disabled={loading}
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>
          </CardHeader>
          
          {/* 筛选器 */}
          {showFilters && (
            <CardContent className="pt-0">
              <div className="space-y-3">
                <div>
                  <Label htmlFor="action-filter" className="text-sm">操作类型</Label>
                  <Select
                    value={filters.action || ''}
                    onValueChange={(value) => setFilters(prev => ({ ...prev, action: value || undefined }))}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="选择操作类型" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">全部</SelectItem>
                      {actionOptions.map(action => (
                        <SelectItem key={action} value={action}>
                          {action === 'grant' ? '授权' : 
                           action === 'revoke' ? '撤销' :
                           action === 'modify' ? '修改' :
                           action === 'inherit' ? '继承' : action}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="permission-type-filter" className="text-sm">权限类型</Label>
                  <Select
                    value={filters.permission_type || ''}
                    onValueChange={(value) => setFilters(prev => ({ ...prev, permission_type: value || undefined }))}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="选择权限类型" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">全部</SelectItem>
                      {permissionTypeOptions.map(type => (
                        <SelectItem key={type} value={type}>
                          {type === 'menu' ? '菜单权限' :
                           type === 'function' ? '功能权限' :
                           type === 'project' ? '项目权限' :
                           type === 'data' ? '数据权限' : type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="user-filter" className="text-sm">操作用户</Label>
                  <Select
                    value={filters.user_id || ''}
                    onValueChange={(value) => setFilters(prev => ({ ...prev, user_id: value || undefined }))}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="选择用户" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">全部</SelectItem>
                      {users.map(user => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="date-from" className="text-sm">开始日期</Label>
                  <Input
                    id="date-from"
                    type="date"
                    className="h-9"
                    value={filters.date_from || ''}
                    onChange={(e) => setFilters(prev => ({ ...prev, date_from: e.target.value || undefined }))}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-3">
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  清除
                </Button>
                <Button size="sm" onClick={applyFilters}>
                  应用
                </Button>
              </div>
            </CardContent>
          )}
        </Card>

        {/* 日志列表 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">操作记录</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ScrollArea className="h-[60vh]">
              <div className="space-y-3">
                {loading ? (
                  <div className="text-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                    <div className="text-sm text-muted-foreground">加载中...</div>
                  </div>
                ) : auditLogs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    暂无操作日志
                  </div>
                ) : (
                  auditLogs.map((log) => (
                    <Card key={log.id} className="border-l-4 border-l-blue-500">
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          {/* 时间和操作类型 */}
                          <div className="flex items-center justify-between">
                            <div className="text-xs text-muted-foreground">
                              {format(new Date(log.created_at), 'MM-dd HH:mm', { locale: zhCN })}
                            </div>
                            <div className="flex items-center gap-2">
                              {getActionIcon(log.action)}
                              {getActionBadge(log.action)}
                            </div>
                          </div>

                          {/* 权限类型和权限项 */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {getPermissionTypeIcon(log.permission_type)}
                              {getPermissionTypeBadge(log.permission_type)}
                            </div>
                            <div className="text-xs font-mono text-muted-foreground">
                              {log.permission_key}
                            </div>
                          </div>

                          {/* 用户信息 */}
                          <div className="space-y-1">
                            <div className="text-sm">
                              <span className="text-muted-foreground">操作用户：</span>
                              <span className="font-medium">{log.user_name}</span>
                            </div>
                            {log.target_user_name && (
                              <div className="text-sm">
                                <span className="text-muted-foreground">目标用户：</span>
                                <span className="font-medium">{log.target_user_name}</span>
                              </div>
                            )}
                            <div className="text-sm">
                              <span className="text-muted-foreground">操作人：</span>
                              <span className="font-medium">{log.created_by_name}</span>
                            </div>
                          </div>

                          {/* 操作按钮 */}
                          <div className="flex justify-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedLog(log);
                                setShowDetailDialog(true);
                              }}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              详情
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </ScrollArea>

            {/* 分页 */}
            {totalCount > pageSize && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <div className="text-xs text-muted-foreground">
                  {Math.min(page * pageSize, totalCount)} / {totalCount}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(page - 1)}
                    disabled={page === 1}
                  >
                    上一页
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(page + 1)}
                    disabled={page >= Math.ceil(totalCount / pageSize)}
                  >
                    下一页
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 详情对话框 */}
        {showDetailDialog && selectedLog && (
          <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
            <DialogContent className="w-[95vw] max-w-md max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>操作详情</DialogTitle>
                <DialogDescription>
                  查看操作日志的详细信息
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div className="space-y-3">
                  <div>
                    <Label className="text-sm font-medium">操作时间</Label>
                    <div className="text-sm">
                      {format(new Date(selectedLog.created_at), 'yyyy-MM-dd HH:mm:ss', { locale: zhCN })}
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-medium">操作类型</Label>
                    <div className="flex items-center gap-2">
                      {getActionIcon(selectedLog.action)}
                      {getActionBadge(selectedLog.action)}
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-medium">权限类型</Label>
                    <div className="flex items-center gap-2">
                      {getPermissionTypeIcon(selectedLog.permission_type)}
                      {getPermissionTypeBadge(selectedLog.permission_type)}
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-medium">权限项</Label>
                    <div className="text-sm font-mono">{selectedLog.permission_key}</div>
                  </div>

                  <div>
                    <Label className="text-sm font-medium">操作用户</Label>
                    <div className="text-sm">
                      <div className="font-medium">{selectedLog.user_name}</div>
                      <div className="text-muted-foreground">{selectedLog.user_email}</div>
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-medium">操作人</Label>
                    <div className="text-sm">
                      <div className="font-medium">{selectedLog.created_by_name}</div>
                      <div className="text-muted-foreground">{selectedLog.created_by_email}</div>
                    </div>
                  </div>

                  {selectedLog.target_user_name && (
                    <div>
                      <Label className="text-sm font-medium">目标用户</Label>
                      <div className="text-sm">
                        <div className="font-medium">{selectedLog.target_user_name}</div>
                        <div className="text-muted-foreground">{selectedLog.target_user_email}</div>
                      </div>
                    </div>
                  )}

                  {selectedLog.reason && (
                    <div>
                      <Label className="text-sm font-medium">操作原因</Label>
                      <div className="text-sm">{selectedLog.reason}</div>
                    </div>
                  )}

                  {(selectedLog.old_value || selectedLog.new_value) && (
                    <div>
                      <Label className="text-sm font-medium">变更详情</Label>
                      <div className="space-y-2">
                        {selectedLog.old_value && (
                          <div>
                            <div className="text-xs text-muted-foreground mb-1">变更前：</div>
                            <div className="text-xs bg-red-50 p-2 rounded border">
                              <pre className="whitespace-pre-wrap">{JSON.stringify(selectedLog.old_value, null, 2)}</pre>
                            </div>
                          </div>
                        )}
                        {selectedLog.new_value && (
                          <div>
                            <div className="text-xs text-muted-foreground mb-1">变更后：</div>
                            <div className="text-xs bg-green-50 p-2 rounded border">
                              <pre className="whitespace-pre-wrap">{JSON.stringify(selectedLog.new_value, null, 2)}</pre>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </MobileLayout>
  );
}
