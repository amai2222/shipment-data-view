// 增强的模板生成工具 - 借鉴数据维护-数据导入的专业处理
// 提供详细的说明、示例数据和格式要求

import * as XLSX from 'xlsx';

export interface TemplateConfig {
  sheetName: string;
  fileName: string;
  headers: string[];
  fieldDescriptions: string[];
  billingTypeDescriptions: string[];
  examples: any[][];
  columnWidths: number[];
}

// 运单导入模板配置
export const WAYBILL_TEMPLATE_CONFIG: TemplateConfig = {
  sheetName: "运单导入模板",
  fileName: "运单导入模板.xlsx",
  headers: [
    '项目名称*', '合作链路(可选)', '司机姓名*', '车牌号*', '司机电话(可选)', 
    '装货地点*', '卸货地点*', '装货日期*', '卸货日期(可选)', '装货数量*', 
    '卸货数量(可选)', '运费金额(可选)', '额外费用(可选)', '运输类型(可选)', 
    '备注(可选)', '其他平台名称(可选)', '其他平台运单号(可选)'
  ],
  fieldDescriptions: [
    '必填(验重)', '可选', '必填(验重)', '必填(验重)', '可选', 
    '必填(验重)', '必填(验重)', '必填(验重)', '可选', '必填(验重)', 
    '可选', '可选', '可选', '可选(默认:实际运输)', '可选', '可选', '可选'
  ],
  billingTypeDescriptions: [
    '', '', '', '', '', '', '', '', '', 
    '根据合作链路计费类型动态显示: 重量(吨)/发车次数/体积(立方)', 
    '根据合作链路计费类型动态显示: 重量(吨)/发车次数/体积(立方)', 
    '', '', '', '', '', ''
  ],
  examples: [
    // 示例1：标准格式
    [
      '示例项目A', '默认链路', '张三', '京A12345', '13800138000', 
      '北京仓库', '上海仓库', '2025-01-15', '2025-01-16', '10.5', 
      '10.2', '5000', '200', '实际运输', '正常运输', '平台A,平台B', '运单1|运单2,运单3'
    ],
    // 示例2：中文日期格式
    [
      '示例项目B', '', '李四', '沪B67890', '13900139000', 
      '上海仓库', '广州仓库', '5月20日', '', '15.0', 
      '14.8', '8000', '300', '实际运输', '加急运输', '平台C', '运单4|运单5|运单6'
    ],
    // 示例3：完整中文格式
    [
      '示例项目C', '特殊链路', '王五', '粤C11111', '13700137000', 
      '广州仓库', '深圳仓库', '2025年12月25日', '2025年12月26日', '8.0', 
      '7.9', '4000', '100', '实际运输', '标准运输', '', ''
    ],
    // 示例4：短格式日期
    [
      '示例项目D', '默认链路', '赵六', '京D22222', '13600136000', 
      '北京仓库', '天津仓库', '3/15', '3/16', '12.0', 
      '11.8', '6000', '250', '实际运输', '混合运输', '平台A,平台B,平台C', '运单7,运单8|运单9,运单10|运单11'
    ],
    // 示例5：最小必填字段
    [
      '示例项目E', '', '孙七', '鲁E33333', '', 
      '济南仓库', '青岛仓库', '2025-06-01', '', '5.5', 
      '', '', '', '', '', '', ''
    ]
  ],
  columnWidths: [
    18, // 项目名称*
    15, // 合作链路(可选)
    12, // 司机姓名*
    15, // 车牌号*
    18, // 司机电话(可选)
    18, // 装货地点*
    18, // 卸货地点*
    15, // 装货日期*
    18, // 卸货日期(可选)
    15, // 装货数量*
    15, // 卸货数量(可选)
    15, // 运费金额(可选)
    15, // 额外费用(可选)
    18, // 运输类型(可选)
    18, // 备注(可选)
    25, // 其他平台名称(可选)
    30  // 其他平台运单号(可选)
  ]
};

