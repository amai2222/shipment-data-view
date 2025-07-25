// 文件路径: src/pages/BusinessEntry.tsx
import { useState, useEffect, useMemo, useCallback } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Download, FileDown, FileUp, PlusCircle, Edit, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from 'xlsx';
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CreatableCombobox } from "@/components/CreatableCombobox";

// 类型定义
interface LogisticsRecord {
  id: string; auto_number: string; project_id: string; project_name: string; chain_id: string | null; chain_name: string | null;
  driver_id: string; driver_name: string; loading_location: string; unloading_location: string; loading_date: string;
  loading_weight: number | null; unloading_weight: number | null; current_cost: number | null; payable_cost: number | null;
  license_plate: string | null; driver_phone: string | null; transport_type: string | null;
  extra_cost: number | null; driver_payable_cost: number | null; remarks: string | null;
}
interface Project { id: string; name:string; }
interface Driver { id: string; name: string; license_plate: string | null; phone: string | null; }
interface Location { id: string; name: string; }
interface PartnerChain { id: string; chain_name: string; }

const BLANK_FORM_DATA = {
  project_id: "", chain_id: "", driver_id: "", driver_name: "", loading_location: "", unloading_location: "",
  loading_date: new Date().toISOString().split('T')[0], loading_weight: null, unloading_weight: null,
  current_cost: null, license_plate: "", driver_phone: "", transport_type: "整车", extra_cost: null,
  driver_payable_cost: null, remarks: ""
};

