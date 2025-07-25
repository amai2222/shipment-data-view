import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  Download, FileDown, FileUp, PlusCircle, Edit, Trash2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from 'xlsx';
import { ConfirmDialog } from "@/components/ConfirmDialog";

// 类型定义
interface LogisticsRecord {
  id: string;
  auto_number: string;
  project_id: string;
  project_name: string;
  chain_id: string | null;
  chain_name: string | null;
  driver_id: string;
  driver_name: string;
  loading_location: string;
  unloading_location: string;
  loading_date: string;
  loading_weight: number | null;
  unloading_weight: number | null;
  current_cost: number | null;
  payable_cost: number | null;
}

interface Project { id: string; name:string; }
interface Driver { id: string; name: string; }
interface PartnerChain { id: string; chain_name: string; }

const BLANK_FORM_DATA = {
  project_id: "",
  chain_id: "",
  driver_id: "",
  loading_location: "",
  unloading_location: "",
  loading_date: new Date().toISOString().split('T')[0],
  loading_weight: null,
  unloading_weight: null,
  current_cost: null,
};

export default function BusinessEntry() {
  const [records, setRecords] = useState<LogisticsRecord[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [partnerChains, setPartnerChains] = useState<PartnerChain[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<LogisticsRecord | null>(null);
  const [formData, setFormData] = useState<any>(BLANK_FORM_DATA);

  const [filters, setFilters] = useState({ startDate: "", endDate: "", searchQuery: "" });
  
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const { data: recordsData, error: recordsError } = await supabase.from('logistics_records_view').select('*').order('loading_date', { ascending: false });
      if (recordsError) throw recordsError;
      setRecords(recordsData as LogisticsRecord[] || []);

      const { data: projectsData, error: projectsError } = await supabase.from('projects').select('id, name');
      if (projectsError) throw projectsError;
      setProjects(projectsData || []);

      const { data: driversData, error: driversError } = await supabase.from('drivers').select('id, name');
      if (driversError) throw driversError;
      setDrivers(driversData || []);
    } catch (error) {
      toast({ title: "错误", description: "数据加载失败", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    // 当选择一个新项目时，清空旧的链路选择
    handleInputChange('chain_id', ''); 
    if (formData.project_id) {
      const fetchChains = async () => {
        const { data, error } = await supabase.from('partner_chains').select('id, chain_name').eq('project_id', formData.project_id);
        if (error) {
          toast({ title: "错误", description: "加载合作链路失败", variant: "destructive" });
          setPartnerChains([]);
        } else {
          setPartnerChains(data as PartnerChain[] || []);
        }
      };
      fetchChains();
    } else {
      setPartnerChains([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.project_id, toast]);

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };
  
  const handleOpenModal = (record: LogisticsRecord | null = null) => {
    if (record) {
      setEditingRecord(record);
      setFormData({
        project_id: record.project_id,
        chain_id: record.chain_id || "",
        driver_id: record.driver_id,
        loading_location: record.loading_location,
        unloading_location: record.unloading_location,
        loading_date: record.loading_date,
        loading_weight: record.loading_weight,
        unloading_weight: record.unloading_weight,
        current_cost: record.current_cost,
      });
    } else {
      setEditingRecord(null);
      setFormData(BLANK_FORM_DATA);
    }
    setIsModalOpen(true);
  };
  
  const handleSubmit = async () => {
    const projectName = projects.find(p => p.id === formData.project_id)?.name;
    const driverName = drivers.find(d => d.id === formData.driver_id)?.name;

    if (!projectName || !driverName || !formData.loading_location || !formData.unloading_location) {
      toast({ title: "错误", description: "请确保所有必填项都已填写或选择", variant: "destructive" });
      return;
    }

    const recordData = {
      p_project_id: formData.project_id,
      p_project_name: projectName,
      p_chain_id: formData.chain_id || null,
      p_driver_id: formData.driver_id,
      p_driver_name: driverName,
      p_loading_location: formData.loading_location,
      p_unloading_location: formData.unloading_location,
      p_loading_date: formData.loading_date,
      p_loading_weight: formData.loading_weight ? parseFloat(formData.loading_weight) : null,
      p_unloading_weight: formData.unloading_weight ? parseFloat(formData.unloading_weight) : null,
      p_current_cost: formData.current_cost ? parseFloat(formData.current_cost) : null,
    };
    
    try {
      if (editingRecord) {
        const { error } = await supabase.rpc('update_logistics_record_with_costs', { p_record_id: editingRecord.id, ...recordData });
        if (error) throw error;
        toast({ title: "成功", description: "运单记录已更新" });
      } else {
        const { error } = await supabase.rpc('add_logistics_record_with_costs', recordData);
        if (error) throw error;
        toast({ title: "成功", description: "新运单已添加" });
      }
      setIsModalOpen(false);
      loadData();
    } catch (error: any) {
      toast({ title: "操作失败", description: error.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from('logistics_records').delete().eq('id', id);
      if (error) throw error;
      toast({ title: "成功", description: "运单记录已删除" });
      loadData();
    } catch (error: any) {
      toast({ title: "删除失败", description: error.message, variant: "destructive" });
    }
  };
  
  const filteredRecords = useMemo(() => {
    return records.filter(record => {
        const startDateMatch = !filters.startDate || record.loading_date >= filters.startDate;
        const endDateMatch = !filters.endDate || record.loading_date <= filters.endDate;
        const query = filters.searchQuery.toLowerCase();
        const searchMatch = !query ||
            record.auto_number.toLowerCase().includes(query) ||
            record.project_name.toLowerCase().includes(query) ||
            record.driver_name.toLowerCase().includes(query) ||
            record.loading_location.toLowerCase().includes(query) ||
            record.unloading_location.toLowerCase().includes(query);
        return startDateMatch && endDateMatch && searchMatch;
    });
  }, [records, filters]);

  const exportToExcel = () => {
    const dataToExport = filteredRecords.map(r => ({
      '运单编号': r.auto_number,
      '项目名称': r.project_name,
      '合作链路': r.chain_name || '默认',
      '司机姓名': r.driver_name,
      '装货地点': r.loading_location,
      '卸货地点': r.unloading_location,
      '装货日期': r.loading_date,
      '装货重量': r.loading_weight,
      '卸货重量': r.unloading_weight,
      '运费金额': r.current_cost,
    }));
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "运单记录");
    XLSX.writeFile(wb, "运单记录.xlsx");
    toast({ title: "成功", description: "数据已导出到Excel" });
  };

  const handleTemplateDownload = () => {
    const templateData = [{'项目名称': '', '合作链路': '', '司机姓名': '', '装货地点': '', '卸货地点': '', '装货日期': '', '装货重量': '', '卸货重量': '', '运费金额': ''}];
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "模板");
    XLSX.writeFile(wb, "运单导入模板.xlsx");
  };

  const handleExcelImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    toast({ title: "提示", description: "导入功能正在开发中！" });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">运单管理</h1>
          <p className="text-muted-foreground">录入、查询和管理所有运单记录</p>
        </div>
        <div className="flex gap-2">
            <Button variant="outline" onClick={handleTemplateDownload}><FileDown className="mr-2 h-4 w-4" />下载模板</Button>
            <Button variant="outline" asChild><Label htmlFor="excel-upload" className="cursor-pointer flex items-center"><FileUp className="mr-2 h-4 w-4" /> 导入Excel<Input id="excel-upload" type="file" className="hidden" onChange={handleExcelImport} accept=".xlsx, .xls" /></Label></Button>
            <Button onClick={exportToExcel}><Download className="mr-2 h-4 w-4" />导出数据</Button>
            <Button onClick={() => handleOpenModal()}><PlusCircle className="mr-2 h-4 w-4" />新增运单</Button>
        </div>
      </div>

      <div className="flex items-end gap-4 p-4 border rounded-lg">
        <div className="grid w-full max-w-sm items-center gap-1.5"><Label htmlFor="search-query">快速搜索</Label><Input type="text" id="search-query" placeholder="搜索运单号、项目、司机..." value={filters.searchQuery} onChange={e => setFilters(f => ({...f, searchQuery: e.target.value}))}/></div>
        <div className="grid items-center gap-1.5"><Label htmlFor="start-date">开始日期</Label><Input type="date" id="start-date" value={filters.startDate} onChange={e => setFilters(f => ({...f, startDate: e.target.value}))} /></div>
        <div className="grid items-center gap-1.5"><Label htmlFor="end-date">结束日期</Label><Input type="date" id="end-date" value={filters.endDate} onChange={e => setFilters(f => ({...f, endDate: e.target.value}))}/></div>
        <Button variant="outline" onClick={() => setFilters({startDate: "", endDate: "", searchQuery: ""})}>清除筛选</Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>运单编号</TableHead><TableHead>项目名称</TableHead><TableHead>合作链路</TableHead><TableHead>司机</TableHead><TableHead>路线</TableHead><TableHead>装货日期</TableHead><TableHead>运费</TableHead><TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? <TableRow><TableCell colSpan={8} className="text-center">加载中...</TableCell></TableRow> : filteredRecords.map((record) => (
              <TableRow key={record.id}>
                <TableCell className="font-mono">{record.auto_number}</TableCell>
                <TableCell>{record.project_name}</TableCell>
                <TableCell>{record.chain_name || '默认'}</TableCell>
                <TableCell>{record.driver_name}</TableCell>
                <TableCell>{record.loading_location} → {record.unloading_location}</TableCell>
                <TableCell>{record.loading_date}</TableCell>
                <TableCell className="font-mono">{record.current_cost ? `¥${record.current_cost.toFixed(2)}` : '-'}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => handleOpenModal(record)}><Edit className="h-4 w-4" /></Button>
                  <ConfirmDialog title="确认删除" description={`您确定要删除运单 ${record.auto_number} 吗？`} onConfirm={() => handleDelete(record.id)}>
                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                  </ConfirmDialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader><DialogTitle>{editingRecord ? "编辑运单" : "新增运单"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-1"><Label>项目名称 *</Label><Select value={formData.project_id} onValueChange={(v) => handleInputChange('project_id', v)}><SelectTrigger><SelectValue placeholder="选择项目" /></SelectTrigger><SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1"><Label>合作链路</Label><Select value={formData.chain_id} onValueChange={(v) => handleInputChange('chain_id', v)} disabled={!formData.project_id}><SelectTrigger><SelectValue placeholder="选择合作链路 (默认为空)" /></SelectTrigger><SelectContent>{partnerChains.map(c => <SelectItem key={c.id} value={c.id}>{c.chain_name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1"><Label>司机 *</Label><Select value={formData.driver_id} onValueChange={(v) => handleInputChange('driver_id', v)}><SelectTrigger><SelectValue placeholder="选择司机" /></SelectTrigger><SelectContent>{drivers.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1"><Label htmlFor="loading-location">装货地点 *</Label><Input id="loading-location" value={formData.loading_location || ''} onChange={(e) => handleInputChange('loading_location', e.target.value)} /></div>
            <div className="space-y-1"><Label htmlFor="unloading-location">卸货地点 *</Label><Input id="unloading-location" value={formData.unloading_location || ''} onChange={(e) => handleInputChange('unloading_location', e.target.value)} /></div>
            <div className="space-y-1"><Label htmlFor="loading-date">装货日期 *</Label><Input id="loading-date" type="date" value={formData.loading_date} onChange={(e) => handleInputChange('loading_date', e.target.value)} /></div>
            <div className="space-y-1"><Label htmlFor="loading-weight">装货重量 (吨)</Label><Input id="loading-weight" type="number" placeholder="例如: 10.5" value={formData.loading_weight || ''} onChange={(e) => handleInputChange('loading_weight', e.target.value)} /></div>
            <div className="space-y-1"><Label htmlFor="unloading-weight">卸货重量 (吨)</Label><Input id="unloading-weight" type="number" placeholder="例如: 10.4" value={formData.unloading_weight || ''} onChange={(e) => handleInputChange('unloading_weight', e.target.value)} /></div>
            <div className="space-y-1 col-span-2"><Label htmlFor="current-cost">运费金额 (元)</Label><Input id="current-cost" type="number" placeholder="系统将根据此金额计算应付成本" value={formData.current_cost || ''} onChange={(e) => handleInputChange('current_cost', e.target.value)} /></div>
          </div>
          <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>取消</Button><Button type="submit" onClick={handleSubmit}>保存</Button></div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
