// 文件路径: src/pages/BusinessEntry.tsx
import { useState, useEffect, useMemo, useCallback } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Download, FileDown, FileUp, PlusCircle, Edit, Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from 'xlsx';
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CreatableCombobox } from "@/components/CreatableCombobox";

// ... 类型定义 ...
// ... BLANK_FORM_DATA ...

export default function BusinessEntry() {
  const [records, setRecords] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [partnerChains, setPartnerChains] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any | null>(null);
  const [viewingRecord, setViewingRecord] = useState<any | null>(null);
  
  const [formData, setFormData] = useState<any>(BLANK_FORM_DATA);
  const [filters, setFilters] = useState({ startDate: "", endDate: "", searchQuery: "" });
  
  const [filteredDrivers, setFilteredDrivers] = useState<any[]>([]);
  const [filteredLocations, setFilteredLocations] = useState<any[]>([]);
  
  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const PAGE_SIZE = 15; // 每页显示15条记录

  const loadInitialOptions = useCallback(async () => {
    // ... 此函数只加载项目、司机、地点等，保持不变
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
      setRecords(data.records || []);
      setTotalPages(Math.ceil(data.total_count / PAGE_SIZE));
    } catch (error) {
      toast({ title: "错误", description: "加载运单记录失败", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [currentPage, filters, toast]);

  useEffect(() => {
    loadInitialOptions();
  }, [loadInitialOptions]);

  useEffect(() => {
    loadPaginatedRecords();
  }, [loadPaginatedRecords]);

  // 当筛选条件变化时，重置到第一页
  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  // ... 其他所有 handle 和 useEffect 逻辑保持不变 ...

  return (
    <div className="space-y-4">
      {/* ... 页面标题和按钮 */}
      {/* ... 筛选区域 */}

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>运单编号</TableHead><TableHead>项目</TableHead><TableHead>合作链路</TableHead><TableHead>司机</TableHead><TableHead>路线</TableHead><TableHead>装货日期</TableHead><TableHead>运费</TableHead><TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? <TableRow><TableCell colSpan={8} className="text-center h-24"><Loader2 className="h-6 w-6 animate-spin"/></TableCell></TableRow> 
            : records.length === 0 ? <TableRow><TableCell colSpan={8} className="text-center">没有找到匹配的记录</TableCell></TableRow>
            : records.map((record) => (
              <TableRow key={record.id} onClick={() => setViewingRecord(record)} className="cursor-pointer">
                {/* ... 表格行内容 */}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* 分页组件 */}
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <Button variant="outline" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>上一页</Button>
          </PaginationItem>
          <PaginationItem>
            <span className="p-2 text-sm">第 {currentPage} 页 / 共 {totalPages} 页</span>
          </PaginationItem>
          <PaginationItem>
            <Button variant="outline" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>下一页</Button>
          </PaginationItem>
        </PaginationContent>
      </Pagination>

      {/* ... 数据汇总栏 */}
      {/* ... 所有弹窗 */}
    </div>
  );
}
