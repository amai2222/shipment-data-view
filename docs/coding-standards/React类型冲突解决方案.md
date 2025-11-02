# React 类型冲突解决方案

## 🚨 问题描述

### 问题原因
项目中存在一个 `src/react-shim.d.ts` 文件，它是一个临时的 React 类型声明文件。这个文件会**覆盖**项目中已安装的正式 React 类型定义，导致类型冲突和构建错误。

### 环境信息
```json
{
  "@types/react": "18.3.12",      // ✅ 正式类型定义
  "@types/react-dom": "18.3.1",   // ✅ 正式类型定义
  "react": "^18.3.1",
  "react-dom": "^18.3.1"
}
```

### 冲突表现
```typescript
// ❌ react-shim.d.ts 声明的简化类型
declare module 'react' {
  export function useState<S>(initialState: S | (() => S)): [S, (value: S | ((prevState: S) => S)) => void];
  export type FC<P = {}> = (props: P & { children?: ReactNode }) => ReactElement | null;
  // ... 简化的类型声明
}

// ✅ @types/react 提供的完整类型
declare module 'react' {
  export function useState<S = undefined>(): [
    S | undefined, 
    Dispatch<SetStateAction<S | undefined>>
  ];
  export function useState<S>(initialState: S | (() => S)): [S, Dispatch<SetStateAction<S>>];
  // ... 完整、精确的类型声明
}

// ⚠️ 冲突：TypeScript 不知道使用哪个类型定义
```

---

## ✅ 解决方案

### 1. 删除 `react-shim.d.ts` 文件
```bash
# 已删除
src/react-shim.d.ts
```

**原因：**
- ✅ 项目已正确安装 `@types/react@18.3.12` 和 `@types/react-dom@18.3.1`
- ✅ 这些是官方的、完整的类型定义
- ✅ `react-shim.d.ts` 只是一个临时解决方案，现在已不需要
- ✅ 删除后，TypeScript 将使用正式的类型定义

### 2. 验证没有引用
```bash
# ✅ 检查通过
grep -r "react-shim" src/
# 结果：无引用
```

### 3. TypeScript 配置正确
```json
// tsconfig.app.json
{
  "compilerOptions": {
    "jsx": "react-jsx",              // ✅ 新的 JSX 转换
    "esModuleInterop": true,         // ✅ 支持默认导入
    "allowSyntheticDefaultImports": true,  // ✅ 允许合成默认导入
    "skipLibCheck": true             // ✅ 跳过库类型检查（提高性能）
  }
}
```

---

## 📋 正确的 React 导入方式

### Hooks 导入（最常用）
```typescript
// ✅ 正确 - 命名导入 hooks
import { useState, useEffect, useCallback, useMemo } from 'react';

function MyComponent() {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    console.log('组件挂载');
  }, []);
  
  return <div>{count}</div>;
}
```

### 类型导入
```typescript
// ✅ 正确 - 使用 type 关键字导入类型
import type { FC, ReactNode, MouseEvent, ChangeEvent } from 'react';
import { useState } from 'react';

interface Props {
  title: string;
  children?: ReactNode;
}

const MyComponent: FC<Props> = ({ title, children }) => {
  return <div>{title}{children}</div>;
};
```

### 混合导入（hooks + 类型）
```typescript
// ✅ 正确 - 分开导入
import { useState, useEffect } from 'react';
import type { FC, ReactNode } from 'react';

// ❌ 错误 - 不要混用默认导入
import React, { useState, useEffect } from 'react';
```

### JSX 使用（无需导入 React）
```typescript
// ✅ 正确 - React 18 + jsx: "react-jsx" 不需要导入 React
import { useState } from 'react';

function MyComponent() {
  const [count, setCount] = useState(0);
  
  // ✅ JSX 可以直接使用，不需要 import React
  return <div onClick={() => setCount(c => c + 1)}>{count}</div>;
}
```

---

## 🔍 类型检查改进

### 删除 react-shim.d.ts 后的优势

#### 1. 完整的类型推断
```typescript
// ✅ 现在可以获得完整的类型推断
import { useState } from 'react';

const [value, setValue] = useState('');
// value: string ✅
// setValue: Dispatch<SetStateAction<string>> ✅

const [count, setCount] = useState<number>();
// count: number | undefined ✅
// setCount: Dispatch<SetStateAction<number | undefined>> ✅
```

#### 2. 正确的事件类型
```typescript
import type { MouseEvent, ChangeEvent, FormEvent } from 'react';

// ✅ 完整的事件类型
function Form() {
  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();  // ✅ 方法存在
    e.stopPropagation(); // ✅ 方法存在
    console.log(e.currentTarget.value); // ✅ 正确的属性
  };
  
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    console.log(e.target.value);      // ✅ 正确的属性
    console.log(e.currentTarget.checked); // ✅ 正确的属性
  };
  
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();  // ✅ 方法存在
    const formData = new FormData(e.currentTarget); // ✅ 正确使用
  };
  
  return (
    <form onSubmit={handleSubmit}>
      <input onChange={handleChange} />
      <button onClick={handleClick}>提交</button>
    </form>
  );
}
```

#### 3. 正确的组件类型
```typescript
import type { FC, PropsWithChildren, ComponentType } from 'react';

// ✅ FC 类型包含 children
const Layout: FC<PropsWithChildren> = ({ children }) => {
  return <div className="layout">{children}</div>;
};

// ✅ 自定义 Props 类型
interface CardProps {
  title: string;
  description?: string;
}

const Card: FC<PropsWithChildren<CardProps>> = ({ 
  title, 
  description, 
  children 
}) => {
  return (
    <div className="card">
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {children}
    </div>
  );
};

// ✅ ComponentType 用于高阶组件
function withLoading<P extends object>(
  Component: ComponentType<P>
): ComponentType<P & { loading?: boolean }> {
  return (props) => {
    const { loading, ...rest } = props as any;
    if (loading) return <div>加载中...</div>;
    return <Component {...rest as P} />;
  };
}
```

