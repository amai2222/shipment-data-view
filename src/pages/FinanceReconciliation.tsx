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
  const [dateRange, setDateRange] = useState({
    startDate: "",
    endDate: ""
  });
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>("all");
  
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      // 加载项目数据
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('id, name')
        .order('name');

      if (projectsError) throw projectsError;
      setProjects(projectsData || []);

      // 先获取所有合作方信息，按级别排序
      const { data: partnersData, error: partnersError } = await supabase
        .from('project_partners')
        .select(`
          partner_id,
          level,
          partners!inner(name)
        `);

      if (partnersError) throw partnersError;

      const uniquePartners = Array.from(
        new Map(partnersData?.map(p => [
          p.partner_id, 
          { 
            id: p.partner_id, 
            name: (p.partners as any).name, 
            level: p.level 
          }
        ]) || []).values()
      ).sort((a, b) => a.level - b.level);

      setAllPartners(uniquePartners);

      // 加载运单数据及其合作方成本
      const { data: records, error: recordsError } = await supabase
        .from('logistics_records')
        .select(`
          id, auto_number, project_name, driver_name, 
          loading_location, unloading_location, loading_date, 
          current_cost, payable_cost,
          logistics_partner_costs(
            partner_id,
            level,
            payable_amount,
            partners!inner(name)
          )
        `)
        .order('loading_date', { ascending: false });

      if (recordsError) throw recordsError;

      // 处理运单数据，添加合作方成本信息
      const recordsWithPartners: LogisticsRecordWithPartners[] = (records || []).map(record => ({
        ...record,
        partner_costs: (record.logistics_partner_costs || []).map((cost: any) => ({ // Add 'any' type for cost
          partner_id: cost.partner_id,
          partner_name: (cost.partners as any).name,
          level: cost.level,
          payable_amount: cost.payable_amount
        })).sort((a, b) => a.level - b.level)
      }));

      setLogisticsRecords(recordsWithPartners);

    } catch (error) {
      console.error('加载财务对账数据失败:', error);
      toast({
        title: "错误",
        description: "加载财务对账数据失败",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // 筛选后的数据
  const filteredRecords = useMemo(() => {
    let filtered = logisticsRecords;

    // 项目筛选
    if (selectedProjectId && selectedProjectId !== "all") {
        const selectedProject = projects.find(p => p.id === selectedProjectId);
        if (selectedProject) {
            filtered = filtered.filter(record => record.project_name === selectedProject.name);
        }
    }

    // 日期范围筛选
    if (dateRange.startDate) {
      filtered = filtered.filter(record => record.loading_date >= dateRange.startDate);
    }
    if (dateRange.endDate) {
      filtered = filtered.filter(record => record.loading_date <= dateRange.endDate);
    }

    // 合作方筛选
    if (selectedPartnerId && selectedPartnerId !== "all") {
      filtered = filtered.filter(record => 
        (record.partner_costs || []).some(cost => cost.partner_id === selectedPartnerId)
      );
    }

    return filtered;
  }, [logisticsRecords, selectedProjectId, projects, dateRange, selectedPartnerId]);

  // 基于筛选数据重新计算合作方应付
  const filteredPartnerPayables = useMemo(() => {
    const payableMap = new Map<string, { name: string; level: number; total: number; count: number }>();
    
    filteredRecords.forEach(record => {
      (record.partner_costs || []).forEach(cost => {
        if (selectedPartnerId && selectedPartnerId !== "all" && cost.partner_id !== selectedPartnerId) {
          return;
        }

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
      partner_id: partnerId,
      partner_name: data.name,
      level: data.level,
      total_payable: data.total,
      records_count: data.count
    })).sort((a, b) => a.level - b.level);
  }, [filteredRecords, selectedPartnerId]);
  
  // 【新增】动态计算需要显示的合作方列
  const displayedPartners = useMemo(() => {
    if (!filteredRecords || filteredRecords.length === 0) {
      return [];
    }
    const relevantPartnerIds = new Set<string>();
    filteredRecords.forEach(record => {
      (record.partner_costs || []).forEach(cost => {
        relevantPartnerIds.add(cost.partner_id);
      });
    });
    return allPartners
      .filter(partner => relevantPartnerIds.has(partner.id))
      .sort((a, b) => a.level - b.level);
  }, [filteredRecords, allPartners]);


  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();
    
    const recordsData = filteredRecords.map(record => ({
      '运单编号': record.auto_number,
      '项目名称': record.project_name,
      '司机姓名': record.driver_name,
      '装货地点': record.loading_location,
      '卸货地点': record.unloading_location,
      '装货日期': record.loading_date,
      '运费金额': record.current_cost || 0,
      '应付金额': record.payable_cost || 0
    }));
    
    const recordsWs = XLSX.utils.json_to_sheet(recordsData);
    XLSX.utils.book_append_sheet(wb, recordsWs, '运单财务');
    
    const partnersData = filteredPartnerPayables.map(partner => ({
      '合作方名称': partner.partner_name,
      '运单数量': partner.records_count,
      '应付总金额': partner.total_payable.toFixed(2)
    }));
    
    const partnersWs = XLSX.utils.json_to_sheet(partnersData);
    XLSX.utils.book_append_sheet(wb, partnersWs, '合作方应付');
    
    XLSX.writeFile(wb, `财务对账_${new Date().toLocaleDateString()}.xlsx`);
    
    toast({
      title: "导出成功",
      description: "财务对账数据已导出到Excel文件",
    });
  };

  if (loading) {
    return <div className="flex justify-center p-8">加载中...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">财务对账</h1>
          <p className="text-muted-foreground">运费收入与合作方应付金额统计</p>
        </div>
        <Button onClick={exportToExcel} className="flex items-center gap-2">
          <Download className="h-4 w-4" />
          导出Excel
        </Button>
      </div>

      <Card className="border-muted/40">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1 min-w-[140px]">
              <Label htmlFor="projectFilter" className="text-xs text-muted-foreground">项目</Label>
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger id="projectFilter" className="h-8 text-sm">
                  <SelectValue placeholder="选择项目" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">所有项目</SelectItem>
                  {projects.map(project => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1 min-w-[120px]">
              <Label htmlFor="startDate" className="text-xs text-muted-foreground">开始日期</Label>
              <Input
                id="startDate"
                type="date"
                value={dateRange.startDate}
                onChange={(e) => setDateRange(prev => ({...prev, startDate: e.target.value}))}
                className="h-8 text-sm"
              />
            </div>
            
            <div className="flex flex-col gap-1 min-w-[120px]">
              <Label htmlFor="endDate" className="text-xs text-muted-foreground">结束日期</Label>
              <Input
                id="endDate"
                type="date"
                value={dateRange.endDate}
                onChange={(e) => setDateRange(prev => ({...prev, endDate: e.target.value}))}
                className="h-8 text-sm"
              />
            </div>

            <div className="flex flex-col gap-1 min-w-[140px]">
              <Label htmlFor="partnerFilter" className="text-xs text-muted-foreground">合作方</Label>
              <Select value={selectedPartnerId} onValueChange={setSelectedPartnerId}>
                <SelectTrigger id="partnerFilter" className="h-8 text-sm">
                  <SelectValue placeholder="选择合作方" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">所有合作方</SelectItem>
                  {allPartners.map(partner => (
                    <SelectItem key={partner.id} value={partner.id}>
                      {partner.name} ({partner.level}级)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                setSelectedProjectId("all");
                setDateRange({ startDate: "", endDate: "" });
                setSelectedPartnerId("all");
              }}
              className="h-8 px-3 text-sm"
            >
              清除筛选
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">运单总数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredRecords.length}</div>
            <p className="text-xs text-muted-foreground">
              {logisticsRecords.length > filteredRecords.length && `总共 ${logisticsRecords.length} 条`}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">总运费收入</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ¥{filteredRecords.reduce((sum, record) => sum + (record.current_cost || 0), 0).toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">合作方应付总额</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ¥{filteredPartnerPayables.reduce((sum, partner) => sum + partner.total_payable, 0).toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>合作方应付汇总</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>合作方名称</TableHead>
                <TableHead>相关运单数</TableHead>
                <TableHead>应付总金额</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPartnerPayables.map((partner) => (
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
        <CardHeader>
          <CardTitle>运单财务明细</CardTitle>
          <p className="text-sm text-muted-foreground">
            各合作方应付金额按级别从左到右排列
          </p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>运单编号</TableHead>
                <TableHead>项目名称</TableHead>
                <TableHead>司机</TableHead>
                <TableHead>路线</TableHead>
                <TableHead>装货日期</TableHead>
                <TableHead>运费金额</TableHead>
                {displayedPartners.map((partner) => (
                  <TableHead key={partner.id} className="text-center bg-gradient-to-r from-primary/5 to-accent/5">
                    {partner.name}
                    <div className="text-xs text-muted-foreground">({partner.level}级)</div>
                  </TableHead>
                ))}
                <TableHead>状态</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRecords.map((record) => (
                <TableRow key={record.id}>
                  <TableCell className="font-mono">{record.auto_number}</TableCell>
                  <TableCell>{record.project_name}</TableCell>
                  <TableCell>{record.driver_name}</TableCell>
                  <TableCell className="text-sm">
                    {record.loading_location} → {record.unloading_location}
                  </TableCell>
                  <TableCell>{record.loading_date}</TableCell>
                  <TableCell className="font-mono">
                    {record.current_cost ? `¥${record.current_cost.toFixed(2)}` : '-'}
                  </TableCell>
                  {displayedPartners.map((partner) => {
                    const partnerCost = (record.partner_costs || []).find(cost => cost.partner_id === partner.id);
                    return (
                      <TableCell key={partner.id} className="font-mono text-center bg-gradient-to-r from-primary/5 to-accent/5">
                        {partnerCost ? `¥${partnerCost.payable_amount.toFixed(2)}` : '-'}
                      </TableCell>
                    );
                  })}
                  <TableCell>
                    <Badge variant={record.current_cost ? "default" : "secondary"}>
                      {record.current_cost ? "已计费" : "待计费"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              
              <TableRow className="bg-muted/30 border-t-2 font-semibold">
                <TableCell colSpan={5} className="text-right font-bold">
                  合计 ({filteredRecords.length} 笔运单)
                </TableCell>
                <TableCell className="font-mono font-bold">
                  ¥{filteredRecords.reduce((sum, record) => sum + (record.current_cost || 0), 0).toFixed(2)}
                </TableCell>
                {displayedPartners.map((partner) => {
                  const partnerTotal = filteredRecords.reduce((sum, record) => {
                    const partnerCost = (record.partner_costs || []).find(cost => cost.partner_id === partner.id);
                    return sum + (partnerCost ? partnerCost.payable_amount : 0);
                  }, 0);
                  return (
                    <TableCell key={partner.id} className="font-mono text-center bg-gradient-to-r from-primary/10 to-accent/10 font-bold">
                      ¥{partnerTotal.toFixed(2)}
                    </TableCell>
                  );
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
