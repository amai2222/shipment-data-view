import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw, Database, Users, Shield, Clock, Wifi, WifiOff } from 'lucide-react';

interface PerformanceStats {
  total_users: number;
  active_users: number;
  total_role_templates: number;
  total_user_permissions: number;
  users_with_custom_permissions: number;
}

interface TableStats {
  table_name: string;
  record_count: number;
  unique_users: number;
  unique_projects: number;
  last_created: string;
  first_created: string;
}

interface RealtimeStatus {
  table_name: string;
  total_records: number;
  last_created: string;
  last_updated: string;
  recent_changes: number;
}

interface SyncStatus {
  table_name: string;
  last_sync: string;
  sync_count: number;
  minutes_since_sync: number;
}

export function PermissionPerformanceMonitor() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<PerformanceStats | null>(null);
  const [tableStats, setTableStats] = useState<TableStats[]>([]);
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus[]>([]);
  const [loadTime, setLoadTime] = useState<number>(0);
  const [realtimeConnected, setRealtimeConnected] = useState(false);

  const loadStats = async () => {
    setLoading(true);
    const startTime = Date.now();
    
    try {
      // 并行加载统计数据
      const [statsRes, tableStatsRes, realtimeRes, syncRes] = await Promise.all([
        supabase.rpc('get_permission_stats'),
        supabase.from('permission_performance_stats').select('*'),
        supabase.from('permission_realtime_status').select('*'),
        supabase.rpc('get_permission_sync_status')
      ]);

      if (statsRes.data && statsRes.data.length > 0) {
        setStats(statsRes.data[0]);
      }

      if (tableStatsRes.data) {
        setTableStats(tableStatsRes.data);
      }

      if (realtimeRes.data) {
        setRealtimeStatus(realtimeRes.data);
      }

      if (syncRes.data) {
        setSyncStatus(syncRes.data);
      }

      const endTime = Date.now();
      setLoadTime(endTime - startTime);

      toast({
        title: "统计更新成功",
        description: `数据加载耗时: ${endTime - startTime}ms`,
      });

    } catch (error) {
      console.error('加载统计数据失败:', error);
      toast({
        title: "加载失败",
        description: "无法加载性能统计数据",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const cleanupPermissions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('cleanup_permissions');
      
      if (error) throw error;

      if (data && data.length > 0) {
        const result = data[0];
        toast({
          title: "清理完成",
          description: `删除了 ${result.deleted_duplicates} 个重复权限和 ${result.deleted_expired} 个过期权限`,
        });
        
        // 重新加载统计数据
        await loadStats();
      }
    } catch (error) {
      console.error('清理权限失败:', error);
      toast({
        title: "清理失败",
        description: "无法清理权限数据",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
    
    // 设置实时连接状态监控
    const checkRealtimeConnection = () => {
      const channel = supabase.channel('realtime_status_check');
      channel.subscribe((status) => {
        setRealtimeConnected(status === 'SUBSCRIBED');
      });
      
      // 5秒后取消订阅
      setTimeout(() => {
        channel.unsubscribe();
      }, 5000);
    };
    
    checkRealtimeConnection();
    
    // 每30秒检查一次连接状态
    const interval = setInterval(checkRealtimeConnection, 30000);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                权限性能监控
              </CardTitle>
              <CardDescription>
                监控权限系统的性能和数据统计
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {loadTime}ms
              </Badge>
              <Badge variant={realtimeConnected ? "default" : "destructive"} className="flex items-center gap-1">
                {realtimeConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                {realtimeConnected ? "实时连接" : "离线"}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={loadStats}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                刷新统计
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{stats.total_users}</div>
                <div className="text-sm text-muted-foreground">总用户数</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{stats.active_users}</div>
                <div className="text-sm text-muted-foreground">活跃用户</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{stats.total_role_templates}</div>
                <div className="text-sm text-muted-foreground">角色模板</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{stats.total_user_permissions}</div>
                <div className="text-sm text-muted-foreground">权限记录</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{stats.users_with_custom_permissions}</div>
                <div className="text-sm text-muted-foreground">自定义权限</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            表性能统计
          </CardTitle>
          <CardDescription>
            各权限相关表的数据统计和性能指标
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {tableStats.map((table, index) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold capitalize">{table.table_name.replace('_', ' ')}</h4>
                  <Badge variant="secondary">{table.record_count} 条记录</Badge>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">唯一用户</div>
                    <div className="font-medium">{table.unique_users}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">唯一项目</div>
                    <div className="font-medium">{table.unique_projects}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">最后创建</div>
                    <div className="font-medium">
                      {new Date(table.last_created).toLocaleDateString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">首次创建</div>
                    <div className="font-medium">
                      {new Date(table.first_created).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 实时状态监控 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wifi className="h-5 w-5" />
            实时状态监控
          </CardTitle>
          <CardDescription>
            权限变更的实时监控和同步状态
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {realtimeStatus.map((status, index) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold capitalize">{status.table_name.replace('_', ' ')}</h4>
                  <div className="flex gap-2">
                    <Badge variant="secondary">{status.total_records} 条记录</Badge>
                    {status.recent_changes > 0 && (
                      <Badge variant="destructive">{status.recent_changes} 最近变更</Badge>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">最后创建</div>
                    <div className="font-medium">
                      {new Date(status.last_created).toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">最后更新</div>
                    <div className="font-medium">
                      {new Date(status.last_updated).toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">最近变更</div>
                    <div className="font-medium text-red-600">
                      {status.recent_changes} 次
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">状态</div>
                    <div className="font-medium">
                      {status.recent_changes > 0 ? (
                        <Badge variant="destructive">活跃</Badge>
                      ) : (
                        <Badge variant="secondary">稳定</Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 同步状态 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            同步状态
          </CardTitle>
          <CardDescription>
            权限数据的同步状态和最后同步时间
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {syncStatus.map((sync, index) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold capitalize">{sync.table_name.replace('_', ' ')}</h4>
                  <Badge variant={sync.minutes_since_sync < 5 ? "default" : "secondary"}>
                    {sync.minutes_since_sync < 1 ? "刚刚同步" : `${Math.round(sync.minutes_since_sync)}分钟前`}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">最后同步</div>
                    <div className="font-medium">
                      {new Date(sync.last_sync).toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">同步次数</div>
                    <div className="font-medium">{sync.sync_count}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">同步状态</div>
                    <div className="font-medium">
                      {sync.minutes_since_sync < 5 ? (
                        <Badge variant="default">正常</Badge>
                      ) : (
                        <Badge variant="secondary">延迟</Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            维护操作
          </CardTitle>
          <CardDescription>
            权限数据的维护和优化操作
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Button
              onClick={cleanupPermissions}
              disabled={loading}
              variant="outline"
            >
              清理重复权限
            </Button>
            <Button
              onClick={loadStats}
              disabled={loading}
              variant="outline"
            >
              刷新缓存
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
