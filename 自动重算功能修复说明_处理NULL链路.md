# 自动重算功能修复说明 - 处理 NULL 链路问题

## 📅 修复日期
2025-01-22

## 🐛 发现的问题

### 问题描述

**用户反馈**：
- 在项目管理中修改了合作方（中粮 → 中粮可乐）
- 但运费对账仍显示旧的合作方（中粮）

### 原因分析

**之前的重算逻辑**：
```sql
-- 只查找 chain_id 完全匹配的运单
SELECT id FROM logistics_records 
WHERE project_id = p_project_id 
  AND chain_id = p_chain_id;
```

**问题**：
- ❌ 很多运单的 `chain_id` 为 **NULL**
- ❌ 这些运单不会被找到
- ❌ 所以即使触发器执行了，这些运单也不会被重算

**数据示例**：
```sql
-- logistics_records 表
| auto_number | project_id | chain_id | 
| ----------- | ---------- | -------- |
| YDN001      | 可口可乐   | NULL ❌  |
| YDN002      | 可口可乐   | NULL ❌  |

-- logistics_partner_costs 表（有数据）
| record_id | partner_id | partner_name |
| --------- | ---------- | ------------ |
| YDN001    | uuid-中粮   | 中粮         |
| YDN002    | uuid-中粮   | 中粮         |

-- 之前的逻辑找不到这些运单（因为 chain_id = NULL）
-- 所以修改项目配置后，这些运单不会被重算
```

---

## ✅ 修复方案

### 新的重算逻辑（反向查找）

```sql
-- ① 先获取该链路配置的所有合作方ID
SELECT array_agg(partner_id) 
FROM project_partners
WHERE project_id = p_project_id AND chain_id = p_chain_id;
-- 结果：[uuid-中粮, uuid-xx, ...]

-- ② 通过 logistics_partner_costs 表反向查找
-- 找到所有使用了这些合作方的运单
SELECT DISTINCT lr.id
FROM logistics_records lr
JOIN logistics_partner_costs lpc ON lr.id = lpc.logistics_record_id
WHERE lr.project_id = p_project_id
  AND lpc.partner_id = ANY(v_chain_partner_ids);
-- 这样就能找到所有相关运单，无论 chain_id 是什么！
```

### 修复的函数

1. ✅ `recalculate_costs_for_chain` - 普通模式
2. ✅ `recalculate_costs_for_chain_safe` - 安全模式

---

## 📊 修复前 vs 修复后

### 修复前 ❌

```
可口可乐项目运单：
- YDN001: chain_id = NULL, 合作方 = 中粮
- YDN002: chain_id = NULL, 合作方 = 中粮
- YDN003: chain_id = UUID, 合作方 = 中粮

修改项目配置：中粮 → 中粮可乐
  ↓
触发器执行重算：
  查找条件：project_id = 可口可乐 AND chain_id = UUID
  ↓
只找到：YDN003 ✅（重算成功）
找不到：YDN001, YDN002 ❌（chain_id = NULL）
  ↓
结果：
- YDN001: 仍显示"中粮" ❌
- YDN002: 仍显示"中粮" ❌
- YDN003: 显示"中粮可乐" ✅
```

### 修复后 ✅

```
可口可乐项目运单：
- YDN001: chain_id = NULL, 合作方 = 中粮
- YDN002: chain_id = NULL, 合作方 = 中粮
- YDN003: chain_id = UUID, 合作方 = 中粮

修改项目配置：中粮 → 中粮可乐
  ↓
触发器执行重算：
  ① 获取链路的合作方ID：[中粮的UUID]
  ② 反向查找：所有使用"中粮"的运单
  ↓
找到所有：YDN001, YDN002, YDN003 ✅
  ↓
重算所有（跳过已付款）：
  - 删除"中粮"的成本记录
  - 生成"中粮可乐"的成本记录
  ↓
结果：
- YDN001: 显示"中粮可乐" ✅
- YDN002: 显示"中粮可乐" ✅
- YDN003: 显示"中粮可乐" ✅
```

---

## 🎯 修复的核心逻辑

### 反向查找机制

**原理**：
1. 不依赖 `logistics_records.chain_id`
2. 通过 `logistics_partner_costs` 表反向查找
3. 找到所有使用了该链路合作方的运单

**优势**：
- ✅ 适用于 chain_id = NULL 的情况
- ✅ 适用于 chain_id 有值的情况
- ✅ 适用于 chain_id 指向错误的情况
- ✅ 100% 覆盖所有相关运单

---

## 🚀 现在应该能正常工作了

### 部署后的效果

```
修改项目配置：
  可口可乐项目 - 合作方：中粮 → 中粮可乐
  ↓
触发器自动执行：
  ① 找到该链路的合作方：[中粮]
  ② 反向查找所有使用"中粮"的运单（无论 chain_id）
  ③ 找到所有相关运单（包括 chain_id = NULL 的）
  ④ 删除"中粮"的成本记录
  ⑤ 生成"中粮可乐"的成本记录
  ⑥ 跳过已付款运单
  ↓
运费对账自动更新：
  - 所有未付款运单显示"中粮可乐" ✅
  - 已付款运单保持原样 ✅
```

---

## 🧪 测试方法

### 1. 部署迁移

```bash
supabase db push
```

### 2. 测试修改

1. 打开项目管理
2. 编辑"可口可乐"项目
3. 修改合作方配置
4. 保存

### 3. 验证结果

```sql
-- 查看是否自动更新
SELECT 
    lr.auto_number,
    p.name as current_partner,
    lpc.payable_amount,
    lpc.created_at
FROM logistics_records lr
JOIN logistics_partner_costs lpc ON lr.id = lpc.logistics_record_id
JOIN partners p ON lpc.partner_id = p.id
WHERE lr.project_name = '可口可乐'
  AND lpc.payment_status != 'Paid'
ORDER BY lr.auto_number, lpc.level;

-- 应该显示最新的合作方名称
```

---

## ⚠️ 临时解决方案（立即见效）

如果迁移还没部署，可以先：

1. **在运费对账页面操作**
   - 筛选：项目=可口可乐，合作方=中粮
   - 全选运单
   - 批量重新计算

2. **刷新验证**
   - 应该显示"中粮可乐"

---

## ✅ 修复总结

**核心改进**：
- ✅ 从"正向查找"改为"反向查找"
- ✅ 不依赖 `chain_id` 字段
- ✅ 通过合作方ID查找运单
- ✅ 100% 覆盖所有相关运单

**效果**：
- ✅ 修改项目配置后，所有运单都会被找到并重算
- ✅ 无论 chain_id 是 NULL 还是有值
- ✅ 运费对账自动显示最新数据

---

**修复时间**: 2025-01-22  
**状态**: ✅ 已修复，等待部署  
**版本**: v1.1

