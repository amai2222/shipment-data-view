import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileText, Printer } from 'lucide-react';
import { LogisticsRecord } from '@/pages/BusinessEntry/types';

interface TransportDocumentGeneratorProps {
  record: LogisticsRecord;
  onClose?: () => void;
}

// 生成条形码的简单实现（使用CSS模拟）
const generateBarcode = (text: string) => {
  // 简单的条形码模拟，实际项目中可以使用专业的条形码库
  if (!text || text.length === 0) {
    return '░'.repeat(32); // 返回空条形码
  }
  
  const bars = text.split('').map(char => {
    const code = char.charCodeAt(0);
    return Array.from({ length: 8 }, (_, i) => (code >> i) & 1 ? '█' : '░').join('');
  }).join('');
  
  return bars;
};

// HTML转义函数，防止XSS攻击
const escapeHtml = (text: string): string => {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

// 渲染信息项的函数，支持图片显示
const renderInfoItem = (item: { label: string; value: string }) => {
  const isImageUrl = item.label.includes('磅单') && item.value.startsWith('http');
  
  if (isImageUrl) {
    return `
      <div class="info-item">
        <span class="info-label">${escapeHtml(item.label)}</span>
        <div class="info-value">
          <img src="${escapeHtml(item.value)}" alt="${escapeHtml(item.label)}" class="weighbridge-image" />
        </div>
      </div>
    `;
  } else {
    return `
      <div class="info-item">
        <span class="info-label">${escapeHtml(item.label)}</span>
        <span class="info-value">${escapeHtml(item.value)}</span>
      </div>
    `;
  }
};

// 生成打印版本的HTML
export const generatePrintVersion = (record: LogisticsRecord) => {
  // 数据验证
  if (!record) {
    throw new Error('运单记录不能为空');
  }
  
  if (!record.auto_number) {
    throw new Error('运输单号不能为空');
  }
  const basicInfo = [
    { label: '客户名称:', value: record.project_name || '未知' },
    { label: '运输单号:', value: record.auto_number || '未知' },
    { label: '运输线路:', value: `${record.loading_location || '未知'} → ${record.unloading_location || '未知'}` },
    { label: '车辆信息:', value: `${record.license_plate || '未知'} | ${record.driver_name || '未知'}` },
    { label: '司机信息:', value: `${record.driver_name || '未知'} | ${record.driver_phone || '未知'}` },
    { label: '货物名称:', value: '运输货物' }
  ];

  const loadingInfo = [
    { label: '发货地址:', value: record.loading_location || '未知' },
    { label: '装货时间:', value: record.loading_date ? new Date(record.loading_date).toLocaleString('zh-CN') : '未知' },
    { label: '装货吨数:', value: `${record.loading_weight?.toFixed(2) || '0.00'} 吨` }
  ];

  // 如果有装货磅单图片，添加到装货信息中
  if (record.loading_weighbridge_image_url) {
    loadingInfo.push({ label: '装货磅单:', value: record.loading_weighbridge_image_url });
  }

  const unloadingInfo = [
    { label: '收货地址:', value: record.unloading_location || '未知' },
    { label: '卸货时间:', value: record.unloading_date ? new Date(record.unloading_date).toLocaleString('zh-CN') : '待定' },
    { label: '卸货吨数:', value: `${record.unloading_weight?.toFixed(2) || '0.00'} 吨` }
  ];

  // 如果有卸货磅单图片，添加到卸货信息中
  if (record.unloading_weighbridge_image_url) {
    unloadingInfo.push({ label: '卸货磅单:', value: record.unloading_weighbridge_image_url });
  }

  const barcode = generateBarcode(record.auto_number || 'UNKNOWN');

  return `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>运输单据 - ${record.auto_number}</title>
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
          grid-template-columns: 1fr 1fr 1fr;
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
          min-width: 80px;
          margin-right: 8px;
        }
        
        .info-value {
          color: #1f2937;
          flex: 1;
          word-break: break-all;
        }
        
        .weighbridge-image {
          max-width: 200px;
          max-height: 150px;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          object-fit: contain;
          margin-top: 5px;
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
        🖨️ 打印运输单据
      </button>
      
      <div class="company-logo">中科智运运输票据</div>
      
      <div class="document-content">
        <div class="info-section">
          <div class="section-title">基础信息</div>
          ${basicInfo.map(item => renderInfoItem(item)).join('')}
        </div>
        
        <div class="info-section">
          <div class="section-title">装货信息</div>
          ${loadingInfo.map(item => renderInfoItem(item)).join('')}
        </div>
        
        <div class="info-section">
          <div class="section-title">卸货信息</div>
          ${unloadingInfo.map(item => renderInfoItem(item)).join('')}
        </div>
      </div>
      
      <div class="barcode-section">
        <div class="barcode-title">运输单号条形码</div>
        <div class="barcode">${barcode}</div>
        <div style="margin-top: 8px; font-size: 10px; color: #6b7280;">
          运输单号: ${escapeHtml(record.auto_number || '未知')}
        </div>
      </div>
      
      <div class="footer">
        <div class="footer-item">生成时间: ${new Date().toLocaleString('zh-CN')}</div>
        <div class="footer-item">本单据具有法律效力，请妥善保管</div>
        <div class="footer-item">中科智运运输有限公司</div>
      </div>
    </body>
    </html>
  `;
};

export const TransportDocumentGenerator: React.FC<TransportDocumentGeneratorProps> = ({ 
  record, 
  onClose 
}) => {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGeneratePDF = async () => {
    setIsGenerating(true);
    
    try {
      // 生成打印版本的HTML
      const printHTML = generatePrintVersion(record);
      
      // 创建新窗口并写入HTML内容（预览模式，不自动打印）
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
      // 使用更友好的错误提示
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
            运输单据
          </>
        )}
      </Button>
    </div>
  );
};

export default TransportDocumentGenerator;
