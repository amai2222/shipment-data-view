// 文件路径: src/pages/FinanceReconciliation.tsx
import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox"; // 【已修复】引入了复选框组件
import { Download, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from 'xlsx';
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { ConfirmDialog } from "@/components/ConfirmDialog";

// 类型定义
interface LogisticsRecord {
  id: string; auto_number: string; project_name: string; driver_name: string;
  loading_location: string; unloading_location: string; loading_date: string;
  unloading_date: string | null; loading_weight: number | null; unloading_weight: number | null;
  current_cost: number | null; payable_cost: number | null; extra_cost: number | null;
  license_plate: string | null; driver_phone: string | null; transport_type: string | null;
  remarks: string | null; chain_name: string | null;
}
interface PartnerPayable {
  partner_id: string; partner_name: string; level: number;
  total_payable: number; records_count: number;
}
interface LogisticsRecordWithPartners extends LogisticsRecord {
  partner_costs: {
    partner_id: string; partner_name: string; level: number; payable_amount: number;
  }[];
}

export default function FinanceReconciliation() {
  const [reportData, setReportData] = useState<any>(null);
  const [allPartners, setAllPartners] = useState<{id: string, name: string, level: number}[]>([]);
  const [projects, setProjects] = useState<{id: string, name: string}[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>("all");
  const [viewingRecord, setViewingRecord] = useState<LogisticsRecordWithPartners | null>(null);
  
  const [selectedRecordIds, setSelectedRecordIds] = useState<Set<string>>(new Set());
  const [isRecalculating, setIsRecalculating] = useState(false);
  
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

  const exportDetailsToExcel = () => {
    if (!reportData?.records || reportData.records.length === 0) {
        toast({ title: "提示", description: "没有可导出的数据" });
        return;
    }
    const headers = ['运单编号', '项目名称', '司机姓名', '路线', '装货日期', '运费金额', '额外费用', '司机应收'];
    displayedPartners.forEach(p => headers.push(`${p.name}(应付)`));
    const dataToExport = reportData.records.map((record: any) => {
      const row: {[key: string]: any} = {
        '运单编号': record.auto_number, '项目名称': record.project_name, '司机姓名': record.driver_name,
        '路线': `${record.loading_location} → ${record.unloading_location}`, '装货日期': record.loading_date,
        '运费金额': record.current_cost || 0, '额外费用': record.extra_cost || 0, '司机应收': record.payable_cost || 0,
      };
      displayedPartners.forEach(p => {
        const cost = (record.partner_costs || []).find((c: any) => c.partner_id === p.id);
        row[`${p.name}(应付)`] = cost ? cost.payable_amount : 0;
      });
      return row;
    });
    const ws = XLSX.utils.json_to_sheet(dataToExport, { header: headers });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "运单财务明细");
    XLSX.writeFile(wb, `运单财务明细_${new Date().toLocaleDateString()}.xlsx`);
    toast({ title: "成功", description: "财务明细数据已导出到Excel" });
  };

  const handleRecordSelect = (recordId: string) => {
    setSelectedRecordIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(recordId)) {
        newSet.delete(recordId);
      } else {
        newSet.add(recordId);
      }
      return newSet;
    });
  };
  
  const handleSelectAll = (isChecked: boolean) => {
    if (isChecked) {
      const allIds = reportData?.records?.map((r: any) => r.id) || [];
      setSelectedRecordIds(new Set(allIds));
    } else {
      setSelectedRecordIds(new Set());
    }
  };

  const handleBatchRecalculate = async () => {
    setIsRecalculating(true);
    try {
      const idsToRecalculate = Array.from(selectedRecordIds);
      const { error } = await supabase.rpc('batch_recalculate_costs', { p_record_ids: idsToRecalculate });
      if (error) throw error;
      
      toast({ title: "成功", description: `已为 ${idsToRecalculate.length} 条运单重新计算合作方应付。` });
      setSelectedRecordIds(new Set());
      fetchReportData();
    } catch (error) {
      console.error("批量重算失败:", error);
      toast({ title: "错误", description: "批量重算失败，请重试。", variant: "destructive" });
    } finally {
      setIsRecalculating(false);
    }
  };


  if (loading && !reportData) return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin"/></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div><h1 className="text-3xl font-bold text-foreground">财务对账</h1><p className="text-muted-foreground">运费收入与合作方应付金额统计</p></div>
        
        <ConfirmDialog
          title="确认批量重算"
          description={`您确定要为选中的 ${selectedRecordIds.size} 条运单重新计算所有合作方的应付金额吗？此操作会根据最新的项目合作链路配置覆盖现有数据。`}
          onConfirm={handleBatchRecalculate}
        >
          <Button variant="destructive" disabled={selectedRecordIds.size === 0 || isRecalculating}>
            {isRecalculating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            一键重算已选运单 ({selectedRecordIds.size})
          </Button>
        </ConfirmDialog>
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
              {loading ? (
                <TableRow><TableCell colSpan={3} className="text-center h-24"><Loader2 className="h-6 w-6 animate-spin inline-block"/></TableCell></TableRow>
              ) : (!reportData?.partner_payables || reportData.partner_payables.length === 0) ? (
                <TableRow><TableCell colSpan={3} className="text-center">没有找到匹配的数据</TableCell></TableRow>
              ) : (reportData.partner_payables).map((partner: any) => (
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
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedRecordIds.size > 0 && selectedRecordIds.size === (reportData?.records?.length || 0)}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead>运单编号</TableHead><TableHead>项目</TableHead><TableHead>司机</TableHead><TableHead>路线</TableHead><TableHead>日期</TableHead>
                <TableHead>运费</TableHead><TableHead className="text-orange-600">额外费</TableHead>
                {displayedPartners.map(p => <TableHead key={p.id} className="text-center">{p.name}<div className="text-xs text-muted-foreground">({p.level}级)</div></TableHead>)}
                <TableHead>状态</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reportData?.records?.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedRecordIds.has(r.id)}
                      onCheckedChange={() => handleRecordSelect(r.id)}
                    />
                  </TableCell>
                  <TableCell className="font-mono cursor-pointer" onClick={() => setViewingRecord(r)}>{r.auto_number}</TableCell>
                  <TableCell className="cursor-pointer" onClick={() => setViewingRecord(r)}>{r.project_name}</TableCell>
                  <TableCell className="cursor-pointer" onClick={() => setViewingRecord(r)}>{r.driver_name}</TableCell>
                  <TableCell className="text-sm cursor-pointer" onClick={() => setViewingRecord(r)}>{r.loading_location}→{r.unloading_location}</TableCell>
                  <TableCell className="cursor-pointer" onClick={() => setViewingRecord(r)}>{r.loading_date}</TableCell>
                  <TableCell className="font-mono cursor-pointer" onClick={() => setViewingRecord(r)}>¥{r.current_cost?.toFixed(2)}</TableCell>
                  <TableCell className="font-mono text-orange-600 cursor-pointer" onClick={() => setViewingRecord(r)}>{r.extra_cost ? `¥${r.extra_cost.toFixed(2)}` : '-'}</TableCell>
                  {displayedPartners.map(p => { const cost = (r.partner_costs || []).find((c:any) => c.partner_id === p.id); return <TableCell key={p.id} className="font-mono text-center cursor-pointer" onClick={() => setViewingRecord(r)}>{cost ? `¥${cost.payable_amount.toFixed(2)}` : '-'}</TableCell>; })}
                  <TableCell className="cursor-pointer" onClick={() => setViewingRecord(r)}><Badge variant={r.current_cost ? "default" : "secondary"}>{r.current_cost ? "已计费" : "待计费"}</Badge></TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/30 font-semibold border-t-2">
                <TableCell colSpan={6} className="text-right font-bold">合计</TableCell>
                <TableCell className="font-mono font-bold text-center">
                  <div>¥{(reportData?.overview?.total_current_cost || 0).toFixed(2)}</div>
                  <div className="text-xs text-muted-foreground font-normal">(运费)</div>
                </TableCell>
                <TableCell className="font-mono font-bold text-orange-600 text-center">
                  <div>¥{(reportData?.overview?.total_extra_cost || 0).toFixed(2)}</div>
                  <div className="text-xs text-muted-foreground font-normal">(额外费)</div>
                </TableCell>
                {displayedPartners.map(p => {
                  const total = (reportData?.records || []).reduce((s: number, r: any) => s + ((r.partner_costs || []).find((c: any) => c.partner_id === p.id)?.payable_amount || 0), 0);
                  return (
                    <TableCell key={p.id} className="text-center font-bold font-mono">
                      <div>¥{total.toFixed(2)}</div>
                      <div className="text-xs text-muted-foreground font-normal">({p.name})</div>
                    </TableCell>
                  );
                })}
                <TableCell></TableCell>
              </TableRow>
            </TableBody>
          </Table>
          )}
        </CardContent>
      </Card>
      
      <Dialog open={!!viewingRecord} onOpenChange={(isOpen) => !isOpen && setViewingRecord(null)}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader><DialogTitle>运单详情 (编号: {viewingRecord?.auto_number})</DialogTitle></DialogHeader>
          {viewingRecord && (
            <div className="grid grid-cols-4 gap-x-4 gap-y-6 py-4 text-sm">
              <div className="space-y-1"><Label className="text-muted-foreground">项目</Label><p>{viewingRecord.project_name}</p></div>
              <div className="space-y-1"><Label className="text-muted-foreground">合作链路</Label><p>{viewingRecord.chain_name || '默认'}</p></div>
              <div className="space-y-1"><Label className="text-muted-foreground">装货日期</Label><p>{viewingRecord.loading_date}</p></div>
              <div className="space-y-1"><Label className="text-muted-foreground">卸货日期</Label><p>{viewingRecord.unloading_date || '未填写'}</p></div>

              <div className="space-y-1"><Label className="text-muted-foreground">司机</Label><p>{viewingRecord.driver_name}</p></div>
              <div className="space-y-1"><Label className="text-muted-foreground">车牌号</Label><p>{viewingRecord.license_plate || '未填写'}</p></div>
              <div className="space-y-1"><Label className="text-muted-foreground">司机电话</Label><p>{viewingRecord.driver_phone || '未填写'}</p></div>
              <div className="space-y-1"><Label className="text-muted-foreground">运输类型</Label><p>{viewingRecord.transport_type}</p></div>

              <div className="space-y-1"><Label className="text-muted-foreground">装货地点</Label><p>{viewingRecord.loading_location}</p></div>
              <div className="space-y-1"><Label className="text-muted-foreground">装货重量</Label><p>{viewingRecord.loading_weight ? `${viewingRecord.loading_weight} 吨` : '-'}</p></div>
              <div className="space-y-1"><Label className="text-muted-foreground">卸货地点</Label><p>{viewingRecord.unloading_location}</p></div>
              <div className="space-y-1"><Label className="text-muted-foreground">卸货重量</Label><p>{viewingRecord.unloading_weight ? `${viewingRecord.unloading_weight} 吨` : '-'}</p></div>

              <div className="space-y-1"><Label className="text-muted-foreground">运费金额</Label><p className="font-mono">{viewingRecord.current_cost ? `¥${viewingRecord.current_cost.toFixed(2)}` : '-'}</p></div>
              <div className="space-y-1"><Label className="text-muted-foreground">额外费用</Label><p className="font-mono">{viewingRecord.extra_cost ? `¥${viewingRecord.extra_cost.toFixed(2)}` : '-'}</p></div>
              <div className="space-y-1 col-span-2"><Label className="text-muted-foreground">司机应收</Label><p className="font-mono font-bold text-primary">{viewingRecord.payable_cost ? `¥${viewingRecord.payable_cost.toFixed(2)}` : '-'}</p></div>
              
              <div className="col-span-4 space-y-1"><Label className="text-muted-foreground">备注</Label><p className="min-h-[40px]">{viewingRecord.remarks || '无'}</p></div>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setViewingRecord(null)}>关闭</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
