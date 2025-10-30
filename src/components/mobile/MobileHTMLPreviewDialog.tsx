import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, Printer, Download } from 'lucide-react';
import { triggerHaptic } from '@/utils/mobile';

interface MobileHTMLPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  htmlContent: string;
}

export function MobileHTMLPreviewDialog({
  open,
  onOpenChange,
  title,
  htmlContent
}: MobileHTMLPreviewDialogProps) {
  
  const handlePrint = () => {
    triggerHaptic('medium');
    
    // 创建临时iframe进行打印
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    
    document.body.appendChild(iframe);
    
    const iframeDoc = iframe.contentWindow?.document;
    if (iframeDoc) {
      iframeDoc.open();
      iframeDoc.write(htmlContent);
      iframeDoc.close();
      
      // 等待内容加载完成后打印
      iframe.contentWindow?.focus();
      setTimeout(() => {
        iframe.contentWindow?.print();
        // 打印后移除iframe
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1000);
      }, 500);
    }
  };

  const handleDownload = () => {
    triggerHaptic('medium');
    
    try {
      // 创建Blob对象
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      
      // 创建下载链接
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title}-${new Date().getTime()}.html`;
      a.click();
      
      // 清理
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('下载失败:', error);
    }
  };

  const handleClose = () => {
    triggerHaptic('light');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-full h-[90vh] max-h-[90vh] p-0 gap-0 overflow-hidden flex flex-col">
        {/* 标题栏 */}
        <DialogHeader className="px-4 py-3 border-b bg-gradient-to-r from-blue-50 to-indigo-50 flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-bold text-blue-900">
              {title}
            </DialogTitle>
            <div className="flex items-center gap-2">
              {/* 打印按钮 */}
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
                className="h-9 px-3 bg-white hover:bg-blue-50 border-blue-200"
              >
                <Printer className="h-4 w-4 mr-1" />
                打印
              </Button>
              
              {/* 下载按钮 */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                className="h-9 px-3 bg-white hover:bg-green-50 border-green-200"
              >
                <Download className="h-4 w-4 mr-1" />
                下载
              </Button>
              
              {/* 关闭按钮 */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClose}
                className="h-9 w-9 p-0"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* HTML内容显示区域 */}
        <div className="flex-1 overflow-auto bg-white">
          <iframe
            srcDoc={htmlContent}
            className="w-full h-full border-none"
            title={title}
            sandbox="allow-same-origin"
          />
        </div>

        {/* 底部操作栏（移动端友好） */}
        <div className="flex-shrink-0 p-3 border-t bg-gray-50 flex gap-2">
          <Button
            onClick={handlePrint}
            className="flex-1 min-h-[48px] bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-md rounded-xl font-medium"
          >
            <Printer className="mr-2 h-5 w-5" />
            打印申请单
          </Button>
          <Button
            onClick={handleClose}
            variant="outline"
            className="min-h-[48px] px-6 border-2 rounded-xl font-medium"
          >
            关闭
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

