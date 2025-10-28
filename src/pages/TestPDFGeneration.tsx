import React from 'react';
import { generatePrintVersion } from '@/components/TransportDocumentGenerator';
import { LogisticsRecord } from '@/pages/BusinessEntry/types';

// 测试用的运单记录
const testRecord: LogisticsRecord = {
  id: 'test-001',
  auto_number: 'YS20250127001',
  project_id: 'proj-001',
  project_name: '测试运输项目',
  chain_id: 'chain-001',
  chain_name: '测试合作链路',
  billing_type_id: 1,
  driver_id: 'driver-001',
  driver_name: '张三',
  loading_location: '北京仓库|天津仓库',
  unloading_location: '上海仓库|苏州仓库',
  loading_date: '2025-01-27T08:00:00Z',
  unloading_date: '2025-01-28T16:00:00Z',
  loading_weight: 25.5,
  unloading_weight: 25.3,
  current_cost: 1500.00,
  payable_cost: 1600.00,
  payable_cost: 1600.00,
  license_plate: '京A12345',
  driver_phone: '13800138000',
  transport_type: '实际运输',
  extra_cost: 100.00,
  remarks: '正常运输，无异常',
  loading_weighbridge_image_url: 'https://via.placeholder.com/300x200/4CAF50/FFFFFF?text=装货磅单',
  unloading_weighbridge_image_url: 'https://via.placeholder.com/300x200/2196F3/FFFFFF?text=卸货磅单',
  external_tracking_numbers: ['HL20250127001', 'MB20250127001'],
  other_platform_names: ['货拉拉', '满帮'],
  created_at: '2025-01-27T10:00:00Z'
};

const TestPDFGeneration: React.FC = () => {
  const handleTestPDF = async () => {
    try {
      const printHTML = await generatePrintVersion(testRecord);
      const previewWindow = window.open('', '_blank', 'width=1000,height=800,scrollbars=yes');
      if (previewWindow) {
        previewWindow.document.write(printHTML);
        previewWindow.document.close();
      } else {
        alert('无法打开预览窗口，请检查浏览器弹窗设置');
      }
    } catch (error) {
      console.error('PDF生成测试失败:', error);
      alert('PDF生成测试失败: ' + error);
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">运输单据PDF生成功能测试</h1>
      <div className="space-y-4">
        <p className="text-gray-600">
          点击下面的按钮测试PDF生成功能。将会生成一个包含测试运单数据的运输单据PDF。
        </p>
        
        <button
          onClick={handleTestPDF}
          className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-medium"
        >
          📄 测试生成运输单据预览
        </button>
        
        <div className="mt-6 p-4 bg-gray-100 rounded-lg">
          <h3 className="font-semibold mb-2">测试数据预览:</h3>
          <div className="text-sm space-y-1">
            <p><strong>运单编号:</strong> {testRecord.auto_number}</p>
            <p><strong>项目名称:</strong> {testRecord.project_name}</p>
            <p><strong>司机信息:</strong> {testRecord.driver_name} | {testRecord.license_plate}</p>
            <p><strong>运输线路:</strong> {testRecord.loading_location} → {testRecord.unloading_location}</p>
            <p><strong>装货重量:</strong> {testRecord.loading_weight} 吨</p>
            <p><strong>卸货重量:</strong> {testRecord.unloading_weight} 吨</p>
            <p><strong>运费:</strong> ¥{testRecord.current_cost}</p>
            <p><strong>额外费用:</strong> ¥{testRecord.extra_cost}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestPDFGeneration;
