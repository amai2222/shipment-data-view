# Edge函数文档

## 概述
本文档记录了Supabase Edge Functions的详细信息，包括函数功能、参数、返回值等。

## Edge函数列表

### 1. 认证相关函数

#### `admin-reset-password`
- **功能**: 管理员重置密码
- **文件**: `supabase/functions/admin-reset-password/index.ts`
- **用途**: 管理员重置用户密码

#### `username-login`
- **功能**: 用户名登录
- **文件**: `supabase/functions/username-login/index.ts`
- **用途**: 支持用户名登录认证

#### `work-wechat-auth`
- **功能**: 企业微信认证
- **文件**: `supabase/functions/work-wechat-auth/index.ts`
- **用途**: 企业微信登录认证

### 2. 业务逻辑函数

#### `bulk-link-logistics`
- **功能**: 批量关联物流记录
- **文件**: `supabase/functions/bulk-link-logistics/index.ts`
- **用途**: 批量处理物流记录关联

#### `get-approvers`
- **功能**: 获取审批人列表
- **文件**: `supabase/functions/get-approvers/index.ts`
- **用途**: 获取付款审批人信息

#### `get-filtered-payment-requests`
- **功能**: 获取筛选的付款申请
- **文件**: `supabase/functions/get-filtered-payment-requests/index.ts`
- **用途**: 根据条件筛选付款申请

### 3. 文件处理函数

#### `export-excel`
- **功能**: 导出Excel文件
- **文件**: `supabase/functions/export-excel/index.ts`
- **用途**: 导出数据到Excel文件

#### `pdf-proxy`
- **功能**: PDF代理服务
- **文件**: `supabase/functions/pdf-proxy/index.ts`
- **用途**: PDF文件代理访问

#### `pdf-proxy-simple`
- **功能**: 简化PDF代理服务
- **文件**: `supabase/functions/pdf-proxy-simple/index.ts`
- **用途**: 简化版PDF代理服务

#### `qiniu-upload`
- **功能**: 七牛云上传服务
- **文件**: `supabase/functions/qiniu-upload/index.ts`
- **用途**: 文件上传到七牛云存储

### 4. 审计日志函数

#### `log-contract-access`
- **功能**: 记录合同访问日志
- **文件**: `supabase/functions/log-contract-access/index.ts`
- **用途**: 记录合同访问审计日志

### 5. 企业微信集成函数

#### `work-wechat-approval`
- **功能**: 企业微信审批
- **文件**: `supabase/functions/work-wechat-approval/index.ts`
- **用途**: 企业微信审批流程集成

## 共享资源

### `_shared/cors.ts`
- **功能**: CORS配置
- **文件**: `supabase/functions/_shared/cors.ts`
- **用途**: 跨域资源共享配置

## 函数分类

### 按功能分类
- **认证类**: `admin-reset-password`, `username-login`, `work-wechat-auth`
- **业务类**: `bulk-link-logistics`, `get-approvers`, `get-filtered-payment-requests`
- **文件类**: `export-excel`, `pdf-proxy`, `pdf-proxy-simple`, `qiniu-upload`
- **审计类**: `log-contract-access`
- **集成类**: `work-wechat-approval`

### 按使用频率分类
- **高频使用**: `export-excel`, `get-approvers`, `get-filtered-payment-requests`
- **中频使用**: `bulk-link-logistics`, `qiniu-upload`, `work-wechat-auth`
- **低频使用**: `admin-reset-password`, `pdf-proxy`, `log-contract-access`

## 部署状态
- ✅ 所有Edge函数已部署到Supabase
- ✅ 共享资源已配置
- ✅ CORS已正确配置

## 更新记录
- 2025-01-20: 初始版本，记录所有Edge函数信息
