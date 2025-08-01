// 文件路径: src/pages/BusinessEntry.tsx

// 1. 导入所有需要的工具和组件
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from 'xlsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { BusinessEntryHeader } from "@/components/business/BusinessEntryHeader";
import { BusinessEntryFilters } from "@/components/business/BusinessEntryFilters";
import { BusinessEntryTable } from "@/components/business/BusinessEntryTable";
import { BusinessEntryPagination } from "@/components/business/BusinessEntryPagination";
import { BusinessEntrySummary } from "@/components/business/BusinessEntrySummary";
import { BusinessEntryEditModal } from "@/components/business/BusinessEntryEditModal";
import { BusinessEntryImportModal } from "@/components/business/BusinessEntryImportModal";

// 2. TypeScript 类型定义
interface LogisticsRecord {
  id: string; auto_number: string; project_id: string; project_name: string; chain_id: string | null; chain_name: string | null;
  driver_id: string; driver_name: string; loading_location: string; unloading_location: string; loading_date: string;
  unloading_date: string | null;
  loading_weight: number | null; unloading_weight: number | null; current_cost: number | null;
  payable_cost: number | null;
  license_plate: string | null; driver_phone: string | null; transport_type: string | null;
  extra_cost: number | null; remarks: string | null;
}

interface Project { id: string; name: string; start_date: string; }
interface Driver { id: string; name: string; license_plate: string | null; phone: string | null; }
interface Location { id: string; name: string; }
interface PartnerChain { id: string; chain_name: string; }

// 3. 辅助函数和常量定义
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
  transport_type: "实际运输", extra_cost: null, payable_cost: null, remarks: ""
};

