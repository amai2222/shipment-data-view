import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import * as XLSX from 'https://esm.sh/xlsx@0.18.5'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PaymentSheetData {
  paying_partner_id: string;
  paying_partner_name: string;
  paying_partner_full_name?: string;
  paying_partner_bank_account?: string;
  paying_partner_bank_name?: string;
  paying_partner_branch_name?: string;
  header_company_name: string;
  records: Array<{
    record: {
      id: string;
      auto_number: string;
      project_name: string;
      driver_name: string;
      loading_location: string;
      unloading_location: string;
      loading_date: string;
      unloading_date: string;
      loading_weight?: number;
      unloading_weight?: number;
      current_cost?: number;
      extra_cost?: number;
      payable_cost?: number;
      license_plate?: string;
      driver_phone?: string;
      transport_type?: string;
      remarks?: string;
      chain_name?: string;
      cargo_type?: string;
    };
    payable_amount: number;
  }>;
  total_payable: number;
  project_name: string;
}

interface RequestBody {
  sheetData: {
    sheets: PaymentSheetData[];
    all_records: any[];
  };
  requestId: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('开始处理Excel导出请求...');
    
    const { sheetData, requestId }: RequestBody = await req.json();
    console.log(`处理请求ID: ${requestId}, 包含 ${sheetData.sheets.length} 个工作表`);

    // 读取模板文件
    console.log('读取Excel模板文件...');
    const templateResponse = await fetch('https://public.supabase.co/payment_template_final.xlsx');
    if (!templateResponse.ok) {
      throw new Error(`无法读取模板文件: ${templateResponse.status}`);
    }
    
    const templateBuffer = await templateResponse.arrayBuffer();
    const templateWorkbook = XLSX.read(templateBuffer, { type: 'array' });
    console.log(`模板工作表数量: ${templateWorkbook.SheetNames.length}`);

    // 创建新工作簿
    const newWorkbook = XLSX.utils.book_new();

    // 为每个付款方创建工作表
    sheetData.sheets.forEach((sheet, index) => {
      console.log(`处理第 ${index + 1} 个工作表: ${sheet.paying_partner_name}`);
      
      // 复制模板工作表结构
      const templateSheetName = templateWorkbook.SheetNames[0];
      const templateSheet = templateWorkbook.Sheets[templateSheetName];
      const newSheet = XLSX.utils.json_to_sheet([]);
      
      // 复制模板的样式和结构（简化版本）
      Object.assign(newSheet, templateSheet);

      // 填充数据到工作表
      const data = [
        ['付款申请单'],
        [''],
        [`付款方: ${sheet.paying_partner_full_name || sheet.paying_partner_name}`],
        [`银行账户: ${sheet.paying_partner_bank_account || ''}`],
        [`开户行: ${sheet.paying_partner_bank_name || ''}`],
        [`支行网点: ${sheet.paying_partner_branch_name || ''}`],
        [`收款方: ${sheet.header_company_name}`],
        [`总金额: ¥${sheet.total_payable.toFixed(2)}`],
        [''],
        ['运单号', '项目名称', '司机姓名', '装货地点', '卸货地点', '装货日期', '卸货日期', '装货重量', '卸货重量', '运费', '额外费用', '应付金额', '车牌号', '司机电话', '运输类型', '货物类型', '备注']
      ];

      sheet.records.forEach(({ record, payable_amount }) => {
        data.push([
          record.auto_number || '',
          record.project_name || '',
          record.driver_name || '',
          record.loading_location || '',
          record.unloading_location || '',
          record.loading_date || '',
          record.unloading_date || '',
          record.loading_weight || '',
          record.unloading_weight || '',
          record.current_cost || 0,
          record.extra_cost || 0,
          payable_amount,
          record.license_plate || '',
          record.driver_phone || '',
          record.transport_type || '',
          record.cargo_type || '',
          record.remarks || ''
        ]);
      });

      // 将数据写入工作表
      const dataSheet = XLSX.utils.aoa_to_sheet(data);
      
      // 设置列宽
      const colWidths = [
        { wch: 15 }, // 运单号
        { wch: 20 }, // 项目名称
        { wch: 10 }, // 司机姓名
        { wch: 20 }, // 装货地点
        { wch: 20 }, // 卸货地点
        { wch: 12 }, // 装货日期
        { wch: 12 }, // 卸货日期
        { wch: 10 }, // 装货重量
        { wch: 10 }, // 卸货重量
        { wch: 10 }, // 运费
        { wch: 10 }, // 额外费用
        { wch: 12 }, // 应付金额
        { wch: 12 }, // 车牌号
        { wch: 15 }, // 司机电话
        { wch: 10 }, // 运输类型
        { wch: 10 }, // 货物类型
        { wch: 20 }  // 备注
      ];
      dataSheet['!cols'] = colWidths;

      // 添加工作表到工作簿
      const sheetName = `${sheet.paying_partner_name}_${index + 1}`.substring(0, 31);
      XLSX.utils.book_append_sheet(newWorkbook, dataSheet, sheetName);
    });

    console.log('生成Excel文件...');
    const excelBuffer = XLSX.write(newWorkbook, {
      type: 'array',
      bookType: 'xlsx'
    });

    console.log(`Excel文件生成完成，大小: ${excelBuffer.byteLength} 字节`);

    return new Response(excelBuffer, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="payment_request_${requestId}_${new Date().toISOString().split('T')[0]}.xlsx"`
      }
    });

  } catch (error) {
    console.error('Excel导出错误:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
})