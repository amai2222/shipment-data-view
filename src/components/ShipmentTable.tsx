// 完全替换 src/components/ShipmentTable.tsx 的内容

import { useState, useMemo, useEffect } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Autocomplete,
  Box,
  CircularProgress,
  TextField,
} from "@mui/material";

// 导入我们的新类型
import { LogisticsRecord, Project, Driver, Location } from "../types";
// 假数据，您需要替换为从API获取的数据
import { makeData } from "../makeData"; 

interface ShipmentTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
}

// --- 模拟API数据 ---
// 在实际应用中，您应该从后端API获取这些选项
const mockProjects: Project[] = [
  { id: "proj-1", name: "华南地区运输项目" },
  { id: "proj-2", name: "华东紧急物资配送" },
];
const mockDrivers: Driver[] = [
  { id: "driver-1", name: "张师傅" },
  { id: "driver-2", name: "李师傅" },
];
const mockLocations: Location[] = [
  { id: "loc-1", name: "上海仓库" },
  { id: "loc-2", name: "广州南沙港" },
  { id: "loc-3", name: "深圳盐田港" },
];
// --------------------

export function ShipmentTable<TData extends LogisticsRecord, TValue>({
  columns,
}: ShipmentTableProps<TData, TValue>) {

  // --- 状态管理 ---
  const [data, setData] = useState<TData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 筛选器状态
  const [selectedProjects, setSelectedProjects] = useState<Project[]>([]);
  const [selectedDrivers, setSelectedDrivers] = useState<Driver[]>([]);
  const [loadingLocationInput, setLoadingLocationInput] = useState("");
  const [unloadingLocationInput, setUnloadingLocationInput] = useState("");

  // --- 数据获取 ---
  // 模拟的查询函数，您需要替换为真实的API调用
  const fetchShipmentData = async () => {
    setIsLoading(true);
    console.log("开始查询数据，筛选条件:", {
      projects: selectedProjects.map(p => p.id),
      drivers: selectedDrivers.map(d => d.id),
      loadingLocation: loadingLocationInput,
      unloadingLocation: unloadingLocationInput,
    });
    // 模拟网络延迟
    await new Promise(resolve => setTimeout(resolve, 1000));
    // 使用假数据，并转换为正确的类型
    const fetchedData = makeData(50) as TData[]; 
    setData(fetchedData);
    setIsLoading(false);
  };
  
  // 首次加载
  useEffect(() => {
    fetchShipmentData();
  }, [])

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const totalPayableCost = useMemo(() => {
    return table.getRowModel().rows.reduce(
        (total, row) => total + row.original.payable_cost, 0
    );
  }, [table.getRowModel().rows]);

  return (
    <div className="space-y-4">
      {/* --- 新的复合筛选器 --- */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "repeat(4, 1fr) auto" },
          gap: 2,
          alignItems: "center",
          padding: 2,
          border: '1px solid #e0e0e0',
          borderRadius: '8px'
        }}
      >
        <Autocomplete
          multiple
          options={mockProjects}
          getOptionLabel={(option) => option.name}
          onChange={(_, newValue) => setSelectedProjects(newValue)}
          renderInput={(params) => <TextField {...params} label="项目" size="small" />}
        />
        <Autocomplete
          multiple
          freeSolo
          options={mockDrivers}
          getOptionLabel={(option) => typeof option === 'string' ? option : option.name}
          onChange={(_, newValue) => setSelectedDrivers(newValue as Driver[])}
          renderInput={(params) => <TextField {...params} label="司机" size="small" />}
        />
        <TextField 
          label="装货地点" 
          size="small"
          value={loadingLocationInput}
          onChange={(e) => setLoadingLocationInput(e.target.value)}
        />
        <TextField
          label="卸货地点"
          size="small"
          value={unloadingLocationInput}
          onChange={(e) => setUnloadingLocationInput(e.target.value)}
        />
        <Button onClick={fetchShipmentData} disabled={isLoading}>
            {isLoading ? <CircularProgress size={20} color="inherit" /> : "查询"}
        </Button>
      </Box>

      {/* --- 表格主体 --- */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  {isLoading ? '正在加载数据...' : '无结果.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
          {/* --- 新的合计行 --- */}
          <TableFooter>
            <TableRow>
                <TableCell colSpan={columns.length - 2} className="font-bold">
                    合计
                </TableCell>
                <TableCell className="font-bold">
                    总条数: {table.getRowModel().rows.length}
                </TableCell>
                <TableCell className="text-right font-bold">
                     {new Intl.NumberFormat("zh-CN", {
                        style: "currency",
                        currency: "CNY",
                    }).format(totalPayableCost)}
                </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
      
      {/* --- 分页控制 --- */}
      <div className="flex items-center justify-end space-x-2 py-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          上一页
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          下一页
        </Button>
      </div>
    </div>
  );
}
