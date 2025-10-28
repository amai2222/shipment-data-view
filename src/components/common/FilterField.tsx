// 筛选字段组件
// 统一的筛选输入组件

import { ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface BaseFilterFieldProps {
  label: string;
  icon?: ReactNode;
  className?: string;
}

// 输入框字段
interface InputFilterFieldProps extends BaseFilterFieldProps {
  type: 'input';
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  enableBatchInput?: boolean;
  onBatchInputClick?: () => void;
  onEnter?: () => void;
}

// 下拉框字段
interface SelectFilterFieldProps extends BaseFilterFieldProps {
  type: 'select';
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  disabled?: boolean;
}

// 日期字段
interface DateFilterFieldProps extends BaseFilterFieldProps {
  type: 'date';
  value: Date | null;
  onChange: (value: Date | null) => void;
  placeholder?: string;
}

type FilterFieldProps = InputFilterFieldProps | SelectFilterFieldProps | DateFilterFieldProps;

export function FilterField(props: FilterFieldProps) {
  const { label, icon, className = '' } = props;

  // 渲染输入框
  if (props.type === 'input') {
    return (
      <div className={`flex-1 min-w-[180px] space-y-2 ${className}`}>
        <Label className="text-sm font-medium flex items-center gap-1">
          {icon}
          {label}
        </Label>
        <div className="relative">
          <Input
            placeholder={props.placeholder}
            value={props.value}
            onChange={(e) => props.onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && props.onEnter) {
                props.onEnter();
              }
            }}
            className={props.enableBatchInput ? "pr-8" : ""}
          />
          {props.enableBatchInput && props.onBatchInputClick && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-full px-2 hover:bg-transparent"
              onClick={props.onBatchInputClick}
            >
              <span className="text-lg">+</span>
            </Button>
          )}
        </div>
      </div>
    );
  }

  // 渲染下拉框
  if (props.type === 'select') {
    return (
      <div className={`flex-1 min-w-[140px] space-y-2 ${className}`}>
        <Label className="text-sm font-medium flex items-center gap-1">
          {icon}
          {label}
        </Label>
        <select
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          disabled={props.disabled}
          className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm h-10 disabled:opacity-50"
        >
          {props.options.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  // 渲染日期选择器
  if (props.type === 'date') {
    return (
      <div className={`flex-1 min-w-[160px] space-y-2 ${className}`}>
        <Label className="text-sm font-medium flex items-center gap-1">
          {icon}
          {label}
        </Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal h-10",
                !props.value && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {props.value ? format(props.value, "yyyy-MM-dd", { locale: zhCN }) : (props.placeholder || "选择日期")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={props.value || undefined}
              onSelect={(date) => props.onChange(date || null)}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  return null;
}

