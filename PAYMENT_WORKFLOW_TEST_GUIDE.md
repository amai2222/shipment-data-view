# 💯 付款流程完整测试指南

## 🎯 完整流程图

```
运单状态              申请单状态          操作页面                按钮
────────────────────────────────────────────────────────────────────
Unpaid(未支付)                          合作方付款申请         [付款申请]
    ↓
Processing          Pending             
(已申请支付)         (待审核)            
    ↓                   ↓                                          
    │                   │                付款审核              [审批]
    ↓                   ↓
Approved            Approved            
(支付审核通过)       (已审批待支付)      
    ↓                   ↓                                          
    │                   │                财务付款              [付款]
    ↓                   ↓
Paid                Paid                
(已支付)             (已支付)            
```

## 🧪 完整测试流程

### 测试1：创建付款申请 ✅

**页面**：合作方付款申请

**步骤**：
1. 选择payment_status = "未支付"的运单
2. 点击"付款申请"按钮
3. 确认生成

**验证**：
- ✅ 运单payment_status：`Unpaid` → `Processing`
- ✅ 运单显示：未支付 → **已申请支付**（灰色徽章）
- ✅ 生成付款申请单，status = `Pending`
- ✅ 申请单显示：**待审核**（灰色徽章）

---

### 测试2：审批付款申请 ✅

**页面**：付款审核

**步骤**：
1. 找到status = "Pending"的申请单
2. 点击"审批"按钮（红色）
3. 确认审批

**验证**：
- ✅ 申请单status：`Pending` → `Approved`
- ✅ 申请单显示：待审核 → **已审批待支付**（蓝色徽章）
- ✅ 运单payment_status：`Processing` → `Approved`
- ✅ 运单显示：已申请支付 → **支付审核通过**（绿色边框徽章）
- ✅ RPC函数：`approve_payment_request`

---

### 测试3：取消审批 ✅

**页面**：付款审核

**步骤**：
1. 找到status = "Approved"的申请单
2. 点击"一键回滚"或批量选择后点击批量按钮
3. 确认取消

**验证**：
- ✅ 申请单status：`Approved` → `Pending`
- ✅ 申请单显示：已审批待支付 → **待审核**（灰色徽章）
- ✅ 运单payment_status：`Approved` → `Processing`
- ✅ 运单显示：支付审核通过 → **已申请支付**（灰色徽章）
- ✅ RPC函数：`batch_rollback_payment_approval`

---

### 测试4：执行付款 ✅

**页面**：财务付款

**步骤**：
1. 默认筛选显示status = "Approved"的申请单
2. 找到"已审批待支付"的申请单
3. 点击"付款"按钮（绿色）
4. 确认付款

**验证**：
- ✅ 申请单status：`Approved` → `Paid`
- ✅ 申请单显示：已审批待支付 → **已支付**（红色徽章）✅
- ✅ 运单payment_status：`Approved` → `Paid`
- ✅ 运单显示：支付审核通过 → **已支付**（蓝色徽章）
- ✅ payment_completed_at时间戳已设置
- ✅ RPC函数：`pay_payment_request`

---

### 测试5：取消付款 ✅

**页面**：财务付款

**步骤**：
1. 找到status = "Paid"的申请单
2. 点击"取消付款"按钮
3. 确认取消

**验证**：
- ✅ 申请单status：`Paid` → `Approved`
- ✅ 申请单显示：已支付 → **已审批待支付**（蓝色徽章）
- ✅ 运单payment_status：`Paid` → `Approved`
- ✅ 运单显示：已支付 → **支付审核通过**（绿色边框徽章）
- ✅ payment_completed_at清空为NULL
- ✅ RPC函数：`cancel_payment_request`

---

## 🔄 完整状态流转验证

### 正向流程
```
Unpaid → Processing → Approved → Paid
(创建)     (审批)      (付款)
```

### 反向流程（取消/回滚）
```
Paid → Approved → Processing
(取消付款)  (取消审批)
```

---

## 📊 数据库检查（测试后执行）

### 验证运单状态
```sql
-- 查看某个运单的状态变化
SELECT 
  auto_number,
  payment_status,
  payment_applied_at,
  payment_completed_at,
  payment_request_id
FROM logistics_records
WHERE auto_number = '运单编号'
ORDER BY payment_applied_at DESC;
```

### 验证申请单状态
```sql
-- 查看某个申请单的状态
SELECT 
  request_id,
  status,
  record_count,
  created_at,
  notes
FROM payment_requests
WHERE request_id = 'FKD...'
ORDER BY created_at DESC;
```

---

## ✅ 筛选器状态选项

### 合作方付款申请（运单状态）
- 所有状态
- 未支付
- 已申请支付
- **支付审核通过** ← 新增
- 已支付

### 付款审核（申请单状态）
- 全部状态
- 待审核
- **已审批待支付** ← 修改
- 已支付

### 财务付款（申请单状态）
- 全部状态
- 待审核
- **已审批待支付** ← 修改（默认选中）
- 已支付

---

## 🎨 徽章颜色

### 运单payment_status
- Unpaid → 红色（destructive）
- Processing → 灰色（secondary）
- **Approved → 绿色边框**（outline + 绿色）
- Paid → 蓝色（default）

### 申请单status
- Pending → 灰色（secondary）
- Approved → 蓝色（default）
- **Paid → 红色**（destructive）✅

---

## 🚀 执行顺序

1. ✅ 执行SQL：`scripts/COMPLETE_PAYMENT_WORKFLOW_FIX.sql`
2. ✅ 刷新浏览器（Ctrl+F5）
3. ✅ 按照上面的测试流程逐个测试
4. ✅ 检查每个状态变化是否正确
5. ✅ 检查筛选器和徽章颜色

---

**完整的测试清单，逐项验证！** ✅

