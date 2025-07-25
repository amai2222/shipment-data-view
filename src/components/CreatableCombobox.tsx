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
  value: string; // value 应该始终是ID或唯一的标识符
  onValueChange: (value: string, label: string) => void; // 返回ID和名称
  placeholder?: string;
  searchPlaceholder?: string;
  createPlaceholder?: string;
}

export function CreatableCombobox({
  options, value, onValueChange, placeholder, searchPlaceholder, createPlaceholder
}: CreatableComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState("");

  // 当外部传入的value变化时，同步更新内部显示的文本
  React.useEffect(() => {
    const selectedOption = options.find(option => option.value === value);
    setInputValue(selectedOption?.label || "");
  }, [value, options]);

  const handleSelect = (currentLabel: string) => {
    const selectedOption = options.find(option => option.label.toLowerCase() === currentLabel.toLowerCase());
    
    // 如果找到了匹配的选项，则把它的 value (ID) 和 label (名称) 传出去
    // 如果没找到，说明是用户输入的新内容，value传空字符串，label传新名称
    const finalValue = selectedOption ? selectedOption.value : "";
    const finalLabel = currentLabel;
    
    onValueChange(finalValue, finalLabel);
    setOpen(false);
  };
  
  const currentLabel = options.find(option => option.value === value)?.label || "";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
          {currentLabel ? currentLabel : <span className="text-muted-foreground">{placeholder}</span>}
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
