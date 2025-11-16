# CurrencyDisplay 组件使用说明

## 功能
统一的金额显示组件，在桌面端将小数点后的数字字号调整为比整数部分小一号。

## 使用方法

### 基本用法
```tsx
import { CurrencyDisplay } from '@/components/CurrencyDisplay';

// 基本使用
<CurrencyDisplay value={1234.56} />

// 带自定义样式
<CurrencyDisplay 
  value={1234.56} 
  className="text-red-600 font-bold"
/>
```

### 替换现有的 formatCurrency 函数

**之前：**
```tsx
{formatCurrency(amount)}
```

**之后：**
```tsx
<CurrencyDisplay value={amount} />
```

### 在表格中使用
```tsx
<TableCell>
  <CurrencyDisplay value={record.amount} />
</TableCell>
```

### 自定义字号
```tsx
<CurrencyDisplay 
  value={1234.56}
  integerClassName="text-lg"  // 整数部分字号
  decimalClassName="text-xs"   // 小数部分字号（默认比整数小一号）
/>
```

## 组件属性

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| value | number \| null \| undefined | - | 要显示的金额值 |
| className | string | '' | 外层容器的样式类名 |
| integerClassName | string | - | 整数部分的样式类名 |
| decimalClassName | string | 'text-[0.85em]' | 小数部分的样式类名（默认比整数小一号） |
| showSymbol | boolean | true | 是否显示货币符号（¥） |
| minimumFractionDigits | number | 2 | 最小小数位数 |
| maximumFractionDigits | number | 2 | 最大小数位数 |

## 已应用的页面
- ✅ FinanceReconciliation.tsx（运费对账）

## 待应用的页面
需要在以下页面中逐步替换 formatCurrency 为 CurrencyDisplay：
- PaymentRequest.tsx
- InvoiceRequest.tsx
- Home.tsx
- ShipperDashboard.tsx
- 其他显示金额的页面

