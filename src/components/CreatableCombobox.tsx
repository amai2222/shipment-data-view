// 文件路径: src/components/CreatableCombobox.tsx
import * as React from "react";
import { Check, ChevronsUpDown, PlusCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface ComboboxOption {
  value: string;
  label: string;
}

interface CreatableComboboxProps {
  options: ComboboxOption[];
  value: string;
  onValueChange: (value: string) => void;
  onCreateNew?: () => void; // 【核心改动】新增一个专门用于“创建”的回调函数
  placeholder?: string;
  searchPlaceholder?: string;
  emptyPlaceholder?: string;
}

export function CreatableCombobox({
  options, value, onValueChange, onCreateNew,
  placeholder, searchPlaceholder, emptyPlaceholder
}: CreatableComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const currentLabel = options.find(option => option.value === value)?.label || "";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
          {value ? currentLabel : <span className="text-muted-foreground">{placeholder}</span>}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command filter={(value, search) => value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0}>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>
              <div className="text-center text-sm text-muted-foreground py-4 px-2">
                {emptyPlaceholder || "未找到结果。"}
                {/* 【核心改动】如果传入了 onCreateNew 函数，就显示这个按钮 */}
                {onCreateNew && (
                  <Button variant="link" className="p-0 h-auto mt-1" onClick={onCreateNew}>
                    <PlusCircle className="mr-1 h-4 w-4" />
                    去管理页面新增
                  </Button>
                )}
              </div>
            </CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={() => {
                    onValueChange(option.value);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === option.value ? "opacity-100" : "opacity-0")} />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
