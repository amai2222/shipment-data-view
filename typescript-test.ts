// TypeScript 语法检查测试文件
import { useSimplePermissions } from './src/hooks/useSimplePermissions';

// 测试基本语法
const testFunction = () => {
  const permissions = useSimplePermissions();
  console.log(permissions);
};

export default testFunction;
