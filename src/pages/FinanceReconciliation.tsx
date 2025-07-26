// 文件路径: src/pages/FinanceReconciliation.tsx
import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from 'xlsx';
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { DateRange } from "react-day-picker";
import { format } from "date-fns";

// 类型定义...
// ... (与您项目中的 types 文件保持一致)

export default function FinanceReconciliation() {
  const [reportData, setReportData] = useState<any>(null);
  const [allPartners, setAllPartners] = useState<{id: string, name: string, level: number}[]>([]);
  const [projects, setProjects] = useState<{id: string, name: string}[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>("all");
  const [viewingRecord, setViewingRecord] = useState<any | null>(null);
  
  const { toast } = useToast();

  const fetchInitialOptions = useCallback(async () => {
    try {
      const { data: projectsData } = await supabase.from('projects').select('id, name').order('name');
      setProjects(projectsData || []);
      const { data: partnersData } = await supabase.from('project_partners').select(`partner_id, level, partners!inner(name)`);
      const uniquePartners = Array.from(new Map(partnersData?.map(p => [ p.partner_id, { id: p.partner_id, name: (p.partners as any).name, level: p.level } ]) || []).values()).sort((a, b) => a.level - b.level);
      setAllPartners(uniquePartners);
    } catch (error) {
      toast({ title: "错误", description: "加载筛选选项失败", variant: "destructive" });
    }
  }, [toast]);

  const fetchReportData = useCallback(async () => {
    setLoading(true);
    try {
      const filters = {
        p_project_id: selectedProjectId === 'all' ? null : selectedProjectId,
        p_start_date: dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : null,
        p_end_date: dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : null,
        p_partner_id: selectedPartnerId === 'all' ? null : selectedPartnerId,
      };
      const { data, error } = await supabase.rpc('get_finance_reconciliation_data', filters);
      if (error) throw error;
      setReportData(data);
    } catch (error) {
      console.error("加载财务对账数据失败:", error);
      toast({ title: "错误", description: "加载财务对账数据失败", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId, dateRange, selectedPartnerId, toast]);

  useEffect(() => {
    fetchInitialOptions();
  }, [fetchInitialOptions]);

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  const displayedPartners = useMemo(() => {
    if (selectedPartnerId !== "all") {
      const selected = allPartners.find(p => p.id === selectedPartnerId);
      return selected ? [selected] : [];
    }
    if (!reportData?.records) return [];
    const relevantPartnerIds = new Set<string>();
    reportData.records.forEach((record: any) => {
      (record.partner_costs || []).forEach((cost: any) => relevantPartnerIds.add(cost.partner_id));
    });
    return allPartners.filter(partner => relevantPartnerIds.has(partner.id)).sort((a, b) => a.level - b.level);
  }, [reportData, allPartners, selectedPartnerId]);

  const exportDetailsToExcel = () => { /* ... */ };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div><h1 className="text-3xl font-bold text-foreground">财务对账</h1><p className="text-muted-foreground">运费收入与合作方应付金额统计</p></div>
      </div>

      <Card className="border-muted/40">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1 min-w-[140px]"><Label>项目</Label><Select value={selectedProjectId} onValueChange={setSelectedProjectId}><SelectTrigger className="h-8 text-sm"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">所有项目</SelectItem>{projects.map(p => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}</SelectContent></Select></div>
            <div className="flex flex-col gap-1"><Label>日期范围</Label><DateRangePicker date={dateRange} onDateChange={setDateRange} /></div>
            <div className="flex flex-col gap-1 min-w-[140px]"><Label>合作方</Label><Select value={selectedPartnerId} onValueChange={setSelectedPartnerId}><SelectTrigger className="h-8 text-sm"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">所有合作方</SelectItem>{allPartners.map(p => (<SelectItem key={p.id} value={p.id}>{p.name} ({p.level}级)</SelectItem>))}</SelectContent></Select></div>
            <Button variant="outline" size="sm" onClick={() => { setSelectedProjectId("all"); setDateRange(undefined); setSelectedPartnerId("all"); }} className="h-8 px-3 text-sm">清除筛选</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-4">
        <Card><CardHeader><CardTitle className="text-sm font-medium">运单总数</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{reportData?.overview?.total_records || 0}</div></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm font-medium">总运费</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">¥{(reportData?.overview?.total_current_cost || 0).toFixed(2)}</div></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm font-medium">总额外费用</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-orange-600">¥{(reportData?.overview?.total_extra_cost || 0).toFixed(2)}</div></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm font-medium">司机应收汇总</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-green-600">¥{(reportData?.overview?.total_payable_cost || 0).toFixed(2)}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>合作方应付汇总</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>合作方名称</TableHead><TableHead>相关运单数</TableHead><TableHead>应付总金额</TableHead></TableRow></TableHeader>
            <TableBody>
              {!loading && (!reportData?.partner_payables || reportData.partner_payables.length === 0) ? (
                <TableRow><TableCell colSpan={3} className="text-center">没有找到匹配的数据</TableCell></TableRow>
              ) : (reportData?.partner_payables || []).map((partner: any) => (
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

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div><CardTitle>运单财务明细</CardTitle><p className="text-sm text-muted-foreground">各合作方应付金额按级别从左到右排列</p></div>
          <Button variant="outline" size="sm" onClick={exportDetailsToExcel} disabled={!reportData?.records || reportData.records.length === 0}><Download className="mr-2 h-4 w-4" />导出明细</Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin"/></div>
          ) : (
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
              {reportData?.records?.map((r: any) => (
                <TableRow key={r.id} onClick={() => setViewingRecord(r)} className="cursor-pointer">
                  <TableCell className="font-mono">{r.auto_number}</TableCell><TableCell>{r.project_name}</TableCell><TableCell>{r.driver_name}</TableCell>
                  <TableCell className="text-sm">{r.loading_location}→{r.unloading_location}</TableCell><TableCell>{r.loading_date}</TableCell>
                  <TableCell className="font-mono">¥{r.current_cost?.toFixed(2)}</TableCell>
                  <TableCell className="font-mono text-orange-600">{r.extra_cost ? `¥${r.extra_cost.toFixed(2)}` : '-'}</TableCell>
                  {displayedPartners.map(p => { const cost = (r.partner_costs || []).find((c:any) => c.partner_id === p.id); return <TableCell key={p.id} className="font-mono text-center">{cost ? `¥${cost.payable_amount.toFixed(2)}` : '-'}</TableCell>; })}
                  <TableCell><Badge variant={r.current_cost ? "default" : "secondary"}>{r.current_cost ? "已计费" : "待计费"}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          )}
        </CardContent>
      </Card>
      {/* ... 查看详情弹窗的 JSX ... */}
    </div>
  );
}
