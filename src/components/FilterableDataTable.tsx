import React, { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search } from "lucide-react";

interface FilterableDataTableProps {
  title: string;
  data: any[];
  columns: {
    key: string;
    title: string;
    render?: (value: any, row: any) => React.ReactNode;
  }[];
  actions?: (row: any) => React.ReactNode;
  searchKeys: string[];
}

export function FilterableDataTable({ 
  title, 
  data, 
  columns, 
  actions, 
  searchKeys 
}: FilterableDataTableProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return data;
    
    const query = searchQuery.toLowerCase();
    return data.filter(row => 
      searchKeys.some(key => {
        const value = key.split('.').reduce((obj, k) => obj?.[k], row);
        return value?.toString().toLowerCase().includes(query);
      })
    );
  }, [data, searchQuery, searchKeys]);

  return (
    <Card className="shadow-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{title} ({filteredData.length} / {data.length})</CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="搜索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((column) => (
                  <TableHead key={column.key}>{column.title}</TableHead>
                ))}
                {actions && <TableHead>操作</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.map((row, index) => (
                <TableRow key={row.id || index}>
                  {columns.map((column) => (
                    <TableCell key={column.key}>
                      {column.render 
                        ? column.render(
                            column.key.split('.').reduce((obj, k) => obj?.[k], row), 
                            row
                          )
                        : column.key.split('.').reduce((obj, k) => obj?.[k], row)
                      }
                    </TableCell>
                  ))}
                  {actions && (
                    <TableCell>
                      {actions(row)}
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {filteredData.length === 0 && (
                <TableRow>
                  <TableCell 
                    colSpan={columns.length + (actions ? 1 : 0)} 
                    className="text-center text-muted-foreground py-8"
                  >
                    {searchQuery ? "未找到匹配的数据" : "暂无数据"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}