// 生成增强的Excel模板
export const generateEnhancedWaybillTemplate = (): void => {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([]);
  
  // 构建模板数据
  const templateData = [
    // 标题行
    WAYBILL_TEMPLATE_CONFIG.headers,
    // 字段说明行
    WAYBILL_TEMPLATE_CONFIG.fieldDescriptions,
    // 计费类型说明行
    WAYBILL_TEMPLATE_CONFIG.billingTypeDescriptions,
    // 空行分隔
    [],
    // 示例数据标题
    ['示例数据（支持多种日期格式）'],
    // 示例数据
    ...WAYBILL_TEMPLATE_CONFIG.examples,
    // 空行分隔
    [],
    // 使用说明
    ['使用说明：'],
    ['1. 标有*的字段为必填字段，用于重复数据检测'],
    ['2. 日期格式支持：2025-01-15、5月20日、2025年12月25日、3/15等'],
    ['3. 其他平台名称：多个平台用逗号分隔，如：平台A,平台B'],
    ['4. 其他平台运单号：每个平台的运单号用|分隔，多个平台用逗号分隔'],
    ['5. 运单号示例：运单1|运单2,运单3|运单4'],
    ['6. 装货数量：根据合作链路计费类型，可能是重量(吨)、发车次数或体积(立方)'],
    ['7. 运输类型：默认为"实际运输"，可选"退货"等'],
    ['8. 如果卸货日期为空，系统将自动使用装货日期'],
    ['9. 如果司机或地点不存在，系统将自动创建并关联到对应项目'],
    ['10. 系统会自动生成运单编号，格式：YDN + 日期 + 序号']
  ];
  
  // 设置工作表数据
  XLSX.utils.sheet_add_aoa(ws, templateData);
  
  // 设置列宽
  ws['!cols'] = WAYBILL_TEMPLATE_CONFIG.columnWidths.map(width => ({ wch: width }));
  
  // 设置行高
  ws['!rows'] = [
    { hpt: 20 }, // 标题行
    { hpt: 15 }, // 字段说明行
    { hpt: 15 }, // 计费类型说明行
    { hpt: 10 }, // 空行
    { hpt: 18 }, // 示例数据标题
    ...WAYBILL_TEMPLATE_CONFIG.examples.map(() => ({ hpt: 15 })), // 示例数据行
    { hpt: 10 }, // 空行
    { hpt: 15 }, // 使用说明标题
    ...Array(10).fill({ hpt: 12 }) // 使用说明行
  ];
  
  // 设置单元格样式
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  
  // 标题行样式
  for (let col = range.s.c; col <= range.e.c; col++) {
    const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
    if (!ws[cellAddress]) ws[cellAddress] = { v: '' };
    ws[cellAddress].s = {
      font: { bold: true, color: { rgb: "FFFFFF" } },
      fill: { fgColor: { rgb: "366092" } },
      alignment: { horizontal: "center", vertical: "center" }
    };
  }
  
  // 字段说明行样式
  for (let col = range.s.c; col <= range.e.c; col++) {
    const cellAddress = XLSX.utils.encode_cell({ r: 1, c: col });
    if (!ws[cellAddress]) ws[cellAddress] = { v: '' };
    ws[cellAddress].s = {
      font: { italic: true, color: { rgb: "666666" } },
      fill: { fgColor: { rgb: "F2F2F2" } },
      alignment: { horizontal: "center", vertical: "center" }
    };
  }
  
  // 计费类型说明行样式
  for (let col = range.s.c; col <= range.e.c; col++) {
    const cellAddress = XLSX.utils.encode_cell({ r: 2, c: col });
    if (!ws[cellAddress]) ws[cellAddress] = { v: '' };
    ws[cellAddress].s = {
      font: { italic: true, color: { rgb: "0066CC" } },
      fill: { fgColor: { rgb: "E6F3FF" } },
      alignment: { horizontal: "center", vertical: "center" }
    };
  }
  
  // 示例数据标题样式
  const exampleTitleAddress = XLSX.utils.encode_cell({ r: 4, c: 0 });
  if (!ws[exampleTitleAddress]) ws[exampleTitleAddress] = { v: '' };
  ws[exampleTitleAddress].s = {
    font: { bold: true, color: { rgb: "006600" } },
    fill: { fgColor: { rgb: "E6FFE6" } }
  };
  
  // 使用说明标题样式
  const usageTitleAddress = XLSX.utils.encode_cell({ r: 4 + WAYBILL_TEMPLATE_CONFIG.examples.length + 1, c: 0 });
  if (!ws[usageTitleAddress]) ws[usageTitleAddress] = { v: '' };
  ws[usageTitleAddress].s = {
    font: { bold: true, color: { rgb: "CC6600" } },
    fill: { fgColor: { rgb: "FFF2E6" } }
  };
  
  // 添加工作表到工作簿
  XLSX.utils.book_append_sheet(wb, ws, WAYBILL_TEMPLATE_CONFIG.sheetName);
  
  // 下载文件
  XLSX.writeFile(wb, WAYBILL_TEMPLATE_CONFIG.fileName);
};

// 生成简化的模板（用于快速导入）
export const generateSimpleWaybillTemplate = (): void => {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    // 表头
    ['项目名称*', '司机姓名*', '车牌号*', '装货地点*', '卸货地点*', '装货日期*', '装货数量*', '运费金额*'],
    // 示例数据
    ['示例项目', '张三', '京A12345', '北京仓库', '上海仓库', '2025-01-15', '10.5', '5000']
  ]);
  
  // 设置列宽
  ws['!cols'] = [
    { wch: 18 }, { wch: 12 }, { wch: 15 }, { wch: 18 }, 
    { wch: 18 }, { wch: 15 }, { wch: 15 }, { wch: 15 }
  ];
  
  XLSX.utils.book_append_sheet(wb, ws, "运单导入模板-简化版");
  XLSX.writeFile(wb, "运单导入模板-简化版.xlsx");
};

// 验证模板格式
export const validateTemplateFormat = (worksheet: XLSX.WorkSheet): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  // 获取表头
  const headerRow = XLSX.utils.sheet_to_json(worksheet, { header: 1 })[0] as string[];
  
  if (!headerRow || headerRow.length === 0) {
    errors.push('模板文件没有表头');
    return { isValid: false, errors };
  }
  
  // 检查必需字段
  const requiredFields = ['项目名称', '司机姓名', '车牌号', '装货地点', '卸货地点', '装货日期', '装货数量'];
  const missingFields = requiredFields.filter(field => !headerRow.includes(field));
  
  if (missingFields.length > 0) {
    errors.push(`缺少必需字段: ${missingFields.join(', ')}`);
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};
