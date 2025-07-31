// 在 src/components/columns.ts

import { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, MoreHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogisticsRecord } from "../types"; // 从我们创建的 types.ts 导入类型

// 定义操作列，这是一个非常通用的设计模式
const ActionCell: ColumnDef<LogisticsRecord>["cell"] = ({ row }) => {
  const record = row.original;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0">
          <span className="sr-only">打开菜单</span>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>操作</DropdownMenuLabel>
        <DropdownMenuItem
          onClick={() => navigator.clipboard.writeText(record.id)}
        >
          复制运单ID
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem>查看详情</DropdownMenuItem>
        <DropdownMenuItem>编辑运单</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

// 定义表格的所有列
export const columns: ColumnDef<LogisticsRecord>[] = [
  // 注意：在需求 D 中，我们需要为财务页面添加复选框
  // 但运单管理页面 A 中未提及，因此暂时不加。
  // 我们后续可以轻松地在这里添加。

  {
    accessorKey: "project_name",
    header: "项目",
  },
  {
    accessorKey: "license_plate",
    header: "车牌号",
  },
  {
    accessorKey: "driver_name",
    header: "司机",
  },
  {
    accessorKey: "driver_phone",
    header: "司机电话",
  },
  {
    accessorKey: "transport_type",
    header: "运输类型"
  },
  {
    accessorKey: "loading_date",
    // 我们为表头添加排序功能，这是一个很好的用户体验提升
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          装货日期
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    // 对单元格内容进行格式化
    cell: ({ row }) => {
      const date = new Date(row.getValue("loading_date"));
      // 格式化为 YYYY-MM-DD
      return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
    },
  },
  {
    accessorKey: "loading_location",
    header: "装货地点",
  },
  {
    accessorKey: "unloading_location",
    header: "卸货地点",
  },
  {
    accessorKey: "payable_cost",
    // 同样为金额添加排序功能
    header: ({ column }) => {
      return(
        <div className="text-right">
             <Button
                variant="ghost"
                onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                >
                应付成本
                <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
        </div>
      )
    },
    // 对金额进行货币格式化
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue("payable_cost"));
      const formatted = new Intl.NumberFormat("zh-CN", {
        style: "currency",
        currency: "CNY",
      }).format(amount);

      return <div className="text-right font-medium">{formatted}</div>;
    },
  },
  {
    id: "actions",
    // 使用我们上面定义的 ActionCell
    cell: ActionCell,
    // 因为这列没有对应的数据字段，所以要禁用排序和隐藏
    enableSorting: false,
    enableHiding: false,
  },
];
