// 文件路径: src/pages/FinanceReconciliation.tsx
import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from 'xlsx';

// 类型定义
interface LogisticsRecord {
  id: string;
  auto_number: string;
  project_name: string;
  driver_name: string;
  loading_location: string;
  unloading_location: string;
  loading_date: string;
  current_cost: number | null;
  payable_cost: number | null;
  extra_cost: number | null;
}

interface PartnerPayable {
  partner_id: string;
  partner_name: string;
  level: number;
  total_payable: number;
  records_count: number;
}

interface LogisticsRecordWithPartners extends LogisticsRecord {
  partner_costs: {
    partner_id: string;
    partner_name: string;
    level: number;
    payable_amount: number;
  }[];
}

export default function FinanceReconciliation() {
  const [logisticsRecords, setLogisticsRecords] = useState<LogisticsRecordWithPartners[]>([]);
  const [allPartners, setAllPartners] = useState<{id: string, name: string, level: number}[]>([]);
  const [projects, setProjects] = useState<{id: string, name: string}[]>([]);
  const [loading, setLoading] = useState(true);
  
  // 筛选器状态
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");
  const [selectedDate, setSelectedDate] = useState<string>(""); // 【已修改】使用单个日期筛选
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>("all");
  
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const { data: projectsData } = await supabase.from('projects').select('id, name').order('name');
      setProjects(projectsData || []);

      const { data: partnersData } = await supabase.from('project_partners').select(`partner_id, level, partners!inner(name)`);
      const uniquePartners = Array.from(new Map(partnersData?.map(p => [ p.partner_id, { id: p.partner_id, name: (p.partners as any).name, level: p.level } ]) || []).values()).sort((a, b) => a.level - b.level);
      setAllPartners(uniquePartners);

      const { data: records, error: recordsError } = await supabase
        .from('logistics_records_view')
        .select(`*, logistics_partner_costs(*, partners!inner(name))`)
        .order('created_at', { ascending: false });
      if (recordsError) throw recordsError;

      const recordsWithPartners: LogisticsRecordWithPartners[] = (records || []).map((record: any) => ({
        ...record,
        partner_costs: (record.logistics_partner_costs || []).map((cost: any) => ({
          partner_id: cost.partner_id,
          partner_name: cost.partners.name,
          level: cost.level,
          payable_amount: cost.payable_amount
        })).sort((a, b) => a.level - b.level)
      }));
      setLogisticsRecords(recordsWithPartners);

    } catch (error) {
      toast({ title: "错误", description: "加载财务对账数据失败", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // 筛选后的数据
  const filteredRecords = useMemo(() => {
    return logisticsRecords.filter(record => {
      const projectMatch = selectedProjectId === "all" || record.project_name === projects.find(p => p.id === selectedProjectId)?.name;
      const dateMatch = !selectedDate || record.loading_date === selectedDate; // 【已修改】按单个日期筛选
      const partnerMatch = selectedPartnerId === "all" || record.partner_costs.some(cost => cost.partner_id === selectedPartnerId);
      return projectMatch && dateMatch && partnerMatch;
    });
  }, [logisticsRecords, selectedProjectId, projects, selectedDate, selectedPartnerId]);

  // 基于筛选数据重新计算合作方应付
  const filteredPartnerPayables = useMemo(() => {
    const payableMap = new Map<string, { name: string; level: number; total: number; count: number }>();
    filteredRecords.forEach(record => {
      record.partner_costs.forEach(cost => {
        if (selectedPartnerId !== "all" && cost.partner_id !== selectedPartnerId) return;
        const partnerId = cost.partner_id;
        if (payableMap.has(partnerId)) {
          const existing = payableMap.get(partnerId)!;
          existing.total += cost.payable_amount;
          existing.count += 1;
        } else {
          payableMap.set(partnerId, {
            name: cost.partner_name,
            level: cost.level,
            total: cost.payable_amount,
            count: 1
          });
        }
      });
    });
    return Array.from(payableMap.entries()).map(([partnerId, data]) => ({
      partner_id: partnerId, partner_name: data.name, level: data.level,
      total_payable: data.total, records_count: data.count
    })).sort((a, b) => a.level - b.level);
  }, [filteredRecords, selectedPartnerId]);
  
  // 【已修改】动态计算需要显示的合作方列
  const displayedPartners = useMemo(() => {
    // 如果选择了具体的合作方，就只显示那一个
    if (selectedPartnerId && selectedPartnerId !== "all") {
      const selected = allPartners.find(p => p.id === selectedPartnerId);
      return selected ? [selected] : [];
    }

    // 否则，显示所有在筛选结果中出现过的合作方
    if (!filteredRecords || filteredRecords.length === 0) return [];
    const relevantPartnerIds = new Set<string>();
    filteredRecords.forEach(record => {
      (record.partner_costs || []).forEach(cost => relevantPartnerIds.add(cost.partner_id));
    });
    return allPartners.filter(partner => relevantPartnerIds.has(partner.id)).sort((a, b) => a.level - b.level);
  }, [filteredRecords, allPartners, selectedPartnerId]);

  const exportDetailsToExcel = () => { /* ... */ };

  if (loading) return <div className="flex justify-center p-8">加载中...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div><h1 className="text-3xl font-bold text-foreground">财务对账</h1><p className="text-muted-foreground">运费收入与合作方应付金额统计</p></div>
        {/* <Button onClick={exportToExcel} className="flex items-center gap-2"><Download className="h-4 w-4" />导出汇总</Button> */}
      </div>

      {/* 筛选器 */}
      <Card className="border-muted/40">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1 min-w-[140px]"><Label htmlFor="projectFilter" className="text-xs text-muted-foreground">项目</Label><Select value={selectedProjectId} onValueChange={setSelectedProjectId}><SelectTrigger id="projectFilter" className="h-8 text-sm"><SelectValue placeholder="选择项目" /></SelectTrigger><SelectContent><SelectItem value="all">所有项目</SelectItem>{projects.map(project => (<SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>))}</SelectContent></Select></div>
            
            {/* 【已修改】单个日期筛选器 */}
            <div className="flex flex-col gap-1 min-w-[120px]">
              <Label htmlFor="dateFilter" className="text-xs text-muted-foreground">日期</Label>
              <Input id="dateFilter" type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="h-8 text-sm"/>
            </div>

            <div className="flex flex-col gap-1 min-w-[140px]"><Label htmlFor="partnerFilter" className="text-xs text-muted-foreground">合作方</Label><Select value={selectedPartnerId} onValueChange={setSelectedPartnerId}><SelectTrigger id="partnerFilter" className="h-8 text-sm"><SelectValue placeholder="选择合作方" /></SelectTrigger><SelectContent><SelectItem value="all">所有合作方</SelectItem>{allPartners.map(partner => (<SelectItem key={partner.id} value={partner.id}>{partner.name} ({partner.level}级)</SelectItem>))}</SelectContent></Select></div>
            <Button variant="outline" size="sm" onClick={() => { setSelectedProjectId("all"); setSelectedDate(""); setSelectedPartnerId("all"); }} className="h-8 px-3 text-sm">清除筛选</Button>
          </div>
        </CardContent>
      </Card>

      {/* 统计卡片 */}
      <div className="grid gap-6 md:grid-cols-4">
        <Card><CardHeader><CardTitle className="text-sm font-medium">运单总数</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{filteredRecords.length}</div></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm font-medium">总运费收入</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">¥{filteredRecords.reduce((s, r) => s + (r.current_cost || 0), 0).toFixed(2)}</div></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm font-medium">总额外费用</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-orange-600">¥{filteredRecords.reduce((s, r) => s + (r.extra_cost || 0), 0).toFixed(2)}</div></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm font-medium">合作方应付总额</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">¥{filteredPartnerPayables.reduce((s, p) => s + p.total_payable, 0).toFixed(2)}</div></CardContent></Card>
      </div>

      {/* 合作方应付汇总 */}
      <Card>
        <CardHeader><CardTitle>合作方应付汇总</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>合作方名称</TableHead><TableHead>相关运单数</TableHead><TableHead>应付总金额</TableHead></TableRow></TableHeader>
            <TableBody>
              {filteredPartnerPayables.length === 0 ? (
                <TableRow><TableCell colSpan={3} className="text-center">没有找到匹配的数据</TableCell></TableRow>
              ) : filteredPartnerPayables.map((partner) => (
                <TableRow key={partner.partner_id}>
                  <TableCell className="font-medium">{partner.partner_name}</TableCell>
                  <TableCell>{partner.records_count}</TableCell>
                  <TableCell className="font-mono">¥{partner.total_payable.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 运单财务明细 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
            <div><CardTitle>运单财务明细</CardTitle><p className="text-sm text-muted-foreground">各合作方应付金额按级别从左到右排列</p></div>
            <Button variant="outline" size="sm" onClick={exportDetailsToExcel}><Download className="mr-2 h-4 w-4" />导出明细</Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>运单编号</TableHead><TableHead>项目</TableHead><TableHead>司机</TableHead><TableHead>路线</TableHead><TableHead>日期</TableHead>
                <TableHead>运费</TableHead><TableHead className="text-orange-600">额外费</TableHead>
                {displayedPartners.map(p => <TableHead key={p.id} className="text-center">{p.name}<div className="text-xs text-muted-foreground">({p.level}级)</div></TableHead>)}
                <TableHead>状态</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRecords.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono">{r.auto_number}</TableCell><TableCell>{r.project_name}</TableCell><TableCell>{r.driver_name}</TableCell>
                  <TableCell className="text-sm">{r.loading_location}→{r.unloading_location}</TableCell><TableCell>{r.loading_date}</TableCell>
                  <TableCell className="font-mono">¥{r.current_cost?.toFixed(2)}</TableCell>
                  <TableCell className="font-mono text-orange-600">{r.extra_cost ? `¥${r.extra_cost.toFixed(2)}` : '-'}</TableCell>
                  {displayedPartners.map(p => { const cost = (r.partner_costs || []).find(c => c.partner_id === p.id); return <TableCell key={p.id} className="font-mono text-center">{cost ? `¥${cost.payable_amount.toFixed(2)}` : '-'}</TableCell>; })}
                  <TableCell><Badge variant={r.current_cost ? "default" : "secondary"}>{r.current_cost ? "已计费" : "待计费"}</Badge></TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/30 font-semibold border-t-2">
                <TableCell colSpan={5} className="text-right font-bold">合计</TableCell>
                <TableCell className="font-mono font-bold">¥{filteredRecords.reduce((s, r) => s + (r.current_cost || 0), 0).toFixed(2)}</TableCell>
                <TableCell className="font-mono font-bold text-orange-600">¥{filteredRecords.reduce((s, r) => s + (r.extra_cost || 0), 0).toFixed(2)}</TableCell>
                {displayedPartners.map(p => {
                  const total = filteredRecords.reduce((s, r) => s + ((r.partner_costs || []).find(c => c.partner_id === p.id)?.payable_amount || 0), 0);
                  return <TableCell key={p.id} className="text-center font-bold font-mono">¥{total.toFixed(2)}</TableCell>;
                })}
                <TableCell></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