export default function BusinessEntry() {
  const [records, setRecords] = useState<LogisticsRecord[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
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
      const { data: recordsData } = await supabase.from('logistics_records_view').select('*').order('created_at', { ascending: false });
      setRecords(recordsData as LogisticsRecord[] || []);
      const { data: projectsData } = await supabase.from('projects').select('id, name');
      setProjects(projectsData || []);
      const { data: driversData } = await supabase.from('drivers').select('id, name, license_plate, phone');
      setDrivers(driversData as Driver[] || []);
      const { data: locationsData } = await supabase.from('locations').select('id, name');
      setLocations(locationsData || []);
    } catch (error) { toast({ title: "错误", description: "数据加载失败", variant: "destructive" });
    } finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => {
    handleInputChange('chain_id', '');
    if (formData.project_id) {
      const fetchChains = async () => {
        const { data } = await supabase.from('partner_chains').select('id, chain_name').eq('project_id', formData.project_id);
        setPartnerChains(data as PartnerChain[] || []);
      };
      fetchChains();
    } else { setPartnerChains([]); }
  }, [formData.project_id]);

  const handleInputChange = (field: string, value: any) => { setFormData((prev: any) => ({ ...prev, [field]: value })); };
  
  useEffect(() => {
    const selectedDriver = drivers.find(d => d.id === formData.driver_id || d.name === formData.driver_name);
    if (selectedDriver) {
      setFormData((prev: any) => ({
        ...prev,
        driver_id: selectedDriver.id, driver_name: selectedDriver.name,
        license_plate: selectedDriver.license_plate || prev.license_plate || '',
        driver_phone: selectedDriver.phone || prev.driver_phone || '',
      }));
    }
  }, [formData.driver_id, formData.driver_name, drivers]);

  const handleOpenModal = (record: LogisticsRecord | null = null) => {
    if (record) {
      setEditingRecord(record);
      setFormData({
        project_id: record.project_id, chain_id: record.chain_id || "", driver_id: record.driver_id, driver_name: record.driver_name,
        loading_location: record.loading_location, unloading_location: record.unloading_location, loading_date: record.loading_date,
        loading_weight: record.loading_weight, unloading_weight: record.unloading_weight, current_cost: record.current_cost,
        license_plate: record.license_plate, driver_phone: record.driver_phone, transport_type: record.transport_type,
        extra_cost: record.extra_cost, driver_payable_cost: record.driver_payable_cost, remarks: record.remarks
      });
    } else { setEditingRecord(null); setFormData(BLANK_FORM_DATA); }
    setIsModalOpen(true);
  };
  
  const handleSubmit = async () => {
    const projectName = projects.find(p => p.id === formData.project_id)?.name;
    if (!projectName || !formData.driver_name || !formData.loading_location || !formData.unloading_location) {
      toast({ title: "错误", description: "项目、司机和地点为必填项", variant: "destructive" }); return;
    }
    
    const { data: driverResult, error: driverError } = await supabase.rpc('get_or_create_driver', {
      p_driver_name: formData.driver_name, p_license_plate: formData.license_plate, p_phone: formData.driver_phone
    });
    if (driverError || !driverResult) { toast({ title: "错误", description: "处理司机信息失败", variant: "destructive" }); return; }
    const finalDriver = driverResult[0];

    await supabase.rpc('get_or_create_location', { p_location_name: formData.loading_location });
    await supabase.rpc('get_or_create_location', { p_location_name: formData.unloading_location });

    const recordData = {
      p_project_id: formData.project_id, p_project_name: projectName, p_chain_id: formData.chain_id || null,
      p_driver_id: finalDriver.driver_id, p_driver_name: finalDriver.driver_name,
      p_loading_location: formData.loading_location, p_unloading_location: formData.unloading_location,
      p_loading_date: formData.loading_date,
      p_loading_weight: formData.loading_weight ? parseFloat(formData.loading_weight) : null,
      p_unloading_weight: formData.unloading_weight ? parseFloat(formData.unloading_weight) : null,
      p_current_cost: formData.current_cost ? parseFloat(formData.current_cost) : null,
      p_license_plate: formData.license_plate, p_driver_phone: formData.driver_phone,
      p_transport_type: formData.transport_type,
      p_extra_cost: formData.extra_cost ? parseFloat(formData.extra_cost) : null,
      p_driver_payable_cost: formData.driver_payable_cost ? parseFloat(formData.driver_payable_cost) : null,
      p_remarks: formData.remarks
    };
    
    try {
      if (editingRecord) {
        await supabase.rpc('update_logistics_record_with_costs', { p_record_id: editingRecord.id, ...recordData });
        toast({ title: "成功", description: "运单记录已更新" });
      } else {
        await supabase.rpc('add_logistics_record_with_costs', recordData);
        toast({ title: "成功", description: "新运单已添加" });
      }
      setIsModalOpen(false); loadData();
    } catch (error: any) { toast({ title: "操作失败", description: error.message, variant: "destructive" }); }
  };

  const handleDelete = async (id: string) => { /* ... */ };
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
      '运单编号': r.auto_number, '项目名称': r.project_name, '合作链路': r.chain_name || '默认',
      '司机姓名': r.driver_name, '车牌号': r.license_plate, '司机电话': r.driver_phone,
      '装货地点': r.loading_location, '卸货地点': r.unloading_location, '装货日期': r.loading_date,
      '运输类型': r.transport_type, '装货重量': r.loading_weight, '卸货重量': r.unloading_weight,
      '运费金额': r.current_cost, '额外费用': r.extra_cost, '司机应收': r.driver_payable_cost, '备注': r.remarks,
    }));
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "运单记录");
    XLSX.writeFile(wb, "运单记录.xlsx");
  };
  const handleTemplateDownload = () => {
    const templateData = [{'项目名称': '', '合作链路': '', '司机姓名': '', '车牌号': '', '司机电话': '', '装货地点': '', '卸货地点': '', '装货日期': '', '运输类型': '', '装货重量': '', '卸货重量': '', '运费金额': '', '额外费用': '', '司机应收': '', '备注': ''}];
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "模板");
    XLSX.writeFile(wb, "运单导入模板.xlsx");
  };
  const handleExcelImport = async (event: React.ChangeEvent<HTMLInputElement>) => { toast({ title: "提示", description: "导入功能正在开发中！" }); };

  return (
    <div className="space-y-4">
      {/* 页面标题和按钮 */}
      <div className="flex justify-between items-center">
        <div><h1 className="text-3xl font-bold text-foreground">运单管理</h1><p className="text-muted-foreground">录入、查询和管理所有运单记录</p></div>
        <div className="flex gap-2">
            <Button variant="outline" onClick={handleTemplateDownload}><FileDown className="mr-2 h-4 w-4" />下载模板</Button>
            <Button variant="outline" asChild><Label htmlFor="excel-upload" className="cursor-pointer flex items-center"><FileUp className="mr-2 h-4 w-4" /> 导入Excel<Input id="excel-upload" type="file" className="hidden" onChange={handleExcelImport} accept=".xlsx, .xls" /></Label></Button>
            <Button onClick={exportToExcel}><Download className="mr-2 h-4 w-4" />导出数据</Button>
            <Button onClick={() => handleOpenModal()}><PlusCircle className="mr-2 h-4 w-4" />新增运单</Button>
        </div>
      </div>
      
      {/* 表格区域 */}
      {/* ... */}

      {/* 弹窗 */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader><DialogTitle>{editingRecord ? "编辑运单" : "新增运单"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-4 gap-4 py-4">
            <div className="space-y-1"><Label>项目 *</Label><Select value={formData.project_id} onValueChange={(v) => handleInputChange('project_id', v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1"><Label>合作链路</Label><Select value={formData.chain_id} onValueChange={(v) => handleInputChange('chain_id', v)} disabled={!formData.project_id}><SelectTrigger><SelectValue placeholder="默认链路"/></SelectTrigger><SelectContent>{partnerChains.map(c => <SelectItem key={c.id} value={c.id}>{c.chain_name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1"><Label>装货日期 *</Label><Input type="date" value={formData.loading_date} onChange={(e) => handleInputChange('loading_date', e.target.value)} /></div>
            <div className="space-y-1"><Label>运输类型</Label><Select value={formData.transport_type} onValueChange={(v) => handleInputChange('transport_type', v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="整车">整车</SelectItem><SelectItem value="零担">零担</SelectItem></SelectContent></Select></div>
            
            <div className="space-y-1"><Label>司机 *</Label><CreatableCombobox options={drivers.map(d => ({ value: d.id, label: d.name }))} value={formData.driver_id || formData.driver_name} onChange={(v) => {handleInputChange('driver_id', v); handleInputChange('driver_name', v);}} placeholder="选择或创建司机" searchPlaceholder="搜索或输入新司机..." createPlaceholder="创建新司机:"/></div>
            <div className="space-y-1"><Label>车牌号</Label><Input value={formData.license_plate || ''} onChange={(e) => handleInputChange('license_plate', e.target.value)} /></div>
            <div className="space-y-1"><Label>司机电话</Label><Input value={formData.driver_phone || ''} onChange={(e) => handleInputChange('driver_phone', e.target.value)} /></div>
            <div className="space-y-1"><Label>司机应收</Label><Input type="number" value={formData.driver_payable_cost || ''} onChange={(e) => handleInputChange('driver_payable_cost', e.target.value)} /></div>
            
            <div className="space-y-1"><Label>装货地点 *</Label><CreatableCombobox options={locations.map(l => ({ value: l.name, label: l.name }))} value={formData.loading_location} onChange={(v) => handleInputChange('loading_location', v)} placeholder="选择或创建地点" searchPlaceholder="搜索或输入新地点..." createPlaceholder="创建新地点:"/></div>
            <div className="space-y-1"><Label>装货重量</Label><Input type="number" value={formData.loading_weight || ''} onChange={(e) => handleInputChange('loading_weight', e.target.value)} /></div>
            <div className="space-y-1"><Label>卸货地点 *</Label><CreatableCombobox options={locations.map(l => ({ value: l.name, label: l.name }))} value={formData.unloading_location} onChange={(v) => handleInputChange('unloading_location', v)} placeholder="选择或创建地点" searchPlaceholder="搜索或输入新地点..." createPlaceholder="创建新地点:"/></div>
            <div className="space-y-1"><Label>卸货重量</Label><Input type="number" value={formData.unloading_weight || ''} onChange={(e) => handleInputChange('unloading_weight', e.target.value)} /></div>
            
            <div className="space-y-1"><Label>运费金额 (元)</Label><Input type="number" value={formData.current_cost || ''} onChange={(e) => handleInputChange('current_cost', e.target.value)} /></div>
            <div className="space-y-1"><Label>额外费用 (元)</Label><Input type="number" value={formData.extra_cost || ''} onChange={(e) => handleInputChange('extra_cost', e.target.value)} /></div>
            <div className="space-y-1 col-span-2"><Label>备注</Label><Textarea value={formData.remarks || ''} onChange={(e) => handleInputChange('remarks', e.target.value)} /></div>
          </div>
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setIsModalOpen(false)}>取消</Button><Button onClick={handleSubmit}>保存</Button></div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
