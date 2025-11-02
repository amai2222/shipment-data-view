# Lovable.dev 平台兼容性规范

## 📦 当前环境版本

### React 生态
```json
{
  "react": "^18.3.1",
  "react-dom": "^18.3.1",
  "@types/react": "^18.3.3",
  "@types/react-dom": "^18.3.0"
}
```

### 图标库
```json
{
  "lucide-react": "^0.462.0"
}
```

---

## ✅ React 18.3 支持的类型

### 1. Hooks（全部支持）

#### 基础 Hooks
```typescript
import { 
  useState,      // ✅ 状态管理
  useEffect,     // ✅ 副作用
  useContext,    // ✅ 上下文
  useReducer,    // ✅ 复杂状态管理
  useCallback,   // ✅ 回调缓存
  useMemo,       // ✅ 计算缓存
  useRef,        // ✅ 引用
  useLayoutEffect // ✅ 布局副作用
} from 'react';
```

#### 高级 Hooks（React 18 新增）
```typescript
import {
  useId,                  // ✅ 生成唯一 ID
  useTransition,          // ✅ 并发特性
  useDeferredValue,       // ✅ 延迟值
  useSyncExternalStore,   // ✅ 外部状态同步
  useImperativeHandle,    // ✅ 自定义 ref
  useDebugValue          // ✅ 调试标签
} from 'react';
```

**使用示例：**
```typescript
// ✅ 正确使用
import { useState, useEffect, useCallback, useMemo } from 'react';

function MyComponent() {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    console.log('组件已挂载');
  }, []);
  
  const increment = useCallback(() => {
    setCount(c => c + 1);
  }, []);
  
  const doubled = useMemo(() => count * 2, [count]);
  
  return <div onClick={increment}>{doubled}</div>;
}
```

### 2. 组件类型

```typescript
import type {
  FC,                    // ✅ 函数组件类型
  ReactNode,             // ✅ 任意 React 节点
  ReactElement,          // ✅ React 元素
  JSX.Element,           // ✅ JSX 元素（同 ReactElement）
  ComponentType,         // ✅ 组件类型
  PropsWithChildren,     // ✅ 带 children 的 Props
  FunctionComponent      // ✅ 函数组件（同 FC）
} from 'react';
```

**使用示例：**
```typescript
// ✅ 正确 - 使用 FC 类型
import type { FC, ReactNode } from 'react';

interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
}

const MyButton: FC<ButtonProps> = ({ children, onClick }) => {
  return <button onClick={onClick}>{children}</button>;
};
```

### 3. 事件类型

```typescript
import type {
  MouseEvent,            // ✅ 鼠标事件
  ChangeEvent,           // ✅ 输入变化事件
  FormEvent,             // ✅ 表单事件
  KeyboardEvent,         // ✅ 键盘事件
  FocusEvent,            // ✅ 焦点事件
  TouchEvent,            // ✅ 触摸事件
  DragEvent,             // ✅ 拖拽事件
  ClipboardEvent,        // ✅ 剪贴板事件
  PointerEvent           // ✅ 指针事件
} from 'react';
```

**使用示例：**
```typescript
// ✅ 正确使用事件类型
import type { MouseEvent, ChangeEvent } from 'react';

function MyComponent() {
  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    console.log('点击事件', e.currentTarget);
  };
  
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    console.log('输入值', e.target.value);
  };
  
  return (
    <>
      <button onClick={handleClick}>点击</button>
      <input onChange={handleChange} />
    </>
  );
}
```

### 4. 其他常用类型

```typescript
import type {
  CSSProperties,         // ✅ CSS 样式对象
  HTMLAttributes,        // ✅ HTML 属性
  RefObject,             // ✅ 只读 Ref
  MutableRefObject,      // ✅ 可变 Ref
  Dispatch,              // ✅ Dispatch 函数
  SetStateAction,        // ✅ setState 参数类型
  Context                // ✅ Context 类型
} from 'react';
```

