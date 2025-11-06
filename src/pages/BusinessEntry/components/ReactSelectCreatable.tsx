// 正确路径: src/pages/BusinessEntry/components/ReactSelectCreatable.tsx
import { useState } from 'react';
import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';
import AsyncCreatableSelect from 'react-select/async-creatable';
import { useDebounce } from '../hooks/use-debounce';

export interface SelectOption { value: string; label: string; [key: string]: any; }

interface ReactSelectCreatableProps {
  value: SelectOption | null;
  onChange: (option: SelectOption | null) => void;
  placeholder?: string;
  tableName: 'drivers' | 'locations';
  projectId: string | null;
  disabled?: boolean;
}

const selectStyles = {
  control: (provided: any, state: any) => ({ ...provided, backgroundColor: 'transparent', borderColor: state.isFocused ? 'hsl(var(--ring))' : 'hsl(var(--input))', boxShadow: state.isFocused ? '0 0 0 1px hsl(var(--ring))' : 'none', '&:hover': { borderColor: 'hsl(var(--input))', }, minHeight: '40px', }),
  input: (provided: any) => ({ ...provided, color: 'hsl(var(--foreground))', }),
  singleValue: (provided: any) => ({ ...provided, color: 'hsl(var(--foreground))', }),
  menu: (provided: any) => ({ ...provided, backgroundColor: 'hsl(var(--popover))', color: 'hsl(var(--popover-foreground))', border: '1px solid hsl(var(--border))', }),
  option: (provided: any, state: any) => ({ ...provided, backgroundColor: state.isSelected ? 'hsl(var(--accent))' : state.isFocused ? 'hsl(var(--accent))' : 'transparent', color: 'hsl(var(--accent-foreground))', '&:active': { backgroundColor: 'hsl(var(--accent))', }, }),
  placeholder: (provided: any) => ({ ...provided, color: 'hsl(var(--muted-foreground))', }),
};

export function ReactSelectCreatable({ value, onChange, placeholder = "选择或输入...", tableName, projectId, disabled = false }: ReactSelectCreatableProps) {
  const [debouncedInputValue, setDebouncedInputValue] = useState('');
  const debouncedValue = useDebounce(debouncedInputValue, 500);

  const loadOptions = async (inputValue: string): Promise<SelectOption[]> => {
    if (!projectId) return [];
    const searchTerm = inputValue || ''; // 确保即使是空输入也能触发初始列表加载
    const { data, error } = await supabase.rpc('search_project_linked_items' as any, { p_project_id: projectId, p_item_type: tableName, p_search_term: searchTerm });
    if (error) { console.error("Error fetching options:", error); return []; }
    const resultArray = Array.isArray(data) ? data : [];
    return resultArray.map((item: any) => ({ value: item.id, label: tableName === 'drivers' ? `${item.name} (${item.license_plate || '无车牌'})` : item.name, ...item }));
  };

  return (
    <AsyncCreatableSelect
      cacheOptions
      defaultOptions
      loadOptions={loadOptions}
      value={value}
      onChange={onChange}
      isDisabled={!projectId || disabled}
      placeholder={placeholder}
      styles={selectStyles}
      formatCreateLabel={(inputValue) => `创建 "${inputValue}"`}
      noOptionsMessage={({ inputValue }) => inputValue ? '未找到结果' : '请输入以搜索...'}
      loadingMessage={() => '加载中...'}
      onInputChange={(value) => setDebouncedInputValue(value)}
    />
  );
}
