import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

interface FilterableDataTableProps<T> {
  data: T[];
  searchFields: (keyof T)[];
  renderRow: (item: T, index: number) => React.ReactNode;
  placeholder?: string;
}

export function FilterableDataTable<T>({
  data,
  searchFields,
  renderRow,
  placeholder = "搜索..."
}: FilterableDataTableProps<T>) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredData = React.useMemo(() => {
    if (!searchQuery.trim()) return data;
    
    return data.filter(item => 
      searchFields.some(field => {
        const value = item[field];
        if (typeof value === 'string') {
          return value.toLowerCase().includes(searchQuery.toLowerCase());
        }
        if (typeof value === 'number') {
          return value.toString().includes(searchQuery);
        }
        return false;
      })
    );
  }, [data, searchFields, searchQuery]);

  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={placeholder}
          className="pl-10"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>
      
      <div className="space-y-2">
        {filteredData.map((item, index) => renderRow(item, index))}
        {filteredData.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            {searchQuery ? "未找到匹配的结果" : "暂无数据"}
          </div>
        )}
      </div>
    </div>
  );
}