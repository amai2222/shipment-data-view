// 懒加载错误边界组件
// 自动重试加载失败的模块

import React, { Component, ReactNode, Suspense } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  retryCount: number;
}

class LazyLoadErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, retryCount: 0 };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('懒加载错误:', error, errorInfo);
    
    // 自动重试（最多3次）
    if (this.state.retryCount < 3) {
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
        <div className="flex flex-col items-center justify-center h-screen p-4">
          <div className="text-center space-y-4 max-w-md">
            <div className="text-6xl">⚠️</div>
            <h2 className="text-2xl font-bold">页面加载失败</h2>
            <p className="text-muted-foreground">
              {this.state.retryCount > 0 
                ? `正在自动重试... (${this.state.retryCount}/3)`
                : '页面组件加载失败，请刷新重试'
              }
            </p>
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

