// Excel字段模糊匹配工具
// 支持灵活的字段名匹配，提高导入容错性

/**
 * Excel字段到数据库字段的映射规则
 */
export const FIELD_MAPPING_RULES = {
  // 项目相关
  project_name: ['项目名称', '项目', 'project'],
  chain_name: ['合作链路', '链路', '合作方链路', 'chain'],
  
  // 司机相关
  driver_name: ['司机姓名', '司机', '驾驶员', 'driver'],
  license_plate: ['车牌号', '车牌', '牌照', 'plate'],
  driver_phone: ['司机电话', '电话', '手机', '联系方式', 'phone'],
  
  // 地点相关
  loading_location: ['装货地点', '装货地', '起点', '发货地', 'loading'],
  unloading_location: ['卸货地点', '卸货地', '终点', '收货地', 'unloading'],
  
  // 日期相关
  loading_date: ['装货日期', '装货时间', '发车日期', 'load_date'],
  unloading_date: ['卸货日期', '卸货时间', '到达日期', 'unload_date'],
  
  // 数量相关
  loading_weight: ['装货数量', '装货重量', '装载量', '发货量', 'load_weight'],
  unloading_weight: ['卸货数量', '卸货重量', '卸载量', '到货量', 'unload_weight'],
  
  // 费用相关
  current_cost: ['运费金额', '运费', '当前费用', '基础运费', 'cost'],
  extra_cost: ['额外费用', '额外', '附加费', 'extra'],
  
  // 其他
  transport_type: ['运输类型', '类型', 'type'],
  cargo_type: ['货物类型', '货类', 'cargo'],
  remarks: ['备注', '说明', '注释', 'remark', 'note'],
  other_platform_names: ['其他平台名称', '平台名称', '其他平台', 'platform'],
  external_tracking_numbers: ['其他平台运单号', '外部运单号', '平台运单号', 'tracking']
};

/**
 * 模糊匹配Excel字段名到数据库字段
 * @param excelFieldName - Excel中的字段名
 * @returns 对应的数据库字段名，如果没找到返回null
 */
export function matchFieldName(excelFieldName: string): string | null {
  if (!excelFieldName) return null;
  
  // 清理字段名：去掉*, (可选), 空格等
  const cleanName = excelFieldName
    .replace(/\*/g, '')           // 去掉*
    .replace(/\(可选\)/g, '')      // 去掉(可选)
    .replace(/\(必填\)/g, '')      // 去掉(必填)
    .replace(/\s+/g, '')          // 去掉空格
    .toLowerCase();               // 转小写
  
  // 遍历映射规则，查找匹配
  for (const [dbField, excelNames] of Object.entries(FIELD_MAPPING_RULES)) {
    for (const name of excelNames) {
      const cleanRuleName = name.toLowerCase().replace(/\s+/g, '');
      
      // 完全匹配
      if (cleanName === cleanRuleName) {
        return dbField;
      }
      
      // 包含匹配（只要包含关键字）
      if (cleanName.includes(cleanRuleName) || cleanRuleName.includes(cleanName)) {
        return dbField;
      }
    }
  }
  
  return null;
}

/**
 * 从Excel行数据中获取字段值（支持模糊匹配）
 * @param rowData - Excel行数据对象
 * @param dbFieldName - 数据库字段名
 * @returns 字段值
 */
export function getFieldValue(rowData: Record<string, any>, dbFieldName: string): any {
  // 先尝试直接匹配
  const mappingRules = FIELD_MAPPING_RULES[dbFieldName as keyof typeof FIELD_MAPPING_RULES] || [];
  
  for (const excelName of mappingRules) {
    // 尝试各种可能的字段名
    const possibleNames = [
      excelName,
      excelName + '*',
      excelName + '(可选)',
      excelName + '(必填)',
      excelName + ' ',
      ' ' + excelName
    ];
    
    for (const name of possibleNames) {
      if (rowData[name] !== undefined && rowData[name] !== null && rowData[name] !== '') {
        return rowData[name];
      }
    }
  }
  
  // 如果都没找到，尝试模糊匹配
  for (const key in rowData) {
    const matchedField = matchFieldName(key);
    if (matchedField === dbFieldName) {
      return rowData[key];
    }
  }
  
  return null;
}

/**
 * 批量获取字段值
 * @param rowData - Excel行数据
 * @param fieldNames - 要获取的数据库字段名数组
 * @returns 字段值对象
 */
export function getFieldValues(rowData: Record<string, any>, fieldNames: string[]): Record<string, any> {
  const result: Record<string, any> = {};
  
  for (const fieldName of fieldNames) {
    result[fieldName] = getFieldValue(rowData, fieldName);
  }
  
  return result;
}

/**
 * 示例：使用方法
 */
export function exampleUsage() {
  const excelRow = {
    '项目名称*': '天兴芦花',
    '卸货数量(可选)': 10.5,
    '备注': '正常运输',
    '运费': 5000  // 缺少"金额"两字
  };
  
  // 方式1：单个字段获取
  const projectName = getFieldValue(excelRow, 'project_name');  // '天兴芦花'
  const unloadingWeight = getFieldValue(excelRow, 'unloading_weight');  // 10.5
  const remarks = getFieldValue(excelRow, 'remarks');  // '正常运输'
  const currentCost = getFieldValue(excelRow, 'current_cost');  // 5000（模糊匹配到'运费'）
  
  // 方式2：批量获取
  const values = getFieldValues(excelRow, [
    'project_name',
    'unloading_weight',
    'remarks',
    'current_cost'
  ]);
  // { project_name: '天兴芦花', unloading_weight: 10.5, remarks: '正常运输', current_cost: 5000 }
}

