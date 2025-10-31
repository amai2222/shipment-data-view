# 实施新的付款流程

## 📋 需要修改的文件

### 后端（Supabase）

1. **scripts/ADD_APPROVED_STATUS.sql** ✅ 已创建
   - 创建approve_payment_request函数
   - 创建pay_payment_request函数
   - 创建批量函数

### 前端（需要修改）

2. **src/pages/PaymentAudit.tsx** - 付款审核页面
   - 修改handleApproval函数调用新的RPC

3. **src/pages/PaymentRequestsList.tsx** - 财务付款页面
   - 修改付款函数调用新的RPC
   - 添加状态判断（只有Approved才能付款）

4. **前端状态显示映射** - 多个文件
   - 添加Approved状态的中文显示

---

## 🚀 实施步骤

### 第1步：执行后端SQL

**在Supabase执行**：`scripts/ADD_APPROVED_STATUS.sql`

### 第2步：修改前端代码

我现在开始修改...

### 第3步：测试流程

1. 创建付款申请
2. 审核
3. 付款

---

**我现在开始修改前端代码！**

