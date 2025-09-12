// 临时测试页面 - 用于验证日期解析功能
import { parseExcelDateToChina } from '../utils/dateUtils';

export default function DateTest() {
  const testDates = [
    '2025/9/9',
    '2025/9/10', 
    '2025/9/11',
    '2025-09-09',
    '2025年9月9日',
    '9/9',
    new Date('2025-09-09'),
    45285, // Excel日期序列号
  ];

  const testResults = testDates.map((date, index) => {
    try {
      const result = parseExcelDateToChina(date);
      return { input: date, output: result, success: true, error: null };
    } catch (error: any) {
      return { input: date, output: null, success: false, error: error.message };
    }
  });

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">日期解析测试</h1>
      <div className="space-y-2">
        {testResults.map((result, index) => (
          <div key={index} className={`p-3 border rounded ${result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <div className="font-mono text-sm">
              <strong>输入:</strong> {String(result.input)} ({typeof result.input})
            </div>
            {result.success ? (
              <div className="text-green-700">
                <strong>输出:</strong> {result.output}
              </div>
            ) : (
              <div className="text-red-700">
                <strong>错误:</strong> {result.error}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
