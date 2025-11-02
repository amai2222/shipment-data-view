// 安全的权限加载测试组件
// 文件: src/components/SafePermissionLoader.tsx

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';

interface SafePermissionLoaderProps {
  contractId?: string;
}

export function SafePermissionLoader({ contractId }: SafePermissionLoaderProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<any[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  const loadPermissions = async () => {
    if (loading) return; // 防止重复加载
    
    try {
      setLoading(true);
      setError(null);
      
      // 安全地查询权限数据
      let query = supabase
        .from('contract_permissions')
        .select(`
          *,
          contracts(contract_number, counterparty_company, our_company),
          profiles!contract_permissions_user_id_fkey(full_name, email)
        `)
        .order('created_at', { ascending: false });

      if (contractId) {
        query = query.eq('contract_id', contractId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('数据库查询错误:', error);
        
        if (error.message.includes('relation "contract_permissions" does not exist')) {
          setPermissions([]);
          setError('合同权限表尚未创建');
          return;
        }
        
        throw error;
      }

      // 安全地处理数据
      const safeData = (data || []).map(item => {
        const profileData = item.profiles as any;
        return {
          id: item.id,
          contract_id: item.contract_id,
          user_id: item.user_id,
          permission_type: item.permission_type || 'view',
          is_active: item.is_active !== false,
          created_at: item.created_at,
          contract_number: item.contracts?.contract_number || '未知合同',
          counterparty_company: item.contracts?.counterparty_company || '未知公司',
          user_name: (profileData && typeof profileData === 'object' && profileData.full_name) || `用户 ${item.user_id}`,
          user_email: (profileData && typeof profileData === 'object' && profileData.email) || ''
        };
      });

      setPermissions(safeData);
      setError(null);
      
    } catch (err) {
      console.error('加载权限失败:', err);
      setError(err instanceof Error ? err.message : '加载权限数据失败');
      setPermissions([]);
    } finally {
      setLoading(false);
      setIsInitialized(true);
    }
  };

  useEffect(() => {
    loadPermissions();
  }, [contractId]);

  const handleRetry = () => {
    loadPermissions();
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : error ? (
            <AlertCircle className="h-5 w-5 text-red-500" />
          ) : (
            <CheckCircle className="h-5 w-5 text-green-500" />
          )}
          安全权限加载测试
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 状态信息 */}
        <div className="flex items-center gap-4">
          <Badge variant={loading ? "secondary" : error ? "destructive" : "default"}>
            {loading ? "加载中" : error ? "错误" : "正常"}
          </Badge>
          <Badge variant="outline">
            初始化: {isInitialized ? "完成" : "进行中"}
          </Badge>
          <Badge variant="outline">
            权限数量: {permissions.length}
          </Badge>
        </div>

        {/* 错误信息 */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 text-red-700">
              <AlertCircle className="h-4 w-4" />
              <span className="font-medium">错误信息:</span>
            </div>
            <p className="text-red-600 mt-1">{error}</p>
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex gap-2">
          <Button 
            onClick={handleRetry} 
            disabled={loading}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            重新加载
          </Button>
        </div>

        {/* 权限列表 */}
        {permissions.length > 0 && (
          <div className="space-y-2">
            <h3 className="font-medium">权限列表:</h3>
            <div className="max-h-60 overflow-y-auto space-y-1">
              {permissions.map((permission) => (
                <div 
                  key={permission.id} 
                  className="p-2 bg-gray-50 rounded border text-sm"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-medium">{permission.contract_number}</span>
                      <span className="text-gray-500 ml-2">({permission.counterparty_company})</span>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {permission.permission_type}
                    </Badge>
                  </div>
                  <div className="text-gray-600 text-xs mt-1">
                    用户: {permission.user_name} ({permission.user_email})
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 空状态 */}
        {!loading && !error && permissions.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <CheckCircle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>没有找到权限数据</p>
            <p className="text-sm">这可能是因为权限表尚未创建或没有数据</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default SafePermissionLoader;
