import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Truck, Eye, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { DateRange } from "react-day-picker";
import { format } from "date-fns";

interface LogisticsRecord {
  id: string; auto_number: string; project_name: string; driver_name: string;
  loading_location: string; unloading_location: string; loading_date: string;
  unloading_date: string | null; loading_weight: number | null; unloading_weight: number | null;
  current_cost: number | null; payable_cost: number | null; extra_cost: number | null;
  license_plate: string | null; driver_phone: string | null; transport_type: string | null;
  remarks: string | null; chain_name: string | null;
}

const TransportOverview = () => {
  const [records, setRecords] = useState<LogisticsRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<{id: string, name: string}[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [viewingRecord, setViewingRecord] = useState<LogisticsRecord | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  
  const { toast } = useToast();

  const fetchInitialOptions = useCallback(async () => {
    try {
      const { data: projectsData } = await supabase.from('projects').select('id, name').order('name');
      setProjects(projectsData || []);
    } catch (error) {
      toast({ title: "错误", description: "加载筛选选项失败", variant: "destructive" });
    }
  }, [toast]);

  const fetchTransportData = useCallback(async () => {
    setLoading(true);
    try {
      const filters = {
        p_project_id: selectedProjectId === 'all' ? null : selectedProjectId,
        p_start_date: dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : null,
        p_end_date: dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : null,
        p_search_query: searchQuery || null,
      };
      const { data, error } = await supabase.rpc('get_paginated_logistics_records_with_filters', {
        ...filters,
        p_page_size: 1000,
        p_offset: 0,
      });
      if (error) throw error;
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        setRecords((data as any).records || []);
      }
    } catch (error) {
      console.error("加载运输数据失败:", error);
      toast({ title: "错误", description: "加载运输数据失败", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId, dateRange, searchQuery, toast]);

  useEffect(() => {
    fetchInitialOptions();
  }, [fetchInitialOptions]);

  useEffect(() => {
    fetchTransportData();
  }, [fetchTransportData]);

  const summary = useMemo(() => {
    return records.reduce((acc, record) => {
      acc.totalRecords += 1;
      acc.totalWeight += record.loading_weight || 0;
      acc.totalCost += record.current_cost || 0;
      acc.totalExtraCost += record.extra_cost || 0;
      if (record.transport_type === '实际运输') acc.actualCount += 1;
      else if (record.transport_type === '退货') acc.returnCount += 1;
      return acc;
    }, {
      totalRecords: 0, totalWeight: 0, totalCost: 0, totalExtraCost: 0,
      actualCount: 0, returnCount: 0,
    });
  }, [records]);

  const handleRecordDetail = (record: LogisticsRecord) => {
    setViewingRecord(record);
  };

  const handleCloseDetail = () => {
    setViewingRecord(null);
    // Keep all filters intact when closing detail view
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-primary p-6 rounded-lg shadow-primary text-primary-foreground">
        <h1 className="text-2xl font-bold mb-2 flex items-center">
          <Truck className="mr-2" />
          运输概览
        </h1>
        <p className="opacity-90">运输运单查看与统计分析</p>
      </div>

      <Card className="border-muted/40">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1"><Label>搜索</Label><Input placeholder="搜索运单号、司机、地点..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-64"/></div>
            <div className="flex flex-col gap-1 min-w-[140px]"><Label>项目</Label><Select value={selectedProjectId} onValueChange={setSelectedProjectId}><SelectTrigger className="h-8 text-sm"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">所有项目</SelectItem>{projects.map(p => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}</SelectContent></Select></div>
            <div className="flex flex-col gap-1"><Label>日期范围</Label><DateRangePicker date={dateRange} onDateChange={setDateRange} /></div>
            <Button variant="outline" size="sm" onClick={() => { setSelectedProjectId("all"); setDateRange(undefined); setSearchQuery(""); }} className="h-8 px-3 text-sm">清除筛选</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-4">
        <Card><CardHeader><CardTitle className="text-sm font-medium">运单总数</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{summary.totalRecords}</div></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm font-medium">总装货重量</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{summary.totalWeight.toFixed(1)}吨</div></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm font-medium">总运费</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">¥{summary.totalCost.toFixed(2)}</div></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm font-medium">额外费用</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-orange-600">¥{summary.totalExtraCost.toFixed(2)}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>运单列表</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin"/></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>运单编号</TableHead><TableHead>项目</TableHead><TableHead>司机</TableHead><TableHead>路线</TableHead><TableHead>装货日期</TableHead><TableHead>运费</TableHead><TableHead>状态</TableHead><TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-mono">{record.auto_number}</TableCell>
                    <TableCell>{record.project_name}</TableCell>
                    <TableCell>{record.driver_name}</TableCell>
                    <TableCell className="text-sm">{record.loading_location}→{record.unloading_location}</TableCell>
                    <TableCell>{record.loading_date}</TableCell>
                    <TableCell className="font-mono">¥{record.current_cost?.toFixed(2) || '0.00'}</TableCell>
                    <TableCell><Badge variant={record.current_cost ? "default" : "secondary"}>{record.current_cost ? "已计费" : "待计费"}</Badge></TableCell>
                    <TableCell><Button variant="outline" size="sm" onClick={() => handleRecordDetail(record)}><Eye className="h-4 w-4 mr-1"/>查看</Button></TableCell>
                  </TableRow>
                ))}
                {!loading && records.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center">没有找到匹配的运单</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      
      <Dialog open={!!viewingRecord} onOpenChange={(open) => !open && handleCloseDetail()}>
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
            <Button variant="outline" onClick={handleCloseDetail}>关闭</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TransportOverview;