#### 4. 正确的 Ref 类型
```typescript
import type { RefObject, MutableRefObject } from 'react';
import { useRef, useEffect } from 'react';

function Component() {
  // ✅ RefObject<HTMLInputElement> - 只读 ref
  const inputRef = useRef<HTMLInputElement>(null);
  
  // ✅ MutableRefObject<number> - 可变 ref
  const countRef = useRef<number>(0);
  
  useEffect(() => {
    // ✅ 正确的类型检查
    if (inputRef.current) {
      inputRef.current.focus();  // ✅ 方法存在
      inputRef.current.value = 'test'; // ✅ 属性存在
    }
    
    // ✅ 可变 ref 可以直接赋值
    countRef.current += 1;
  }, []);
  
  return <input ref={inputRef} />;
}
```

---

## 🚫 常见错误和解决方案

### 错误 1：导入 React 但未使用
```typescript
// ❌ 错误 - 不需要导入 React
import React, { useState } from 'react';

function Component() {
  const [count, setCount] = useState(0);
  return <div>{count}</div>;
}

// ✅ 正确 - 只导入需要的 hooks
import { useState } from 'react';

function Component() {
  const [count, setCount] = useState(0);
  return <div>{count}</div>;
}
```

### 错误 2：错误的命名导入
```typescript
// ❌ 错误 - React 不是命名导出
import { React } from 'react';

// ✅ 正确 - React 是默认导出（但通常不需要）
import React from 'react';

// ✅ 更正确 - 只导入需要的 hooks
import { useState } from 'react';
```

### 错误 3：类型导入未使用 type 关键字
```typescript
// ⚠️ 可以工作但不推荐
import { FC, ReactNode } from 'react';

// ✅ 推荐 - 使用 type 关键字
import type { FC, ReactNode } from 'react';
```

**原因：**
- 使用 `type` 关键字可以让 TypeScript 知道这只是类型导入
- 在编译时会被完全移除，不会影响运行时代码
- 更好的性能和更清晰的代码意图

### 错误 4：混用导入方式
```typescript
// ❌ 错误 - 混用默认导入和命名导入
import React, { useState, useEffect } from 'react';
import type { FC } from 'react';

function Component() {
  // React 从未使用
  const [count, setCount] = useState(0);
  return <div>{count}</div>;
}

// ✅ 正确 - 统一使用命名导入
import { useState, useEffect } from 'react';
import type { FC } from 'react';

function Component() {
  const [count, setCount] = useState(0);
  return <div>{count}</div>;
}
```

---

## ✅ 检查清单

在提交代码前，请确认：

### React 导入
- [ ] ✅ 没有 `src/react-shim.d.ts` 文件
- [ ] ✅ 没有 `import React, { ... }` 混用方式
- [ ] ✅ 没有 `import { React }` 错误写法
- [ ] ✅ 只导入实际使用的 hooks
- [ ] ✅ 类型导入使用 `import type` 语法

### TypeScript 配置
- [ ] ✅ `tsconfig.app.json` 中 `jsx: "react-jsx"`
- [ ] ✅ `esModuleInterop: true`
- [ ] ✅ `allowSyntheticDefaultImports: true`

### 依赖版本
- [ ] ✅ `@types/react@18.3.x` 已安装
- [ ] ✅ `@types/react-dom@18.3.x` 已安装
- [ ] ✅ `react@18.3.x` 已安装
- [ ] ✅ `react-dom@18.3.x` 已安装

---

## 🎯 lovable.dev 平台兼容性

### 支持的 React 类型（完整列表）

#### Hooks
```typescript
import {
  useState,
  useEffect,
  useContext,
  useReducer,
  useCallback,
  useMemo,
  useRef,
  useLayoutEffect,
  useImperativeHandle,
  useDebugValue,
  useDeferredValue,
  useTransition,
  useId,
  useSyncExternalStore
} from 'react';
```

#### 组件类型
```typescript
import type {
  FC,
  ReactNode,
  ReactElement,
  ComponentType,
  PropsWithChildren,
  FunctionComponent
} from 'react';
```

#### 事件类型
```typescript
import type {
  MouseEvent,
  ChangeEvent,
  FormEvent,
  KeyboardEvent,
  FocusEvent,
  TouchEvent,
  DragEvent,
  ClipboardEvent,
  PointerEvent
} from 'react';
```

#### 其他类型
```typescript
import type {
  CSSProperties,
  HTMLAttributes,
  RefObject,
  MutableRefObject,
  Dispatch,
  SetStateAction,
  Context
} from 'react';
```

---

## 📚 参考文档

- [React 18 官方文档](https://react.dev/)
- [TypeScript React 备忘单](https://react-typescript-cheatsheet.netlify.app/)
- [@types/react on DefinitelyTyped](https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/react)
- [Lovable 平台兼容性规范](./Lovable平台兼容性规范.md)

---

## 📝 修改历史

| 日期 | 操作 | 说明 |
|------|------|------|
| 2025-11-02 | 删除文件 | 删除 `src/react-shim.d.ts`，解决类型冲突 |
| 2025-11-02 | 文档创建 | 创建此文档，说明问题和解决方案 |

---

**状态：** ✅ 已解决  
**最后更新：** 2025-11-02  
**维护者：** 开发团队

