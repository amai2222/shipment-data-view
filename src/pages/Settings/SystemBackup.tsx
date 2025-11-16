// 系统备份管理页面
// 支持数据库备份到本地

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';
import { 
  Download, 
  Database, 
  FileDown,
  Calendar,
  HardDrive,
  CheckCircle2,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/PageHeader';

export default function SystemBackup() {
  const [backing, setBacking] = useState(false);
  const [backupProgress, setBackupProgress] = useState<string>('');
  const { toast } = useToast();

  // 选择要备份的表
  const [selectedTables, setSelectedTables] = useState({
    // 核心业务表
    logistics_records: true,
    logistics_partner_costs: true,
    
    // 内部车辆管理系统（新增）
    internal_drivers: true,
    internal_vehicles: true,
    internal_driver_vehicle_relations: true,
    fleet_manager_projects: true,
    fleet_manager_favorite_routes: true,
    fleet_manager_favorite_route_drivers: true,
    dispatch_orders: true,
    internal_driver_expense_applications: true,
    internal_vehicle_change_applications: true,
    
    // 项目和合作方
    projects: true,
    partners: true,
    project_partners: true,
    partner_chains: true,
    
    // 财务数据
    payment_requests: true,
    invoice_requests: true,
    payment_records: true,
    invoice_records: true,
    partner_balance: true,                    // 货主余额表（新增）
    partner_balance_transactions: true,       // 货主余额流水表（新增）
    invoice_receipt_records: true,             // 收款记录表（新增）
    
    // 基础数据
    drivers: true,
    locations: true,
    scale_records: true,                       // 磅单记录表（新增）
    
    // 用户和权限
    profiles: true,
    user_permissions: true,
    role_permission_templates: true,
    
    // 菜单配置
    menu_config: true,
    
    // 合同
    contracts: false  // 可选
  });

  // 备份数据到本地
  const handleBackupToLocal = async () => {
    try {
      setBacking(true);
      setBackupProgress('准备备份...');

      interface BackupData {
        version: string;
        timestamp: string;
        tables: Record<string, {
          count: number;
          data: unknown[];
        }>;
      }

      const backupData: BackupData = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        tables: {}
      };

      // 获取选中的表名
      const tablesToBackup = Object.entries(selectedTables)
        .filter(([_, selected]) => selected)
        .map(([table]) => table);

      let completed = 0;
      const total = tablesToBackup.length;

      // 依次备份每个表
      for (const tableName of tablesToBackup) {
        setBackupProgress(`正在备份 ${tableName}... (${completed + 1}/${total})`);
        
        const { data, error } = await supabase
          .from(tableName)
          .select('*');

        if (error) {
          console.error(`备份 ${tableName} 失败:`, error);
          throw new Error(`备份表 ${tableName} 失败: ${error.message}`);
        }

        backupData.tables[tableName] = {
          count: data?.length || 0,
          data: data || []
        };

        completed++;
      }

      setBackupProgress('生成备份文件...');

      // 生成文件名
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const filename = `中科物流系统备份_${timestamp}.json`;

      // 下载JSON文件
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { 
        type: 'application/json' 
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      setBackupProgress('');
      
      toast({
        title: '备份成功',
        description: `已备份 ${total} 个表，文件已下载到本地`,
      });

    } catch (error: unknown) {
      console.error('备份失败:', error);
      toast({
        title: '备份失败',
        description: error instanceof Error ? error.message : String(error),
        variant: 'destructive',
      });
      setBackupProgress('');
    } finally {
      setBacking(false);
    }
  };

  // 备份为SQL格式
  const handleBackupToSQL = async () => {
    try {
      setBacking(true);
      setBackupProgress('生成SQL备份脚本...');

      const tablesToBackup = Object.entries(selectedTables)
        .filter(([_, selected]) => selected)
        .map(([table]) => table);

      let sqlScript = `-- ============================================================================
-- 中科物流系统数据库备份
-- 备份时间: ${new Date().toLocaleString('zh-CN')}
-- 备份表数: ${tablesToBackup.length}
-- ============================================================================

BEGIN;

`;

      let completed = 0;
      const total = tablesToBackup.length;

      for (const tableName of tablesToBackup) {
        setBackupProgress(`正在导出 ${tableName}... (${completed + 1}/${total})`);
        
        const { data, error } = await supabase
          .from(tableName)
          .select('*');

        if (error) {
          throw new Error(`导出表 ${tableName} 失败: ${error.message}`);
        }

        if (data && data.length > 0) {
          sqlScript += `\n-- ==========================================\n`;
          sqlScript += `-- 表: ${tableName} (${data.length} 条记录)\n`;
          sqlScript += `-- ==========================================\n\n`;
          
          // 生成INSERT语句
          data.forEach((row, index) => {
            const columns = Object.keys(row);
            const values = columns.map(col => {
              const val = row[col];
              if (val === null) return 'NULL';
              if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
              if (typeof val === 'boolean') return val ? 'true' : 'false';
              if (Array.isArray(val)) return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
              if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
              return val;
            });

            sqlScript += `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${values.join(', ')});\n`;
            
            // 每100条记录添加注释
            if ((index + 1) % 100 === 0) {
              sqlScript += `-- 已插入 ${index + 1} 条记录\n\n`;
            }
          });
          
          sqlScript += `\n`;
        }

        completed++;
      }

      sqlScript += `\nCOMMIT;\n\n`;
      sqlScript += `-- ============================================================================\n`;
      sqlScript += `-- 备份完成\n`;
      sqlScript += `-- ============================================================================\n`;

      setBackupProgress('保存SQL文件...');

      // 下载SQL文件
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const filename = `中科物流系统备份_${timestamp}.sql`;

      const blob = new Blob([sqlScript], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      setBackupProgress('');
      
      toast({
        title: 'SQL备份成功',
        description: `已生成 ${total} 个表的SQL脚本`,
      });

    } catch (error: unknown) {
      console.error('SQL备份失败:', error);
      toast({
        title: 'SQL备份失败',
        description: error instanceof Error ? error.message : String(error),
        variant: 'destructive',
      });
      setBackupProgress('');
    } finally {
      setBacking(false);
    }
  };

  const tableGroups = [
    {
      title: '核心业务表',
      tables: [
        { key: 'logistics_records', label: '运单记录', description: '所有运单数据' },
        { key: 'logistics_partner_costs', label: '运单成本', description: '合作方成本数据' }
      ]
    },
    {
      title: '内部车辆管理系统',
      tables: [
        { key: 'internal_drivers', label: '内部司机', description: '内部司机档案' },
        { key: 'internal_vehicles', label: '内部车辆', description: '内部车辆档案' },
        { key: 'internal_driver_vehicle_relations', label: '司机车辆关系', description: '司机与车辆绑定关系' },
        { key: 'fleet_manager_projects', label: '车队长项目', description: '车队长负责的项目' },
        { key: 'fleet_manager_favorite_routes', label: '常用线路', description: '车队长常用线路' },
        { key: 'fleet_manager_favorite_route_drivers', label: '线路分配', description: '常用线路分配给司机' },
        { key: 'dispatch_orders', label: '派单', description: '车队长派单记录' },
        { key: 'internal_driver_expense_applications', label: '司机费用申请', description: '司机费用相关申请' },
        { key: 'internal_vehicle_change_applications', label: '车辆变更申请', description: '车辆变更审批记录' }
      ]
    },
    {
      title: '项目和合作方',
      tables: [
        { key: 'projects', label: '项目信息', description: '项目基础数据' },
        { key: 'partners', label: '合作方信息', description: '合作方基础数据' },
        { key: 'project_partners', label: '项目合作方配置', description: '项目-合作方关联' },
        { key: 'partner_chains', label: '合作链路', description: '合作链路配置' }
      ]
    },
    {
      title: '财务数据',
      tables: [
        { key: 'payment_requests', label: '付款申请', description: '付款申请记录' },
        { key: 'invoice_requests', label: '开票申请', description: '开票申请记录' },
        { key: 'payment_records', label: '付款记录', description: '实际付款记录' },
        { key: 'invoice_records', label: '开票记录', description: '实际开票记录' },
        { key: 'partner_balance', label: '货主余额', description: '货主账户余额' },
        { key: 'partner_balance_transactions', label: '余额流水', description: '货主余额交易流水' },
        { key: 'invoice_receipt_records', label: '收款记录', description: '财务收款记录' }
      ]
    },
    {
      title: '基础数据',
      tables: [
        { key: 'drivers', label: '司机信息', description: '司机基础数据' },
        { key: 'locations', label: '地点信息', description: '地点基础数据' },
        { key: 'scale_records', label: '磅单记录', description: '磅单管理数据' }
      ]
    },
    {
      title: '系统配置',
      tables: [
        { key: 'profiles', label: '用户信息', description: '用户账户数据' },
        { key: 'user_permissions', label: '用户权限', description: '用户权限配置' },
        { key: 'role_permission_templates', label: '角色模板', description: '角色权限模板' },
        { key: 'menu_config', label: '菜单配置', description: '动态菜单配置' }
      ]
    },
    {
      title: '可选数据',
      tables: [
        { key: 'contracts', label: '合同信息', description: '合同数据（可选）' }
      ]
    }
  ];

  const selectedCount = Object.values(selectedTables).filter(Boolean).length;
  const totalCount = Object.keys(selectedTables).length;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader
        title="系统备份"
        description="将数据库数据备份到本地，支持 JSON 和 SQL 格式"
        icon={Database}
        iconColor="text-primary"
        actions={(
          <Badge variant="outline" className="text-sm">
            已选择 {selectedCount} / {totalCount} 个表
          </Badge>
        )}
      />

      {/* 主体左右布局 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 左侧主体 */}
        <div className="lg:col-span-8 space-y-6">
          {/* 备份操作区 */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileDown className="h-5 w-5 text-blue-600" />
                  JSON 格式备份
                </CardTitle>
                <CardDescription>
                  备份为 JSON 文件，适合数据分析和跨平台使用
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  onClick={handleBackupToLocal}
                  disabled={backing || selectedCount === 0}
                  className="w-full"
                  size="lg"
                >
                  {backing ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      {backupProgress}
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      下载 JSON 备份
                    </>
                  )}
                </Button>
                {selectedCount === 0 && (
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    请至少选择一个表
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HardDrive className="h-5 w-5 text-green-600" />
                  SQL 格式备份
                </CardTitle>
                <CardDescription>
                  备份为 SQL 脚本，可直接导入数据库
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  onClick={handleBackupToSQL}
                  disabled={backing || selectedCount === 0}
                  className="w-full"
                  size="lg"
                  variant="outline"
                >
                  {backing ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      {backupProgress}
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      下载 SQL 备份
                    </>
                  )}
                </Button>
                {selectedCount === 0 && (
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    请至少选择一个表
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* 表选择 */}
          <div className="grid gap-4">
            {tableGroups.map(group => (
              <Card key={group.title}>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center justify-between">
                {group.title}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      const updates: Partial<typeof selectedTables> = {};
                      group.tables.forEach(t => {
                        updates[t.key as keyof typeof selectedTables] = true;
                      });
                      setSelectedTables(prev => ({ ...prev, ...updates }));
                    }}
                  >
                    全选
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      const updates: Partial<typeof selectedTables> = {};
                      group.tables.forEach(t => {
                        updates[t.key as keyof typeof selectedTables] = false;
                      });
                      setSelectedTables(prev => ({ ...prev, ...updates }));
                    }}
                  >
                    全不选
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {group.tables.map(table => (
                  <div key={table.key} className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                    <Checkbox
                      id={table.key}
                      checked={selectedTables[table.key as keyof typeof selectedTables]}
                      onCheckedChange={(checked) => {
                        setSelectedTables(prev => ({
                          ...prev,
                          [table.key]: checked as boolean
                        }));
                      }}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <Label
                        htmlFor={table.key}
                        className="text-sm font-medium cursor-pointer"
                      >
                        {table.label}
                      </Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        {table.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
            ))}
          </div>

          {/* 快捷操作 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">快捷备份</CardTitle>
              <CardDescription>常用的备份组合</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedTables({
                      logistics_records: true,
                      logistics_partner_costs: true,
                      projects: true,
                      partners: true,
                      project_partners: true,
                      partner_chains: true,
                      payment_requests: true,
                      invoice_requests: true,
                      payment_records: true,
                      invoice_records: true,
                      partner_balance: true,
                      partner_balance_transactions: true,
                      invoice_receipt_records: true,
                      drivers: true,
                      locations: true,
                      scale_records: true,
                      profiles: false,
                      user_permissions: false,
                      role_permission_templates: false,
                      menu_config: false,
                      contracts: false,
                      // 内部车辆管理系统
                      internal_drivers: false,
                      internal_vehicles: false,
                      internal_driver_vehicle_relations: false,
                      fleet_manager_projects: false,
                      fleet_manager_favorite_routes: false,
                      fleet_manager_favorite_route_drivers: false,
                      dispatch_orders: false,
                      internal_driver_expense_applications: false,
                      internal_vehicle_change_applications: false
                    });
                  }}
                >
                  仅业务数据
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedTables({
                      logistics_records: false,
                      logistics_partner_costs: false,
                      projects: true,
                      partners: true,
                      project_partners: true,
                      partner_chains: true,
                      payment_requests: false,
                      invoice_requests: false,
                      payment_records: false,
                      invoice_records: false,
                      partner_balance: false,
                      partner_balance_transactions: false,
                      invoice_receipt_records: false,
                      drivers: true,
                      locations: true,
                      scale_records: false,
                      profiles: true,
                      user_permissions: true,
                      role_permission_templates: true,
                      menu_config: true,
                      contracts: false,
                      // 内部车辆管理系统
                      internal_drivers: false,
                      internal_vehicles: false,
                      internal_driver_vehicle_relations: false,
                      fleet_manager_projects: false,
                      fleet_manager_favorite_routes: false,
                      fleet_manager_favorite_route_drivers: false,
                      dispatch_orders: false,
                      internal_driver_expense_applications: false,
                      internal_vehicle_change_applications: false
                    });
                  }}
                >
                  仅配置数据
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    const updates: Partial<typeof selectedTables> = {};
                    Object.keys(selectedTables).forEach(key => {
                      updates[key as keyof typeof selectedTables] = true;
                    });
                    setSelectedTables(prev => ({ ...prev, ...updates }));
                  }}
                >
                  全部数据
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 右侧说明/最近记录 */}
        <aside className="lg:col-span-4 space-y-6">
          {/* 使用说明 */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-1">
                <p className="font-semibold">备份说明：</p>
                <ul className="text-sm space-y-1 list-disc list-inside ml-2">
                  <li><strong>JSON格式</strong>：适合数据分析、迁移到其他系统、人工查看</li>
                  <li><strong>SQL格式</strong>：适合直接导入PostgreSQL数据库、数据恢复</li>
                  <li>建议定期备份（每天/每周），保存在安全的位置</li>
                  <li>备份文件名包含时间戳，不会覆盖旧备份</li>
                </ul>
              </div>
            </AlertDescription>
          </Alert>

          {/* 预留：最近备份记录/计划任务 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">最近备份记录</CardTitle>
              <CardDescription>后续可接入日志表或本地记录</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">暂无记录</p>
            </CardContent>
          </Card>
        </aside>
      </div>

      {/* 备份历史提示 */}
      <Alert className="border-green-500 bg-green-50">
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        <AlertDescription className="text-green-800">
          <div className="space-y-1">
            <p className="font-semibold">备份最佳实践：</p>
            <ul className="text-sm space-y-1 list-disc list-inside ml-2">
              <li>定期备份（建议每天或每周）</li>
              <li>保存到安全的位置（本地 + 云盘）</li>
              <li>备份前先测试恢复流程</li>
              <li>重要操作前先进行备份</li>
            </ul>
          </div>
        </AlertDescription>
      </Alert>
    </div>
  );
}


