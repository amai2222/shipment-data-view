# React 导入严格规范

**创建日期：** 2025-11-02  
**优先级：** 🔴 **最高优先级**  
**强制执行：** ✅ **必须遵守**

---

## 🚨 核心原则

**绝对禁止混用不同的导入方式！**

混用导入方式会导致：
- ❌ Hooks 失效
- ❌ Cannot read properties of null (reading 'useState')
- ❌ Invalid hook call 错误
- ❌ 白屏崩溃

---

## ✅ 标准导入方式（唯一正确方式）

### 1. React Hooks 和函数（运行时导入）

```typescript
// ✅ 正确 - 标准命名导入
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';

// ✅ 正确 - 分开导入 hooks 和类型
import { useState, useEffect } from 'react';
import type { FC, ReactNode } from 'react';
```

### 2. React 类型（类型导入）

```typescript
// ✅ 正确 - 使用 import type 单独导入类型
import type { FC, ReactNode, MouseEvent, ChangeEvent } from 'react';

// ✅ 正确 - 组合使用
import { useState, useEffect } from 'react';
import type { FC, ReactNode } from 'react';
```

### 3. 组件导出

```typescript
// ✅ 正确 - 默认导出（页面组件）
export default function PageName() {
  return <div>...</div>;
}

// ✅ 正确 - 命名导出（工具组件）
export function UtilComponent() {
  return <div>...</div>;
}
```

---

## 🚫 严格禁止的导入方式

### 1. 混用 type 和运行时导入

```typescript
// ❌ 错误 - 禁止在同一行混用 type 和 runtime
import { useState, useEffect, type ReactNode } from 'react';

// ❌ 错误 - 禁止这种写法
import { createContext, useContext, type FC } from 'react';

// ✅ 正确 - 必须分开
import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
```

### 2. 默认导入 React（旧写法）

```typescript
// ❌ 错误 - jsx: "react-jsx" 配置下不需要默认导入
import React, { useState } from 'react';

// ❌ 错误 - 除非使用 React.xxx，否则不需要
import React from 'react';

// ✅ 正确 - 直接导入需要的内容
import { useState } from 'react';
```

### 3. 命名空间导入（特殊情况除外）

```typescript
// ❌ 错误 - 避免使用（除非是 UI 组件库）
import * as React from 'react';

// ✅ 正确 - 明确导入需要的内容
import { useState, useEffect } from 'react';
```

---

## 📋 完整导入模板

### 模板 1：函数组件（最常用）

```typescript
// ✅ 标准模板
import { useState, useEffect, useCallback } from 'react';
import type { FC, ReactNode } from 'react';

interface Props {
  title: string;
  children?: ReactNode;
}

const MyComponent: FC<Props> = ({ title, children }) => {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    console.log('mounted');
  }, []);
  
  return <div>{title}: {count}</div>;
};

export default MyComponent;
```

### 模板 2：带事件处理的组件

```typescript
// ✅ 标准模板
import { useState } from 'react';
import type { FC, MouseEvent, ChangeEvent } from 'react';

interface Props {
  onSubmit?: (value: string) => void;
}

const FormComponent: FC<Props> = ({ onSubmit }) => {
  const [value, setValue] = useState('');
  
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
  };
  
  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    onSubmit?.(value);
  };
  
  return (
    <div>
      <input value={value} onChange={handleChange} />
      <button onClick={handleClick}>提交</button>
    </div>
  );
};

export default FormComponent;
```

### 模板 3：Context Provider

```typescript
// ✅ 标准模板
import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

interface ContextType {
  value: string;
  setValue: (value: string) => void;
}

const MyContext = createContext<ContextType | undefined>(undefined);

export function MyProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState('');
  
  return (
    <MyContext.Provider value={{ value, setValue }}>
      {children}
    </MyContext.Provider>
  );
}

export function useMyContext() {
  const context = useContext(MyContext);
  if (!context) {
    throw new Error('useMyContext must be used within MyProvider');
  }
  return context;
}
```

### 模板 4：Class 组件（ErrorBoundary）

```typescript
// ✅ 标准模板
import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
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
    console.error('Error caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <div>出错了</div>;
    }
    return this.props.children;
  }
}
```

---

## 🔍 检查清单

### 提交代码前必须检查

- [ ] ✅ 没有 `import React, { ... }` 混用写法
- [ ] ✅ 没有 `import { ..., type ... } from 'react'` 混用写法
- [ ] ✅ 类型导入使用 `import type { ... } from 'react'`
- [ ] ✅ Hooks 导入使用 `import { ... } from 'react'`
- [ ] ✅ 所有文件使用统一的导入方式
- [ ] ✅ 没有不必要的 React 默认导入

---

## 🛠️ 自动检查脚本

### 检查脚本：check-react-imports.sh

```bash
#!/bin/bash
# 检查 React 导入规范

echo "🔍 检查 React 导入规范..."

# 检查混用 type 和 runtime
echo ""
echo "检查 1: 混用 type 和 runtime 导入..."
grep -r "import.*{.*type.*}.*from.*['\"]react['\"]" src/ --include="*.tsx" --include="*.ts" || echo "✅ 通过"

# 检查 React 默认导入
echo ""
echo "检查 2: React 默认导入（可能不需要）..."
grep -r "import React," src/ --include="*.tsx" --include="*.ts" | grep -v "components/ui" || echo "✅ 通过"

# 检查命名空间导入
echo ""
echo "检查 3: 命名空间导入..."
grep -r "import \* as React" src/ --include="*.tsx" --include="*.ts" | grep -v "components/ui" || echo "✅ 通过"

echo ""
echo "🎉 检查完成！"
```

### 使用方法