**使用示例：**
```typescript
// ✅ 正确使用
import type { CSSProperties, HTMLAttributes } from 'react';
import { useState } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  style?: CSSProperties;
}

const Card = ({ title, style, children, ...props }: CardProps) => {
  return (
    <div style={style} {...props}>
      <h3>{title}</h3>
      {children}
    </div>
  );
};
```

---

## ✅ Lucide React 0.462 支持的图标

### 导航和操作图标
```typescript
import { 
  // 导航
  Home,              // ✅ 首页
  Menu,              // ✅ 菜单
  X,                 // ✅ 关闭
  ChevronRight,      // ✅ 右箭头
  ChevronLeft,       // ✅ 左箭头
  ChevronUp,         // ✅ 上箭头
  ChevronDown,       // ✅ 下箭头
  ChevronsUpDown,    // ✅ 上下箭头
  ArrowLeft,         // ✅ 返回箭头
  ArrowRight,        // ✅ 前进箭头
  
  // 操作
  Plus,              // ✅ 加号
  Minus,             // ✅ 减号
  Check,             // ✅ 对勾
  Save,              // ✅ 保存
  Edit,              // ✅ 编辑
  Trash2,            // ✅ 删除
  Search,            // ✅ 搜索
  Filter,            // ✅ 筛选
  Settings,          // ✅ 设置
  MoreVertical,      // ✅ 更多（竖）
  MoreHorizontal,    // ✅ 更多（横）
  RefreshCw,         // ✅ 刷新
  Download,          // ✅ 下载
  Upload,            // ✅ 上传
  Copy,              // ✅ 复制
  Clipboard          // ✅ 剪贴板
} from 'lucide-react';
```

### 业务相关图标
```typescript
import {
  // 物流业务
  Truck,             // ✅ 卡车
  Package,           // ✅ 包裹
  Weight,            // ✅ 重量
  Scale,             // ✅ 磅秤
  MapPin,            // ✅ 地图标记
  Navigation,        // ✅ 导航
  
  // 人员和组织
  User,              // ✅ 用户
  Users,             // ✅ 用户组
  UserPlus,          // ✅ 添加用户
  Building,          // ✅ 建筑物
  Building2,         // ✅ 建筑物2
  Briefcase,         // ✅ 公文包
  
  // 时间和日期
  Calendar,          // ✅ 日历
  Clock,             // ✅ 时钟
  
  // 文档和数据
  FileText,          // ✅ 文件文本
  Database,          // ✅ 数据库
  Receipt,           // ✅ 收据
  FileSignature,     // ✅ 文件签名
  
  // 安全和权限
  Lock,              // ✅ 锁
  Unlock,            // ✅ 解锁
  Key,               // ✅ 钥匙
  Shield,            // ✅ 盾牌
  Eye,               // ✅ 眼睛
  EyeOff,            // ✅ 眼睛关闭
  
  // 通信
  Mail,              // ✅ 邮件
  Phone,             // ✅ 电话
  Bell,              // ✅ 铃铛
  
  // 财务
  CreditCard,        // ✅ 信用卡
  Banknote,          // ✅ 钞票
  DollarSign,        // ✅ 美元符号
  Calculator         // ✅ 计算器
} from 'lucide-react';
```

### 图表和数据图标
```typescript
import {
  BarChart3,         // ✅ 柱状图
  PieChart,          // ✅ 饼图
  LineChart,         // ✅ 折线图
  TrendingUp,        // ✅ 上升趋势
  TrendingDown,      // ✅ 下降趋势
  Activity,          // ✅ 活动
  AlertCircle,       // ✅ 警告圆圈
  CheckCircle,       // ✅ 对勾圆圈
  XCircle,           // ✅ 叉号圆圈
  Info,              // ✅ 信息
  Target,            // ✅ 目标
  Zap,               // ✅ 闪电
  Gauge              // ✅ 仪表盘
} from 'lucide-react';
```

