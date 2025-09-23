import React from 'react';

interface ResponsiveNumberProps {
  value: string | number;
  className?: string;
  maxLength?: number;
}

export function ResponsiveNumber({ value, className = "", maxLength = 12 }: ResponsiveNumberProps) {
  const valueStr = String(value);
  const length = valueStr.length;
  
  // 缩小数字字体大小，使卡片更紧凑
  let sizeClass = "";
  if (length <= 2) {
    sizeClass = "text-2xl sm:text-3xl lg:text-4xl"; // 1-2位数字，大字体
  } else if (length <= 4) {
    sizeClass = "text-xl sm:text-2xl lg:text-3xl"; // 3-4位数字，中等字体
  } else if (length <= 8) {
    sizeClass = "text-lg sm:text-xl lg:text-2xl"; // 5-8位数字，较小字体
  } else if (length <= 12) {
    sizeClass = "text-base sm:text-lg lg:text-xl"; // 9-12位数字，小字体
  } else {
    sizeClass = "text-sm sm:text-base lg:text-lg"; // 超长数字，最小字体
  }
  
  return (
    <p className={`${sizeClass} font-extrabold text-foreground number-responsive tracking-tight leading-none ${className}`}>
      {value}
    </p>
  );
}

interface ResponsiveCurrencyProps {
  value: number | null | undefined;
  className?: string;
}

export function ResponsiveCurrency({ value, className = "" }: ResponsiveCurrencyProps) {
  const formatCurrency = (val: number | null | undefined): string => {
    if (val == null || isNaN(val)) return '¥0.00';
    return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(val);
  };
  
  const formattedValue = formatCurrency(value);
  const length = formattedValue.length;
  
  // 缩小货币显示的字体大小，使卡片更紧凑
  let sizeClass = "";
  if (length <= 8) { // ¥1,234.56 - 短金额
    sizeClass = "text-lg sm:text-xl lg:text-2xl";
  } else if (length <= 12) { // ¥12,345.67 - 中等金额
    sizeClass = "text-base sm:text-lg lg:text-xl";
  } else if (length <= 16) { // ¥123,456.78 - 较大金额
    sizeClass = "text-sm sm:text-base lg:text-lg";
  } else { // 超大金额
    sizeClass = "text-xs sm:text-sm lg:text-base";
  }
  
  return (
    <p className={`${sizeClass} font-extrabold text-foreground number-responsive tracking-tight leading-none tabular-nums ${className}`}>
      {formattedValue}
    </p>
  );
}

interface ResponsiveNumberWithUnitProps {
  value: number;
  unit: string;
  className?: string;
}

export function ResponsiveNumberWithUnit({ value, unit, className = "" }: ResponsiveNumberWithUnitProps) {
  const formattedValue = value.toFixed(2);
  const fullText = `${formattedValue} ${unit}`;
  const length = fullText.length;
  
  // 缩小数字和单位的字体大小，使卡片更紧凑
  let numberSizeClass = "";
  let unitSizeClass = "";
  
  if (length <= 8) { // 短文本，如 "12.34 吨"
    numberSizeClass = "text-xl sm:text-2xl lg:text-3xl";
    unitSizeClass = "text-sm sm:text-base lg:text-lg";
  } else if (length <= 12) { // 中等文本，如 "1234.56 吨"
    numberSizeClass = "text-lg sm:text-xl lg:text-2xl";
    unitSizeClass = "text-xs sm:text-sm lg:text-base";
  } else if (length <= 16) { // 较长文本
    numberSizeClass = "text-base sm:text-lg lg:text-xl";
    unitSizeClass = "text-xs sm:text-sm lg:text-base";
  } else { // 超长文本
    numberSizeClass = "text-sm sm:text-base lg:text-lg";
    unitSizeClass = "text-xs sm:text-xs lg:text-sm";
  }
  
  return (
    <p className={`font-extrabold text-foreground number-responsive leading-none ${className}`}>
      <span className={`${numberSizeClass} tracking-tight tabular-nums`}>{formattedValue}</span>
      <span className={`${unitSizeClass} font-semibold text-muted-foreground ml-2 align-bottom`}>{unit}</span>
    </p>
  );
}