```bash
# 1. 创建脚本
chmod +x check-react-imports.sh

# 2. 运行检查
./check-react-imports.sh

# 3. 修复发现的问题
```

---

## 📊 常见场景对照表

| 场景 | 正确写法 | 错误写法 |
|------|----------|----------|
| **基础组件** | `import { useState } from 'react';` | `import React, { useState } from 'react';` |
| **类型导入** | `import type { FC } from 'react';` | `import { type FC } from 'react';` |
| **Context** | `import { createContext } from 'react';` | `import React from 'react';`<br>`React.createContext()` |
| **事件类型** | `import type { MouseEvent } from 'react';` | `import { MouseEvent } from 'react';` |
| **组合导入** | `import { useState } from 'react';`<br>`import type { FC } from 'react';` | `import { useState, type FC } from 'react';` |

---

## 🎯 特殊情况说明

### 1. UI 组件库（shadcn/ui）

```typescript
// ✅ UI 组件库可以使用命名空间导入
// src/components/ui/*.tsx
import * as React from "react"

// 说明：shadcn/ui 生成的组件使用此方式，不需要修改
```

### 2. 第三方库兼容

```typescript
// ✅ 某些第三方库可能需要特定导入方式
// 遵循库的官方文档
```

### 3. 类型断言

```typescript
// ✅ 如果确实需要 React 命名空间
import type * as React from 'react';

// 但通常不需要，直接导入具体类型即可
import type { ReactNode, FC } from 'react';
```

---

## ⚠️ 常见错误和解决方案

### 错误 1：Invalid hook call

```typescript
// ❌ 原因：导入方式混用
import { useState, type FC } from 'react';

// ✅ 解决：分开导入
import { useState } from 'react';
import type { FC } from 'react';
```

### 错误 2：Cannot read properties of null

```typescript
// ❌ 原因：React 对象为 null
import React, { useState } from 'react';

// ✅ 解决：不导入 React
import { useState } from 'react';
```

### 错误 3：Multiple React copies

```typescript
// ❌ 原因：可能有多个 React 实例
// 检查：npm list react

// ✅ 解决：
npm dedupe
npm install
```

---

## 🔧 修复工具

### PowerShell 修复脚本

```powershell
# Fix-ReactImports-Strict.ps1
# 严格修复 React 导入问题

$files = Get-ChildItem -Path src -Include *.tsx,*.ts -Recurse | 
         Where-Object { $_.FullName -notmatch "\\components\\ui\\" }

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    $original = $content
    
    # 修复混用
    $content = $content -replace "import \{ ([^}]*), type ([^}]*) \} from ['\`"]react['\`"];", "import { `$1 } from 'react';`nimport type { `$2 } from 'react';"
    
    # 修复默认导入混用
    $content = $content -replace "import React, \{ ([^}]+) \} from ['\`"]react['\`"];", "import { `$1 } from 'react';"
    
    if ($content -ne $original) {
        $content | Set-Content $file.FullName -NoNewline
        Write-Host "[FIXED] $($file.FullName)" -ForegroundColor Green
    }
}

Write-Host "`n✅ 修复完成！" -ForegroundColor Cyan
```

---

## 📖 学习资源

### 推荐阅读

1. **React 18 文档** - [react.dev](https://react.dev/)
2. **TypeScript React 备忘单** - [react-typescript-cheatsheet](https://react-typescript-cheatsheet.netlify.app/)
3. **React Hooks 规则** - [Rules of Hooks](https://react.dev/reference/rules/rules-of-hooks)

### 为什么要统一

1. **避免 Hooks 失效** - 混用导入会破坏 React 内部机制
2. **类型检查准确** - 统一的导入方式让 TypeScript 正确推断
3. **代码一致性** - 团队协作更顺畅
4. **减少 Bug** - 标准化减少低级错误

---

## ✅ 最佳实践总结

### 黄金规则

1. **🥇 规则 1：** 永远不要混用 `type` 和运行时导入
2. **🥈 规则 2：** 使用 `import type` 导入类型
3. **🥉 规则 3：** 只导入实际使用的内容
4. **🏅 规则 4：** 保持所有文件的导入方式一致

### 记忆口诀

```
导入 React 有规范，
混用类型会出乱。
type 单独来导入，
hooks 直接用命名。
默认导入不需要，
统一格式最安全！
```

---

## 🎯 强制执行

### 代码审查要点

每次提交代码时，审查者必须检查：
1. ✅ React 导入方式是否统一
2. ✅ 没有混用 type 和 runtime
3. ✅ 没有不必要的默认导入
4. ✅ 类型导入使用 import type

### Git Pre-commit Hook（可选）

```bash
#!/bin/bash
# .git/hooks/pre-commit

echo "🔍 检查 React 导入规范..."

# 检查混用
MIXED=$(git diff --cached --name-only | grep -E '\.(tsx|ts)$' | xargs grep -l "import.*{.*type.*}.*from.*['\"]react['\"]" 2>/dev/null)

if [ ! -z "$MIXED" ]; then
    echo "❌ 发现混用 type 和 runtime 导入："
    echo "$MIXED"
    echo ""
    echo "请修复后再提交！"
    exit 1
fi

echo "✅ React 导入规范检查通过"
exit 0
```

---

## 📞 问题反馈

如果遇到导入相关的问题：

1. 检查本文档的规范
2. 运行检查脚本
3. 查看常见错误和解决方案
4. 必要时重新安装依赖

---

**创建时间：** 2025-11-02  
**维护者：** 开发团队  
**状态：** ✅ 强制执行  
**优先级：** 🔴 最高

---

## 🎉 总结

**记住一句话：**

> **React 导入必须统一，类型单独，Hooks 命名，绝不混用！**

遵守这个规范，就能避免 99% 的 React 导入相关问题！

