// 正确路径: src/pages/BusinessEntry/components/AsyncCreatableCombobox.tsx

import * as React from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useDebounce } from '../hooks/use-debounce';

export interface Option {
  value: string;
  label: string;
  [key: string]: any;
}

interface AsyncCreatableComboboxProps {
  value: string;
  onValueChange: (option: Option | null, rawValue: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyResultText?: string;
  tableName: 'drivers' | 'locations';
  searchColumn: string;
  projectId: string | null;
  disabled?: boolean;
}

export function AsyncCreatableCombobox({
  value,
  onValueChange,
  placeholder = "Select an option...",
  searchPlaceholder = "Search...",
  emptyResultText = "No results found. Type to create.",
  tableName,
  searchColumn,
  projectId,
  disabled = false
}: AsyncCreatableComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [options, setOptions] = React.useState<Option[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  
  const selectedOption = options.find(opt => opt.label === value) || (value ? { value: value, label: value } : null);

  React.useEffect(() => {
    // [核心重写] - 只要下拉框打开且有项目ID，就应该获取数据
    if (!projectId || !open) {
      setOptions([]);
      return;
    }

    setIsLoading(true);
    const fetchOptions = async () => {
      // [核心重写] - debouncedSearchTerm 可以为空，RPC函数会处理
      const { data, error } = await supabase.rpc('search_project_linked_items', {
        p_project_id: projectId,
        p_item_type: tableName,
        p_search_term: debouncedSearchTerm
      });
      
      if (error) {
        console.error("Error fetching options:", error);
        setOptions([]);
      } else {
        const formattedOptions = (data || []).map((item: any) => ({
          value: item.id,
          label: tableName === 'drivers' ? `${item[searchColumn]} (${item.license_plate || '无车牌'})` : item[searchColumn],
          ...item
        }));
        setOptions(formattedOptions);
      }
      setIsLoading(false);
    };
    
    fetchOptions();
  }, [debouncedSearchTerm, tableName, searchColumn, open, projectId]);

  const handleSelect = (currentValue: string) => {
    const option = options.find(opt => opt.value === currentValue);
    onValueChange(option || null, option ? option.label : '');
    setOpen(false);
    setSearchTerm("");
  };

  const handleInputChange = (search: string) => {
    setSearchTerm(search);
    onValueChange(null, search);
  };

  const displayValue = value || placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={!projectId || disabled}
        >
          <span className="truncate">{displayValue}</span>
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
          
          {!isLoading && options.length === 0 && (<CommandEmpty>{emptyResultText}</CommandEmpty>)}
          {isLoading && (<div className="p-2 flex justify-center items-center"><Loader2 className="h-4 w-4 animate-spin" /></div>)}

          {options.length > 0 && (
            <CommandGroup>
              {options.map((option) => (
                <CommandItem key={option.value} value={option.value} onSelect={handleSelect}>
                  <Check className={cn("mr-2 h-4 w-4", selectedOption?.value === option.value ? "opacity-100" : "opacity-0")} />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
