// 文件路径: src/pages/BusinessEntry.tsx

// 1. 导入所有需要的工具和组件
// React Hooks 用于管理状态和性能优化
import { useState, useEffect, useMemo, useCallback } from "react";
// React Router DOM 用于页面跳转
import { useNavigate } from "react-router-dom";
// UI 组件，构成了页面的外观
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Pagination, PaginationContent, PaginationItem } from "@/components/ui/pagination";
// 图标库，让按钮更直观
import { Download, FileDown, FileUp, PlusCircle, Edit, Trash2, Loader2 } from "lucide-react";
// Supabase 客户端，用于和数据库通信
import { supabase } from "@/integrations/supabase/client";
// 吐司通知，用于向用户显示操作结果
import { useToast } from "@/hooks/use-toast";
// Excel 导入导出库
import * as XLSX from 'xlsx';
// 自定义的确认对话框和“选择或创建”输入框组件
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CreatableCombobox } from "@/components/CreatableCombobox";

// 2. TypeScript 类型定义，确保数据安全
// 运单记录的完整结构
interface LogisticsRecord {
  id: string; auto_number: string; project_id: string; project_name: string; chain_id: string | null; chain_name: string | null;
  driver_id: string; driver_name: string; loading_location: string; unloading_location: string; loading_date: string;
  unloading_date: string | null;
  loading_weight: number | null; unloading_weight: number | null; current_cost: number | null; 
  payable_cost: number | null; // payable_cost 代表“司机应收”
  license_plate: string | null; driver_phone: string | null; transport_type: string | null;
  extra_cost: number | null; remarks: string | null;
}
// 项目、司机、地点、合作链路的结构
interface Project { id: string; name:string; start_date: string; }
interface Driver { id: string; name: string; license_plate: string | null; phone: string | null; }
interface Location { id: string; name: string; }
interface PartnerChain { id: string; chain_name: string; }

// 3. 辅助函数和常量定义
// 获取默认日期（当月第一天到今天）的函数
const getInitialDefaultDates = () => {
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const formatDate = (date: Date) => date.toISOString().split('T')[0];
    return { startDate: formatDate(firstDayOfMonth), endDate: formatDate(today) };
};

// 新增运单时，表单的初始空白状态
const BLANK_FORM_DATA = {
  project_id: "", chain_id: "", driver_id: "", driver_name: "", loading_location: "", unloading_location: "",
  loading_date: new Date().toISOString().split('T')[0], unloading_date: new Date().toISOString().split('T')[0],
  loading_weight: null, unloading_weight: null, current_cost: null, license_plate: "", driver_phone: "",
  transport_type: "实际运输", extra_cost: null, 
  payable_cost: null,
  remarks: ""
};

