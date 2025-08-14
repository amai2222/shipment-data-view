import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useExcelImport } from './hooks/useExcelImport';
import { useLogisticsData, ImportReport } from './hooks/useLogisticsData';

// 定义组件接收的Props
interface ImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ImportDialog: React.FC<ImportDialogProps> = ({ isOpen, onClose }) => {
  const [file, setFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<ImportReport | null>(null);

  // 获取我们创建的Hooks
  const { parseExcel, isParsing, error: parseError } = useExcelImport();
  const { addLogisticsData, loading: isImporting } = useLogisticsData();

  // 使用 react-dropzone 实现文件拖拽上传
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setImportResult(null); // 重置上一次的导入结果
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv'],
    },
    maxFiles: 1,
  });

  // 处理导入按钮点击事件
  const handleImport = async () => {
    if (!file) return;

    try {
      // 1. 解析Excel文件
      const data = await parseExcel(file);
      // 2. 调用API提交数据
      const result = await addLogisticsData(data);
      // 3. 将返回的详细报告存入state以供UI渲染
      setImportResult(result);
    } catch (err) {
      // 这个catch主要捕获 parseExcel 抛出的错误
      console.error(err);
    }
  };

  // 重置所有状态，关闭对话框
  const handleClose = () => {
      setFile(null);
      setImportResult(null);
      onClose();
  }

  if (!isOpen) {
    return null;
  }

  const isLoading = isParsing || isImporting;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>导入物流数据</h2>

        {/* 文件上传区域 */}
        <div {...getRootProps()} className={`dropzone ${isDragActive ? 'active' : ''}`}>
          <input {...getInputProps()} />
          {file ? (
            <p>已选择文件: {file.name}</p>
          ) : (
            <p>将 .xlsx, .xls 或 .csv 文件拖拽到此处，或点击选择文件</p>
          )}
        </div>

        {/* 错误和结果展示 */}
        {parseError && <div className="error-message">解析错误: {parseError}</div>}

        {importResult && (
          <div className="import-results">
            <h3>导入报告</h3>
            <p>处理总行数: {importResult.processed}</p>
            <p className="success-text">成功: {importResult.successful}</p>
            <p className="failure-text">失败: {importResult.failures}</p>

            {importResult.failures > 0 && (
              <div className="error-details">
                <h4>错误详情:</h4>
                <ul>
                  {importResult.errors.map((err, index) => (
                    <li key={index}>
                      <strong>Excel行号 {err.line_number}:</strong> {err.error_message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* 操作按钮 */}
        <div className="modal-actions">
          <button onClick={handleClose} className="button-secondary">关闭</button>
          <button onClick={handleImport} disabled={!file || isLoading}>
            {isParsing ? '正在解析...' : isImporting ? '正在导入...' : '开始导入'}
          </button>
        </div>
      </div>
      {/* 建议添加一些CSS样式 */}
      <style jsx>{`
        .modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
        .modal-content { background: white; padding: 2rem; border-radius: 8px; width: 90%; max-width: 600px; }
        .dropzone { border: 2px dashed #ccc; border-radius: 8px; padding: 2rem; text-align: center; cursor: pointer; margin-bottom: 1rem; }
        .dropzone.active { border-color: #0070f3; }
        .modal-actions { display: flex; justify-content: flex-end; gap: 1rem; margin-top: 1.5rem; }
        .import-results { margin-top: 1rem; }
        .success-text { color: green; }
        .failure-text { color: red; }
        .error-details ul { max-height: 150px; overflow-y: auto; border: 1px solid #eee; padding: 0.5rem; list-style-position: inside; background: #fafafa; }
        .error-message { color: red; margin-top: 1rem; }
      `}</style>
    </div>
  );
};
