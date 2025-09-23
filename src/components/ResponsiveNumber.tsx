import React from 'react';

interface ResponsiveNumberProps {
  value: string | number;
  className?: string;
  maxLength?: number;
}

export function ResponsiveNumber({ value, className = "", maxLength = 12 }: ResponsiveNumberProps) {
  const valueStr = String(value);
  const length = valueStr.length;
  
  // 根据数字长度动态选择字体大小
  let sizeClass = "";
  if (length <= 4) {
    sizeClass = "text-2xl sm:text-3xl lg:text-4xl xl:text-5xl"; // 短数字用大字体
  } else if (length <= 8) {
    sizeClass = "text-lg sm:text-xl lg:text-2xl xl:text-3xl"; // 中等长度
  } else if (length <= 12) {
    sizeClass = "text-base sm:text-lg lg:text-xl xl:text-2xl"; // 长数字用小字体
  } else {
    sizeClass = "text-sm sm:text-base lg:text-lg xl:text-xl"; // 超长数字用最小字体
  }
  
  return (
    <p className={`${sizeClass} font-bold text-foreground number-responsive ${className}`}>
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
  
  // 针对货币格式的响应式字体大小
  let sizeClass = "";
  if (length <= 8) { // ¥1,234.56
    sizeClass = "text-lg sm:text-xl lg:text-2xl xl:text-3xl";
  } else if (length <= 12) { // ¥12,345.67
    sizeClass = "text-base sm:text-lg lg:text-xl xl:text-2xl";
  } else if (length <= 16) { // ¥123,456.78
    sizeClass = "text-sm sm:text-base lg:text-lg xl:text-xl";
  } else {
    sizeClass = "text-xs sm:text-sm lg:text-base xl:text-lg";
  }
  
  return (
    <p className={`${sizeClass} font-bold text-foreground number-responsive ${className}`}>
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
  
  // 根据完整文本长度选择字体大小
  let numberSizeClass = "";
  let unitSizeClass = "";
  
  if (length <= 10) {
    numberSizeClass = "text-lg sm:text-xl lg:text-2xl xl:text-3xl";
    unitSizeClass = "text-sm sm:text-base lg:text-lg xl:text-xl";
  } else if (length <= 15) {
    numberSizeClass = "text-base sm:text-lg lg:text-xl xl:text-2xl";
    unitSizeClass = "text-xs sm:text-sm lg:text-base xl:text-lg";
  } else {
    numberSizeClass = "text-sm sm:text-base lg:text-lg xl:text-xl";
    unitSizeClass = "text-xs sm:text-xs lg:text-sm xl:text-base";
  }
  
  return (
    <p className={`font-bold text-foreground number-responsive ${className}`}>
      <span className={numberSizeClass}>{formattedValue}</span>
      <span className={`${unitSizeClass} font-medium text-muted-foreground ml-1`}>{unit}</span>
    </p>
  );
}
