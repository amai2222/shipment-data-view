// 测试LogisticsFormDialog导入
import React from 'react';

// 尝试不同的导入方式
try {
  const { LogisticsFormDialog } = require('./pages/BusinessEntry/components/LogisticsFormDialog');
  console.log('require方式成功:', LogisticsFormDialog);
} catch (error) {
  console.log('require方式失败:', error.message);
}

try {
  const { LogisticsFormDialog } = require('@/pages/BusinessEntry/components/LogisticsFormDialog');
  console.log('绝对路径require成功:', LogisticsFormDialog);
} catch (error) {
  console.log('绝对路径require失败:', error.message);
}