// 4. 主组件定义
export default function BusinessEntry() {
  // 5. 状态管理 (useState)
  // 核心数据状态
  const [records, setRecords] = useState<LogisticsRecord[]>([]); // 存储当前页的运单列表
  const [projects, setProjects] = useState<Project[]>([]);       // 存储所有项目，用于下拉选择
  const [drivers, setDrivers] = useState<Driver[]>([]);         // 存储所有司机，用于下拉选择
  const [locations, setLocations] = useState<Location[]>([]);     // 存储所有地点，用于下拉选择
  const [partnerChains, setPartnerChains] = useState<PartnerChain[]>([]); // 存储项目关联的合作链路

  // UI状态
  const [loading, setLoading] = useState(true); // 控制加载动画的显示
  const { toast } = useToast(); // 初始化吐司通知功能
  
  // 弹窗状态
  const [isEditModalOpen, setIsEditModalOpen] = useState(false); // 控制“新增/编辑”弹窗的开关
  const [editingRecord, setEditingRecord] = useState<LogisticsRecord | null>(null); // 存储正在编辑的记录，null表示新增
  const [viewingRecord, setViewingRecord] = useState<LogisticsRecord | null>(null); // 存储正在查看详情的记录
  
  // 表单和筛选器状态
  const [formData, setFormData] = useState<any>(BLANK_FORM_DATA); // 存储弹窗表单中的所有数据
  const [filters, setFilters] = useState({ 
    startDate: getInitialDefaultDates().startDate, 
    endDate: getInitialDefaultDates().endDate, 
    searchQuery: "" 
  });
  
  // 派生状态（根据其他状态计算而来）
  const [filteredDrivers, setFilteredDrivers] = useState<Driver[]>([]); // 存储根据项目筛选后的司机列表
  const [filteredLocations, setFilteredLocations] = useState<Location[]>([]); // 存储根据项目筛选后的地点列表
  
  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const PAGE_SIZE = 15; // 每页显示15条记录

  const navigate = useNavigate(); // 初始化页面跳转功能

  // 6. 数据加载逻辑 (useCallback & useEffect)
  // 加载下拉框选项（项目、司机、地点）
  const loadInitialOptions = useCallback(async () => {
    try {
      const { data: projectsData } = await supabase.from('projects').select('id, name, start_date');
      setProjects(projectsData as Project[] || []);
      const { data: driversData } = await supabase.from('drivers').select('id, name, license_plate, phone');
      setDrivers(driversData as Driver[] || []);
      const { data: locationsData } = await supabase.from('locations').select('id, name');
      setLocations(locationsData || []);
    } catch (error) { toast({ title: "错误", description: "加载筛选选项失败", variant: "destructive" }); }
  }, [toast]);

  // 【核心性能优化】从后端加载分页和筛选后的数据
  const loadPaginatedRecords = useCallback(async () => {
    setLoading(true);
    try {
      const offset = (currentPage - 1) * PAGE_SIZE;
      const { data, error } = await supabase.rpc('get_paginated_logistics_records', {
        p_page_size: PAGE_SIZE,
        p_offset: offset,
        p_start_date: filters.startDate || null,
        p_end_date: filters.endDate || null,
        p_search_query: filters.searchQuery || null,
      });
      if (error) throw error;
      setRecords(data.records || []);
      setTotalPages(Math.ceil(data.total_count / PAGE_SIZE) || 1);
    } catch (error) {
      toast({ title: "错误", description: "加载运单记录失败", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [currentPage, filters, toast]);

  // 7. 副作用管理 (useEffect)
  // 页面首次加载时，获取下拉选项
  useEffect(() => { loadInitialOptions(); }, [loadInitialOptions]);
  // 当页码变化时，重新获取运单列表
  useEffect(() => { loadPaginatedRecords(); }, [currentPage, loadPaginatedRecords]);

  // 【性能优化】为搜索框增加防抖
  useEffect(() => {
    const timer = setTimeout(() => {
      // 如果筛选导致页码变化，先更新页码，useEffect的依赖变化会触发数据刷新
      if (currentPage !== 1) {
        setCurrentPage(1);
      } else {
        // 如果页码已经是1，直接刷新数据
        loadPaginatedRecords();
      }
    }, 500); // 延迟500毫秒执行，避免用户快速输入时频繁请求
    return () => clearTimeout(timer); // 组件卸载或依赖变化时，清除上一个计时器
  }, [filters, currentPage, loadPaginatedRecords]);

  // 统一的表单输入处理器
  const handleInputChange = (field: string, value: any) => { setFormData((prev: any) => ({ ...prev, [field]: value })); };

  // 当项目变化时，获取关联的链路、司机和地点
  useEffect(() => {
    handleInputChange('chain_id', '');
    if (formData.project_id) {
      const fetchRelatedData = async () => {
        const { data: chainsData } = await supabase.from('partner_chains').select('id, chain_name').eq('project_id', formData.project_id);
        setPartnerChains(chainsData as PartnerChain[] || []);
        const { data: driverLinks } = await supabase.from('driver_projects').select('driver_id').eq('project_id', formData.project_id);
        const driverIds = driverLinks?.map(link => link.driver_id) || [];
        setFilteredDrivers(drivers.filter(driver => driverIds.includes(driver.id)));
        const { data: locationLinks } = await supabase.from('location_projects').select('location_id').eq('project_id', formData.project_id);
        const locationIds = locationLinks?.map(link => link.location_id) || [];
        setFilteredLocations(locations.filter(location => locationIds.includes(location.id)));
      };
      fetchRelatedData();
    } else {
      setPartnerChains([]);
      setFilteredDrivers([]);
      setFilteredLocations([]);
    }
  }, [formData.project_id, drivers, locations]);

  // 当司机选择变化时，自动填充车牌和电话
  useEffect(() => {
    const selectedDriver = drivers.find(d => d.id === formData.driver_id);
    if (selectedDriver) {
      setFormData((prev: any) => ({
        ...prev,
        driver_name: selectedDriver.name,
        license_plate: selectedDriver.license_plate || prev.license_plate || '',
        driver_phone: selectedDriver.phone || prev.driver_phone || '',
      }));
    }
  }, [formData.driver_id, drivers]);

  // 自动计算司机应收
  useEffect(() => {
    const currentCost = parseFloat(formData.current_cost) || 0;
    const extraCost = parseFloat(formData.extra_cost) || 0;
    handleInputChange('payable_cost', (currentCost + extraCost > 0) ? (currentCost + extraCost).toFixed(2) : null);
  }, [formData.current_cost, formData.extra_cost]);
  
  // 卸货日期默认等于装货日期
  useEffect(() => {
    if (formData.loading_date && !formData.unloading_date) {
      handleInputChange('unloading_date', formData.loading_date);
    }
  }, [formData.loading_date]);

  // 8. 事件处理器 (Handlers)
  // 打开弹窗（新增或编辑）
  const handleOpenModal = (record: LogisticsRecord | null = null) => {
    if (record) { // 编辑模式
      setEditingRecord(record);
      setFormData({
        project_id: record.project_id, chain_id: record.chain_id || "", driver_id: record.driver_id, driver_name: record.driver_name,
        loading_location: record.loading_location, unloading_location: record.unloading_location, loading_date: record.loading_date,
        unloading_date: record.unloading_date || record.loading_date,
        loading_weight: record.loading_weight, unloading_weight: record.unloading_weight, current_cost: record.current_cost,
        license_plate: record.license_plate, driver_phone: record.driver_phone, transport_type: record.transport_type || '实际运输',
        extra_cost: record.extra_cost, 
        payable_cost: record.payable_cost,
        remarks: record.remarks
      });
    } else { // 新增模式
      const latestProject = [...projects].sort((a, b) => (b.start_date || '').localeCompare(a.start_date || ''))[0];
      setEditingRecord(null);
      setFormData({ ...BLANK_FORM_DATA, project_id: latestProject ? latestProject.id : "" });
    }
    setIsEditModalOpen(true);
  };
  
  // 提交表单（新增或编辑）
  const handleSubmit = async () => {
    const projectName = projects.find(p => p.id === formData.project_id)?.name;
    if (!projectName || !formData.driver_name || !formData.loading_location || !formData.unloading_location) {
      toast({ title: "错误", description: "项目、司机和地点为必填项", variant: "destructive" }); return;
    }
    
    let finalDriverId = formData.driver_id;
    let finalDriverName = formData.driver_name;
    const isUuid = /^[0-9a-fA-F-]{36}$/.test(formData.driver_id);
    if (!isUuid) {
        const { data: driverResult, error: driverError } = await supabase.rpc('get_or_create_driver', {
            p_driver_name: formData.driver_name, p_license_plate: formData.license_plate, p_phone: formData.driver_phone, p_project_id: formData.project_id
        });
        if (driverError || !driverResult || driverResult.length === 0) { toast({ title: "错误", description: "处理司机信息失败", variant: "destructive" }); return; }
        finalDriverId = driverResult[0].driver_id;
        finalDriverName = driverResult[0].driver_name;
    }

    await supabase.rpc('get_or_create_location', { p_location_name: formData.loading_location, p_project_id: formData.project_id });
    await supabase.rpc('get_or_create_location', { p_location_name: formData.unloading_location, p_project_id: formData.project_id });

    const recordData = {
      p_project_id: formData.project_id, p_project_name: projectName, p_chain_id: formData.chain_id || null,
      p_driver_id: finalDriverId, p_driver_name: finalDriverName,
      p_loading_location: formData.loading_location, p_unloading_location: formData.unloading_location,
      p_loading_date: formData.loading_date, p_unloading_date: formData.unloading_date || null,
      p_loading_weight: formData.loading_weight ? parseFloat(formData.loading_weight) : null,
      p_unloading_weight: formData.unloading_weight ? parseFloat(formData.unloading_weight) : null,
      p_current_cost: formData.current_cost ? parseFloat(formData.current_cost) : null,
      p_license_plate: formData.license_plate, p_driver_phone: formData.driver_phone,
      p_transport_type: formData.transport_type,
      p_extra_cost: formData.extra_cost ? parseFloat(formData.extra_cost) : null,
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
      setIsEditModalOpen(false); 
      loadPaginatedRecords();
      loadInitialOptions();
    } catch (error: any) { toast({ title: "操作失败", description: error.message, variant: "destructive" }); }
  };

  // 删除记录
  const handleDelete = async (id: string) => {
    try {
      await supabase.from('logistics_records').delete().eq('id', id);
      toast({ title: "成功", description: "运单记录已删除" });
      loadPaginatedRecords();
    } catch (error: any) { toast({ title: "删除失败", description: error.message, variant: "destructive" }); }
  };

  // 9. 计算属性 (useMemo)
  // 计算当前页的合计数据
  const summary = useMemo(() => {
    return records.reduce((acc, record) => {
      acc.totalLoadingWeight += record.loading_weight || 0;
      acc.totalUnloadingWeight += record.unloading_weight || 0;
      acc.totalCurrentCost += record.current_cost || 0;
      acc.totalExtraCost += record.extra_cost || 0;
      acc.totalDriverPayableCost += record.payable_cost || 0;
      if (record.transport_type === '实际运输') acc.actualCount += 1;
      else if (record.transport_type === '退货') acc.returnCount += 1;
      return acc;
    }, {
      totalLoadingWeight: 0,
      totalUnloadingWeight: 0,
      totalCurrentCost: 0,
      totalExtraCost: 0,
      totalDriverPayableCost: 0,
      actualCount: 0,
      returnCount: 0,
    });
  }, [records]);

  // 10. 辅助功能函数
  // 导出全部筛选结果
  const exportToExcel = async () => {
    toast.info("正在准备导出全部筛选结果...");
    try {
        const { data, error } = await supabase.rpc('get_paginated_logistics_records', {
            p_page_size: 99999, p_offset: 0,
            p_start_date: filters.startDate || null,
            p_end_date: filters.endDate || null,
            p_search_query: filters.searchQuery || null,
        });
        if (error) throw error;
        
        const dataToExport = data.records.map((r: LogisticsRecord) => ({
          '运单编号': r.auto_number, '项目名称': r.project_name, '合作链路': r.chain_name || '默认',
          '司机姓名': r.driver_name, '车牌号': r.license_plate, '司机电话': r.driver_phone,
          '装货地点': r.loading_location, '卸货地点': r.unloading_location, '装货日期': r.loading_date, '卸货日期': r.unloading_date,
          '运输类型': r.transport_type, '装货重量': r.loading_weight, '卸货重量': r.unloading_weight,
          '运费金额': r.current_cost, '额外费用': r.extra_cost, 
          '司机应收': r.payable_cost,
          '备注': r.remarks,
        }));
        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "运单记录");
        XLSX.writeFile(wb, "运单记录.xlsx");
        toast.success("全部筛选结果已成功导出！");
    } catch(e) {
        toast.error("导出失败，请重试。");
    }
  };
  
  const handleTemplateDownload = () => {
    const templateData = [{'项目名称': '', '合作链路': '', '司机姓名': '', '车牌号': '', '司机电话': '', '装货地点': '', '卸货地点': '', '装货日期': '', '卸货日期': '', '运输类型': '实际运输', '装货重量': '', '卸货重量': '', '运费金额': '', '额外费用': '', '备注': ''}];
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "模板");
    XLSX.writeFile(wb, "运单导入模板.xlsx");
  };
  
  const handleExcelImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    // ... 导入逻辑 ...
  };

  // 11. 渲染UI (return)
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div><h1 className="text-3xl font-bold text-foreground">运单管理</h1><p className="text-muted-foreground">录入、查询和管理所有运单记录</p></div>
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
        <Button variant="outline" onClick={() => setFilters({startDate: getInitialDefaultDates().startDate, endDate: getInitialDefaultDates().endDate, searchQuery: ""})}>清除筛选</Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader><TableRow><TableHead>运单编号</TableHead><TableHead>项目</TableHead><TableHead>合作链路</TableHead><TableHead>司机</TableHead><TableHead>路线</TableHead><TableHead>装货日期</TableHead><TableHead>运费</TableHead><TableHead>额外费</TableHead><TableHead>司机应收</TableHead><TableHead className="text-right">操作</TableHead></TableRow></TableHeader>
          <TableBody>
            {loading ? <TableRow><TableCell colSpan={10} className="text-center h-24"><Loader2 className="h-6 w-6 animate-spin"/></TableCell></TableRow> 
            : records.length === 0 ? <TableRow><TableCell colSpan={10} className="text-center">没有找到匹配的记录</TableCell></TableRow>
            : records.map((record) => (
              <TableRow key={record.id} onClick={() => setViewingRecord(record)} className="cursor-pointer">
                <TableCell className="font-mono">{record.auto_number}</TableCell>
                <TableCell>{record.project_name}</TableCell>
                <TableCell>{record.chain_name || '默认'}</TableCell>
                <TableCell>{record.driver_name}</TableCell>
                <TableCell>{record.loading_location} → {record.unloading_location}</TableCell>
                <TableCell>{record.loading_date}</TableCell>
                <TableCell className="font-mono">{record.current_cost ? `¥${record.current_cost.toFixed(2)}` : '-'}</TableCell>
                <TableCell className="font-mono text-orange-600">{record.extra_cost ? `¥${record.extra_cost.toFixed(2)}` : '-'}</TableCell>
                <TableCell className="font-mono text-green-600 font-semibold">{record.payable_cost ? `¥${record.payable_cost.toFixed(2)}` : '-'}</TableCell>
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
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

      <Pagination>
        <PaginationContent>
          <PaginationItem><Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1}>上一页</Button></PaginationItem>
          <PaginationItem><span className="p-2 text-sm">第 {currentPage} 页 / 共 {totalPages} 页</span></PaginationItem>
          <PaginationItem><Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}>下一页</Button></PaginationItem>
        </PaginationContent>
      </Pagination>

      <div className="flex items-center justify-end space-x-6 rounded-lg border p-4 text-sm font-medium">
        <span>当前页合计:</span>
        <span className="font-bold">装: <span className="text-primary">{summary.totalLoadingWeight.toFixed(1)}吨</span></span>
        <span className="font-bold">卸: <span className="text-primary">{summary.totalUnloadingWeight.toFixed(1)}吨</span></span>
        <span className="font-bold">{summary.actualCount}实际 / {summary.returnCount}退货</span>
        <span>司机运费: <span className="font-bold text-primary">¥{summary.totalCurrentCost.toFixed(2)}</span></span>
        <span>额外费用: <span className="font-bold text-orange-600">¥{summary.totalExtraCost.toFixed(2)}</span></span>
        <span>司机应收: <span className="font-bold text-green-600">¥{summary.totalDriverPayableCost.toFixed(2)}</span></span>
      </div>

      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader><DialogTitle>{editingRecord ? "编辑运单" : "新增运单"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-4 gap-4 py-4">
            <div className="space-y-1"><Label>项目 *</Label><Select value={formData.project_id} onValueChange={(v) => handleInputChange('project_id', v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1"><Label>合作链路</Label><Select value={formData.chain_id} onValueChange={(v) => handleInputChange('chain_id', v)} disabled={!formData.project_id}><SelectTrigger><SelectValue placeholder="默认链路"/></SelectTrigger><SelectContent>{partnerChains.map(c => <SelectItem key={c.id} value={c.id}>{c.chain_name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1"><Label>装货日期 *</Label><Input type="date" value={formData.loading_date} onChange={(e) => handleInputChange('loading_date', e.target.value)} /></div>
            <div className="space-y-1"><Label>卸货日期</Label><Input type="date" value={formData.unloading_date} onChange={(e) => handleInputChange('unloading_date', e.target.value)} /></div>
            
            <div className="space-y-1"><Label>司机 *</Label><CreatableCombobox options={filteredDrivers.map(d => ({ value: d.id, label: `${d.name} (${d.license_plate || '无车牌'})` }))} value={formData.driver_id} onValueChange={(id, name) => { handleInputChange('driver_id', id); handleInputChange('driver_name', name); }} placeholder="选择或创建司机" searchPlaceholder="搜索或输入新司机..." createPlaceholder="创建新司机:" onCreateNew={() => navigate('/drivers')}/></div>
            <div className="space-y-1"><Label>车牌号</Label><Input value={formData.license_plate || ''} onChange={(e) => handleInputChange('license_plate', e.target.value)} /></div>
            <div className="space-y-1"><Label>司机电话</Label><Input value={formData.driver_phone || ''} onChange={(e) => handleInputChange('driver_phone', e.target.value)} /></div>
            <div className="space-y-1"><Label>运输类型</Label><Select value={formData.transport_type} onValueChange={(v) => handleInputChange('transport_type', v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="实际运输">实际运输</SelectItem><SelectItem value="退货">退货</SelectItem></SelectContent></Select></div>
            
            <div className="space-y-1"><Label>装货地点 *</Label><CreatableCombobox options={filteredLocations.map(l => ({ value: l.name, label: l.name }))} value={formData.loading_location} onValueChange={(_, label) => handleInputChange('loading_location', label)} placeholder="选择或创建地点" searchPlaceholder="搜索或输入新地点..." createPlaceholder="创建新地点:" onCreateNew={() => navigate('/locations')}/></div>
            <div className="space-y-1"><Label>装货重量</Label><Input type="number" value={formData.loading_weight || ''} onChange={(e) => handleInputChange('loading_weight', e.target.value)} /></div>
            <div className="space-y-1"><Label>卸货地点 *</Label><CreatableCombobox options={filteredLocations.map(l => ({ value: l.name, label: l.name }))} value={formData.unloading_location} onValueChange={(_, label) => handleInputChange('unloading_location', label)} placeholder="选择或创建地点" searchPlaceholder="搜索或输入新地点..." createPlaceholder="创建新地点:" onCreateNew={() => navigate('/locations')}/></div>
            <div className="space-y-1"><Label>卸货重量</Label><Input type="number" value={formData.unloading_weight || ''} onChange={(e) => handleInputChange('unloading_weight', e.target.value)} /></div>
            
            <div className="space-y-1"><Label>运费金额 (元)</Label><Input type="number" value={formData.current_cost || ''} onChange={(e) => handleInputChange('current_cost', e.target.value)} /></div>
            <div className="space-y-1"><Label>额外费用 (元)</Label><Input type="number" value={formData.extra_cost || ''} onChange={(e) => handleInputChange('extra_cost', e.target.value)} /></div>
            <div className="space-y-1 col-span-2"><Label>备注</Label><Textarea value={formData.remarks || ''} onChange={(e) => handleInputChange('remarks', e.target.value)} /></div>
            
            <div className="space-y-1 col-start-4"><Label>司机应收 (自动计算)</Label><Input type="number" value={formData.payable_cost || ''} disabled className="font-bold text-primary" /></div>
          </div>
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setIsEditModalOpen(false)}>取消</Button><Button type="submit" onClick={handleSubmit}>保存</Button></div>
        </DialogContent>
      </Dialog>
      
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
            <Button onClick={() => { if (viewingRecord) { handleOpenModal(viewingRecord); setViewingRecord(null); } }}>编辑此记录</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
