# 合作链路 is_default 被重置问题修复说明

## 🐛 问题描述

**用户反馈**：在已有合作链路上**只添加一个合作方**，结果**所有链路的默认状态都被改了**。

**问题现象**：
- 项目有多个合作链路（比如链路1、链路2、链路3）
- 用户只想在链路2上添加一个合作方
- 保存后，发现所有链路的 `is_default` 状态都被重置了
- 原本是链路2是默认链路，现在变成链路1是默认链路

## 🔍 问题原因

### 根本原因

**前端编辑逻辑缺陷** - 编辑项目时没有正确保留和恢复链路的 `is_default` 状态。

### 问题代码分析

#### 问题1：编辑时没有保留 `is_default`

```typescript
// src/pages/Projects.tsx  行 200-210
const chainsWithPartners = (project.partnerChains || []).map(chain => ({
  id: `chain-existing-${chain.id}`, 
  dbId: chain.id, 
  chainName: chain.chainName,
  description: chain.description,
  billingTypeId: Number((chain as any).billing_type_id) || 1,
  // ❌ 缺少：is_default: chain.is_default
  partners: (chain.partners || []).map...
}));
```

**问题**：编辑时从数据库加载链路信息，但**没有保留** `is_default` 字段。

#### 问题2：保存时强制重置 `is_default`

```typescript
// src/pages/Projects.tsx  行 255-260
const chainsPayload = selectedChains.map((chain, index) => ({
  id: chain.dbId,
  chain_name: chain.chainName || `链路${index + 1}`,
  description: chain.description || '',
  is_default: index === 0,  // ❌ 强制设置：第一个是默认，其他都不是
  billing_type_id: chain.billingTypeId ?? 1,
  partners: ...
}));
```

**问题**：保存时，强制将 `index === 0`（第一个链路）设为默认，其他链路设为非默认。

### 问题流程

```
1. 用户编辑项目（链路2原本是默认）
   ↓
2. handleEdit 加载链路数据（❌ 没有保留 is_default）
   ↓
3. selectedChains 中所有链路都没有 is_default 属性
   ↓
4. 用户在链路2添加一个合作方
   ↓
5. handleSubmit 保存时，强制设置：
   - 链路1 (index=0): is_default = true  ❌ 错误！
   - 链路2 (index=1): is_default = false ❌ 原本是 true
   - 链路3 (index=2): is_default = false
   ↓
6. 所有链路的默认状态都被错误重置 ❌
```

## ✅ 修复方案

### 核心修复

1. **编辑时保留 `is_default`** - 从数据库加载时保留原始状态
2. **保存时保持 `is_default`** - 只在用户明确更改时才修改

### 修复代码

#### 修复1：编辑时保留 `is_default`

```typescript
// src/pages/Projects.tsx  handleEdit 函数
const chainsWithPartners = (project.partnerChains || []).map(chain => ({
  id: `chain-existing-${chain.id}`, 
  dbId: chain.id, 
  chainName: chain.chainName,
  description: chain.description,
  billingTypeId: Number((chain as any).billing_type_id) || 1,
  isDefault: chain.is_default || false,  // ✅ 添加：保留 is_default 状态
  partners: (chain.partners || []).map...
}));
```

#### 修复2：保存时保持 `is_default`

```typescript
// src/pages/Projects.tsx  handleSubmit 函数
const chainsPayload = selectedChains.map((chain, index) => ({
  id: chain.dbId,
  chain_name: chain.chainName || `链路${index + 1}`,
  description: chain.description || '',
  // ✅ 修改：保持原有状态，只在新建链路时才用 index === 0
  is_default: chain.isDefault !== undefined ? chain.isDefault : (index === 0),
  billing_type_id: chain.billingTypeId ?? 1,
  partners: ...
}));
```

#### 修复3：更新 TypeScript 类型

```typescript
// src/pages/Projects.tsx  selectedChains 状态定义
const [selectedChains, setSelectedChains] = useState<{
  id: string; 
  dbId?: string; 
  chainName: string; 
  description?: string; 
  billingTypeId?: number | null;
  isDefault?: boolean;  // ✅ 添加：is_default 字段
  partners: {...}[];
}[]>([]);
```

## 📊 修复效果

### 修复前

```
用户操作：在链路2添加合作方
结果：
- 链路1: is_default = true  ❌ 被错误设置
- 链路2: is_default = false ❌ 被错误清除（原本是 true）
- 链路3: is_default = false ✅ 正确
```

### 修复后

```
用户操作：在链路2添加合作方
结果：
- 链路1: is_default = false ✅ 保持原样
- 链路2: is_default = true  ✅ 保持原样（原本是 true）
- 链路3: is_default = false ✅ 保持原样
```

## 🔧 完整修复步骤

### 步骤1：更新 selectedChains 类型定义

