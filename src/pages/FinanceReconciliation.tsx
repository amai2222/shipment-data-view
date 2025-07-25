import { useState, useEffect, useCallback } from "react";
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
  const [partnerPayables, setPartnerPayables] = useState<PartnerPayable[]>([]);
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
    loadBasicData();
  }, []);

  useEffect(() => {
    loadFinanceData();
  }, [selectedProjectId, dateRange, selectedPartnerId]);

  const loadBasicData = async () => {
    try {
      // 加载项目数据
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('id, name')
        .order('name');

      if (projectsError) throw projectsError;
      setProjects(projectsData || []);

      // 获取所有合作方信息，按级别排序
      const { data: partnersData, error: partnersError } = await supabase
        .from('project_partners')
        .select(`
          partner_id,
          level,
          partners!inner(name)
        `)
        .order('level', { ascending: true });

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
    } catch (error) {
      console.error('加载基础数据失败:', error);
      toast({
        title: "错误",
        description: "加载基础数据失败",
        variant: "destructive",
      });
    }
  };

  const loadFinanceData = useCallback(async () => {
    setLoading(true);
    try {
      // 使用数据库函数获取筛选后的财务数据
      const projectId = selectedProjectId === "all" ? null : selectedProjectId;
      const partnerId = selectedPartnerId === "all" ? null : selectedPartnerId;
      const startDate = dateRange.startDate || null;
      const endDate = dateRange.endDate || null;

      // 获取运单财务数据
      const { data: recordsData, error: recordsError } = await supabase
        .rpc('get_finance_reconciliation_data', {
          p_project_id: projectId,
          p_start_date: startDate,
          p_end_date: endDate,
          p_partner_id: partnerId
        });

      if (recordsError) throw recordsError;

      // 转换数据格式
      const recordsWithPartners: LogisticsRecordWithPartners[] = (recordsData || []).map(record => ({
        id: record.record_id,
        auto_number: record.auto_number,
        project_name: record.project_name,
        driver_name: record.driver_name,
        loading_location: record.loading_location,
        unloading_location: record.unloading_location,
        loading_date: record.loading_date,
        current_cost: record.current_cost,
        payable_cost: record.payable_cost,
        partner_costs: Array.isArray(record.partner_costs) ? record.partner_costs as any[] : []
      }));

      setLogisticsRecords(recordsWithPartners);

      // 获取合作方应付汇总
      const { data: payablesData, error: payablesError } = await supabase
        .rpc('get_partner_payables_summary', {
          p_project_id: projectId,
          p_start_date: startDate,
          p_end_date: endDate,
          p_partner_id: partnerId
        });

      if (payablesError) throw payablesError;

      const payables: PartnerPayable[] = (payablesData || []).map(item => ({
        partner_id: item.partner_id,
        partner_name: item.partner_name,
        level: item.level,
        total_payable: Number(item.total_payable),
        records_count: Number(item.records_count)
      }));

      setPartnerPayables(payables);
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
  }, [selectedProjectId, dateRange, selectedPartnerId, toast]);



  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();
    
    // 运单财务数据
    const recordsData = logisticsRecords.map(record => ({
      '运单编号': record.auto_number,
      '项目名称': record.project_name,
      '司机姓名': record.driver_name,
      '装货地点': record.loading_location,
      '卸货地点': record.unloading_location,
      '装货日期': record.loading_date,
      '运费金额': record.current_cost || 0,
      '司机应收': record.payable_cost || 0
    }));
    
    const recordsWs = XLSX.utils.json_to_sheet(recordsData);
    XLSX.utils.book_append_sheet(wb, recordsWs, '运单财务');
    
    // 合作方应付数据
    const partnersData = partnerPayables.map(partner => ({
      '合作方名称': partner.partner_name,
      '级别': partner.level,
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

      {/* 筛选器 */}
      <Card className="border-muted/40">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            {/* 项目筛选 */}
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

            {/* 装货日期范围 */}
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

            {/* 合作方筛选 */}
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

            {/* 清除筛选按钮 */}
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

      {/* 统计卡片 */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">运单总数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{logisticsRecords.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">总运费收入</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ¥{logisticsRecords.reduce((sum, record) => sum + (record.current_cost || 0), 0).toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">合作方应付总额</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ¥{partnerPayables.reduce((sum, partner) => sum + partner.total_payable, 0).toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 合作方应付汇总 */}
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
              {partnerPayables.map((partner) => (
                <TableRow key={partner.partner_id}>
                  <TableCell className="font-medium">{partner.partner_name} ({partner.level}级)</TableCell>
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
                {allPartners.map((partner) => (
                  <TableHead key={partner.id} className="text-center bg-gradient-to-r from-primary/5 to-accent/5">
                    {partner.name}
                    <div className="text-xs text-muted-foreground">({partner.level}级)</div>
                  </TableHead>
                ))}
                <TableHead>状态</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logisticsRecords.map((record) => (
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
                  {allPartners.map((partner) => {
                    const partnerCost = record.partner_costs.find(cost => cost.partner_id === partner.id);
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
              
              {/* 合计行 */}
              <TableRow className="bg-muted/30 border-t-2 font-semibold">
                <TableCell colSpan={5} className="text-right font-bold">
                  合计 ({logisticsRecords.length} 笔运单)
                </TableCell>
                <TableCell className="font-mono font-bold">
                  ¥{logisticsRecords.reduce((sum, record) => sum + (record.current_cost || 0), 0).toFixed(2)}
                </TableCell>
                {allPartners.map((partner) => {
                  const partnerTotal = logisticsRecords.reduce((sum, record) => {
                    const partnerCost = record.partner_costs.find(cost => cost.partner_id === partner.id);
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