// 合作方层级管理页面  
// 功能: 仅管理层级关系，支持拖拽调整上下级

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { usePermissions } from '@/hooks/usePermissions';
import { Link } from 'react-router-dom';

// 树节点组件
const TreeNode = ({ node, level, onToggle, onDrop, canEdit }: any) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isOver, setIsOver] = useState(false);
  const hasChildren = node.children && node.children.length > 0;
  const indent = level * 24;

  return (
    <div>
      <div 
        draggable={canEdit}
        onDragStart={(e) => {
          e.dataTransfer.setData('id', node.id);
          setIsDragging(true);
        }}
        onDragEnd={() => setIsDragging(false)}
        onDragEnter={(e) => { e.preventDefault(); setIsOver(true); }}
        onDragLeave={() => setIsOver(false)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          setIsOver(false);
          const id = e.dataTransfer.getData('id');
          if (id && id !== node.id) onDrop(id, node.id);
        }}
        className={`flex items-center gap-2 p-3 rounded border-l-4 transition ${
          isDragging ? 'opacity-50' : ''
        } ${isOver ? 'bg-blue-100 border-blue-500' : ''} ${
          node.is_root ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
        } ${canEdit ? 'hover:bg-gray-50 cursor-move' : ''}`}
        style={{ marginLeft: `${indent}px` }}
      >
        {canEdit && <span className="text-gray-400">≡</span>}
        
        <div className="flex items-center gap-1 min-w-[80px]">
          {hasChildren ? (
            <button onClick={() => onToggle(node)} className="p-1 hover:bg-gray-200 rounded">
              {node.expanded ? '▼' : '▶'}
            </button>
          ) : <div className="w-6" />}
          
          <Badge variant={node.is_root ? "default" : "outline"}>
            {node.is_root ? '🏠 根' : `L${node.hierarchy_depth || 0}`}
          </Badge>
        </div>

        <div className="flex-1">
          <div className="font-medium">{node.name}</div>
          <div className="text-xs text-gray-600 mt-1">
            {node.parent_name && `上级: ${node.parent_name} | `}
            下级: {node.direct_children_count || 0}
          </div>
        </div>
      </div>

      {node.expanded && hasChildren && (
        <div className="mt-1">
          {node.children.map((child: any) => (
            <TreeNode key={child.id} node={child} level={level + 1} onToggle={onToggle} onDrop={onDrop} canEdit={canEdit} />
          ))}
        </div>
      )}
    </div>
  );
};

