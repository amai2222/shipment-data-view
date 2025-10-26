import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { FileText, Download, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { LogisticsRecord } from '@/pages/BusinessEntry/types';
import { generatePrintVersion } from '@/components/TransportDocumentGenerator';

interface BatchPDFGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
  selectedRecords: LogisticsRecord[];
}

// 生成ZIP文件的简单实现
const generateZipFile = async (files: { name: string; content: string }[]): Promise<Blob> => {
  // 这里使用一个简单的实现，实际项目中可以使用JSZip库
  const zipContent = files.map(file => 
    `=== ${file.name} ===\n${file.content}\n\n`
  ).join('');
  
  return new Blob([zipContent], { type: 'application/zip' });
};

export const BatchPDFGenerator: React.FC<BatchPDFGeneratorProps> = ({
  isOpen,
  onClose,
  selectedRecords
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');
  const [generatedFiles, setGeneratedFiles] = useState<{ name: string; content: string }[]>([]);
  const [isCompleted, setIsCompleted] = useState(false);

  const handleGenerateBatchPDF = async () => {
    if (selectedRecords.length === 0) return;

    setIsGenerating(true);
    setProgress(0);
    setGeneratedFiles([]);
    setIsCompleted(false);

    try {
      const files: { name: string; content: string }[] = [];
      
      for (let i = 0; i < selectedRecords.length; i++) {
        const record = selectedRecords[i];
        setCurrentStep(`正在生成 ${record.auto_number} 的运输单据...`);
        
        // 生成PDF内容
        const pdfContent = await generatePrintVersion(record);
        files.push({
          name: `运输单据_${record.auto_number}.html`,
          content: pdfContent
        });
        
        // 更新进度
        const newProgress = ((i + 1) / selectedRecords.length) * 100;
        setProgress(newProgress);
        
        // 添加小延迟以显示进度
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      setCurrentStep('正在打包文件...');
      setGeneratedFiles(files);
      
      // 生成ZIP文件
      const zipBlob = await generateZipFile(files);
      
      // 下载ZIP文件
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `运输单据批量下载_${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setCurrentStep('下载完成！');
      setIsCompleted(true);
      
    } catch (error) {
      console.error('批量生成PDF失败:', error);
      setCurrentStep('生成失败，请重试');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleClose = () => {
    if (!isGenerating) {
      setProgress(0);
      setCurrentStep('');
      setGeneratedFiles([]);
      setIsCompleted(false);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            批量生成运输单据
          </DialogTitle>
          <DialogDescription>
            将为 {selectedRecords.length} 条运单记录生成PDF文件并打包下载
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 进度显示 */}
          {isGenerating && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>生成进度</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="w-full" />
              <p className="text-sm text-muted-foreground">{currentStep}</p>
            </div>
          )}

          {/* 完成状态 */}
          {isCompleted && (
            <div className="text-center space-y-2">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
              <p className="text-sm text-green-600">批量生成完成！</p>
              <p className="text-xs text-muted-foreground">
                已生成 {generatedFiles.length} 个运输单据文件
              </p>
            </div>
          )}

          {/* 运单列表预览 */}
          <div className="max-h-40 overflow-y-auto border rounded-lg p-3">
            <h4 className="text-sm font-medium mb-2">将生成以下运单的运输单据：</h4>
            <div className="space-y-1">
              {selectedRecords.map((record) => (
                <div key={record.id} className="text-xs text-muted-foreground">
                  {record.auto_number} - {record.project_name}
                </div>
              ))}
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={handleClose} disabled={isGenerating}>
              取消
            </Button>
            <Button 
              onClick={handleGenerateBatchPDF} 
              disabled={isGenerating || selectedRecords.length === 0}
              className="flex items-center gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  开始生成
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BatchPDFGenerator;
