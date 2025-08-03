// src/components/AsyncCreatableCombobox.tsx

import * as React from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useDebounce } from "@/hooks/use-debounce"; // 假设你有一个use-debounce钩子

export interface Option { value: string; label: string; [key: string]: any; }

interface AsyncCreatableComboboxProps {
  value: string;
  onValueChange: (option: Option | null, rawValue: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyResultText?: string;
  tableName: 'drivers' | 'locations';
  searchColumn: string;
}

export function AsyncCreatableCombobox({
  value, onValueChange, placeholder = "Select an option...", searchPlaceholder = "Search...",
  emptyResultText = "No results found.", tableName, searchColumn
}: AsyncCreatableComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [options, setOptions] = React.useState<Option[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [selectedOption, setSelectedOption] = React.useState<Option | null>(null);

  React.useEffect(() => {
    if (debouncedSearchTerm) {
      setIsLoading(true);
      const fetchOptions = async () => {
        const { data, error } = await supabase
          .from(tableName)
          .select(`id, ${searchColumn}, license_plate, phone`) // 额外获取司机信息
          .ilike(searchColumn, `%${debouncedSearchTerm}%`)
          .limit(10);
        
        if (error) {
          console.error("Error fetching options:", error);
          setOptions([]);
        } else {
          const formattedOptions = data.map(item => ({
            value: item.id,
            label: tableName === 'drivers' ? `${item[searchColumn]} (${item.license_plate || '无车牌'})` : item[searchColumn],
            ...item // 附加所有数据
          }));
          setOptions(formattedOptions);
        }
        setIsLoading(false);
      };
      fetchOptions();
    } else {
      setOptions([]);
    }
  }, [debouncedSearchTerm, tableName, searchColumn]);

  const handleSelect = (currentValue: string) => {
    const option = options.find(opt => opt.value === currentValue);
    setSelectedOption(option || null);
    onValueChange(option || null, option ? option.label : '');
    setOpen(false);
    setSearchTerm("");
  };

  const handleInputChange = (search: string) => {
    setSearchTerm(search);
    // 如果用户直接输入，我们认为这是一个新值
    if (!options.some(opt => opt.label === search)) {
      setSelectedOption(null);
      onValueChange(null, search);
    }
  };

  const displayValue = selectedOption ? selectedOption.label : value;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between">
          <span className="truncate">{displayValue || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={searchPlaceholder}
            value={searchTerm}
            onValueChange={handleInputChange}
          />
          <CommandEmpty>
            {isLoading ? (
              <div className="flex items-center justify-center p-2">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : (
              <div className="p-2 text-sm">{emptyResultText}</div>
            )}
          </CommandEmpty>
          <CommandGroup>
            {options.map((option) => (
              <CommandItem
                key={option.value}
                value={option.value}
                onSelect={handleSelect}
              >
                <Check className={cn("mr-2 h-4 w-4", value === option.value ? "opacity-100" : "opacity-0")} />
                {option.label}
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// 你需要一个 useDebounce 钩子, 如果没有，可以创建一个
// src/hooks/use-debounce.ts
// import { useState, useEffect } from 'react';
// export function useDebounce<T>(value: T, delay: number): T {
//   const [debouncedValue, setDebouncedValue] = useState<T>(value);
//   useEffect(() => {
//     const handler = setTimeout(() => {
//       setDebouncedValue(value);
//     }, delay);
//     return () => {
//       clearTimeout(handler);
//     };
//   }, [value, delay]);
//   return debouncedValue;
// }
