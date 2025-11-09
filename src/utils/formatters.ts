// 统一的格式化工具函数
// 解决 toLocaleString 的空值问题

/**
 * 安全的数字格式化函数
 * @param num 要格式化的数字
 * @returns 格式化后的字符串
 */
export function safeFormatNumber(num: number | null | undefined | string): string {
  // 处理各种可能的输入类型
  if (num === null || num === undefined || num === '' || isNaN(Number(num))) {
    return '0';
  }
  
  const numValue = typeof num === 'string' ? parseFloat(num) : num;
  
  if (!isFinite(numValue)) {
    return '0';
  }
  
  if (numValue >= 10000) {
    return `${(numValue / 10000).toFixed(1)}万`;
  }
  
  return numValue.toLocaleString();
}

/**
 * 安全的金额格式化函数
 * @param amount 要格式化的金额
 * @returns 格式化后的金额字符串
 */
export function safeFormatAmount(amount: number | null | undefined | string): string {
  const numValue = safeParseNumber(amount);
  return `¥${safeFormatNumber(numValue)}`;
}

/**
 * 安全的重量格式化函数
 * @param weight 要格式化的重量
 * @returns 格式化后的重量字符串
 */
export function safeFormatWeight(weight: number | null | undefined | string): string {
  const numValue = safeParseNumber(weight);
  
  if (numValue >= 1000) {
    return `${(numValue / 1000).toFixed(1)}K吨`;
  }
  
  return `${numValue.toFixed(1)}吨`;
}

/**
 * 安全的货币格式化函数（使用 Intl.NumberFormat）
 * @param value 要格式化的值
 * @returns 格式化后的货币字符串
 */
export function safeFormatCurrency(value: number | null | undefined | string): string {
  const numValue = safeParseNumber(value);
  
  try {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: 'CNY',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(numValue);
  } catch (error) {
    // 如果 Intl.NumberFormat 失败，使用备用方案
    return `¥${safeFormatNumber(numValue)}`;
  }
}

/**
 * 安全的数字解析函数
 * @param input 输入值
 * @returns 解析后的数字，如果解析失败返回0
 */
export function safeParseNumber(input: number | null | undefined | string): number {
  if (input === null || input === undefined || input === '') {
    return 0;
  }
  
  if (typeof input === 'number') {
    return isFinite(input) ? input : 0;
  }
  
  const parsed = parseFloat(String(input));
  return isFinite(parsed) ? parsed : 0;
}

/**
 * 安全的百分比格式化函数
 * @param value 要格式化的值（0-1之间的小数或0-100的整数）
 * @param isDecimal 输入是否为小数形式（true: 0.5 = 50%, false: 50 = 50%）
 * @returns 格式化后的百分比字符串
 */
export function safeFormatPercentage(value: number | null | undefined | string, isDecimal: boolean = true): string {
  const numValue = safeParseNumber(value);
  const percentage = isDecimal ? numValue * 100 : numValue;
  return `${percentage.toFixed(1)}%`;
}

/**
 * 安全的日期格式化函数
 * @param date 要格式化的日期
 * @param locale 语言环境
 * @param options 格式化选项
 * @returns 格式化后的日期字符串
 */
export function safeFormatDate(
  date: string | number | Date | null | undefined,
  locale: string = 'zh-CN',
  options?: Intl.DateTimeFormatOptions
): string {
  if (!date) {
    return '-';
  }
  
  try {
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      return '-';
    }
    
    return dateObj.toLocaleDateString(locale, options);
  } catch (error) {
    return '-';
  }
}

/**
 * 安全的日期时间格式化函数
 * @param date 要格式化的日期时间
 * @param locale 语言环境
 * @param options 格式化选项
 * @returns 格式化后的日期时间字符串
 */
export function safeFormatDateTime(
  date: string | number | Date | null | undefined,
  locale: string = 'zh-CN',
  options?: Intl.DateTimeFormatOptions
): string {
  if (!date) {
    return '-';
  }
  
  try {
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      return '-';
    }
    
    return dateObj.toLocaleString(locale, options);
  } catch (error) {
    return '-';
  }
}

/**
 * 根据计费类型格式化数量显示
 * @param billingTypeId 计费类型ID (1: 计重, 2: 计车, 3: 计体积)
 * @param loadingWeight 装货重量
 * @param unloadingWeight 卸货重量
 * @returns 格式化后的数量字符串
 */
export function formatQuantityByBillingType(
  billingTypeId: number | null | undefined,
  loadingWeight: number | null | undefined,
  unloadingWeight: number | null | undefined
): string {
  const typeId = billingTypeId || 1;
  const loading = safeParseNumber(loadingWeight);
  const unloading = safeParseNumber(unloadingWeight);
  
  switch (typeId) {
    case 1: // 计重
      return `${loading.toFixed(2)} / ${unloading.toFixed(2)} 吨`;
    case 2: // 计车
      return `1 车`;
    case 3: // 计体积
      return `${loading.toFixed(2)} / ${unloading.toFixed(2)} 立方`;
    default:
      return '-';
  }
}

/**
 * 格式化单位配置
 * @param billingTypeId 计费类型ID
 * @returns 单位配置对象
 */
export function getBillingTypeConfig(billingTypeId: number | null | undefined) {
  const typeId = billingTypeId || 1;
  
  switch (typeId) {
    case 1:
      return { name: '计重', unit: '吨' };
    case 2:
      return { name: '计车', unit: '车' };
    case 3:
      return { name: '计体积', unit: '立方' };
    default:
      return { name: '计重', unit: '吨' };
  }
}

/**
 * 限制金额输入为最多2位小数的数字
 * @param value 输入值
 * @param allowNegative 是否允许负数（默认false）
 * @returns 处理后的值（最多2位小数）
 */
export function limitAmountInput(value: string, allowNegative: boolean = false): string {
  // 如果为空，直接返回
  if (value === '' || value === null || value === undefined) {
    return '';
  }

  // 转换为字符串
  let str = String(value);

  // 移除所有非数字和小数点的字符
  // 如果允许负数，保留开头的负号
  if (allowNegative) {
    // 允许开头的负号
    str = str.replace(/[^\d.-]/g, '');
    // 确保负号只在开头
    if (str.includes('-')) {
      const parts = str.split('-');
      if (parts[0] === '') {
        // 负号在开头
        str = '-' + parts.slice(1).join('').replace(/[^\d.]/g, '');
      } else {
        // 负号不在开头，移除所有负号
        str = str.replace(/-/g, '');
      }
    }
  } else {
    // 不允许负数，移除所有非数字和小数点
    str = str.replace(/[^\d.]/g, '');
  }

  // 处理多个小数点的情况，只保留第一个
  const parts = str.split('.');
  if (parts.length > 2) {
    str = parts[0] + '.' + parts.slice(1).join('');
  }

  // 限制小数点后最多2位
  if (parts.length === 2 && parts[1].length > 2) {
    str = parts[0] + '.' + parts[1].substring(0, 2);
  }

  return str;
}