### 界面元素图标
```typescript
import {
  Loader2,           // ✅ 加载动画
  ExternalLink,      // ✅ 外部链接
  Star,              // ✅ 星星
  Heart,             // ✅ 心形
  Share2,            // ✅ 分享
  History,           // ✅ 历史
  TreePine,          // ✅ 松树（货主）
  LogOut             // ✅ 退出登录
} from 'lucide-react';
```

### 图标使用示例
```tsx
import { Home, User, Settings, Loader2 } from 'lucide-react';

// ✅ 基本使用
<Home />

// ✅ 自定义大小和颜色
<User size={24} color="currentColor" />

// ✅ 自定义描边宽度
<Settings size={20} strokeWidth={2} />

// ✅ 添加 className
<Loader2 className="h-4 w-4 animate-spin text-primary" />

// ✅ 组合使用
<div className="flex items-center gap-2">
  <Home className="h-5 w-5" />
  <span>首页</span>
</div>
```

---

## 🚫 平台限制

### 1. 不支持 Service Worker
```typescript
// ❌ 不可用
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/service-worker.js');
}

// ✅ 已禁用
VITE_ENABLE_PWA=false
```

### 2. 不支持某些高级 Web API
```typescript
// ⚠️ 可能不支持
navigator.vibrate(100);           // 触觉反馈
navigator.share({ title: '' });   // Web Share API

// ✅ 使用前检查
if ('vibrate' in navigator) {
  navigator.vibrate(100);
}
```

---

## 📋 代码规范清单

### React 导入规范
```typescript
// ✅ 正确 - 只导入 hooks
import { useState, useEffect, useCallback } from 'react';

// ✅ 正确 - 导入类型
import type { FC, ReactNode, MouseEvent } from 'react';

// ❌ 错误 - 混用默认导入
import React, { useState } from 'react';

// ❌ 错误 - 错误的命名导入
import { React } from 'react';
```

### Lucide React 导入规范
```typescript
// ✅ 正确 - 按需导入
import { Home, User, Settings, Truck, Package } from 'lucide-react';

// ✅ 正确使用
<Home className="h-5 w-5" />
<User size={24} color="currentColor" />
<Settings size={20} strokeWidth={2} className="text-primary" />

// ❌ 错误 - 导入不存在的图标
import { UnknownIcon } from 'lucide-react';  // 检查图标是否存在
```

### 日志规范
```typescript
// ✅ 正确 - 使用 safeLogger
import { safeLogger } from '@/utils/safeLogger';

safeLogger.info('操作成功');
safeLogger.error('操作失败', error);
safeLogger.debug('调试信息', data);

// ❌ 错误 - 直接使用 logger
import { logger } from '@/utils/logger';  // 可能出错
```

---

## 🎯 推荐的类型使用模式

### 1. 函数组件（最常用）
```typescript
import type { FC } from 'react';
import { useState } from 'react';

interface Props {
  title: string;
  count?: number;
}

const MyComponent: FC<Props> = ({ title, count = 0 }) => {
  const [value, setValue] = useState(count);
  return <div>{title}: {value}</div>;
};

export default MyComponent;
```

### 2. 事件处理
```typescript
import type { MouseEvent, ChangeEvent } from 'react';
import { useState } from 'react';

function Form() {
  const [value, setValue] = useState('');
  
  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    console.log('点击');
  };
  
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
  };
  
  return (
    <>
      <input value={value} onChange={handleChange} />
      <button onClick={handleClick}>提交</button>
    </>
  );
}
```

### 3. Ref 使用
```typescript
import type { RefObject } from 'react';
import { useRef, useEffect } from 'react';

function Component() {
  const inputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  
  return <input ref={inputRef} />;
}
```

### 4. Props 继承
```typescript
import type { HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  // className 自动继承，无需单独声明
}

const Card = ({ title, className, children, ...props }: CardProps) => {
  return (
    <div className={className} {...props}>
      <h3>{title}</h3>
      {children}
    </div>
  );
};

// ✅ 使用时 className 可用
<Card title="标题" className="custom-class">内容</Card>
```

---

