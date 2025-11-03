/**
 * 加载动画组件
 * 用于Suspense fallback
 */

import { Loader2 } from 'lucide-react';

export default function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-full w-full p-8">
      <div className="text-center space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
        <p className="text-sm text-muted-foreground">加载中...</p>
      </div>
    </div>
  );
}

/**
 * 页面级加载动画（类似钉钉、企业微信风格）
 */
export function PageLoading() {
  return (
    <>
      {/* 顶部进度条 */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gray-200 overflow-hidden">
        <div className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 animate-loading-bar shadow-lg" />
      </div>
      
      {/* 内容骨架屏 */}
      <div className="p-6 space-y-4 animate-pulse">
        {/* 标题骨架 */}
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 bg-gray-200 rounded-lg" />
          <div className="flex-1 space-y-2">
            <div className="h-6 w-48 bg-gray-200 rounded" />
            <div className="h-4 w-96 bg-gray-100 rounded" />
          </div>
        </div>
        
        {/* 内容卡片骨架 */}
        <div className="grid gap-4">
          <div className="h-32 bg-gray-100 rounded-lg" />
          <div className="h-32 bg-gray-100 rounded-lg" />
          <div className="h-32 bg-gray-100 rounded-lg" />
        </div>
      </div>
    </>
  );
}

/**
 * 内容加载动画（小尺寸）
 */
export function ContentLoading() {
  return (
    <div className="flex items-center justify-center p-8">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

/**
 * 按钮加载动画
 */
export function ButtonLoading() {
  return <Loader2 className="h-4 w-4 animate-spin" />;
}

