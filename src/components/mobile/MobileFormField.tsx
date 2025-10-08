import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { AlertCircle } from 'lucide-react';

interface MobileFormFieldProps {
  label: string;
  value: any;
  onChange: (value: any) => void;
  type?: 'text' | 'number' | 'tel' | 'email' | 'textarea' | 'select' | 'switch' | 'date' | 'datetime-local';
  placeholder?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  options?: Array<{ value: string; label: string }>;
  disabled?: boolean;
  rows?: number;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  inputClassName?: string;
  icon?: React.ReactNode;
}

export function MobileFormField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  required = false,
  error,
  hint,
  options = [],
  disabled = false,
  rows = 3,
  min,
  max,
  step,
  className,
  inputClassName,
  icon
}: MobileFormFieldProps) {
  const renderInput = () => {
    switch (type) {
      case 'textarea':
        return (
          <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            rows={rows}
            className={cn('text-base', inputClassName)}
          />
        );
      
      case 'select':
        return (
          <Select value={value} onValueChange={onChange} disabled={disabled}>
            <SelectTrigger className={cn('text-base h-12', inputClassName)}>
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      
      case 'switch':
        return (
          <div className="flex items-center justify-between">
            <Label htmlFor={label} className="text-base">
              {label}
              {required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Switch
              id={label}
              checked={value}
              onCheckedChange={onChange}
              disabled={disabled}
            />
          </div>
        );
      
      default:
        return (
          <div className="relative">
            {icon && (
              <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">
                {icon}
              </div>
            )}
            <Input
              type={type}
              value={value}
              onChange={(e) => {
                const newValue = type === 'number' ? parseFloat(e.target.value) : e.target.value;
                onChange(newValue);
              }}
              placeholder={placeholder}
              disabled={disabled}
              min={min}
              max={max}
              step={step}
              className={cn(
                'text-base h-12',
                icon && 'pl-10',
                error && 'border-red-500',
                inputClassName
              )}
            />
          </div>
        );
    }
  };

  if (type === 'switch') {
    return (
      <div className={cn('py-3', className)}>
        {renderInput()}
        {error && (
          <div className="flex items-center mt-2 text-sm text-red-500">
            <AlertCircle className="h-4 w-4 mr-1" />
            {error}
          </div>
        )}
        {hint && !error && (
          <p className="mt-2 text-sm text-muted-foreground">{hint}</p>
        )}
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor={label} className="text-base font-medium">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </Label>
      
      {renderInput()}
      
      {error && (
        <div className="flex items-center text-sm text-red-500">
          <AlertCircle className="h-4 w-4 mr-1" />
          {error}
        </div>
      )}
      
      {hint && !error && (
        <p className="text-sm text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

// 移动端表单卡片
interface MobileFormCardProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function MobileFormCard({
  title,
  description,
  children,
  className
}: MobileFormCardProps) {
  return (
    <Card className={className}>
      <CardContent className="p-4 space-y-4">
        {(title || description) && (
          <div className="space-y-1">
            {title && <h3 className="text-lg font-semibold">{title}</h3>}
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>
        )}
        {children}
      </CardContent>
    </Card>
  );
}

// 移动端表单分组
interface MobileFormGroupProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function MobileFormGroup({
  title,
  children,
  className
}: MobileFormGroupProps) {
  return (
    <div className={cn('space-y-3', className)}>
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        {title}
      </h3>
      <div className="space-y-4">
        {children}
      </div>
    </div>
  );
}

