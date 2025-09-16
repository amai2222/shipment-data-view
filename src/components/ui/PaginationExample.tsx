import React, { useState } from 'react';
import { ReusablePagination, SimplePagination, CompactPagination, PaginationState } from './ReusablePagination';

// 使用示例组件
export const PaginationExample: React.FC = () => {
  const [pagination, setPagination] = useState<PaginationState>({
    currentPage: 1,
    pageSize: 20,
    totalCount: 1000,
    totalPages: 50
  });

  const handlePageChange = (page: number) => {
    setPagination(prev => ({ ...prev, currentPage: page }));
  };

  const handlePageSizeChange = (pageSize: number) => {
    const totalPages = Math.ceil(pagination.totalCount / pageSize);
    setPagination(prev => ({
      ...prev,
      pageSize,
      totalPages,
      currentPage: Math.min(prev.currentPage, totalPages)
    }));
  };

  return (
    <div className="space-y-8 p-6">
      <h2 className="text-2xl font-bold">分页组件使用示例</h2>
      
      {/* 完整版本 */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">完整版本 (ReusablePagination)</h3>
        <div className="border rounded-lg p-4">
          <ReusablePagination
            pagination={pagination}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
            pageSizeOptions={[10, 20, 50, 100]}
            showPageSizeSelector={true}
            showPageInput={true}
            showTotalInfo={true}
          />
        </div>
      </div>

      {/* 简化版本 */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">简化版本 (SimplePagination)</h3>
        <div className="border rounded-lg p-4">
          <SimplePagination
            pagination={pagination}
            onPageChange={handlePageChange}
          />
        </div>
      </div>

      {/* 紧凑版本 */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">紧凑版本 (CompactPagination)</h3>
        <div className="border rounded-lg p-4">
          <CompactPagination
            pagination={pagination}
            onPageChange={handlePageChange}
          />
        </div>
      </div>

      {/* 自定义配置示例 */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">自定义配置示例</h3>
        <div className="border rounded-lg p-4">
          <ReusablePagination
            pagination={pagination}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
            pageSizeOptions={[5, 10, 25, 50]}
            showPageSizeSelector={true}
            showPageInput={false}
            showTotalInfo={true}
          />
        </div>
      </div>
    </div>
  );
};

export default PaginationExample;
