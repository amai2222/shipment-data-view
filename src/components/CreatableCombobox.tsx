// 文件路径: src/components/CreatableCombobox.tsx
import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
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
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  createPlaceholder?: string;
}

export function CreatableCombobox({
  options, value, onChange, placeholder, searchPlaceholder, createPlaceholder
}: CreatableComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState("");

  // 当外部传入的value变化时，同步更新内部显示的文本
  React.useEffect(() => {
    const selectedOption = options.find(option => option.value === value);
    setInputValue(selectedOption?.label || value);
  }, [value, options]);

  const handleSelect = (currentValue: string) => {
    // 优先从选项中查找匹配项。`currentValue` 此时是 label。
    const selectedOption = options.find(option => option.label.toLowerCase() === currentValue.toLowerCase());
    
    // 如果找到了匹配的选项，则把它的 value (通常是ID) 传出去
    // 如果没找到，说明是用户输入的新内容，直接把这个新内容的文本传出去
    const finalValue = selectedOption ? selectedOption.value : currentValue;
    
    onChange(finalValue);
    setOpen(false);
  };
  
  const currentLabel = options.find(option => option.value === value)?.label || value;

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
          <CommandInput
            placeholder={searchPlaceholder}
            value={inputValue}
            onValueChange={setInputValue}
          />
          <CommandList>
            <CommandEmpty onSelect={() => handleSelect(inputValue)}>
              <div className="cursor-pointer p-2">{createPlaceholder || "创建"} "{inputValue}"</div>
            </CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label} // CommandItem 的 value 应该是用来搜索和显示的 label
                  onSelect={handleSelect}
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
