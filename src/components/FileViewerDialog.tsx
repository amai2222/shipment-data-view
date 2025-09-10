import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { X, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface FileViewerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileUrl: string;
  fileName?: string;
  fileType?: 'pdf' | 'image' | 'document' | 'other';
}

export function FileViewerDialog({ 
  open, 
  onOpenChange, 
  fileUrl, 
  fileName = '文件',
  fileType = 'other'
}: FileViewerDialogProps) {
  const [loading, setLoading] = useState(false);
  const [proxyUrl, setProxyUrl] = useState('');
  const { toast } = useToast();

  // 生成代理URL
  React.useEffect(() => {
    if (open && fileUrl) {
      generateProxyUrl();
    }
  }, [open, fileUrl]);

  const generateProxyUrl = async () => {
    try {
      // 暂时直接使用原始URL，避免代理服务的认证问题
      console.log('Using original URL:', fileUrl);
      setProxyUrl(fileUrl);
    } catch (error) {
      console.error('生成代理URL失败:', error);
      setProxyUrl(fileUrl);
    }
  };

  const handleDownload = async () => {
    try {
      setLoading(true);
      
      // 直接使用原始URL下载
      const response = await fetch(fileUrl);
      
      if (!response.ok) {
        throw new Error('下载失败');
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      toast({
        title: "成功",
        description: "文件下载完成",
      });
    } catch (error) {
      toast({
        title: "错误",
        description: "下载失败，请稍后重试",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getFileExtension = (url: string) => {
    return url.split('.').pop()?.toLowerCase() || '';
  };

  const isPdf = fileType === 'pdf' || getFileExtension(fileUrl) === 'pdf';
  const isImage = fileType === 'image' || ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(getFileExtension(fileUrl));

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div 
        className="fixed inset-0 bg-black/50" 
        onClick={() => onOpenChange(false)}
      />
      <div className="relative bg-white rounded-lg shadow-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="p-4 pb-2 border-b">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold truncate">
              {fileName}
            </h2>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                disabled={loading}
              >
                <Download className="h-4 w-4 mr-1" />
                {loading ? '下载中...' : '下载'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
        
        <div className="flex-1 overflow-hidden">
          {!proxyUrl && fileUrl ? (
            <div className="flex items-center justify-center h-[70vh] bg-gray-50">
              <div className="text-center text-gray-500">
                <p className="text-lg mb-2">正在加载文件...</p>
                <p className="text-sm">请稍候</p>
              </div>
            </div>
          ) : isPdf ? (
            <div className="relative w-full h-[70vh]">
              <iframe
                src={proxyUrl || fileUrl}
                className="w-full h-full border-0"
                title={fileName}
                onError={() => {
                  console.log('iframe failed to load');
                }}
              />
              <div className="absolute top-4 left-4 pointer-events-none">
                <div className="text-center text-gray-500 bg-white/90 p-2 rounded text-xs">
                  <p>如果文件无法显示，请使用下载按钮</p>
                </div>
              </div>
            </div>
          ) : isImage ? (
            <div className="flex items-center justify-center h-[70vh] bg-gray-50">
              <img
                src={proxyUrl || fileUrl}
                alt={fileName}
                className="max-w-full max-h-full object-contain"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const parent = target.parentElement;
                  if (parent) {
                    parent.innerHTML = `
                      <div class="text-center text-gray-500">
                        <p>无法显示此图片</p>
                        <p class="text-sm mt-2">请使用下载功能获取文件</p>
                      </div>
                    `;
                  }
                }}
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-[70vh] bg-gray-50">
              <div className="text-center text-gray-500">
                <p className="text-lg mb-2">无法预览此文件类型</p>
                <p className="text-sm mb-4">请使用下载功能获取文件</p>
                <Button onClick={handleDownload} disabled={loading}>
                  <Download className="h-4 w-4 mr-2" />
                  {loading ? '下载中...' : '下载文件'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
