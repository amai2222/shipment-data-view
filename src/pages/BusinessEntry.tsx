import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Pencil, Search, Calendar, Filter, Upload, Package, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { LogisticsRecord, Driver, Location, Project, Partner } from "@/types";
import { ConfirmDialog } from "@/components/ConfirmDialog";

const PAGE_SIZE = 20;

interface Filters {
  startDate: string;
  endDate: string;
  projectIds: string[];
  driverIds: string[];
  loadingLocationIds: string[];
  unloadingLocationIds: string[];
}

export default function BusinessEntry() {
  const [records, setRecords] = useState<LogisticsRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  const [filters, setFilters] = useState<Filters>({
    startDate: "",
    endDate: "",
    projectIds: [],
    driverIds: [],
    loadingLocationIds: [],
    unloadingLocationIds: [],
  });
  
  // Options for filters
  const [projects, setProjects] = useState<Project[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  
  const { toast } = useToast();
  const navigate = useNavigate();

  // Load filter options
  const loadFilterOptions = useCallback(async () => {
    try {
      const [projectsData, driversData, locationsData] = await Promise.all([
        supabase.from('projects').select('*').order('name'),
        supabase.from('drivers').select('*').order('name'),
        supabase.from('locations').select('*').order('name')
      ]);
      
      if (projectsData.data) setProjects(projectsData.data.map((p: any) => ({
        ...p,
        startDate: p.start_date,
        endDate: p.end_date,
        loadingAddress: p.loading_address,
        unloadingAddress: p.unloading_address,
        createdAt: p.created_at
      })));
      if (driversData.data) setDrivers(driversData.data.map((d: any) => ({
        ...d,
        licensePlate: d.license_plate,
        createdAt: d.created_at
      })));
      if (locationsData.data) setLocations(locationsData.data.map((l: any) => ({
        ...l,
        createdAt: l.created_at
      })));
    } catch (error) {
      console.error('Error loading filter options:', error);
    }
  }, []);

  // Fetch records with filters
  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const offset = (currentPage - 1) * PAGE_SIZE;
      const { data, error } = await supabase.rpc('get_paginated_logistics_records', {
        p_page_size: PAGE_SIZE,
        p_offset: offset,
        p_start_date: filters.startDate || null,
        p_end_date: filters.endDate || null,
        p_search_query: null, // Removed general search query
      });
      if (error) throw error;
      const result = (data as unknown) as { records: LogisticsRecord[], total_count: number };
      setRecords(result?.records || []);
      setTotalPages(Math.ceil((result?.total_count || 0) / PAGE_SIZE) || 1);

    } catch (error) {
      toast({ title: "错误", description: "加载运单记录失败", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [currentPage, filters, toast]);

  useEffect(() => {
    loadFilterOptions();
  }, [loadFilterOptions]);

  // Manual query trigger
  const handleSearch = () => {
    setCurrentPage(1);
    fetchRecords();
  };

  const handleEdit = (record: LogisticsRecord) => {
    // Navigate to edit page or open modal
    console.log('Edit record:', record);
  };

  const handleDelete = async (id: string) => {
    try {
      await supabase.from('logistics_records').delete().eq('id', id);
      toast({ title: "成功", description: "运单记录已删除" });
      fetchRecords();
    } catch (error: any) {
      toast({ title: "删除失败", description: error.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">运单管理</h1>
          <p className="text-muted-foreground">查询和管理所有运单记录</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => navigate('/data-import')}>
            <Upload className="mr-2 h-4 w-4" />
            导入数据
          </Button>
          <Button onClick={() => navigate('/business-entry/new')}>
            <Package className="mr-2 h-4 w-4" />
            新增运单
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            高级筛选
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Project Filter */}
            <div>
              <label className="text-sm font-medium mb-2 block">项目</label>
              <Select
                value={filters.projectIds.length === 1 ? filters.projectIds[0] : ""}
                onValueChange={(value) => {
                  if (value === "all") {
                    setFilters(prev => ({ ...prev, projectIds: [] }));
                  } else {
                    setFilters(prev => ({ ...prev, projectIds: [value] }));
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择项目" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部项目</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Driver Filter */}
            <div>
              <label className="text-sm font-medium mb-2 block">司机</label>
              <Select
                value={filters.driverIds.length === 1 ? filters.driverIds[0] : ""}
                onValueChange={(value) => {
                  if (value === "all") {
                    setFilters(prev => ({ ...prev, driverIds: [] }));
                  } else {
                    setFilters(prev => ({ ...prev, driverIds: [value] }));
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择司机" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部司机</SelectItem>
                  {drivers.map((driver) => (
                    <SelectItem key={driver.id} value={driver.id}>
                      {driver.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Loading Location Filter */}
            <div>
              <label className="text-sm font-medium mb-2 block">装货地点</label>
              <Select
                value={filters.loadingLocationIds.length === 1 ? filters.loadingLocationIds[0] : ""}
                onValueChange={(value) => {
                  if (value === "all") {
                    setFilters(prev => ({ ...prev, loadingLocationIds: [] }));
                  } else {
                    setFilters(prev => ({ ...prev, loadingLocationIds: [value] }));
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择装货地点" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部地点</SelectItem>
                  {locations.map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Unloading Location Filter */}
            <div>
              <label className="text-sm font-medium mb-2 block">卸货地点</label>
              <Select
                value={filters.unloadingLocationIds.length === 1 ? filters.unloadingLocationIds[0] : ""}
                onValueChange={(value) => {
                  if (value === "all") {
                    setFilters(prev => ({ ...prev, unloadingLocationIds: [] }));
                  } else {
                    setFilters(prev => ({ ...prev, unloadingLocationIds: [value] }));
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择卸货地点" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部地点</SelectItem>
                  {locations.map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <DateRangePicker
                date={{
                  from: filters.startDate ? new Date(filters.startDate) : undefined,
                  to: filters.endDate ? new Date(filters.endDate) : undefined
                }}
                onDateChange={(range) => setFilters(prev => ({
                  ...prev,
                  startDate: range?.from ? format(range.from, 'yyyy-MM-dd') : "",
                  endDate: range?.to ? format(range.to, 'yyyy-MM-dd') : "",
                }))}
              />
              <Button onClick={handleSearch} className="flex items-center gap-2">
                <Search className="h-4 w-4" />
                查询
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setFilters({
                  startDate: "",
                  endDate: "",
                  projectIds: [],
                  driverIds: [],
                  loadingLocationIds: [],
                  unloadingLocationIds: [],
                })}
              >
                清除筛选
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b">
                <tr>
                  <th className="text-left p-4">运单编号</th>
                  <th className="text-left p-4">项目</th>
                  <th className="text-left p-4">司机</th>
                  <th className="text-left p-4">路线</th>
                  <th className="text-left p-4">装货日期</th>
                  <th className="text-left p-4">运费</th>
                  <th className="text-right p-4">操作</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="text-center p-8">
                      加载中...
                    </td>
                  </tr>
                ) : records.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center p-8">
                      暂无数据
                    </td>
                  </tr>
                ) : (
                  records.map((record) => (
                    <tr key={record.id} className="border-b hover:bg-muted/50">
                      <td className="p-4 font-mono">{record.autoNumber}</td>
                      <td className="p-4">{record.projectName}</td>
                      <td className="p-4">{record.driverName}</td>
                      <td className="p-4">{record.loadingLocation} → {record.unloadingLocation}</td>
                      <td className="p-4">{record.loadingDate}</td>
                      <td className="p-4 font-mono">
                        -
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center gap-2 justify-end">
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(record)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-destructive"
                            onClick={() => handleDelete(record.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          第 {currentPage} 页 / 共 {totalPages} 页
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
          >
            上一页
          </Button>
          <Button
            variant="outline"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
          >
            下一页
          </Button>
        </div>
      </div>
    </div>
  );
}