// ==============================================================================
//  ** 关键修复：重写日期解析函数以强制忽略时区 **
// ==============================================================================
const parseExcelDate = (excelDate: any): string | null => {
  if (excelDate === null || excelDate === undefined || excelDate === '') return null;
 
  // **情况1：处理Excel的数字序列日期（如 45671）**
  // 这是从Excel导入时的主要情况。
  if (typeof excelDate === 'number' && excelDate > 0) {
    // 这个公式将Excel的序列号转为JS的毫秒数。这个转换本身是基于UTC的，所以是安全的。
    const date = new Date(Math.round((excelDate - 25569) * 86400 * 1000));
    // **关键：** 必须使用 getUTC* 系列方法来提取年月日，这样可以完全忽略本地时区的影响。
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
 
  // **情况2：处理JavaScript的Date对象**
  // 当使用了 `cellDates:true` 或者某些UI组件返回Date对象时，会进入这里。
  // 这是一个主要的“时区陷阱”。
  if (excelDate instanceof Date) {
     // 为了修正时区问题，我们获取本地的年月日，因为这才是用户在日历上看到的真实日期。
    const year = excelDate.getFullYear();
    const month = String(excelDate.getMonth() + 1).padStart(2, '0');
    const day = String(excelDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
 
  // **情况3：处理字符串日期**
  // 来自于手动输入或者已经格式化好的数据。
  if (typeof excelDate === 'string') {
    const dateStr = excelDate.split(' ')[0]; // 去掉可能存在的时间部分
    // 如果是 YYYY-MM-DD 格式，直接返回
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return dateStr;
    }
    // 如果是 YYYY/MM/DD 格式，替换后返回
    if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(dateStr)) {
      const parts = dateStr.split('/');
      const year = parts[0];
      const month = parts[1].padStart(2, '0');
      const day = parts[2].padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  }
 
  // 如果所有情况都不匹配，返回null
  console.warn("无法解析的日期格式:", excelDate);
  return null;
};
// ==============================================================================
// ** 修复结束 **
// ==============================================================================


// 4. 主组件定义
export default function BusinessEntry() {
  // 状态管理
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

  // 导入相关状态
  const [isImporting, setIsImporting] = useState(false);
  const [importStep, setImportStep] = useState<'idle' | 'preprocessing' | 'preview' | 'processing'>('idle');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importData, setImportData] = useState<{valid: any[], invalid: any[], duplicateCount: number}>({ 
    valid: [], 
    invalid: [], 
    duplicateCount: 0 
  });
  const [preprocessingProgress, setPreprocessingProgress] = useState(0);
  const [importLogs, setImportLogs] = useState<string[]>([]);
  const importLogRef = useRef<HTMLDivElement>(null);

  const navigate = useNavigate();

  // 数据加载逻辑
  const loadInitialOptions = useCallback(async () => {
    try {
      const { data: projectsData } = await supabase.from('projects').select('id, name, start_date');
      setProjects(projectsData as Project[] || []);
      const { data: driversData } = await supabase.from('drivers').select('id, name, license_plate, phone');
      setDrivers(driversData as Driver[] || []);
      const { data: locationsData } = await supabase.from('locations').select('id, name');
      setLocations(locationsData || []);
    } catch (error) { 
      toast({ title: "错误", description: "加载筛选选项失败", variant: "destructive" }); 
    }
  }, [toast]);

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
      const result = data as unknown as { records: LogisticsRecord[], total_count: number };
      setRecords(result?.records || []);
      setTotalPages(Math.ceil((result?.total_count || 0) / PAGE_SIZE) || 1);

    } catch (error) {
      toast({ title: "错误", description: "加载运单记录失败", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [currentPage, filters, toast]);

  // 副作用管理
  useEffect(() => {
    loadInitialOptions();
  }, [loadInitialOptions]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadPaginatedRecords();
    }, 500);
    return () => clearTimeout(timer);
  }, [currentPage, filters, loadPaginatedRecords]);

  useEffect(() => {
    if (currentPage !== 1) {
      setCurrentPage(1);
    }
  }, [filters]);

  useEffect(() => {
    if (importLogRef.current) {
      importLogRef.current.scrollTop = importLogRef.current.scrollHeight;
    }
  }, [importLogs]);

  const handleInputChange = (field: string, value: any) => { 
    setFormData((prev: any) => ({ ...prev, [field]: value })); 
  };

  useEffect(() => {
    handleInputChange('chain_id', '');
    if (formData.project_id) {
      const fetchRelatedData = async () => {
        const { data: chainsData } = await supabase.from('partner_chains')
          .select('id, chain_name')
          .eq('project_id', formData.project_id);
        setPartnerChains(chainsData as PartnerChain[] || []);

        const { data: driverLinks } = await supabase.from('driver_projects')
          .select('driver_id')
          .eq('project_id', formData.project_id);
        const driverIds = driverLinks?.map(link => link.driver_id) || [];
        setFilteredDrivers(drivers.filter(driver => driverIds.includes(driver.id)));

        const { data: locationLinks } = await supabase.from('location_projects')
          .select('location_id')
          .eq('project_id', formData.project_id);
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

  useEffect(() => {
    const currentCost = parseFloat(formData.current_cost) || 0;
    const extraCost = parseFloat(formData.extra_cost) || 0;
    handleInputChange('payable_cost', (currentCost + extraCost > 0) ? (currentCost + extraCost).toFixed(2) : null);
  }, [formData.current_cost, formData.extra_cost]);

  useEffect(() => {
    if (formData.loading_date && !formData.unloading_date) {
      handleInputChange('unloading_date', formData.loading_date);
    }
  }, [formData.loading_date]);

  // 事件处理器
  const handleOpenModal = (record: LogisticsRecord | null = null) => {
    if (record) {
      setEditingRecord(record);
      setFormData({
        project_id: record.project_id, 
        chain_id: record.chain_id || "", 
        driver_id: record.driver_id, 
        driver_name: record.driver_name,
        loading_location: record.loading_location, 
        unloading_location: record.unloading_location, 
        loading_date: record.loading_date,
        unloading_date: record.unloading_date || record.loading_date,
        loading_weight: record.loading_weight, 
        unloading_weight: record.unloading_weight, 
        current_cost: record.current_cost,
        license_plate: record.license_plate, 
        driver_phone: record.driver_phone, 
        transport_type: record.transport_type || '实际运输',
        extra_cost: record.extra_cost,
        payable_cost: record.payable_cost,
        remarks: record.remarks
      });
    } else {
      const latestProject = [...projects].sort((a, b) => (b.start_date || '').localeCompare(a.start_date || ''))[0];
      setEditingRecord(null);
      setFormData({ ...BLANK_FORM_DATA, project_id: latestProject ? latestProject.id : "" });
    }
    setIsEditModalOpen(true);
  };

  const handleSubmit = async () => {
    const projectName = projects.find(p => p.id === formData.project_id)?.name;
    if (!projectName || !formData.driver_name || !formData.loading_location || !formData.unloading_location) {
      toast({ title: "错误", description: "项目、司机和地点为必填项", variant: "destructive" }); 
      return;
    }

    let finalDriverId = formData.driver_id;
    let finalDriverName = formData.driver_name;
    const isUuid = /^[0-9a-fA-F-]{36}$/.test(formData.driver_id);
    
    if (!isUuid) {
      const { data: driverResult, error: driverError } = await supabase.rpc('get_or_create_driver', {
        p_driver_name: formData.driver_name, 
        p_license_plate: formData.license_plate, 
        p_phone: formData.driver_phone, 
        p_project_id: formData.project_id
      });
      
      if (driverError || !driverResult || driverResult.length === 0) { 
        toast({ title: "错误", description: "处理司机信息失败", variant: "destructive" }); 
        return; 
      }
      finalDriverId = driverResult[0].driver_id;
      finalDriverName = driverResult[0].driver_name;
    }

    await supabase.rpc('get_or_create_location', { 
      p_location_name: formData.loading_location, 
      p_project_id: formData.project_id 
    });
    await supabase.rpc('get_or_create_location', { 
      p_location_name: formData.unloading_location, 
      p_project_id: formData.project_id 
    });

    const recordData = {
      p_project_id: formData.project_id, 
      p_project_name: projectName, 
      p_chain_id: formData.chain_id || null,
      p_driver_id: finalDriverId, 
      p_driver_name: finalDriverName,
      p_loading_location: formData.loading_location, 
      p_unloading_location: formData.unloading_location,
      p_loading_date: parseExcelDate(formData.loading_date),
      p_unloading_date: parseExcelDate(formData.unloading_date) || parseExcelDate(formData.loading_date),
      p_loading_weight: formData.loading_weight ? parseFloat(formData.loading_weight) : null,
      p_unloading_weight: formData.unloading_weight ? parseFloat(formData.unloading_weight) : null,
      p_current_cost: formData.current_cost ? parseFloat(formData.current_cost) : null,
      p_license_plate: formData.license_plate, 
      p_driver_phone: formData.driver_phone,
      p_transport_type: formData.transport_type,
      p_extra_cost: formData.extra_cost ? parseFloat(formData.extra_cost) : null,
      p_remarks: formData.remarks
    };

    try {
      if (editingRecord) {
        await supabase.rpc('update_logistics_record_with_costs', { 
          p_record_id: editingRecord.id, 
          ...recordData 
        });
        toast({ title: "成功", description: "运单记录已更新" });
      } else {
        await supabase.rpc('add_logistics_record_with_costs', recordData);
        toast({ title: "成功", description: "新运单已添加" });
      }
      setIsEditModalOpen(false);
      loadPaginatedRecords();
      loadInitialOptions();
    } catch (error: any) { 
      toast({ title: "操作失败", description: error.message, variant: "destructive" }); 
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await supabase.from('logistics_records').delete().eq('id', id);
      toast({ title: "成功", description: "运单记录已删除" });
      loadPaginatedRecords();
    } catch (error: any) { 
      toast({ title: "删除失败", description: error.message, variant: "destructive" }); 
    }
  };

  // 计算属性
// ====================================================================
//【核心改动】高亮开始
// 原因：这是本次升级最核心的部分。我们为 reduce 函数的初始值，
// 补上了缺失的 `totalExtraCost: 0`，并增加了对 `record.extra_cost` 的累加。
// 这彻底解决了因数据未定义而导致的页面崩溃问题。
// ====================================================================
  const summary = useMemo(() => {
    return (records || []).reduce((acc, record) => {
      acc.totalLoadingWeight += record.loading_weight || 0;
      acc.totalUnloadingWeight += record.unloading_weight || 0;
      acc.totalCurrentCost += record.current_cost || 0;
      acc.totalExtraCost += record.extra_cost || 0; // 【已修复】增加了对 extra_cost 的累加
      acc.totalDriverPayableCost += record.payable_cost || 0;
      if (record.transport_type === '实际运输') acc.actualCount += 1;
      else if (record.transport_type === '退货') acc.returnCount += 1;
      return acc;
    }, {
      totalLoadingWeight: 0,
      totalUnloadingWeight: 0,
      totalCurrentCost: 0,
      totalExtraCost: 0, // 【已修复】为 totalExtraCost 提供了初始值 0
      totalDriverPayableCost: 0,
      actualCount: 0,
      returnCount: 0,
    });
  }, [records]);
// ====================================================================
//【核心改动】高亮结束
// ====================================================================

  // 导出功能
  const exportToExcel = async () => {
    toast({ title: "导出", description: "正在准备导出全部筛选结果..." });
    try {
      const { data, error } = await supabase.rpc('get_paginated_logistics_records', {
        p_page_size: 99999, 
        p_offset: 0,
        p_start_date: filters.startDate || null,
        p_end_date: filters.endDate || null,
        p_search_query: filters.searchQuery || null,
      });
      if (error) throw error;

      const records = (data as any)?.records || [];
      const dataToExport = records.map((r: LogisticsRecord) => ({
        '运单编号': r.auto_number, 
        '项目名称': r.project_name, 
        '合作链路': r.chain_name || '默认',
        '司机姓名': r.driver_name, 
        '车牌号': r.license_plate, 
        '司机电话': r.driver_phone,
        '装货地点': r.loading_location, 
        '卸货地点': r.unloading_location, 
        '装货日期': r.loading_date, 
        '卸货日期': r.unloading_date,
        '运输类型': r.transport_type, 
        '装货重量': r.loading_weight, 
        '卸货重量': r.unloading_weight,
        '运费金额': r.current_cost, 
        '额外费用': r.extra_cost,
        '司机应收': r.payable_cost,
        '备注': r.remarks,
      }));
      
      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "运单记录");
      XLSX.writeFile(wb, "运单记录.xlsx");
      toast({ title: "成功", description: "全部筛选结果已成功导出！" });
    } catch(e) {
      toast({ title: "错误", description: "导出失败，请重试。", variant: "destructive" });
    }
  };

  const handleTemplateDownload = () => {
    const templateData = [{
      '项目名称': '', 
      '合作链路': '', 
      '司机姓名': '', 
      '车牌号': '', 
      '司机电话': '', 
      '装货地点': '', 
      '卸货地点': '', 
      '装货日期': '2025/01/14', // 示例格式
      '卸货日期': '2025/01/14', // 示例格式
      '运输类型': '实际运输', 
      '装货重量': '', 
      '卸货重量': '', 
      '运费金额': '', 
      '额外费用': '', 
      '备注': ''
    }];
    
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "模板");
    XLSX.writeFile(wb, "运单导入模板.xlsx");
  };

  // 导入功能
  const handleExcelImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        // **重要：设置`cellDates: false`，确保我们得到原始的数字或字符串，而不是被时区污染的Date对象**
        const workbook = XLSX.read(data, { type: 'array', cellDates: false });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        // **重要：设置 `raw: false` 可以让库帮我们格式化一些值，但日期我们自己处理**
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: false });

        setIsImportModalOpen(true);
        setImportStep('preprocessing');
        await processDataInChunks(jsonData);

      } catch (error) {
        toast({ 
          title: "错误", 
          description: "文件读取失败，请检查文件格式是否与模板一致。", 
          variant: "destructive" 
        });
      }
    };
    reader.readAsArrayBuffer(file);
    // 重置input，这样可以重复上传同一个文件
    event.target.value = '';
  };

  const processDataInChunks = async (data: any[]) => {
    return new Promise<void>((resolve) => {
      let currentIndex = 0;
      const chunkSize = 50;
      const validRows: any[] = [];
      const invalidRows: any[] = [];
      const uniqueKeys = new Set<string>();
      let duplicateCount = 0;

      const processChunk = () => {
        const chunk = data.slice(currentIndex, currentIndex + chunkSize);
        if (chunk.length === 0) {
          setImportData({ valid: validRows, invalid: invalidRows, duplicateCount });
          setImportStep('preview');
          toast({ title: "完成", description: "文件预处理完成，请确认导入数据。" });
          resolve();
          return;
        }

        for (const row of chunk) {
          const originalIndex = currentIndex;
          const rowData = { ...row, originalRow: originalIndex + 2, error: '' };
          currentIndex++;
          
          try {
            const projectName = rowData['项目名称']?.trim();
            const driverName = rowData['司机姓名']?.trim();
            const loadingLocation = rowData['装货地点']?.trim();
            const unloadingLocation = rowData['卸货地点']?.trim();
            const loadingDateFormatted = parseExcelDate(rowData['装货日期']);
            
            if (!projectName || !driverName || !loadingLocation || !unloadingLocation) {
              throw new Error("缺少必填字段（项目/司机/地点）");
            }
            
            if (!loadingDateFormatted) {
              throw new Error("无效的装货日期格式 (请使用 YYYY-MM-DD 或 YYYY/MM/DD)");
            }

            if (!projects.some(p => p.name === projectName)) {
              throw new Error(`项目 "${projectName}" 不存在`);
            }

            const unloadingDateFormatted = rowData['卸货日期'] ? 
              parseExcelDate(rowData['卸货日期']) : 
              loadingDateFormatted;

            const uniqueKey = [
              projectName,
              driverName,
              loadingLocation,
              unloadingLocation,
              loadingDateFormatted,
              rowData['装货重量'],
              rowData['卸货重量']
            ].join('-');

            if (uniqueKeys.has(uniqueKey)) {
              rowData.error = "重复数据（根据项目、司机、路线和日期判断）";
              duplicateCount++;
              invalidRows.push(rowData);
            } else {
              uniqueKeys.add(uniqueKey);
              validRows.push({
                ...rowData,
                loading_date_parsed: loadingDateFormatted,
                unloading_date_parsed: unloadingDateFormatted
              });
            }
          } catch (err: any) {
            rowData.error = err.message;
            invalidRows.push(rowData);
          }
        }

        setPreprocessingProgress((currentIndex / data.length) * 100);
        setTimeout(processChunk, 0);
      };

      processChunk();
    });
  };

  const startActualImport = async () => {
    setImportStep('processing');
    setImportLogs([]);

    const addLog = (message: string) => 
      setImportLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);

    addLog(`开始批量导入... 共 ${importData.valid.length} 条有效记录。`);

    try {
      const batchRecords = importData.valid.map(rowData => ({
        project_name: rowData['项目名称']?.trim(),
        chain_name: rowData['合作链路']?.trim() || null,
        driver_name: rowData['司机姓名']?.trim(),
        license_plate: rowData['车牌号']?.toString().trim() || null,
        driver_phone: rowData['司机电话']?.toString().trim() || null,
        loading_location: rowData['装货地点']?.trim(),
        unloading_location: rowData['卸货地点']?.trim(),
        loading_date: rowData.loading_date_parsed,
        unloading_date: rowData.unloading_date_parsed,
        loading_weight: rowData['装货重量'] ? parseFloat(rowData['装货重量']).toString() : null,
        unloading_weight: rowData['卸货重量'] ? parseFloat(rowData['卸货重量']).toString() : null,
        current_cost: rowData['运费金额'] ? parseFloat(rowData['运费金额']).toString() : '0',
        extra_cost: rowData['额外费用'] ? parseFloat(rowData['额外费用']).toString() : '0',
        transport_type: rowData['运输类型']?.trim() || '实际运输',
        remarks: rowData['备注']?.toString().trim() || null
      }));

      addLog('准备批量导入数据...');
      const { data: result, error: batchError } = await supabase.rpc('batch_import_logistics_records', {
        p_records: batchRecords
      });

      if (batchError) throw batchError;

      const successCount = (result as any).success_count || 0;
      const errorCount = (result as any).error_count || 0;
      const errors = (result as any).errors || [];

      addLog(`批量导入完成: 成功 ${successCount} 条，失败 ${errorCount} 条`);
      if (errorCount > 0) {
        addLog(`错误详情: ${JSON.stringify(errors.slice(0, 5))}`);
      }

      addLog(`--------------------`);
      addLog(`批量导入流程已完成！`);
      addLog(`成功: ${successCount}条, 失败: ${errorCount}条。`);

      if (successCount > 0) {
        toast({ 
          title: "成功", 
          description: `批量导入成功 ${successCount} 条运单记录！` 
        });
        loadPaginatedRecords();
      }
      if (errorCount > 0) {
        toast({ 
          title: "注意", 
          description: `有 ${errorCount} 条记录导入失败，详情请查看导入日志。`,
          variant: "destructive" 
        });
      }

    } catch (error: any) {
      addLog(`批量导入发生错误: ${error.message}`);
      toast({ 
        title: "错误", 
        description: `批量导入失败: ${error.message}`, 
        variant: "destructive" 
      });
    }
  };

  const closeImportModal = () => {
    setIsImportModalOpen(false);
    setImportStep('idle');
    setImportData({ valid: [], invalid: [], duplicateCount: 0 });
    setPreprocessingProgress(0);
    setImportLogs([]);
  }

  // Helper functions for the new component structure
  const handleFiltersChange = (newFilters: typeof filters) => {
    setFilters(newFilters);
  };

  const handleViewDetails = (record: LogisticsRecord) => {
    setViewingRecord(record);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleFileUpload = (file: File) => {
    handleExcelImport({ target: { files: [file] } } as any);
  };

  // UI渲染
  return (
    <div className="space-y-6">
      <BusinessEntryHeader
        onAddNew={() => handleOpenModal()}
        onImport={() => setIsImportModalOpen(true)}
        onExport={exportToExcel}
        onTemplateDownload={handleTemplateDownload}
      />

      <BusinessEntryFilters
        filters={filters}
        onFiltersChange={handleFiltersChange}
      />

      <BusinessEntryTable
        records={records}
        loading={loading}
        onEdit={handleOpenModal}
        onDelete={handleDelete}
        onViewDetails={handleViewDetails}
      />

      <BusinessEntryPagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={handlePageChange}
      />

      <BusinessEntrySummary summary={summary} />

      <BusinessEntryEditModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSubmit={handleSubmit}
        formData={formData}
        onInputChange={handleInputChange}
        projects={projects}
        filteredDrivers={filteredDrivers}
        filteredLocations={filteredLocations}
        partnerChains={partnerChains}
        editingRecord={editingRecord}
        viewingRecord={viewingRecord}
      />
      
      {/* 查看详情弹窗 */}
      <Dialog open={!!viewingRecord} onOpenChange={(isOpen) => !isOpen && setViewingRecord(null)}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>运单详情 (编号: {viewingRecord?.auto_number})</DialogTitle>
          </DialogHeader>
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

              <div className="space-y-1"><Label className="text-muted-foreground">运费金额</Label><p className="font-mono">{viewingRecord.current_cost != null ? `¥${viewingRecord.current_cost.toFixed(2)}` : '-'}</p></div>
              <div className="space-y-1"><Label className="text-muted-foreground">额外费用</Label><p className="font-mono text-orange-600">{viewingRecord.extra_cost != null ? `¥${viewingRecord.extra_cost.toFixed(2)}` : '-'}</p></div>
              <div className="space-y-1 col-span-2"><Label className="text-muted-foreground">司机应收</Label><p className="font-mono font-bold text-primary">{viewingRecord.payable_cost != null ? `¥${viewingRecord.payable_cost.toFixed(2)}` : '-'}</p></div>
              
              <div className="col-span-4 space-y-1"><Label className="text-muted-foreground">备注</Label><p className="min-h-[40px] whitespace-pre-wrap">{viewingRecord.remarks || '无'}</p></div>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setViewingRecord(null)}>关闭</Button>
            <Button onClick={() => { if (viewingRecord) { handleOpenModal(viewingRecord); setViewingRecord(null); } }}>编辑此记录</Button>
          </div>
        </DialogContent>
      </Dialog>
      
      <BusinessEntryImportModal
        isOpen={isImportModalOpen}
        onClose={closeImportModal}
        importStep={importStep}
        preprocessingProgress={preprocessingProgress}
        importData={importData}
        importLogs={importLogs}
        importLogRef={importLogRef}
        onFileUpload={handleFileUpload}
        onStartImport={startActualImport}
        isImporting={isImporting}
      />
    </div>
  );
}
