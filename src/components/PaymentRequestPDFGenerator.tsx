import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileText } from 'lucide-react';

interface PaymentRequestPDFGeneratorProps {
  requestId: string;
  requestData?: any;
  onClose?: () => void;
}

// 生成条形码
const generateBarcode = (text: string): string => {
  // 简单的条形码生成（实际项目中可以使用专业的条形码库）
  const chars = '█▉▊▋▌▍▎▏';
  let barcode = '';
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    barcode += chars[char % chars.length];
  }
  return barcode;
};

// HTML转义函数
const escapeHtml = (text: string): string => {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

// 生成付款申请单PDF的HTML内容
const generatePaymentRequestPDF = async (requestData: any): Promise<string> => {
  if (!requestData) {
    throw new Error('付款申请单数据不能为空');
  }

  const { waybills, partner_totals, total_waybills } = requestData;

  // 基础信息
  const basicInfo = [
    { label: '申请编号:', value: requestData.request_id || '未知' },
    { label: '申请时间:', value: new Date().toLocaleString('zh-CN') },
    { label: '运单数量:', value: `${total_waybills || 0} 条` },
    { label: '合作方数量:', value: `${partner_totals?.length || 0} 个` }
  ];

  // 合作方汇总信息
  const partnerInfo = (partner_totals || []).map((partner: any) => ({
    label: `${partner.partner_name} (${partner.level}级):`,
    value: `¥${(partner.total_amount || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`
  }));

  // 运单明细信息
  const waybillInfo = (waybills || []).map((waybill: any) => ({
    label: `${waybill.auto_number}:`,
    value: `${waybill.driver_name} | ${waybill.loading_location} → ${waybill.unloading_location} | ¥${(waybill.payable_cost || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`
  }));

  const barcode = generateBarcode(requestData.request_id || 'UNKNOWN');

  return `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>付款申请单 - ${requestData.request_id}</title>
      <style>
        @media print {
          @page {
            size: A4;
            margin: 20mm;
          }
          body {
            margin: 0;
            padding: 0;
            font-family: 'Microsoft YaHei', Arial, sans-serif;
            font-size: 12px;
            line-height: 1.4;
            color: #000;
          }
        }
        
        body {
          font-family: 'Microsoft YaHei', Arial, sans-serif;
          font-size: 12px;
          line-height: 1.4;
          color: #000;
          margin: 0;
          padding: 20px;
          background: white;
        }
        
        .company-logo {
          text-align: center;
          font-size: 28px;
          font-weight: bold;
          color: #2563eb;
          margin-bottom: 20px;
          border-bottom: 2px solid #2563eb;
          padding-bottom: 10px;
        }
        
        .document-content {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 30px;
        }
        
        .info-section {
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 15px;
          background: #f9fafb;
        }
        
        .section-title {
          font-size: 16px;
          font-weight: bold;
          color: #1f2937;
          margin-bottom: 15px;
          text-align: center;
          border-bottom: 1px solid #d1d5db;
          padding-bottom: 8px;
        }
        
        .info-item {
          display: flex;
          margin-bottom: 8px;
          align-items: flex-start;
        }
        
        .info-label {
          font-weight: bold;
          color: #374151;
          min-width: 120px;
          margin-right: 8px;
        }
        
        .info-value {
          color: #1f2937;
          flex: 1;
          word-break: break-all;
        }
        
        .waybill-section {
          grid-column: 1 / -1;
          margin-top: 20px;
        }
        
        .waybill-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 10px;
        }
        
        .waybill-table th,
        .waybill-table td {
          border: 1px solid #d1d5db;
          padding: 8px;
          text-align: left;
        }
        
        .waybill-table th {
          background: #f3f4f6;
          font-weight: bold;
        }
        
        .barcode-section {
          text-align: center;
          margin: 30px 0;
          padding: 20px;
          border: 2px dashed #d1d5db;
          border-radius: 8px;
          background: #f9fafb;
        }
        
        .barcode-title {
          font-size: 14px;
          font-weight: bold;
          color: #374151;
          margin-bottom: 10px;
        }
        
        .barcode {
          font-family: 'Courier New', monospace;
          font-size: 10px;
          line-height: 1;
          color: #000;
          background: white;
          padding: 10px;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          display: inline-block;
          letter-spacing: 1px;
        }
        
        .footer {
          margin-top: 40px;
          text-align: center;
          font-size: 10px;
          color: #6b7280;
          border-top: 1px solid #d1d5db;
          padding-top: 15px;
        }
        
        .footer-item {
          margin-bottom: 5px;
        }
        
        .print-button {
          position: fixed;
          top: 20px;
          right: 20px;
          z-index: 1000;
          background: #2563eb;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          font-weight: bold;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        
        .print-button:hover {
          background: #1d4ed8;
        }
        
        @media print {
          .print-button {
            display: none;
          }
        }
      </style>
    </head>
    <body>
      <button class="print-button" onclick="window.print()">
        🖨️ 打印付款申请单
      </button>
      
      <div class="company-logo">中科智运付款申请单</div>
      
      <div class="document-content">
        <div class="info-section">
          <div class="section-title">申请信息</div>
          ${basicInfo.map(item => `
            <div class="info-item">
              <div class="info-label">${escapeHtml(item.label)}</div>
              <div class="info-value">${escapeHtml(item.value)}</div>
            </div>
          `).join('')}
        </div>
        
        <div class="info-section">
          <div class="section-title">合作方汇总</div>
          ${partnerInfo.map(item => `
            <div class="info-item">
              <div class="info-label">${escapeHtml(item.label)}</div>
              <div class="info-value">${escapeHtml(item.value)}</div>
            </div>
          `).join('')}
        </div>
      </div>
      
      <div class="waybill-section">
        <div class="section-title">运单明细</div>
        <table class="waybill-table">
          <thead>
            <tr>
              <th>运单号</th>
              <th>司机</th>
              <th>路线</th>
              <th>装货日期</th>
              <th>司机应收</th>
            </tr>
          </thead>
          <tbody>
            ${waybillInfo.map(item => `
              <tr>
                <td>${escapeHtml(item.label.replace(':', ''))}</td>
                <td>${escapeHtml(item.value.split(' | ')[0])}</td>
                <td>${escapeHtml(item.value.split(' | ')[1])}</td>
                <td>${escapeHtml(item.value.split(' | ')[2] || '')}</td>
                <td>${escapeHtml(item.value.split(' | ')[3] || '')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      
      <div class="barcode-section">
        <div class="barcode-title">申请单号条形码</div>
        <div class="barcode">${barcode}</div>
        <div style="margin-top: 8px; font-size: 10px; color: #6b7280;">
          申请单号: ${escapeHtml(requestData.request_id || '未知')}
        </div>
      </div>
      
      <div class="footer">
        <div class="footer-item">生成时间: ${new Date().toLocaleString('zh-CN')}</div>
        <div class="footer-item">本申请单具有法律效力，请妥善保管</div>
        <div class="footer-item">中科智运运输有限公司</div>
      </div>
    </body>
    </html>
  `;
};

export const PaymentRequestPDFGenerator: React.FC<PaymentRequestPDFGeneratorProps> = ({ 
  requestId, 
  requestData,
  onClose 
}) => {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGeneratePDF = async () => {
    setIsGenerating(true);
    
    try {
      let pdfData = requestData;
      
      // 如果没有提供数据，从数据库获取
      if (!pdfData) {
        const { data, error } = await supabase.rpc('generate_payment_request_pdf_data', {
          p_record_ids: [] // 这里需要传入实际的运单ID数组
        });
        
        if (error) throw error;
        pdfData = data;
      }
      
      // 生成PDF内容
      const printHTML = await generatePaymentRequestPDF(pdfData);
      
      // 创建新窗口并写入HTML内容
      const previewWindow = window.open('', '_blank', 'width=1000,height=800,scrollbars=yes');
      if (previewWindow) {
        previewWindow.document.write(printHTML);
        previewWindow.document.close();
        
        // 处理窗口关闭事件
        previewWindow.onbeforeunload = () => {};
      } else {
        throw new Error('无法打开预览窗口，请检查浏览器弹窗设置');
      }
    } catch (error) {
      console.error('生成PDF失败:', error);
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      alert(`生成PDF失败: ${errorMessage}，请重试`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleGeneratePDF}
        disabled={isGenerating}
        className="flex items-center gap-2"
      >
        {isGenerating ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
            生成中...
          </>
        ) : (
          <>
            <FileText className="h-4 w-4" />
            生成PDF
          </>
        )}
      </Button>
    </div>
  );
};

export default PaymentRequestPDFGenerator;
