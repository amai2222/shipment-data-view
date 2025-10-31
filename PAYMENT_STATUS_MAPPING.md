# 付款状态映射和中文显示

## 运单payment_status状态值和中文显示

| 数据库值 | 中文显示 | 说明 | 流程阶段 |
|---------|---------|------|---------|
| `Unpaid` | 未支付 | 初始状态 | - |
| `Processing` | 已申请支付 | 创建付款申请后 | 步骤1完成 |
| `Approved` | 支付审核通过 | 审核通过后 | 步骤2完成 |
| `Paid` | 已支付 | 付款完成后 | 步骤3完成 |

## 付款申请单status状态值和中文显示

| 数据库值 | 中文显示 | 说明 | 流程阶段 |
|---------|---------|------|---------|
| `Pending` | 待审核 | 创建后初始状态 | - |
| `Approved` | 待支付 | 审核通过 | 步骤2完成 |
| `Paid` | 已支付 | 付款完成 | 步骤3完成 |
| `Rejected` | 已驳回 | 审核驳回 | - |
| `Cancelled` | 已取消 | 作废/取消 | - |

## 前端中文映射代码

### 运单payment_status显示
```typescript
const getPaymentStatusText = (status: string) => {
  switch (status) {
    case 'Unpaid': return '未支付';
    case 'Processing': return '已申请支付';
    case 'Approved': return '支付审核通过';
    case 'Paid': return '已支付';
    default: return status;
  }
};
```

### 申请单status显示
```typescript
const getRequestStatusText = (status: string) => {
  switch (status) {
    case 'Pending': return '待审核';
    case 'Approved': return '待支付';
    case 'Paid': return '已支付';
    case 'Rejected': return '已驳回';
    case 'Cancelled': return '已取消';
    default: return status;
  }
};
```

## 状态流转图

```
运单状态流转：
┌─────────┐
│ Unpaid  │ 未支付
│ (初始)   │
└────┬────┘
     │ 创建付款申请
     ↓
┌─────────┐
│Processing│ 已申请支付
│         │
└────┬────┘
     │ 审核通过
     ↓
┌─────────┐
│Approved │ 支付审核通过 ← 新增状态
│         │
└────┬────┘
     │ 执行付款
     ↓
┌─────────┐
│  Paid   │ 已支付
│         │
└─────────┘

申请单状态流转：
┌─────────┐
│ Pending │ 待审核
│         │
└────┬────┘
     │ 审核通过
     ↓
┌─────────┐
│Approved │ 待支付
│         │
└────┬────┘
     │ 执行付款
     ↓
┌─────────┐
│  Paid   │ 已支付
│         │
└─────────┘
```

