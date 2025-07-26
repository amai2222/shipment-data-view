// 文件路径: src/components/CreatableCombobox.tsx
import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface ComboboxOption {
  value: string; // Typically the ID
  label: string; // The display name
}

interface CreatableComboboxProps {
  options: ComboboxOption[];
  value: string; // The ID of the selected item
  onValueChange: (value: string, label: string) => void; // Returns both ID and label
  placeholder?: string;
  searchPlaceholder?: string;
  createPlaceholder?: string;
}

export function CreatableCombobox({
  options,
  value,
  onValueChange,
  placeholder,
  searchPlaceholder,
  createPlaceholder,
}: CreatableComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState("");

  // Find the label corresponding to the current value (ID)
  const currentLabel = React.useMemo(() => {
    return options.find(option => option.value === value)?.label || '';
  }, [value, options]);

  const handleSelect = (selectedLabel: string) => {
    const selectedOption = options.find(option => option.label.toLowerCase() === selectedLabel.toLowerCase());
    
    if (selectedOption) {
      // User selected an existing item
      onValueChange(selectedOption.value, selectedOption.label);
    } else {
      // User is creating a new item
      onValueChange(selectedLabel, selectedLabel); // Pass the new name as both value and label temporarily
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className="w-full justify-between font-normal"
        >
          {currentLabel || <span className="text-muted-foreground">{placeholder}</span>}
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
                  value={option.label}
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
