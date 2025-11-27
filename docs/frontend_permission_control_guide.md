# 前端权限控制使用指南

## 📋 概述

本文档说明如何在前端通过权限管理系统控制这些付款相关函数的使用。

## ✅ 已完成的更新

### 1. 权限配置已更新
- ✅ `src/config/permissions.ts` 中已添加新的权限键
- ✅ 默认角色权限已更新（admin、finance、operator）

### 2. 前端权限检查已添加
- ✅ `PaymentRequestsList.tsx` - PC端付款申请列表
- ✅ `PaymentAudit.tsx` - PC端付款审核
- ✅ `MobilePaymentRequestsList.tsx` - 移动端付款申请列表

## 🔑 函数与权限键对应关系

| 函数名 | 权限键 | 说明 |
|--------|--------|------|
| `cancel_payment_request_1126` | `finance.cancel_payment` | 取消付款申请 |
| `rollback_payment_request_approval_1126` | `finance.rollback_payment_approval` | 回滚付款审批（单个） |
| `batch_rollback_payment_approval_1126` | `finance.rollback_payment_approval` | 批量回滚付款审批 |
| `pay_payment_request_1126` | `finance.pay_payment` | 完成单个付款申请 |
| `batch_pay_payment_requests_1126` | `finance.pay_payment` | 批量完成付款 |
| `reconcile_partner_costs_batch_1126` | `finance.reconcile` | 批量对账合作方成本 |

## 🛠️ 实现方式

### 1. 导入权限 Hook

```typescript
import { useUnifiedPermissions } from '@/hooks/useUnifiedPermissions';

// 在组件中使用
const { hasButtonAccess, hasFunctionAccess } = useUnifiedPermissions();
```

### 2. 控制按钮显示

#### 方式一：使用 `hasButtonAccess`（推荐）

```typescript
// 单个按钮权限控制
{hasButtonAccess('finance.pay_payment') && (
  <Button onClick={handlePayment}>
    付款
  </Button>
)}

// 批量操作权限控制
{hasButtonAccess('finance.pay_payment') && selection.selectedIds.size > 0 && (
  <Button onClick={handleBatchPay}>
    批量付款
  </Button>
)}
```

#### 方式二：使用 `hasFunctionAccess`

```typescript
// 功能权限检查
const canPay = hasFunctionAccess('finance.pay_payment');
const canCancel = hasFunctionAccess('finance.cancel_payment');

{canPay && (
  <Button onClick={handlePayment}>付款</Button>
)}
```

### 3. 控制操作执行

在函数执行前进行权限检查：

```typescript
const handlePayment = async (req: PaymentRequest) => {
  // 权限检查（双重保护：前端 + 后端）
  if (!hasButtonAccess('finance.pay_payment')) {
    toast({
      title: '权限不足',
      description: '您没有完成付款的权限',
      variant: 'destructive'
    });
    return;
  }

  try {
    const { data, error } = await supabase.rpc('pay_payment_request_1126', {
      p_request_id: req.request_id
    });
    // ... 处理结果
  } catch (error) {
    // 后端也会检查权限，如果权限不足会返回错误
    console.error('付款失败:', error);
  }
};
```

### 4. 条件渲染整个操作区域

```typescript
{hasButtonAccess('finance.pay_payment') && (
  <div className="flex gap-2">
    <Button onClick={handlePayment}>付款</Button>
    <Button onClick={handleBatchPay}>批量付款</Button>
  </div>
)}
```

## 📝 完整示例

### 示例1：付款申请列表页面

```typescript
import { useUnifiedPermissions } from '@/hooks/useUnifiedPermissions';

export default function PaymentRequestsList() {
  const { hasButtonAccess } = useUnifiedPermissions();

  // 单个付款
  const handlePayment = async (req: PaymentRequest) => {
    if (!hasButtonAccess('finance.pay_payment')) {
      toast({ title: '权限不足', variant: 'destructive' });
      return;
    }
    
    const { data, error } = await supabase.rpc('pay_payment_request_1126', {
      p_request_id: req.request_id
    });
    // ...
  };

  // 批量付款
  const handleBatchPay = async () => {
    if (!hasButtonAccess('finance.pay_payment')) {
      toast({ title: '权限不足', variant: 'destructive' });
      return;
    }
    
    const { data, error } = await supabase.rpc('batch_pay_payment_requests_1126', {
      p_request_ids: Array.from(selection.selectedIds)
    });
    // ...
  };

  return (
    <div>
      {/* 批量操作按钮 - 需要权限 */}
      {hasButtonAccess('finance.pay_payment') && selection.selectedIds.size > 0 && (
        <Button onClick={handleBatchPay}>批量付款</Button>
      )}

      {/* 表格中的操作按钮 */}
      <Table>
        {requests.map(req => (
          <TableRow key={req.id}>
            <TableCell>{req.request_id}</TableCell>
            <TableCell>
              {/* 付款按钮 - 需要权限 */}
              {hasButtonAccess('finance.pay_payment') && req.status === 'Approved' && (
                <Button onClick={() => handlePayment(req)}>付款</Button>
              )}
              
              {/* 取消付款按钮 - 需要权限 */}
              {hasButtonAccess('finance.cancel_payment') && req.status === 'Paid' && (
                <Button onClick={() => handleCancelPayment(req)}>取消付款</Button>
              )}
              
              {/* 回滚审批按钮 - 需要权限 */}
              {hasButtonAccess('finance.rollback_payment_approval') && req.status === 'Approved' && (
                <Button onClick={() => handleRollbackApproval(req)}>回滚审批</Button>
              )}
            </TableCell>
          </TableRow>
        ))}
      </Table>
    </div>
  );
}
```

