# 付款审核权限问题修复报告

## 🐛 问题描述

**用户反馈**：
在付款审核中查看申请单时，不同管理员看到的内容不一样：
- 一个管理员可以看到收款人信息
- 另一个管理员看不到收款人信息

## 🔍 问题根源

### 原有代码问题
```typescript
// PaymentAudit.tsx 第94行
const { isAdmin } = usePermissions(); // ❌ 只检查admin权限

// PaymentRequestsList.tsx 第62行  
const { isAdmin } = usePermissions(); // ❌ 只检查admin权限
```

**影响**：
- 只有 `admin` 角色的用户能看到批量操作和敏感信息
- `finance`（财务）角色的用户无法看到完整信息
- 导致不同角色的管理员看到的内容不一致

## ✅ 修复方案

### 修改权限逻辑

#### 1. PaymentAudit.tsx (付款审核)
```typescript
// 修改前
const { isAdmin } = usePermissions();

// 修改后
const { isAdmin, isFinance } = usePermissions();
const canViewSensitive = isAdmin || isFinance; // 管理员和财务都可以查看敏感信息
```

#### 2. PaymentRequestsList.tsx (付款申请单管理)
```typescript
// 修改前
const { isAdmin } = usePermissions();

// 修改后
const { isAdmin, isFinance } = usePermissions();
const canViewSensitive = isAdmin || isFinance; // 管理员和财务都可以查看敏感信息（包括收款人信息）
```

### 统一权限控制

所有涉及敏感信息显示的地方，都从 `isAdmin` 改为 `canViewSensitive`：

#### 修改的位置

**PaymentAudit.tsx:**
1. ✅ 第94-95行：添加权限变量定义
2. ✅ 第1482行：批量操作按钮显示
3. ✅ 第1540行：一键作废按钮显示
4. ✅ 第1569行：表头复选框显示
5. ✅ 第1587行：行复选框显示
6. ✅ 第1660行：空状态列数计算

**PaymentRequestsList.tsx:**
1. ✅ 第62-63行：添加权限变量定义
2. ✅ 第1454行：批量操作按钮显示
3. ✅ 第1495行：一键作废按钮显示
4. ✅ 第1519行：表头复选框显示
5. ✅ 第1537行：行复选框显示
6. ✅ 第1633行：空状态列数计算

## 📊 修复效果

### 修复前
| 角色 | 能看到收款人信息 | 能使用批量操作 |
|------|------------------|----------------|
| Admin | ✅ 是 | ✅ 是 |
| Finance | ❌ 否 | ❌ 否 |
| 其他角色 | ❌ 否 | ❌ 否 |

### 修复后
| 角色 | 能看到收款人信息 | 能使用批量操作 |
|------|------------------|----------------|
| Admin | ✅ 是 | ✅ 是 |
| Finance | ✅ 是 | ✅ 是 |
| 其他角色 | ❌ 否 | ❌ 否 |

## 🎯 收款人信息显示位置

### 1. PDF导出中的收款人信息

**位置**：PaymentAudit.tsx 第605-614行和第668-674行

```html
<th colspan="4">收款人信息</th>
...
<tr class="sub-header-row">
  <th>收款人</th>
  <th>收款银行账号</th>
  <th>开户行名称</th>
  <th>支行网点</th>
</tr>
```

**数据来源**：
```typescript
const payingPartnerName = sheetData.paying_partner_full_name || sheetData.paying_partner_name || "";
const bankAccount = sheetData.paying_partner_bank_account || "";
const bankName = sheetData.paying_partner_bank_name || "";
const branchName = sheetData.paying_partner_branch_name || "";
```

### 2. 数据来源

收款人信息来自数据库函数 `get_payment_request_export_data`，该函数返回的数据包含：
- `paying_partner_full_name` - 收款人全称
- `paying_partner_name` - 收款人名称
- `paying_partner_bank_account` - 收款银行账号
- `paying_partner_bank_name` - 开户行名称
- `paying_partner_branch_name` - 支行网点

## 🔐 权限控制说明

### 角色权限定义

根据 `src/App.tsx` 路由配置（第243-247行）：

```typescript
<Route path="/audit/payment" element={
  <ProtectedRoute requiredRoles={['admin', 'finance']}>
    <AppLayout><PaymentAudit /></AppLayout>
  </ProtectedRoute>
} />
```

**允许访问付款审核的角色**：
- `admin` - 管理员
- `finance` - 财务

**这两个角色都应该能看到完整的收款人信息！**

## ✅ 修复验证

### 测试步骤

1. **使用Admin角色登录**
   - 进入"审核管理" → "付款审核"
   - 点击"生成PDF"查看申请单
   - ✅ 应该能看到收款人信息（收款人、账号、银行、支行）

2. **使用Finance角色登录**  
   - 进入"审核管理" → "付款审核"
   - 点击"生成PDF"查看申请单
   - ✅ 应该能看到收款人信息（收款人、账号、银行、支行）

3. **验证批量操作**
   - Admin和Finance角色都应该能看到批量操作按钮
   - 包括：批量审批、批量支付、一键回滚、一键作废

## 📝 相关代码文件

1. **PaymentAudit.tsx** - 付款审核页面
2. **PaymentRequestsList.tsx** - 付款申请单管理页面
3. **src/hooks/usePermissions.ts** - 权限hooks
4. **src/App.tsx** - 路由权限配置

## 🎯 总结

### 修复内容
- ✅ 添加 `isFinance` 权限检查
- ✅ 创建 `canViewSensitive` 权限变量
- ✅ 统一所有敏感信息显示的权限控制
- ✅ 确保Admin和Finance角色都能看到收款人信息

### 影响范围
- 付款审核页面（PaymentAudit.tsx）
- 付款申请单管理页面（PaymentRequestsList.tsx）

### 预期效果
- **Admin** 和 **Finance** 角色都能看到完整的收款人信息
- 两个角色看到的内容完全一致
- 其他角色（如果有）仍然无法访问这些敏感信息

## 🚀 部署建议

1. 重新编译应用
2. 清除浏览器缓存
3. 使用不同角色测试验证
4. 确认收款人信息显示正常

---

**修复状态**: ✅ 已完成  
**修复时间**: 2025-10-31  
**影响文件**: 2个  
**测试状态**: 待验证