// 主组件
export default function PartnerHierarchyManagement() {
  const { isAdmin, isFinance } = usePermissions();
  const canEdit = isAdmin || isFinance;

  const [partners, setPartners] = useState<any[]>([]);
  const [tree, setTree] = useState<any[]>([]);
  const [unassigned, setUnassigned] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [stats, setStats] = useState<any>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('partners')
        .select('*')
        .order('name');

      if (error) throw error;

      setPartners(data || []);
      
      // 未分配的（没有上级且不是根）
      const unassignedList = (data || []).filter((p: any) => !p.parent_partner_id && !p.is_root);
      setUnassigned(unassignedList);
      
      // 构建树
      const map = new Map();
      const roots: any[] = [];

      (data || []).forEach((item: any) => {
        const count = (data || []).filter((p: any) => p.parent_partner_id === item.id).length;
        map.set(item.id, {
          ...item,
          children: [],
          expanded: (item.hierarchy_depth || 0) < 2,
          direct_children_count: count,
          parent_name: (data || []).find((p: any) => p.id === item.parent_partner_id)?.name
        });
      });

      (data || []).forEach((item: any) => {
        const node = map.get(item.id);
        if (item.parent_partner_id && map.has(item.parent_partner_id)) {
          map.get(item.parent_partner_id).children.push(node);
        } else if (item.is_root) {
          roots.push(node);
        }
      });

      setTree(roots);

      // 统计
      const total = data?.length || 0;
      const rootCount = (data || []).filter((p: any) => p.is_root).length;
      const depths = (data || []).map((p: any) => p.hierarchy_depth || 0);
      const maxDepth = Math.max(...depths, 0);
      const avgDepth = total > 0 ? (depths.reduce((a, b) => a + b, 0) / total).toFixed(1) : '0';

      setStats({ total_partners: total, root_partners: rootCount, max_depth: maxDepth, avg_depth: avgDepth });
    } catch (e: any) {
      toast.error('加载失败: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const toggle = (node: any) => {
    node.expanded = !node.expanded;
    setTree([...tree]);
  };

  const expandAll = () => {
    const exp = (nodes: any[]) => nodes.forEach(n => { n.expanded = true; if (n.children.length) exp(n.children); });
    exp(tree);
    setTree([...tree]);
  };

  const collapseAll = () => {
    const col = (nodes: any[]) => nodes.forEach(n => { n.expanded = false; if (n.children.length) col(n.children); });
    col(tree);
    setTree([...tree]);
  };

  const handleDrop = async (dragId: string, targetId: string) => {
    const drag = partners.find(p => p.id === dragId);
    const target = partners.find(p => p.id === targetId);
    if (!drag || !target) return;

    if (target.hierarchy_path?.includes(dragId)) {
      toast.error('不能拖到子孙节点下');
      return;
    }

    if (!confirm(`将 "${drag.name}" 移到 "${target.name}" 下？`)) return;

    try {
      const { error } = await supabase
        .from('partners')
        .update({ parent_partner_id: targetId } as any)
        .eq('id', dragId);

      if (error) throw error;
      toast.success('移动成功');
      load();
    } catch (e: any) {
      toast.error('失败: ' + e.message);
    }
  };

  const batchSetRoot = async () => {
    if (selected.size === 0) return;
    
    if (!confirm(`设置 ${selected.size} 个为根节点？`)) return;

    try {
      const { error } = await supabase
        .from('partners')
        .update({ parent_partner_id: null, is_root: true } as any)
        .in('id', Array.from(selected));

      if (error) throw error;
      toast.success(`已设置 ${selected.size} 个根节点`);
      setShowDialog(false);
      setSelected(new Set());
      load();
    } catch (e: any) {
      toast.error('失败: ' + e.message);
    }
  };

  const toggleSel = (id: string) => {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  };

  const toggleAll = () => {
    setSelected(selected.size === unassigned.length ? new Set() : new Set(unassigned.map((p: any) => p.id)));
  };

  const filtered = React.useMemo(() => {
    if (!search) return tree;
    const filter = (nodes: any[]): any[] => {
      const res: any[] = [];
      for (const n of nodes) {
        const match = n.name.toLowerCase().includes(search.toLowerCase());
        const childMatch = n.children ? filter(n.children) : [];
        if (match || childMatch.length) res.push({ ...n, children: childMatch, expanded: true });
      }
      return res;
    };
    return filter(tree);
  }, [tree, search]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* 头部 */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">🌳 合作方层级管理</h1>
          <p className="text-sm text-gray-600 mt-1">拖拽调整组织架构，上级可查看下级数据</p>
        </div>
        <div className="flex gap-2">
          {unassigned.length > 0 && canEdit && (
            <Button onClick={() => setShowDialog(true)} className="bg-orange-600 hover:bg-orange-700">
              🏠 设置根节点 ({unassigned.length})
            </Button>
          )}
          <Button variant="outline" asChild>
            <Link to="/partners">📝 管理合作方信息</Link>
          </Button>
          <Button variant="outline" onClick={load}>
            🔄 刷新
          </Button>
        </div>
      </div>

      {/* 提示 */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-4">
          <div className="text-sm">
            <div className="font-medium mb-2">💡 使用说明:</div>
            <ul className="space-y-1">
              <li>• <strong>拖拽</strong>节点到目标位置建立上下级关系</li>
              <li>• 点击<strong>"设置根节点"</strong>按钮批量设置未分配的合作方</li>
              <li>• 上级可以查看所有下级数据，不同链路完全隔离</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* 统计 */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card><CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.total_partners}</div>
            <div className="text-xs text-gray-600">总合作方</div>
          </CardContent></Card>
          <Card><CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-600">{stats.root_partners}</div>
            <div className="text-xs text-gray-600">根节点</div>
          </CardContent></Card>
          <Card><CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">{stats.max_depth}</div>
            <div className="text-xs text-gray-600">最大深度</div>
          </CardContent></Card>
          <Card><CardContent className="pt-6">
            <div className="text-2xl font-bold text-purple-600">{stats.avg_depth}</div>
            <div className="text-xs text-gray-600">平均深度</div>
          </CardContent></Card>
        </div>
      )}

      {/* 搜索 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1">
              <Input
                placeholder="🔍 搜索合作方..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button variant="outline" onClick={expandAll}>展开全部</Button>
            <Button variant="outline" onClick={collapseAll}>折叠全部</Button>
          </div>
        </CardContent>
      </Card>

      {/* 树 */}
      <Card>
        <CardHeader>
          <CardTitle>🌳 组织架构树 ({partners.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12">加载中...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <div className="mb-4">{search ? '未找到匹配' : '暂无根节点'}</div>
              {unassigned.length > 0 && (
                <Button onClick={() => setShowDialog(true)}>
                  🏠 设置根节点 ({unassigned.length})
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="space-y-1">
                {filtered.map((n: any) => (
                  <TreeNode key={n.id} node={n} level={0} onToggle={toggle} onDrop={handleDrop} canEdit={canEdit} />
                ))}
              </div>

              {canEdit && (
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={async (e) => {
                    e.preventDefault();
                    const id = e.dataTransfer.getData('id');
                    if (!id) return;
                    
                    const p = partners.find(x => x.id === id);
                    if (!p || !confirm(`将 "${p.name}" 设为根节点？`)) return;
                    
                    try {
                      const { error } = await supabase
                        .from('partners')
                        .update({ parent_partner_id: null } as any)
                        .eq('id', id);
                      
                      if (error) throw error;
                      toast.success('已设为根节点');
                      load();
                    } catch (e: any) {
                      toast.error('失败: ' + e.message);
                    }
                  }}
                  className="mt-4 p-6 border-2 border-dashed border-green-300 rounded text-center hover:border-green-500 hover:bg-green-50 transition"
                >
                  <div className="text-4xl mb-2">🏠</div>
                  <div className="font-medium text-green-700">拖到这里设为根节点</div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* 未分配对话框 */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>🏠 设置根节点 - 未分配的合作方</DialogTitle>
          </DialogHeader>
          
          <div className="text-sm text-gray-600 mb-4">
            以下合作方尚未设置层级，请选择需要设为根节点的：
          </div>

          <div className="max-h-96 overflow-y-auto border rounded p-2 space-y-1">
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded sticky top-0">
              <input type="checkbox" checked={selected.size === unassigned.length} onChange={toggleAll} />
              <span>全选 ({selected.size} / {unassigned.length})</span>
            </div>

            {unassigned.map((p: any) => (
              <div
                key={p.id}
                onClick={() => toggleSel(p.id)}
                className={`flex items-center gap-2 p-3 rounded cursor-pointer border ${
                  selected.has(p.id) ? 'bg-blue-100 border-blue-300' : 'hover:bg-gray-50'
                }`}
              >
                <input type="checkbox" checked={selected.has(p.id)} onChange={() => {}} />
                <div className="flex-1">
                  <div className="font-medium">{p.name}</div>
                  {p.full_name && <div className="text-sm text-gray-600">{p.full_name}</div>}
                </div>
                <Badge variant="outline">未分配</Badge>
              </div>
            ))}
          </div>

          <div className="flex justify-between pt-4 border-t">
            <div>已选 <strong>{selected.size}</strong> 个</div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowDialog(false)}>取消</Button>
              <Button onClick={batchSetRoot} disabled={selected.size === 0}>设置为根节点</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