## 📊 常见图标使用场景

### 导航图标
```typescript
import { Home, ArrowLeft, Menu, Settings } from 'lucide-react';

// 首页
<Home className="h-5 w-5" />

// 返回
<ArrowLeft className="h-4 w-4" />

// 菜单
<Menu className="h-6 w-6" />

// 设置
<Settings className="h-5 w-5" />
```

### 业务图标
```typescript
import { Truck, Package, Weight, MapPin, Calendar } from 'lucide-react';

// 运输
<Truck className="h-5 w-5 text-blue-600" />

// 包裹
<Package className="h-5 w-5 text-green-600" />

// 重量
<Weight className="h-5 w-5 text-orange-600" />

// 地点
<MapPin className="h-5 w-5 text-red-600" />

// 日期
<Calendar className="h-5 w-5 text-purple-600" />
```

### 状态图标
```typescript
import { CheckCircle, AlertCircle, XCircle, Clock, Loader2 } from 'lucide-react';

// 成功
<CheckCircle className="h-5 w-5 text-green-600" />

// 警告
<AlertCircle className="h-5 w-5 text-amber-600" />

// 错误
<XCircle className="h-5 w-5 text-red-600" />

// 待处理
<Clock className="h-5 w-5 text-blue-600" />

// 加载中
<Loader2 className="h-4 w-4 animate-spin" />
```

---

## ⚠️ 常见错误和解决方案

### 错误 1：导入不存在的图标
```typescript
// ❌ 错误
import { MyCustomIcon } from 'lucide-react';
// Error: Module has no exported member 'MyCustomIcon'

// ✅ 解决
// 1. 检查图标名称是否正确
// 2. 查看 lucide-react 0.462 版本文档
// 3. 使用替代图标
```

### 错误 2：React 类型错误
```typescript
// ❌ 错误
import { React } from 'react';
// Error: Module has no exported member 'React'

// ✅ 正确
import { useState } from 'react';
// 或
import React from 'react';
```

### 错误 3：类型定义缺失
```typescript
// ❌ 可能出错
const handleClick = (e) => {  // 缺少类型
  console.log(e);
};

// ✅ 正确
import type { MouseEvent } from 'react';

const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
  console.log(e);
};
```

---

## 🔧 TypeScript 配置

### tsconfig.app.json（已配置）
```json
{
  "compilerOptions": {
    "jsx": "react-jsx",              // ✅ 新的 JSX 转换
    "esModuleInterop": true,         // ✅ 支持默认导入
    "allowSyntheticDefaultImports": true,  // ✅ 允许合成默认导入
    "strict": false,                 // ⚠️ 非严格模式（可选）
    "skipLibCheck": true             // ✅ 跳过库类型检查
  }
}
```

---

## ✅ 检查清单

提交代码前请确认：

### React 使用
- [ ] ✅ 只导入实际使用的 hooks
- [ ] ✅ 类型导入使用 `import type`
- [ ] ✅ 没有 `import React, { ... }` 混用
- [ ] ✅ 没有 `import { React }` 错误写法
- [ ] ✅ 事件处理器有正确的类型注解

### Lucide React 使用
- [ ] ✅ 只导入实际使用的图标
- [ ] ✅ 图标名称正确（检查版本文档）
- [ ] ✅ 图标有 className 或 size 属性
- [ ] ✅ 加载图标使用 `Loader2` + `animate-spin`

### 日志使用
- [ ] ✅ 使用 `safeLogger` 而不是 `logger`
- [ ] ✅ 日志方法调用正确

---

## 📚 参考文档

- [React 18 官方文档](https://react.dev/)
- [React TypeScript 备忘单](https://react-typescript-cheatsheet.netlify.app/)
- [Lucide React 图标库](https://lucide.dev/icons/)
- [Lucide React 0.462 更新日志](https://github.com/lucide-icons/lucide/releases/tag/0.462.0)

---

**平台：** lovable.dev  
**最后更新：** 2025-11-02  
**维护者：** 开发团队