### 示例2：对账页面

```typescript
import { useUnifiedPermissions } from '@/hooks/useUnifiedPermissions';

export default function FinanceReconciliation() {
  const { hasButtonAccess } = useUnifiedPermissions();

  const handleReconcile = async (costIds: string[]) => {
    if (!hasButtonAccess('finance.reconcile')) {
      toast({ title: '权限不足', variant: 'destructive' });
      return;
    }

    const { data, error } = await supabase.rpc('reconcile_partner_costs_batch_1126', {
      p_cost_ids: costIds,
      p_reconciliation_status: 'Reconciled'
    });
    // ...
  };

  return (
    <div>
      {hasButtonAccess('finance.reconcile') && (
        <Button onClick={() => handleReconcile(selectedIds)}>
          批量对账
        </Button>
      )}
    </div>
  );
}
```

## 🔒 权限配置

### 在权限管理系统中配置

1. 进入 **设置 → 权限配置** 或 **设置 → 集成权限管理**
2. 找到 **财务操作** 组
3. 为角色分配以下权限：
   - `finance.pay_payment` - 完成付款
   - `finance.cancel_payment` - 取消付款
   - `finance.rollback_payment_approval` - 回滚付款审批
   - `finance.reconcile` - 财务对账

### 默认角色权限

在 `src/config/permissions.ts` 中已配置默认权限：

```typescript
finance: {
  function_permissions: [
    'finance.view_cost',
    'finance.approve_payment',
    'finance.generate_invoice',
    'finance.reconcile',
    'finance.pay_payment',        // ✅ 新增
    'finance.cancel_payment',     // ✅ 新增
    'finance.rollback_payment_approval' // ✅ 新增
  ]
}
```

## ⚠️ 重要说明

### 双重权限保护

1. **前端权限检查**：控制按钮显示和操作执行
   - 使用 `hasButtonAccess` 或 `hasFunctionAccess`
   - 防止无权限用户看到操作按钮

2. **后端权限检查**：确保数据安全
   - 数据库函数内部使用 `has_function_permission()`
   - 即使前端被绕过，后端也会拒绝无权限操作

### 权限检查最佳实践

```typescript
// ✅ 推荐：在函数执行前检查
const handlePayment = async (req: PaymentRequest) => {
  if (!hasButtonAccess('finance.pay_payment')) {
    toast({ title: '权限不足', variant: 'destructive' });
    return;
  }
  // 执行操作...
};

// ✅ 推荐：条件渲染按钮
{hasButtonAccess('finance.pay_payment') && (
  <Button onClick={handlePayment}>付款</Button>
)}

// ❌ 不推荐：只依赖后端检查（用户体验差）
// 用户点击按钮后才发现没有权限
```

## 📊 权限键汇总

| 权限键 | 对应函数 | 使用场景 |
|--------|---------|---------|
| `finance.pay_payment` | `pay_payment_request_1126`<br>`batch_pay_payment_requests_1126` | 付款操作（单个/批量） |
| `finance.cancel_payment` | `cancel_payment_request_1126` | 取消付款 |
| `finance.rollback_payment_approval` | `rollback_payment_request_approval_1126`<br>`batch_rollback_payment_approval_1126` | 回滚审批（单个/批量） |
| `finance.reconcile` | `reconcile_partner_costs_batch_1126` | 运费对账 |
| `finance.approve_payment` | `batch_approve_payment_requests_1126` | 审批付款（已有） |
| `finance.generate_invoice` | `save_invoice_request_1126` | 生成发票（已有） |

## 🎯 快速开始

1. **导入 Hook**：
   ```typescript
   import { useUnifiedPermissions } from '@/hooks/useUnifiedPermissions';
   ```

2. **使用权限检查**：
   ```typescript
   const { hasButtonAccess } = useUnifiedPermissions();
   ```

3. **控制按钮显示**：
   ```typescript
   {hasButtonAccess('finance.pay_payment') && <Button>付款</Button>}
   ```

4. **在操作前检查**：
   ```typescript
   if (!hasButtonAccess('finance.pay_payment')) return;
   ```

5. **配置角色权限**：
   - 在权限管理界面为角色分配相应权限
   - 或修改 `src/config/permissions.ts` 中的默认配置

## ✅ 验证

- ✅ 权限配置已添加到 `src/config/permissions.ts`
- ✅ 前端使用 `hasButtonAccess` 控制按钮显示
- ✅ 后端使用 `has_function_permission` 确保数据安全
- ✅ 双重保护机制确保系统安全

