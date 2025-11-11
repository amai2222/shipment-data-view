// 懒加载错误边界组件
// 自动重试加载失败的模块

import React, { Component, ReactNode, Suspense } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { logErrorToDatabase, extractChunkLoadErrorInfo, extractReactErrorInfo } from '@/utils/errorLogger';

// 🔧 配置开关：是否启用自动3次刷新保护机制
// 设置为 false 可以临时停用自动刷新，方便调试查看真实错误
const ENABLE_AUTO_RETRY = true; // ✅ 启用自动重试（错误会自动记录到数据库）

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  retryCount: number;
  errorMessage?: string;
  errorStack?: string;
}

class LazyLoadErrorBoundary extends Component<Props, State> {
  private lastError: Error | null = null;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, retryCount: 0 };
  }

  static getDerivedStateFromError(error: Error) {
    return { 
      hasError: true,
      errorMessage: error.message,
      errorStack: error.stack
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.lastError = error;
    
    // 检查是否是应该忽略的错误（缓存问题、浏览器扩展等）
    const errorMessage = error.message || '';
    const errorName = error.name || '';
    const ignoredPatterns = [
      'SyntaxError: Unexpected token \'<\'',
      'Unexpected token \'<\'',
      'A listener indicated an asynchronous response',
      'message channel closed',
      'chrome-extension://',
      'moz-extension://',
      'safari-extension://'
    ];
    
    const shouldIgnore = ignoredPatterns.some(pattern => 
      errorMessage.includes(pattern) || errorName.includes(pattern)
    );
    
    // 只输出非忽略的错误
    if (!shouldIgnore) {
      console.error('懒加载错误:', error, errorInfo);
      console.error('错误详情:', {
        name: error.name,
        message: error.message,
        stack: error.stack,
        errorInfo
      });
    }
    
    // 📝 记录错误到数据库
    const isChunkLoadError = error.name === 'ChunkLoadError' || 
                            error.message.includes('Failed to fetch') ||
                            error.message.includes('Loading chunk');
    
    if (isChunkLoadError) {
      // ChunkLoadError（懒加载错误）
      const errorData = extractChunkLoadErrorInfo(error);
      errorData.retryCount = this.state.retryCount;
      logErrorToDatabase(errorData).catch(err => {
        console.error('记录ChunkLoadError失败:', err);
      });
    } else {
      // React组件错误
      const errorData = extractReactErrorInfo(error, errorInfo);
      logErrorToDatabase(errorData).catch(err => {
        console.error('记录React错误失败:', err);
      });
    }
    
    // 🔧 如果禁用了自动重试，直接返回，不执行自动刷新
    if (!ENABLE_AUTO_RETRY) {
      console.log('⚠️ 自动重试已停用，显示错误页面供调试');
      return;
    }
    
    // 自动重试（最多3次，且只针对懒加载错误）
    if (isChunkLoadError && this.state.retryCount < 3) {
      setTimeout(() => {
        this.setState(state => ({
          hasError: false,
          retryCount: state.retryCount + 1
        }));
        window.location.reload();
      }, 1000);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, retryCount: 0 });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-50">
          <div className="text-center space-y-4 max-w-2xl w-full">
            <div className="text-6xl">⚠️</div>
            <h2 className="text-2xl font-bold">页面加载失败</h2>
            <p className="text-muted-foreground">
              {ENABLE_AUTO_RETRY && this.state.retryCount > 0 
                ? `正在自动重试... (${this.state.retryCount}/3)`
                : '页面组件加载失败，请刷新重试'
              }
            </p>
            
            {/* 🔧 调试模式：显示详细错误信息 */}
            {!ENABLE_AUTO_RETRY && (
              <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg text-left">
                <h3 className="font-semibold text-red-800 mb-2">错误信息（调试模式）</h3>
                {this.state.errorMessage && (
                  <div className="mb-3">
                    <p className="text-sm font-mono text-red-700 break-all">
                      <strong>错误消息：</strong>{this.state.errorMessage}
                    </p>
                  </div>
                )}
                {this.state.errorStack && (
                  <details className="mt-2">
                    <summary className="text-sm font-semibold text-red-700 cursor-pointer">
                      查看错误堆栈
                    </summary>
                    <pre className="mt-2 text-xs font-mono text-red-600 overflow-auto max-h-60 p-2 bg-white rounded border">
                      {this.state.errorStack}
                    </pre>
                  </details>
                )}
                <p className="mt-3 text-xs text-red-600">
                  💡 提示：请打开浏览器控制台（F12）查看更详细的错误信息
                </p>
              </div>
            )}
            
            <Button onClick={this.handleRetry} className="mt-4">
              <RefreshCw className="h-4 w-4 mr-2" />
              手动刷新
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Suspense包装器（带加载动画）
export function LazyLoadWrapper({ children }: { children: ReactNode }) {
  return (
    <LazyLoadErrorBoundary>
      <Suspense 
        fallback={
          <div className="flex items-center justify-center h-screen">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
              <p className="text-muted-foreground">正在加载...</p>
            </div>
          </div>
        }
      >
        {children}
      </Suspense>
    </LazyLoadErrorBoundary>
  );
}

export default LazyLoadErrorBoundary;

