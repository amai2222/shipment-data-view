// 增强的字段验证工具 - 借鉴数据维护-数据导入的专业处理
// 提供详细的必填字段检查和数据清理

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  cleanedData: any;
}

export interface FieldValidationRule {
  field: string;
  required: boolean;
  type: 'string' | 'number' | 'date' | 'phone' | 'email';
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  customValidator?: (value: any) => string | null;
}

// 运单数据验证规则
export const WAYBILL_VALIDATION_RULES: FieldValidationRule[] = [
  {
    field: '项目名称',
    required: true,
    type: 'string',
    minLength: 1,
    maxLength: 100
  },
  {
    field: '司机姓名',
    required: true,
    type: 'string',
    minLength: 1,
    maxLength: 50
  },
  {
    field: '车牌号',
    required: true,
    type: 'string',
    minLength: 1,
    maxLength: 20,
    pattern: /^[\u4e00-\u9fa5A-Za-z0-9]+$/
  },
  {
    field: '装货地点',
    required: true,
    type: 'string',
    minLength: 1,
    maxLength: 100
  },
  {
    field: '卸货地点',
    required: true,
    type: 'string',
    minLength: 1,
    maxLength: 100
  },
  {
    field: '装货日期',
    required: true,
    type: 'date'
  },
  {
    field: '装货数量',
    required: true,
    type: 'number',
    customValidator: (value: any) => {
      const num = parseFloat(value);
      if (isNaN(num) || num <= 0) {
        return '装货数量必须是大于0的数字';
      }
      return null;
    }
  },
  {
    field: '司机电话',
    required: false,
    type: 'phone',
    pattern: /^1[3-9]\d{9}$/
  },
  {
    field: '运费金额',
    required: false,
    type: 'number',
    customValidator: (value: any) => {
      if (value && value !== '') {
        const num = parseFloat(value);
        if (isNaN(num) || num < 0) {
          return '运费金额必须是非负数';
        }
      }
      return null;
    }
  },
  {
    field: '额外费用',
    required: false,
    type: 'number',
    customValidator: (value: any) => {
      if (value && value !== '') {
        const num = parseFloat(value);
        if (isNaN(num) || num < 0) {
          return '额外费用必须是非负数';
        }
      }
      return null;
    }
  }
];

// 验证单行数据
export const validateRowData = (rowData: any, rowIndex: number): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const cleanedData: any = {};
  
  console.log(`开始验证第${rowIndex + 1}行数据:`, rowData);
  
  // 清理和验证每个字段
  WAYBILL_VALIDATION_RULES.forEach(rule => {
    const fieldValue = rowData[rule.field];
    const cleanedValue = cleanFieldValue(fieldValue, rule.type);
    cleanedData[rule.field] = cleanedValue;
    
    // 必填字段检查
    if (rule.required && (!cleanedValue || cleanedValue === '')) {
      errors.push(`第${rowIndex + 1}行: ${rule.field}是必填字段`);
      return;
    }
    
    // 如果字段为空且非必填，跳过其他验证
    if (!cleanedValue || cleanedValue === '') {
      return;
    }
    
    // 类型验证
    const typeError = validateFieldType(cleanedValue, rule.type);
    if (typeError) {
      errors.push(`第${rowIndex + 1}行: ${rule.field}${typeError}`);
      return;
    }
    
    // 长度验证
    if (rule.minLength && cleanedValue.length < rule.minLength) {
      errors.push(`第${rowIndex + 1}行: ${rule.field}长度不能少于${rule.minLength}个字符`);
      return;
    }
    
    if (rule.maxLength && cleanedValue.length > rule.maxLength) {
      errors.push(`第${rowIndex + 1}行: ${rule.field}长度不能超过${rule.maxLength}个字符`);
      return;
    }
    
    // 正则表达式验证
    if (rule.pattern && !rule.pattern.test(cleanedValue)) {
      errors.push(`第${rowIndex + 1}行: ${rule.field}格式不正确`);
      return;
    }
    
    // 自定义验证
    if (rule.customValidator) {
      const customError = rule.customValidator(cleanedValue);
      if (customError) {
        errors.push(`第${rowIndex + 1}行: ${customError}`);
        return;
      }
    }
  });

  // ✅ 修复：保留所有原始字段，不仅仅是验证规则中的字段
  // 这样可以保留"合作链路"、"external_tracking_numbers"、"other_platform_names"等字段
  Object.keys(rowData).forEach(key => {
    // 如果字段不在验证规则中，直接保留原始值（经过清理）
    const isInValidationRules = WAYBILL_VALIDATION_RULES.some(rule => rule.field === key);
    if (!isInValidationRules && cleanedData[key] === undefined) {
      // 对于非验证规则字段，进行基本清理
      const value = rowData[key];
      if (value !== null && value !== undefined) {
        if (typeof value === 'string') {
          const trimmed = value.trim();
          // 即使是空字符串，也保留（因为可能是有效的空值）
          cleanedData[key] = trimmed;
        } else if (Array.isArray(value)) {
          cleanedData[key] = value; // 保留数组类型（如 external_tracking_numbers, other_platform_names）
        } else {
          cleanedData[key] = value;
        }
      } else if (value === null || value === undefined) {
        cleanedData[key] = null; // 保留 null 值
      }
    }
  });
  
  // 验证外部平台数据
  const platformErrors = validateExternalPlatformData(rowData);
  platformErrors.forEach(error => {
    errors.push(`第${rowIndex + 1}行: ${error}`);
  });
  
  // 验证日期逻辑
  if (cleanedData['装货日期'] && cleanedData['卸货日期']) {
    const loadingDate = new Date(cleanedData['装货日期']);
    const unloadingDate = new Date(cleanedData['卸货日期']);
    
    if (unloadingDate < loadingDate) {
      warnings.push(`第${rowIndex + 1}行: 卸货日期早于装货日期，请检查数据`);
    }
  }
  
  const result: ValidationResult = {
    isValid: errors.length === 0,
    errors,
    warnings,
    cleanedData
  };
  
  console.log(`第${rowIndex + 1}行验证结果:`, result);
  return result;
};

