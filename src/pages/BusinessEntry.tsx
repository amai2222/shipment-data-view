// FILE: /src/pages/BusinessEntry.tsx

import { useEffect, useState } from "react";
import { DateRange } from "react-day-picker";
import { subDays, format } from "date-fns";
import {
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateRangePicker } from "@/components/DateRangePicker";
import { DataTable } from "./business-entry/data-table";
import { columns } from "./business-entry/columns";
import { EntryDialog } from "./business-entry/EntryDialog";
import { MultiSelectCombobox, OptionType } from "@/components/MultiSelectCombobox";
import { getBusinessData, deleteBusinessEntry } from "@/integrations/supabase/api";
import { supabase } from "@/integrations/supabase/client";
import { BusinessData } from "@/types";

export default function BusinessEntry() {
  const { toast } = useToast();

  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState({});
  const [data, setData] = useState<BusinessData[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<"new" | "edit">("new");
  const [selectedRowData, setSelectedRowData] = useState<BusinessData | undefined>(undefined);
  
  const [date, setDate] = useState<DateRange | undefined>({
    from: subDays(new Date(), 29),
    to: new Date(),
  });
  const [projectOptions, setProjectOptions] = useState<OptionType[]>([]);
  const [driverOptions, setDriverOptions] = useState<OptionType[]>([]);
  const [locationOptions, setLocationOptions] = useState<OptionType[]>([]);
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [selectedDrivers, setSelectedDrivers] = useState<string[]>([]);
  const [selectedLoadingLocations, setSelectedLoadingLocations] = useState<string[]>([]);
  const [selectedUnloadingLocations, setSelectedUnloadingLocations] = useState<string[]>([]);

  const fetchData = async () => {
    if (!date?.from || !date?.to) {
      toast({ title: "错误", description: "请选择一个有效的日期范围。", variant: "destructive" });
      return;
    }
    setLoading(true);
    setColumnFilters([]);
    try {
      const formattedFrom = format(date.from, "yyyy-MM-dd");
      const formattedTo = format(date.to, "yyyy-MM-dd");
      const result = await getBusinessData({
        from: formattedFrom, to: formattedTo,
        projectIds: selectedProjects, driverIds: selectedDrivers,
        loadingLocationIds: selectedLoadingLocations, unloadingLocationIds: selectedUnloadingLocations,
      });
      setData(result);
    } catch (error) {
      console.error("查询数据失败:", error);
      toast({ title: "查询失败", description: "获取运单数据时发生错误。", variant: "destructive" });
      setData([]);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    const fetchInitialData = async () => {
        setLoading(true);
        try {
            await Promise.all([
                (async () => {
                    const { data, error } = await supabase.from("projects").select("id, name");
                    if (error) throw error;
                    setProjectOptions(data.map(p => ({ value: p.id.toString(), label: p.name })));
                })(),
                (async () => {
                    const { data, error } = await supabase.from("drivers").select("id, name");
                    if (error) throw error;
                    setDriverOptions(data.map(d => ({ value: d.id.toString(), label: d.name })));
                })(),
                (async () => {
                    const { data, error } = await supabase.from("locations").select("id, name");
                    if (error) throw error;
                    setLocationOptions(data.map(l => ({ value: l.id.toString(), label: l.name })));
                })(),
            ]);
            await fetchData();
        } catch (error) {
            toast({ title: "初始化失败", description: "加载页面筛选器选项时出错。", variant: "destructive" })
            setLoading(false);
        }
    };
    fetchInitialData();
  }, []);

  const handleNew = () => {
    setDialogType("new");
    setSelectedRowData(undefined);
    setDialogOpen(true);
  };

  const handleEdit = (rowData: BusinessData) => {
    setDialogType("edit");
    setSelectedRowData(rowData);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("确定要删除这条记录吗？此操作不可撤销。")) return;
    try {
      await deleteBusinessEntry(id);
      toast({ title: "成功", description: "记录已删除。" });
      await fetchData();
    } catch (error) {
      toast({ title: "删除失败", description: (error as Error).message, variant: "destructive" });
    }
  };
  
  const handleDialogSuccess = async () => {
    setDialogOpen(false);
    await fetchData();
  };
  
  const handleResetFilters = () => {
    setDate({ from: subDays(new Date(), 29), to: new Date() });
    setSelectedProjects([]);
    setSelectedDrivers([]);
    setSelectedLoadingLocations([]);
    setSelectedUnloadingLocations([]);
  };
  
  const table = useReactTable({
    data,
    columns: columns({ onEdit: handleEdit, onDelete: handleDelete }),
    state: { sorting, columnFilters, columnVisibility, rowSelection },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableRowSelection: true,
  });

  return (
    <>
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        <div className="flex items-center justify-between space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">运单管理</h2>
          <div className="flex items-center space-x-2">
            <Button onClick={handleNew}>新建运单</Button>
          </div>
        </div>

        <div className="flex flex-col gap-4 p-4 border rounded-lg bg-card text-card-foreground shadow-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                <DateRangePicker date={date} onDateChange={setDate} className="w-full" />
                <MultiSelectCombobox options={projectOptions} selected={selectedProjects} onChange={setSelectedProjects} placeholder="筛选项目" className="w-full" />
                <MultiSelectCombobox options={driverOptions} selected={selectedDrivers} onChange={setSelectedDrivers} placeholder="筛选司机" className="w-full" />
                <MultiSelectCombobox options={locationOptions} selected={selectedLoadingLocations} onChange={setSelectedLoadingLocations} placeholder="筛选装货地" className="w-full" />
                <MultiSelectCombobox options={locationOptions} selected={selectedUnloadingLocations} onChange={setSelectedUnloadingLocations} placeholder="筛选卸货地" className="w-full" />
            </div>
            <div className="flex items-center justify-end gap-2">
                <Button onClick={fetchData} disabled={loading}>
                  {loading ? '查询中...' : '查询'}
                </Button>
                <Button variant="outline" onClick={handleResetFilters} disabled={loading}>
                  重置
                </Button>
            </div>
        </div>
        
        <div className="flex items-center justify-between">
            <div className="flex flex-1 items-center space-x-2">
                <Input
                    placeholder="在当前结果中搜索项目..."
                    value={(table.getColumn("projects_name")?.getFilterValue() as string) ?? ""}
                    onChange={(event) =>
                        table.getColumn("projects_name")?.setFilterValue(event.target.value)
                    }
                    className="h-9 w-[150px] lg:w-[250px]"
                />
            </div>
            <DataTable.Toolbar table={table} />
        </div>

        <div className="rounded-md border">
            <DataTable table={table} columns={columns({ onEdit: handleEdit, onDelete: handleDelete })} loading={loading} />
        </div>

        <DataTable.Pagination table={table} />
      </div>

      <EntryDialog
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        dialogType={dialogType}
        initialData={selectedRowData}
        onSuccess={handleDialogSuccess}
      />
    </>
  );
}
