import React from 'react';
import { cn } from '@/lib/utils';

interface CurrencyDisplayProps {
  value: number | null | undefined;
  className?: string;
  /**
   * 整数部分的字号类名（默认继承父元素）
   */
  integerClassName?: string;
  /**
   * 小数部分的字号类名（默认比整数小一号）
   */
  decimalClassName?: string;
  /**
   * 是否显示货币符号（默认 true）
   */
  showSymbol?: boolean;
  /**
   * 最小小数位数（默认 2）
   */
  minimumFractionDigits?: number;
  /**
   * 最大小数位数（默认 2）
   */
  maximumFractionDigits?: number;
}

/**
 * 统一的金额显示组件
 * 在桌面端，小数点后的数字字号比整数部分小一号
 */
export function CurrencyDisplay({
  value,
  className = '',
  integerClassName,
  decimalClassName,
  showSymbol = true,
  minimumFractionDigits = 2,
  maximumFractionDigits = 2,
}: CurrencyDisplayProps) {
  // 格式化金额
  const formatValue = (val: number | null | undefined): string => {
    if (val == null || isNaN(val)) return '0.00';
    
    return new Intl.NumberFormat('zh-CN', {
      style: showSymbol ? 'currency' : 'decimal',
      currency: 'CNY',
      minimumFractionDigits,
      maximumFractionDigits,
    }).format(val);
  };

  const formatted = formatValue(value);
  
  // 如果没有小数部分，直接返回
  if (!formatted.includes('.') && minimumFractionDigits === 0) {
    return <span className={cn('font-mono', className)}>{formatted}</span>;
  }

  // 分离整数部分和小数部分
  // 处理 ¥1,234.56 格式
  const parts = formatted.split('.');
  if (parts.length === 1) {
    // 没有小数部分
    return <span className={cn('font-mono', className)}>{formatted}</span>;
  }

  const integerPart = parts[0]; // 包含 ¥ 和千位分隔符的整数部分
  const decimalPart = parts[1]; // 小数部分

  // 默认字号：整数部分继承，小数部分小一号
  // 在桌面端使用相对字号，移动端保持相同
  // 使用 0.85em 让小数部分比整数部分小约 15%（相当于小一号）
  const defaultDecimalClass = 'text-[0.85em]'; // 比父元素小约 15%

  return (
    <span 
      className={cn('font-mono inline-flex items-baseline', className)}
      onCopy={(e) => {
        // 始终复制完整的格式化数字（包括小数部分）
        e.clipboardData.setData('text/plain', formatted);
        e.preventDefault();
      }}
      style={{ userSelect: 'text', WebkitUserSelect: 'text' }}
    >
      <span className={integerClassName || ''}>{integerPart}.</span>
      <span 
        className={cn(decimalClassName || defaultDecimalClass, 'tabular-nums')}
      >
        {decimalPart}
      </span>
    </span>
  );
}

/**
 * 简化版金额显示组件（用于表格等场景）
 * 使用更紧凑的样式
 */
export function CompactCurrencyDisplay({
  value,
  className = '',
}: {
  value: number | null | undefined;
  className?: string;
}) {
  return (
    <CurrencyDisplay
      value={value}
      className={className}
      decimalClassName="text-[0.8em]"
    />
  );
}

