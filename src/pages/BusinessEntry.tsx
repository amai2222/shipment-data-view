// 文件路径: src/pages/BusinessEntry.tsx
import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom"; // 【核心改动】引入页面跳转功能
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Pagination, PaginationContent, PaginationItem } from "@/components/ui/pagination";
import { Download, FileDown, FileUp, PlusCircle, Edit, Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from 'xlsx';
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CreatableCombobox } from "@/components/CreatableCombobox";

// 类型定义
interface LogisticsRecord {
  id: string; auto_number: string; project_id: string; project_name: string; chain_id: string | null; chain_name: string | null;
  driver_id: string; driver_name: string; loading_location: string; unloading_location: string; loading_date: string;
  unloading_date: string | null;
  loading_weight: number | null; unloading_weight: number | null; current_cost: number | null; 
  payable_cost: number | null;
  license_plate: string | null; driver_phone: string | null; transport_type: string | null;
  extra_cost: number | null; remarks: string | null;
}
interface Project { id: string; name:string; start_date: string; }
interface Driver { id: string; name: string; license_plate: string | null; phone: string | null; }
interface Location { id: string; name: string; }
interface PartnerChain { id: string; chain_name: string; }

const getInitialDefaultDates = () => {
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const formatDate = (date: Date) => date.toISOString().split('T')[0];
    return { startDate: formatDate(firstDayOfMonth), endDate: formatDate(today) };
};

const BLANK_FORM_DATA = {
  project_id: "", chain_id: "", driver_id: "", driver_name: "", loading_location: "", unloading_location: "",
  loading_date: new Date().toISOString().split('T')[0], unloading_date: new Date().toISOString().split('T')[0],
  loading_weight: null, unloading_weight: null, current_cost: null, license_plate: "", driver_phone: "",
  transport_type: "实际运输", extra_cost: null, 
  payable_cost: null,
  remarks: ""
};

export default function BusinessEntry() {
  const [records, setRecords] = useState<LogisticsRecord[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [partnerChains, setPartnerChains] = useState<PartnerChain[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<LogisticsRecord | null>(null);
  const [viewingRecord, setViewingRecord] = useState<LogisticsRecord | null>(null);
  
  const [formData, setFormData] = useState<any>(BLANK_FORM_DATA);
  const [filters, setFilters] = useState({ 
    startDate: getInitialDefaultDates().startDate, 
    endDate: getInitialDefaultDates().endDate, 
    searchQuery: "" 
  });
  
  const [filteredDrivers, setFilteredDrivers] = useState<Driver[]>([]);
  const [filteredLocations, setFilteredLocations] = useState<Location[]>([]);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const PAGE_SIZE = 15;

  const navigate = useNavigate(); // 【核心改动】初始化页面跳转功能

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const { data: recordsData } = await supabase.from('logistics_records_view').select('*').order('created_at', { ascending: false });
      setRecords(recordsData as LogisticsRecord[] || []);
      const { data: projectsData } = await supabase.from('projects').select('id, name, start_date');
      setProjects(projectsData as Project[] || []);
      const { data: driversData } = await supabase.from('drivers').select('id, name, license_plate, phone');
      setDrivers(driversData as Driver[] || []);
      const { data: locationsData } = await supabase.from('locations').select('id, name');
      setLocations(locationsData || []);
    } catch (error) { toast({ title: "错误", description: "数据加载失败", variant: "destructive" });
    } finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { loadData(); }, [loadData]);
  
  const handleInputChange = (field: string, value: any) => { setFormData((prev: any) => ({ ...prev, [field]: value })); };

  useEffect(() => { /* ... 关联筛选逻辑 ... */ }, [formData.project_id, drivers, locations]);
  useEffect(() => { /* ... 自动填充司机信息 ... */ }, [formData.driver_id, drivers]);
  useEffect(() => { /* ... 自动计算司机应收 ... */ }, [formData.current_cost, formData.extra_cost]);
  useEffect(() => { /* ... 自动设置卸货日期 ... */ }, [formData.loading_date]);

  const handleOpenModal = (record: LogisticsRecord | null = null) => { /* ... */ };
  
  const handleSubmit = async () => {
    const projectName = projects.find(p => p.id === formData.project_id)?.name;
    if (!projectName || !formData.driver_id || !formData.loading_location || !formData.unloading_location) {
      toast({ title: "错误", description: "项目、司机和地点为必填项", variant: "destructive" }); return;
    }
    
    // ... 保存逻辑保持不变，因为创建操作已分离出去
  };

  const handleDelete = async (id: string) => { /* ... */ };
  const filteredRecords = useMemo(() => { /* ... */ return []; }, [records, filters]);
  const summary = useMemo(() => { /* ... */ return {}; }, [filteredRecords]);
  const exportToExcel = async () => { /* ... */ };
  const handleTemplateDownload = () => { /* ... */ };
  const handleExcelImport = async (event: React.ChangeEvent<HTMLInputElement>) => { /* ... */ };

  return (
    <div className="space-y-4">
      {/* ... 页面标题、按钮、筛选器和表格区域 ... */}

      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader><DialogTitle>{editingRecord ? "编辑运单" : "新增运单"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-4 gap-4 py-4">
            {/* ... 其他表单行 ... */}
            
            <div className="space-y-1"><Label>司机 *</Label>
              <CreatableCombobox
                options={filteredDrivers.map(d => ({ value: d.id, label: d.name }))}
                value={formData.driver_id}
                onValueChange={(value) => handleInputChange('driver_id', value)}
                onCreateNew={() => navigate('/drivers')} // 【核心改动】点击按钮时跳转到司机管理页面
                placeholder="选择关联司机"
                searchPlaceholder="搜索司机..."
                emptyPlaceholder="未找到司机。"
              />
            </div>
            
            {/* ... 其他表单行 ... */}
            
            <div className="space-y-1"><Label>装货地点 *</Label>
              <CreatableCombobox
                options={filteredLocations.map(l => ({ value: l.name, label: l.name }))}
                value={formData.loading_location}
                onValueChange={(value) => handleInputChange('loading_location', value)}
                onCreateNew={() => navigate('/locations')} // 【核心改动】点击按钮时跳转到地点管理页面
                placeholder="选择关联地点"
                searchPlaceholder="搜索地点..."
                emptyPlaceholder="未找到地点。"
              />
            </div>
            
            {/* ... 其他表单行 ... */}
            
            <div className="space-y-1"><Label>卸货地点 *</Label>
              <CreatableCombobox
                options={filteredLocations.map(l => ({ value: l.name, label: l.name }))}
                value={formData.unloading_location}
                onValueChange={(value) => handleInputChange('unloading_location', value)}
                onCreateNew={() => navigate('/locations')} // 【核心改动】点击按钮时跳转到地点管理页面
                placeholder="选择关联地点"
                searchPlaceholder="搜索地点..."
                emptyPlaceholder="未找到地点。"
              />
            </div>
            
            {/* ... 其他表单行 ... */}
          </div>
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setIsEditModalOpen(false)}>取消</Button><Button onClick={handleSubmit}>保存</Button></div>
        </DialogContent>
      </Dialog>
      
      {/* ... 查看详情弹窗 ... */}
    </div>
  );
}
