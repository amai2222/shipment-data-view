// FILE: /src/pages/business-entry/columns.tsx

"use client"
import { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BusinessData } from "@/types";

interface ColumnsProps {
  onEdit: (data: BusinessData) => void;
  onDelete: (id: string) => void;
}

export const columns = ({ onEdit, onDelete }: ColumnsProps): ColumnDef<BusinessData>[] => [
  {
    accessorKey: "date",
    header: "日期",
  },
  {
    // 重要：这个ID必须和BusinessEntry.tsx里的快速搜索框对应
    id: "projects_name", 
    accessorKey: "projects_name",
    header: "项目名称",
  },
  {
    accessorKey: "drivers_name",
    header: "司机",
  },
  {
    accessorKey: "loading_location_name",
    header: "装货地",
  },
  {
    accessorKey: "unloading_location_name",
    header: "卸货地",
  },
  {
    accessorKey: "goods_name",
    header: "货物名称",
  },
  {
    accessorKey: "unit_price",
    header: "单价",
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue("unit_price"));
      const formatted = new Intl.NumberFormat("zh-CN", {
        style: "currency",
        currency: "CNY",
      }).format(amount);
      return <div className="text-right font-medium">{formatted}</div>;
    },
  },
  {
    accessorKey: "freight_cost",
    header: "运费",
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue("freight_cost"));
      const formatted = new Intl.NumberFormat("zh-CN", {
        style: "currency",
        currency: "CNY",
      }).format(amount);
      return <div className="text-right font-medium">{formatted}</div>;
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const entry = row.original;
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>操作</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => onEdit(entry)}>
              编辑
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-red-600"
              onClick={() => onDelete(entry.id)}
            >
              删除
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
