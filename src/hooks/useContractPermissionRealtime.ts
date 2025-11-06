// 合同权限实时订阅 Hook
// 文件: src/hooks/useContractPermissionRealtime.ts

import { useEffect, useState, useCallback } from 'react';
import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';
import { ContractPermissionChange, ContractPermissionSyncStatus } from '@/types/permissions';
import { ContractPermissionServiceSimple as ContractPermissionService } from '@/services/contractPermissionServiceSimple';

export interface UseContractPermissionRealtimeOptions {
  enabled?: boolean;
  onPermissionChange?: (change: ContractPermissionChange) => void;
  onSyncStatusUpdate?: (status: ContractPermissionSyncStatus[]) => void;
  refreshInterval?: number; // 毫秒
}

export interface UseContractPermissionRealtimeReturn {
  isConnected: boolean;
  lastChange: ContractPermissionChange | null;
  syncStatus: ContractPermissionSyncStatus[];
  error: string | null;
  reconnect: () => void;
  disconnect: () => void;
}

export function useContractPermissionRealtime(
  options: UseContractPermissionRealtimeOptions = {}
): UseContractPermissionRealtimeReturn {
  const {
    enabled = true,
    onPermissionChange,
    onSyncStatusUpdate,
    refreshInterval = 30000 // 30秒
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [lastChange, setLastChange] = useState<ContractPermissionChange | null>(null);
  const [syncStatus, setSyncStatus] = useState<ContractPermissionSyncStatus[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [channel, setChannel] = useState<any>(null);

  // 连接实时订阅
  const connect = useCallback(() => {
    if (!enabled) return;

    try {
      setError(null);
      
      const newChannel = supabase
        .channel('contract_permissions_realtime')
        .on('postgres_changes', 
          { 
            event: '*', 
            schema: 'public', 
            table: 'contract_permissions' 
          },
          (payload) => {
            const change: ContractPermissionChange = {
              table: payload.table,
              operation: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
              contract_id: payload.new?.contract_id || payload.old?.contract_id,
              user_id: payload.new?.user_id || payload.old?.user_id,
              role_id: payload.new?.role_id || payload.old?.role_id,
              department_id: payload.new?.department_id || payload.old?.department_id,
              permission_type: payload.new?.permission_type || payload.old?.permission_type,
              timestamp: new Date().toISOString()
            };
            
            setLastChange(change);
            onPermissionChange?.(change);
          }
        )
        .on('postgres_changes', 
          { 
            event: '*', 
            schema: 'public', 
            table: 'contract_owner_permissions' 
          },
          (payload) => {
            const change: ContractPermissionChange = {
              table: payload.table,
              operation: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
              contract_id: payload.new?.contract_id || payload.old?.contract_id,
              user_id: payload.new?.owner_id || payload.old?.owner_id,
              timestamp: new Date().toISOString()
            };
            
            setLastChange(change);
            onPermissionChange?.(change);
          }
        )
        .on('postgres_changes', 
          { 
            event: '*', 
            schema: 'public', 
            table: 'contract_category_permission_templates' 
          },
          (payload) => {
            const change: ContractPermissionChange = {
              table: payload.table,
              operation: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
              timestamp: new Date().toISOString()
            };
            
            setLastChange(change);
            onPermissionChange?.(change);
          }
        )
        .on('broadcast', 
          { event: 'permission_cache_refresh' },
          (payload) => {
            // 可以在这里触发数据重新加载
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            setIsConnected(true);
            setError(null);
          } else if (status === 'CHANNEL_ERROR') {
            setIsConnected(false);
            setError('订阅频道错误');
          } else if (status === 'TIMED_OUT') {
            setIsConnected(false);
            setError('订阅超时');
          } else if (status === 'CLOSED') {
            setIsConnected(false);
          }
        });

      setChannel(newChannel);
    } catch (err) {
      setError(err instanceof Error ? err.message : '连接失败');
      setIsConnected(false);
    }
  }, [enabled, onPermissionChange]);

  // 断开连接
  const disconnect = useCallback(() => {
    if (channel) {
      supabase.removeChannel(channel);
      setChannel(null);
      setIsConnected(false);
    }
  }, [channel]);

  // 重新连接
  const reconnect = useCallback(() => {
    disconnect();
    setTimeout(connect, 1000); // 延迟1秒重连
  }, [disconnect, connect]);

  // 加载同步状态（简化版）
  const loadSyncStatus = useCallback(async () => {
    try {
      // 简化版：直接设置空状态
      setSyncStatus([]);
      onSyncStatusUpdate?.([]);
    } catch (err) {
      console.error('加载同步状态失败:', err);
    }
  }, [onSyncStatusUpdate]);

  // 初始化连接
  useEffect(() => {
    if (enabled) {
      connect();
      loadSyncStatus();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, connect, disconnect, loadSyncStatus]);

  // 定期刷新同步状态
  useEffect(() => {
    if (!enabled || refreshInterval <= 0) return;

    const interval = setInterval(loadSyncStatus, refreshInterval);
    return () => clearInterval(interval);
  }, [enabled, refreshInterval, loadSyncStatus]);

  // 监听网络状态变化
  useEffect(() => {
    const handleOnline = () => {
      if (!isConnected && enabled) {
        reconnect();
      }
    };

    const handleOffline = () => {
      setIsConnected(false);
      setError('网络连接已断开');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isConnected, enabled, reconnect]);

  return {
    isConnected,
    lastChange,
    syncStatus,
    error,
    reconnect,
    disconnect
  };
}

// 简化的合同权限变更监听 Hook
export function useContractPermissionChanges(
  onChange?: (change: ContractPermissionChange) => void
) {
  const { isConnected, lastChange, error } = useContractPermissionRealtime({
    onPermissionChange: onChange
  });

  return {
    isConnected,
    lastChange,
    error
  };
}

// 合同权限同步状态 Hook（简化版）
export function useContractPermissionSyncStatus() {
  const [syncStatus, setSyncStatus] = useState<ContractPermissionSyncStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSyncStatus = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      // 简化版：直接设置空状态
      setSyncStatus([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载同步状态失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSyncStatus();
  }, [loadSyncStatus]);

  return {
    syncStatus,
    loading,
    error,
    refresh: loadSyncStatus
  };
}

export default useContractPermissionRealtime;
