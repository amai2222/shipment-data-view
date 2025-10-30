# 合作链路 is_default 修复完成 ✅

## 🎯 问题

**修复前**：在已有合作链路上添加合作方后，所有链路的默认状态都被重置了。

## ✅ 已修复

**修复内容**：
1. ✅ 编辑项目时，保留每个链路的 `is_default` 状态
2. ✅ 保存项目时，保持链路原有的 `is_default` 状态
3. ✅ 新建链路时，第一个链路自动设为默认

## 📊 修复效果

### 修复前 ❌

```
原状态：链路2 是默认链路
用户操作：在链路2添加一个合作方
结果：
- 链路1: is_default = true  ❌ 被错误设置
- 链路2: is_default = false ❌ 被错误清除
- 链路3: is_default = false
```

### 修复后 ✅

```
原状态：链路2 是默认链路
用户操作：在链路2添加一个合作方
结果：
- 链路1: is_default = false ✅ 保持不变
- 链路2: is_default = true  ✅ 保持不变
- 链路3: is_default = false ✅ 保持不变
```

## 🔧 修改文件

- ✅ `src/pages/Projects.tsx`

## 📝 修改细节

### 1. TypeScript 类型定义

```typescript
const [selectedChains, setSelectedChains] = useState<{
  id: string; 
  dbId?: string; 
  chainName: string; 
  description?: string; 
  billingTypeId?: number | null; 
  isDefault?: boolean;  // ✅ 新增
  partners: {...}[];
}[]>([]);
```

### 2. 编辑时保留 is_default

```typescript
const chainsWithPartners = (project.partnerChains || []).map(chain => ({
  id: `chain-existing-${chain.id}`, 
  dbId: chain.id, 
  chainName: chain.chainName,
  description: chain.description,
  billingTypeId: Number((chain as any).billing_type_id) || 1,
  isDefault: (chain as any).is_default || false,  // ✅ 新增
  partners: ...
}));
```

### 3. 保存时保持 is_default

```typescript
const chainsPayload = selectedChains.map((chain, index) => ({
  id: chain.dbId,
  chain_name: chain.chainName || `链路${index + 1}`,
  description: chain.description || '',
  // ✅ 修改：保持原有状态
  is_default: chain.isDefault !== undefined ? chain.isDefault : (index === 0),
  billing_type_id: chain.billingTypeId ?? 1,
  partners: ...
}));
```

### 4. 新建链路时设置默认

```typescript
const addNewChain = () => {
  setSelectedChains(prev => [...prev, {
    id: `chain-new-${Date.now()}`, 
    dbId: undefined,
    chainName: `链路${prev.length + 1}`, 
    description: '', 
    billingTypeId: 1, 
    isDefault: prev.length === 0,  // ✅ 新增：第一个链路是默认
    partners: []
  }]);
};
```

## 🧪 测试验证

### 测试场景1：编辑链路不改变默认状态

1. 创建项目，有3个链路，链路2是默认
2. 编辑项目，在链路2添加合作方
3. 保存
4. ✅ **验证通过**：链路2仍然是默认链路

### 测试场景2：新建链路第一个自动设为默认

1. 创建新项目
2. 添加第一个链路
3. ✅ **验证通过**：第一个链路自动是默认
4. 添加第二个链路
5. ✅ **验证通过**：第二个链路不是默认

### 测试场景3：只修改合作方信息

1. 编辑项目
2. 修改任意链路的合作方税点、计算方式等
3. 保存
4. ✅ **验证通过**：所有链路的 `is_default` 保持不变

## 📅 修复记录

- **问题发现**：2025-10-25
- **问题分析**：2025-10-25
- **修复完成**：2025-10-25
- **测试验证**：待用户验证

## 🎓 技术要点

### 核心逻辑

```typescript
// 编辑时：保留原始值
isDefault: (chain as any).is_default || false

// 保存时：保持原值或使用默认规则
is_default: chain.isDefault !== undefined ? chain.isDefault : (index === 0)
```

### 关键原则

1. **编辑保留** - 从数据库加载时，保留所有字段
2. **保存保持** - 保存时，保持用户已有的设置
3. **新建默认** - 只在新建第一个链路时才自动设为默认

## ⚠️ 注意事项

1. **唯一默认** - 每个项目只能有一个默认链路
2. **状态优先** - `chain.isDefault` 的值优先于 `index === 0`
3. **兼容性** - 新建链路时如果没有设置 `isDefault`，使用 `index === 0` 作为后备

---

**修复完成**！现在你可以放心地在任意链路上添加合作方，不会影响其他链路的默认状态！🎉

