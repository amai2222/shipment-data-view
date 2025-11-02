/**
 * React 错误边界组件
 * 根据代码优化建议报告 - 低优先级优化 3.3
 */

import { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // 记录错误日志
    console.error('React Error Boundary 捕获错误:', error, errorInfo);
    
    // 调用自定义错误处理函数
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // 更新状态
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      // 如果提供了自定义fallback，使用它
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // 默认错误UI
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <Card className="max-w-2xl w-full">
            <CardHeader>
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-6 w-6 text-red-500" />
                <CardTitle className="text-xl">出错了</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-muted-foreground">
                  应用程序遇到了一个错误，请尝试刷新页面或返回首页。
                </p>
                
                {process.env.NODE_ENV === 'development' && this.state.error && (
                  <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="font-semibold text-red-800 mb-2">错误详情（仅开发环境显示）:</p>
                    <pre className="text-xs text-red-700 overflow-auto max-h-40">
                      {this.state.error.toString()}
                      {this.state.errorInfo && '\n\n' + this.state.errorInfo.componentStack}
                    </pre>
                  </div>
                )}
              </div>

              <div className="flex space-x-3 pt-4">
                <Button 
                  onClick={this.handleReset}
                  className="flex-1"
                  variant="default"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  重新加载
                </Button>
                <Button 
                  onClick={this.handleGoHome}
                  className="flex-1"
                  variant="outline"
                >
                  <Home className="h-4 w-4 mr-2" />
                  返回首页
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * 错误回退组件（移动端）
 */
export function MobileErrorFallback({ 
  error, 
  onReset 
}: { 
  error?: Error; 
  onReset?: () => void;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
      <AlertTriangle className="h-16 w-16 text-red-500 mb-4" />
      <h2 className="text-xl font-bold mb-2">出错了</h2>
      <p className="text-muted-foreground text-center mb-6">
        应用程序遇到了一个错误，请尝试刷新页面。
      </p>
      
      {process.env.NODE_ENV === 'development' && error && (
        <div className="w-full max-w-md p-4 bg-red-50 border border-red-200 rounded-lg mb-4">
          <p className="font-semibold text-red-800 text-sm mb-2">错误详情:</p>
          <pre className="text-xs text-red-700 overflow-auto max-h-32">
            {error.toString()}
          </pre>
        </div>
      )}

      <div className="flex flex-col w-full max-w-xs space-y-3">
        <Button onClick={onReset || (() => window.location.reload())}>
          <RefreshCw className="h-4 w-4 mr-2" />
          重新加载
        </Button>
        <Button variant="outline" onClick={() => window.location.href = '/'}>
          <Home className="h-4 w-4 mr-2" />
          返回首页
        </Button>
      </div>
    </div>
  );
}

/**
 * Hook：在函数组件中使用错误边界
 */
export function useErrorHandler() {
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    if (error) {
      throw error;
    }
  }, [error]);

  return setError;
}

