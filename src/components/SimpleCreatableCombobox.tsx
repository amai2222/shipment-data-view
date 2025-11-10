import { useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ComboboxOption {
  value: string;
  label: string;
}

interface SimpleCreatableComboboxProps {
  options: ComboboxOption[];
  value: string;
  onValueChange: (value: string) => void;
  onCreateNew?: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function SimpleCreatableCombobox({
  options = [],
  value,
  onValueChange,
  onCreateNew,
  placeholder = "选择选项...",
  className
}: SimpleCreatableComboboxProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  // Ensure options is always an array
  const safeOptions = Array.isArray(options) ? options : [];
  
  // Filter options based on search
  const filteredOptions = safeOptions.filter(option =>
    option.label.toLowerCase().includes(searchValue.toLowerCase())
  );

  const selectedOption = safeOptions.find((option) => option.value === value);

  const handleCreateNew = () => {
    if (onCreateNew && searchValue.trim()) {
      onCreateNew(searchValue.trim());
      onValueChange(searchValue.trim()); // Ensure the value is set in the form
      setOpen(false);
      setSearchValue("");
    }
  };

  const handleSelectOption = (optionValue: string) => {
    onValueChange(optionValue);
    setOpen(false);
    setSearchValue("");
  };

  const showCreateOption = onCreateNew && 
    searchValue.trim() && 
    !filteredOptions.some(opt => opt.value.toLowerCase() === searchValue.trim().toLowerCase());

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-label={selectedOption ? `${selectedOption.label}` : placeholder}
          className={cn("w-full justify-between", className)}
        >
          {selectedOption ? selectedOption.label : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <div className="flex flex-col">
          <div className="p-2">
            <Input
              placeholder="搜索..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="h-8"
            />
          </div>
          <ScrollArea className="max-h-60">
            <div className="p-1">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((option) => (
                  <div
                    key={option.value}
                    className={cn(
                      "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                      value === option.value && "bg-accent text-accent-foreground"
                    )}
                    onClick={() => handleSelectOption(option.value)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === option.value ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {option.label}
                  </div>
                ))
              ) : (
                <div className="p-2 text-sm text-muted-foreground text-center">
                  未找到结果
                </div>
              )}
              
              {showCreateOption && (
                <div
                  className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground border-t"
                  onClick={handleCreateNew}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  创建 "{searchValue.trim()}"
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
  );
}