在 `src/pages/Projects.tsx` 第 62-65 行附近：

```typescript
const [selectedChains, setSelectedChains] = useState<{
  id: string; 
  dbId?: string; 
  chainName: string; 
  description?: string; 
  billingTypeId?: number | null;
  isDefault?: boolean;  // ✅ 添加这一行
  partners: {
    id: string, 
    dbId?: string, 
    partnerId: string, 
    level: number, 
    taxRate: number, 
    calculationMethod: "tax" | "profit", 
    profitRate?: number, 
    partnerName?: string
  }[];
}[]>([]);
```

### 步骤2：编辑时保留 is_default

在 `src/pages/Projects.tsx` 第 200-210 行附近：

```typescript
const chainsWithPartners = (project.partnerChains || []).map(chain => ({
  id: `chain-existing-${chain.id}`, 
  dbId: chain.id, 
  chainName: chain.chainName,
  description: chain.description,
  billingTypeId: Number((chain as any).billing_type_id) || 1,
  isDefault: chain.is_default || false,  // ✅ 添加这一行
  partners: (chain.partners || []).map((pp) => ({
    id: `partner-existing-${pp.id}`, 
    dbId: pp.id, 
    partnerId: pp.partnerId,
    level: pp.level, 
    taxRate: pp.taxRate,
    calculationMethod: pp.calculationMethod || "tax",
    profitRate: pp.profitRate || 0, 
    partnerName: pp.partnerName
  }))
}));
```

### 步骤3：保存时保持 is_default

在 `src/pages/Projects.tsx` 第 255-260 行附近：

```typescript
const chainsPayload = selectedChains.map((chain, index) => ({
  id: chain.dbId,
  chain_name: chain.chainName || `链路${index + 1}`,
  description: chain.description || '',
  // ✅ 修改这一行
  is_default: chain.isDefault !== undefined ? chain.isDefault : (index === 0),
  billing_type_id: chain.billingTypeId ?? 1,
  partners: chain.partners.map(p => ({
    id: p.dbId,
    partner_id: p.partnerId,
    level: Number(p.level),
    tax_rate: Number(p.taxRate) || 0,
    calculation_method: p.calculationMethod || 'tax',
    profit_rate: Number(p.profitRate) || 0
  }))
}));
```

### 步骤4：新增链路时设置 is_default

在 `src/pages/Projects.tsx` 第 330-334 行附近：

```typescript
const addNewChain = () => {
  setSelectedChains(prev => [
    ...prev, 
    { 
      id: `chain-new-${Date.now()}`, 
      chainName: '', 
      billingTypeId: 1,
      isDefault: prev.length === 0,  // ✅ 添加：第一个链路设为默认
      partners: [] 
    }
  ]);
};
```

## 🧪 测试验证

### 测试用例1：编辑项目时保持默认链路

1. 创建一个项目，有3个链路，链路2是默认链路
2. 编辑项目，在链路2上添加一个合作方
3. 保存
4. ✅ 验证：链路2仍然是默认链路

### 测试用例2：新建链路时第一个是默认

1. 创建一个新项目
2. 添加第一个链路
3. ✅ 验证：第一个链路自动设为默认
4. 添加第二个链路
5. ✅ 验证：第二个链路不是默认

### 测试用例3：只修改合作方不影响默认状态

1. 编辑一个已有项目
2. 在任意链路上修改合作方信息（税点、计算方式等）
3. 保存
4. ✅ 验证：所有链路的 `is_default` 状态保持不变

## ⚠️ 注意事项

### 1. 数据一致性

- 每个项目**只能有一个**默认链路
- 如果手动设置多个默认链路，系统可能会出现异常

### 2. 新建 vs 编辑

- **新建链路**：第一个链路自动设为默认
- **编辑链路**：保持原有的 `is_default` 状态

### 3. 链路顺序

- 链路在 `selectedChains` 数组中的顺序（index）不应该影响 `is_default`
- `is_default` 应该由数据库中的值决定，不是由数组索引决定

## 📅 修复记录

- **问题发现**：2025-10-25
- **问题分析**：2025-10-25
- **修复方案**：2025-10-25
- **待实施**：需要修改前端代码

## 🎯 总结

### 问题本质

**状态丢失问题** - 编辑时没有保留链路的 `is_default` 状态，导致保存时被错误重置。

### 解决方案

1. ✅ 编辑时保留 `is_default`
2. ✅ 保存时保持 `is_default`
3. ✅ 只在新建链路时才自动设置第一个为默认

### 关键代码

```typescript
// 编辑时
isDefault: chain.is_default || false

// 保存时
is_default: chain.isDefault !== undefined ? chain.isDefault : (index === 0)
```

这两行代码解决了链路默认状态被错误重置的核心问题！✅

---

**修复完成后**：用户在任意链路添加合作方，都不会影响其他链路的默认状态！🎉

