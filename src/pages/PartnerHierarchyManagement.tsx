// 货主层级管理页面  
// 功能: 仅管理货主类型合作方的层级关系，支持拖拽调整上下级

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
const TreeNode = ({ node, level, onToggle, onDrop, onCancelRoot, onDetach, canEdit }: any) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isOver, setIsOver] = useState(false);
  const hasChildren = node.children && node.children.length > 0;
  const indent = level * 24;
  const isChild = level > 0; // 是否为子节点

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

        <div className="flex gap-2">
          {/* 取消根节点按钮 */}
          {canEdit && node.is_root && !hasChildren && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => onCancelRoot(node.id, node.name)}
              className="text-xs text-orange-600 hover:text-orange-700 hover:bg-orange-50"
            >
              取消根节点
            </Button>
          )}
          
          {/* 脱离上级按钮（只对子节点且没有下级的显示） */}
          {canEdit && isChild && !hasChildren && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => onDetach(node.id, node.name, node.parent_name)}
              className="text-xs text-purple-600 hover:text-purple-700 hover:bg-purple-50"
            >
              脱离上级
            </Button>
          )}
        </div>
      </div>

      {node.expanded && hasChildren && (
        <div className="mt-1">
          {node.children.map((child: any) => (
            <TreeNode key={child.id} node={child} level={level + 1} onToggle={onToggle} onDrop={onDrop} onCancelRoot={onCancelRoot} onDetach={onDetach} canEdit={canEdit} />
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
      // 只查询货主类型的合作方
      const { data, error } = await supabase
        .from('partners')
        .select('*')
        .eq('partner_type', '货主')
        .order('name');

      if (error) throw error;

      setPartners(data || []);
      
      // 构建树
      const map = new Map();
      const roots: any[] = [];
      const inTreeIds = new Set<string>(); // 记录在树中的所有节点ID

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

      // 递归标记所有在树中的节点
      const markTreeNodes = (nodes: any[]) => {
        nodes.forEach(node => {
          inTreeIds.add(node.id);
          if (node.children && node.children.length > 0) {
            markTreeNodes(node.children);
          }
        });
      };
      markTreeNodes(roots);

      // 未分配的：不是根节点，且不在任何树中的节点
      const unassignedList = (data || []).filter((p: any) => 
        !p.is_root && !inTreeIds.has(p.id)
      );
      setUnassigned(unassignedList);

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

    // 检查是否拖到子孙节点下（防止循环引用）
    // hierarchy_path 格式：/uuid1/uuid2/uuid3
    // 检查 target 的路径是否以 drag 的路径开头
    if (drag.hierarchy_path && target.hierarchy_path) {
      // target 是 drag 的子孙节点
      if (target.hierarchy_path.startsWith(drag.hierarchy_path + '/') || 
          target.hierarchy_path === drag.hierarchy_path) {
        toast.error(`不能将 "${drag.name}" 拖到它的子孙节点 "${target.name}" 下`);
        return;
      }
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

  const handleCancelRoot = async (id: string, name: string) => {
    if (!confirm(`确定取消 "${name}" 的根节点设置？\n\n取消后该货主将移到"未分配"列表。`)) return;

    try {
      const { error } = await supabase
        .from('partners')
        .update({ 
          parent_partner_id: null,
          is_root: false 
        } as any)
        .eq('id', id);

      if (error) throw error;
      toast.success('已取消根节点设置');
      load();
    } catch (e: any) {
      toast.error('失败: ' + e.message);
    }
  };

  const handleDetach = async (id: string, name: string, parentName: string) => {
    if (!confirm(`确定将 "${name}" 从 "${parentName}" 下脱离？\n\n脱离后该货主将移到"未分配"列表，需要重新设置层级。`)) return;

    try {
      const { error } = await supabase
        .from('partners')
        .update({ 
          parent_partner_id: null,
          is_root: false 
        } as any)
        .eq('id', id);

      if (error) throw error;
      toast.success('已脱离上级');
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
          <h1 className="text-2xl font-bold">🌳 货主层级管理</h1>
          <p className="text-sm text-gray-600 mt-1">管理货主组织架构，上级可查看下级数据（不包括合作商）</p>
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
              <li>• <strong>拖拽</strong>货主节点到目标位置建立上下级关系</li>
              <li>• 点击<strong>"取消根节点"</strong>或<strong>"脱离上级"</strong>可断开关系</li>
              <li>• 点击<strong>"设置根节点"</strong>按钮批量设置未分配的货主</li>
              <li>• 上级货主可以查看所有下级数据，不同链路完全隔离</li>
              <li>• 🔵 <strong>只管理货主类型</strong>，其他类型不参与层级关系</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* 统计 */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card><CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.total_partners}</div>
            <div className="text-xs text-gray-600">总货主数</div>
          </CardContent></Card>
          <Card><CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-600">{stats.root_partners}</div>
            <div className="text-xs text-gray-600">根节点货主</div>
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
                placeholder="🔍 搜索货主..."
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
              {/* 根节点 */}
              <div className="space-y-1">
                {filtered.map((n: any) => (
                  <TreeNode key={n.id} node={n} level={0} onToggle={toggle} onDrop={handleDrop} onCancelRoot={handleCancelRoot} onDetach={handleDetach} canEdit={canEdit} />
                ))}
              </div>

              {/* 未分配层级的货主（可拖拽） */}
              {unassigned.length > 0 && (
                <div className="mt-6 border-t-2 border-dashed pt-4">
                  <div className="text-sm font-medium text-gray-600 mb-2 flex items-center gap-2">
                    <span className="text-orange-600">⚠️</span>
                    未分配层级的货主 ({unassigned.length})
                    <span className="text-xs text-gray-500">- 不在任何组织架构树中</span>
                  </div>
                  <div className="space-y-1 bg-orange-50 p-3 rounded">
                    {unassigned.map((p: any) => {
                      const parentName = partners.find(x => x.id === p.parent_partner_id)?.name;
                      return (
                        <div
                          key={p.id}
                          draggable={canEdit}
                          onDragStart={(e) => {
                            e.dataTransfer.setData('id', p.id);
                          }}
                          className={`flex items-center gap-2 p-3 rounded border-l-4 border-orange-300 bg-white ${
                            canEdit ? 'hover:bg-gray-50 cursor-move' : ''
                          }`}
                        >
                          {canEdit && <span className="text-gray-400">≡</span>}
                          <Badge variant="outline">{p.parent_partner_id ? '有上级' : '独立'}</Badge>
                          <div className="flex-1">
                            <div className="font-medium">{p.name}</div>
                            <div className="text-xs text-gray-600">
                              {parentName && `上级: ${parentName} | `}
                              {p.full_name || '未设为根节点'}
                            </div>
                          </div>
                          {canEdit && (
                            <div className="text-xs text-gray-400">← 拖我</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {canEdit && (
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={async (e) => {
                    e.preventDefault();
                    const id = e.dataTransfer.getData('id');
                    if (!id) return;
                    
                    const p = partners.find(x => x.id === id);
                    if (!p) return;
                    
                    // 如果有下级，不允许直接设为根节点
                    const hasChildren = partners.some(x => x.parent_partner_id === id);
                    if (hasChildren) {
                      toast.error(`"${p.name}" 有下级货主，请先处理下级关系`);
                      return;
                    }
                    
                    if (!confirm(`将 "${p.name}" 设为根节点？\n\n如果该货主有上级，将断开上下级关系。`)) return;
                    
                    try {
                      const { error } = await supabase
                        .from('partners')
                        .update({ 
                          parent_partner_id: null,
                          is_root: true 
                        } as any)
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
                  <div className="text-xs text-gray-500 mt-1">将任意节点（无下级）拖到这里，设置为独立的根节点</div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* 设置根节点对话框 */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>🏠 设置根节点 - 选择货主</DialogTitle>
          </DialogHeader>
          
          <div className="text-sm text-gray-600 mb-4">
            以下货主尚未分配到任何组织架构树中，请选择需要设为根节点的：
          </div>

          <div className="max-h-96 overflow-y-auto border rounded p-2 space-y-1">
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded sticky top-0">
              <input type="checkbox" checked={selected.size === unassigned.length} onChange={toggleAll} />
              <span>全选 ({selected.size} / {unassigned.length})</span>
            </div>

            {unassigned.map((p: any) => {
              const parentName = partners.find(x => x.id === p.parent_partner_id)?.name;
              return (
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
                    <div className="text-sm text-gray-600">
                      {parentName && `上级: ${parentName} | `}
                      {p.full_name || '未设为根节点'}
                    </div>
                  </div>
                  <Badge variant={p.parent_partner_id ? "secondary" : "outline"}>
                    {p.parent_partner_id ? '有上级' : '独立'}
                  </Badge>
                </div>
              );
            })}
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
