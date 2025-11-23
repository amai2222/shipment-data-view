import * as React from "react"
import { Check, ChevronsUpDown, Plus } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export interface ComboboxOption {
  value: string
  label: string
  searchText?: string // 用于搜索的文本（可选，如果提供则优先使用此字段进行搜索）
}

interface ComboboxProps {
  value?: string
  onValueChange: (value: string) => void
  onCreateNew?: (value: string) => Promise<void>
  options: ComboboxOption[]
  placeholder?: string
  searchPlaceholder?: string
  createLabel?: string
  emptyMessage?: string
  className?: string
  disabled?: boolean
}

export function Combobox({
  value,
  onValueChange,
  onCreateNew,
  options,
  placeholder = "选择选项...",
  searchPlaceholder = "搜索...",
  createLabel = "创建",
  emptyMessage = "未找到选项",
  className,
  disabled = false,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [searchValue, setSearchValue] = React.useState("")

  const selectedOption = options.find((option) => option.value === value)

  // 模糊搜索：支持搜索名称和昵称
  const filteredOptions = React.useMemo(() => {
    if (!searchValue.trim()) {
      return options;
    }
    const searchLower = searchValue.toLowerCase().trim();
    return options.filter((option) => {
      const searchText = option.searchText || option.label;
      // 支持模糊匹配：检查搜索文本是否包含在名称或昵称中
      return searchText.toLowerCase().includes(searchLower);
    });
  }, [options, searchValue]);

  const handleSelect = (currentValue: string) => {
    onValueChange(currentValue === value ? "" : currentValue)
    setOpen(false)
    setSearchValue("")
  }

  const handleCreateNew = async () => {
    if (searchValue && onCreateNew) {
      try {
        await onCreateNew(searchValue)
        setOpen(false)
        setSearchValue("")
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : '创建选项失败';
        console.error("Failed to create new option:", errorMessage);
      }
    }
  }

  const canCreateNew = 
    onCreateNew && 
    searchValue && 
    !filteredOptions.some(option => option.label.toLowerCase() === searchValue.toLowerCase())

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-label={selectedOption ? `${selectedOption.label}` : placeholder}
          className={cn("w-full justify-between", className)}
          disabled={disabled}
        >
          {selectedOption ? selectedOption.label : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0">
        <Command shouldFilter={false}>
          <CommandInput 
            placeholder={searchPlaceholder} 
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList>
            {filteredOptions.length === 0 && !canCreateNew && (
              <CommandEmpty>{emptyMessage}</CommandEmpty>
            )}
            {filteredOptions.length > 0 && (
              <CommandGroup>
                {filteredOptions.map((option) => {
                  // 使用 searchText 作为 CommandItem 的 value，以便 Command 组件也能正确过滤
                  const searchValueForItem = option.searchText || option.label;
                  return (
                    <CommandItem
                      key={option.value}
                      value={searchValueForItem}
                      onSelect={() => handleSelect(option.value)}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === option.value ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {option.label}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
            {canCreateNew && (
              <CommandGroup>
                <CommandItem onSelect={handleCreateNew} value={searchValue}>
                  <Plus className="mr-2 h-4 w-4" />
                  {createLabel} "{searchValue}"
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}