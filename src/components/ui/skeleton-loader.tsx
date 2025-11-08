// 移动端骨架屏加载组件

export function MobilePageSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      {/* 顶部导航栏骨架 */}
      <div className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur h-14 flex items-center px-4">
        <div className="h-5 w-5 bg-gray-200 rounded animate-pulse"></div>
        <div className="flex-1 flex justify-center">
          <div className="h-6 w-32 bg-gray-200 rounded animate-pulse"></div>
        </div>
        <div className="w-10"></div>
      </div>

      {/* 内容骨架 */}
      <div className="container mx-auto px-4 py-4 space-y-4">
        {/* 卡片骨架 */}
        <div className="bg-white rounded-lg border p-6 space-y-3 animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>

        <div className="bg-white rounded-lg border p-6 space-y-3 animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-full"></div>
          <div className="h-8 bg-gray-200 rounded w-full"></div>
          <div className="h-8 bg-gray-200 rounded w-full"></div>
        </div>

        <div className="bg-white rounded-lg border p-6 space-y-3 animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          <div className="h-4 bg-gray-200 rounded w-full"></div>
          <div className="h-4 bg-gray-200 rounded w-4/5"></div>
        </div>
      </div>
    </div>
  );
}

export function PCPageSkeleton() {
  return (
    <div className="p-6 space-y-6">
      {/* 标题骨架 */}
      <div className="space-y-2 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-64"></div>
        <div className="h-4 bg-gray-200 rounded w-96"></div>
      </div>

      {/* 卡片骨架 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white rounded-lg border p-6 space-y-3 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-8 bg-gray-200 rounded w-full"></div>
          </div>
        ))}
      </div>

      {/* 表格骨架 */}
      <div className="bg-white rounded-lg border p-6 space-y-3 animate-pulse">
        <div className="h-10 bg-gray-200 rounded w-full"></div>
        <div className="h-10 bg-gray-200 rounded w-full"></div>
        <div className="h-10 bg-gray-200 rounded w-full"></div>
        <div className="h-10 bg-gray-200 rounded w-full"></div>
      </div>
    </div>
  );
}