// 清理字段值
const cleanFieldValue = (value: any, type: string): any => {
  if (value === null || value === undefined) {
    return '';
  }
  
  if (type === 'string') {
    return value.toString().trim();
  }
  
  if (type === 'number') {
    const cleaned = value.toString().trim();
    return cleaned === '' ? '' : cleaned;
  }
  
  if (type === 'date') {
    return value.toString().trim();
  }
  
  return value;
};

// 验证字段类型
const validateFieldType = (value: any, type: string): string | null => {
  if (type === 'string') {
    return null; // 字符串类型总是有效
  }
  
  if (type === 'number') {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return '必须是数字';
    }
    return null;
  }
  
  if (type === 'date') {
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      return '必须是有效的日期格式';
    }
    return null;
  }
  
  if (type === 'phone') {
    if (!/^1[3-9]\d{9}$/.test(value)) {
      return '必须是有效的手机号码格式';
    }
    return null;
  }
  
  if (type === 'email') {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return '必须是有效的邮箱格式';
    }
    return null;
  }
  
  return null;
};

// 验证外部平台数据
const validateExternalPlatformData = (rowData: any): string[] => {
  const errors: string[] = [];
  
  if (rowData['其他平台名称'] && rowData['其他平台运单号']) {
    const platformNames = rowData['其他平台名称']?.toString().split(',').map((name: string) => name.trim()).filter((name: string) => name) || [];
    const platformTrackingGroups = rowData['其他平台运单号']?.toString().split(',').map((group: string) => group.trim()).filter((group: string) => group) || [];
    
    // 检查平台名称和运单号组数量是否匹配
    if (platformNames.length !== platformTrackingGroups.length) {
      errors.push(`平台名称数量(${platformNames.length})与运单号组数量(${platformTrackingGroups.length})不匹配`);
    }
    
    // 检查每个运单号组是否包含有效的运单号
    platformTrackingGroups.forEach((group: string, index: number) => {
      const trackingNumbers = group.split('|').map((tn: string) => tn.trim()).filter((tn: string) => tn);
      if (trackingNumbers.length === 0) {
        errors.push(`平台"${platformNames[index]}"的运单号组为空`);
      }
    });
  }
  
  return errors;
};

// 批量验证数据
export const validateBatchData = (data: any[]): { validRows: any[]; invalidRows: { index: number; errors: string[] }[] } => {
  const validRows: any[] = [];
  const invalidRows: { index: number; errors: string[] }[] = [];
  
  data.forEach((rowData, index) => {
    const validation = validateRowData(rowData, index);
    
    if (validation.isValid) {
      validRows.push(validation.cleanedData);
    } else {
      invalidRows.push({
        index,
        errors: validation.errors
      });
    }
  });
  
  console.log('批量验证结果:', {
    total: data.length,
    valid: validRows.length,
    invalid: invalidRows.length
  });
  
  return { validRows, invalidRows };
};
