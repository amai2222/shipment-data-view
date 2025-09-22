# API接口文档

## 📋 目录
1. [API概述](#API概述)
2. [认证机制](#认证机制)
3. [RESTful API接口](#RESTful-API接口)
4. [RPC函数接口](#RPC函数接口)
5. [实时订阅接口](#实时订阅接口)
6. [文件上传接口](#文件上传接口)
7. [错误处理](#错误处理)
8. [SDK使用示例](#SDK使用示例)

---

## API概述

### 🌐 基础信息
- **基础URL**: `https://your-project.supabase.co`
- **API版本**: v1
- **认证方式**: JWT Bearer Token
- **数据格式**: JSON
- **字符编码**: UTF-8

### 📊 API架构
```
┌─────────────────────────────────────────────────────────────┐
│                    客户端应用                                │
├─────────────────────────────────────────────────────────────┤
│                    API网关层                                │
│  ┌─────────────┬─────────────┬─────────────┬─────────────┐  │
│  │ RESTful API │ RPC函数     │ 实时订阅     │ 文件存储     │  │
│  │ CRUD操作    │ 业务逻辑    │ WebSocket   │ 文件上传     │  │
│  └─────────────┴─────────────┴─────────────┴─────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                   Supabase后端                              │
│  ┌─────────────┬─────────────┬─────────────┬─────────────┐  │
│  │ PostgreSQL  │ PostgREST   │ Realtime    │ Storage     │  │
│  │ 数据库      │ API生成     │ 实时通信     │ 文件存储     │  │
│  └─────────────┴─────────────┴─────────────┴─────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 认证机制

### 🔐 JWT Token认证

#### 1. 获取访问令牌
```javascript
// 用户登录
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password'
});

// 获取访问令牌
const accessToken = data.session?.access_token;
```

#### 2. 请求头设置
```javascript
const headers = {
  'Authorization': `Bearer ${accessToken}`,
  'apikey': 'your-anon-key',
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
};
```

#### 3. 令牌刷新
```javascript
// 自动刷新令牌
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'TOKEN_REFRESHED') {
    console.log('Token refreshed:', session.access_token);
  }
});
```

### 🛡️ 行级安全(RLS)
所有API请求都会自动应用数据库级别的行级安全策略，确保用户只能访问有权限的数据。

---

## RESTful API接口

### 📊 项目管理API

#### 1. 获取项目列表
```http
GET /rest/v1/projects
```

**查询参数:**
```javascript
{
  select?: string,           // 选择字段，默认 "*"
  project_status?: string,   // 项目状态筛选
  limit?: number,           // 分页限制，默认 50
  offset?: number,          // 分页偏移，默认 0
  order?: string            // 排序，默认 "created_at.desc"
}
```

**响应示例:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "项目A",
      "manager": "张经理",
      "project_status": "进行中",
      "start_date": "2024-01-01",
      "end_date": "2024-12-31",
      "loading_address": "北京市朝阳区",
      "unloading_address": "天津市滨海新区",
      "planned_total_tons": 10000,
      "billing_type_id": 1,
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    }
  ],
  "count": 1,
  "status": 200,
  "statusText": "OK"
}
```

#### 2. 创建项目
```http
POST /rest/v1/projects
```

**请求体:**
```json
{
  "name": "新项目",
  "manager": "李经理",
  "start_date": "2024-01-01",
  "end_date": "2024-12-31",
  "loading_address": "上海市浦东新区",
  "unloading_address": "杭州市西湖区",
  "planned_total_tons": 5000,
  "billing_type_id": 1,
  "project_status": "进行中"
}
```

**响应示例:**
```json
{
  "data": {
    "id": "new-uuid",
    "name": "新项目",
    "manager": "李经理",
    // ... 其他字段
    "created_at": "2024-01-15T08:30:00Z"
  },
  "status": 201,
  "statusText": "Created"
}
```

#### 3. 更新项目
```http
PATCH /rest/v1/projects?id=eq.{project_id}
```

**请求体:**
```json
{
  "name": "更新后的项目名",
  "project_status": "已完成"
}
```

#### 4. 删除项目
```http
DELETE /rest/v1/projects?id=eq.{project_id}
```

### 🚛 物流记录API

#### 1. 获取物流记录列表
```http
GET /rest/v1/logistics_records
```

**查询参数:**
```javascript
{
  select?: string,                    // 选择字段
  project_id?: string,               // 项目ID筛选
  driver_name?: string,              // 司机名称筛选
  loading_date?: string,             // 装货日期筛选
  transport_type?: string,           // 运输类型筛选
  limit?: number,                    // 分页限制
  offset?: number,                   // 分页偏移
  order?: string                     // 排序规则
}
```

**复杂查询示例:**
```javascript
// 获取指定项目的最近50条记录
const { data, error } = await supabase
  .from('logistics_records')
  .select(`
    *,
    projects(name, manager),
    partner_chains(chain_name)
  `)
  .eq('project_id', projectId)
  .gte('loading_date', '2024-01-01')
  .order('loading_date', { ascending: false })
  .limit(50);
```

#### 2. 创建物流记录
```http
POST /rest/v1/logistics_records
```

**请求体:**
```json
{
  "project_id": "uuid",
  "project_name": "项目A",
  "driver_name": "张师傅",
  "license_plate": "京A12345",
  "driver_phone": "13800138000",
  "loading_date": "2024-01-15T08:30:00Z",
  "loading_location": "北京某煤矿",
  "unloading_location": "天津某电厂",
  "loading_weight": 45.5,
  "transport_type": "实际运输",
  "current_cost": 1000,
  "extra_cost": 200,
  "remarks": "正常运输"
}
```

#### 3. 批量查询
```javascript
// 使用in操作符进行批量查询
const { data, error } = await supabase
  .from('logistics_records')
  .select('*')
  .in('id', ['uuid1', 'uuid2', 'uuid3']);

// 使用or操作符进行复合查询
const { data, error } = await supabase
  .from('logistics_records')
  .select('*')
  .or('transport_type.eq.实际运输,loading_weight.gt.40');
```

### 👥 用户管理API

#### 1. 获取用户配置
```http
GET /rest/v1/user_profiles
```

#### 2. 获取用户权限
```http
GET /rest/v1/user_permissions?user_id=eq.{user_id}
```

#### 3. 更新用户权限
```http
PATCH /rest/v1/user_permissions?user_id=eq.{user_id}&permission_type=eq.menu&permission_name=eq.projects
```

**请求体:**
```json
{
  "has_permission": true
}
```

### 📄 合同管理API

#### 1. 获取合同列表
```http
GET /rest/v1/contracts
```

#### 2. 创建合同
```http
POST /rest/v1/contracts
```

**请求体:**
```json
{
  "contract_number": "HT202401150001",
  "contract_name": "运输服务合同",
  "contract_type": "transport",
  "party_a": "甲方公司",
  "party_b": "乙方公司",
  "signing_date": "2024-01-15",
  "effective_date": "2024-01-16",
  "expiry_date": "2024-12-31",
  "contract_amount": 1000000,
  "status": "draft"
}
```

---

## RPC函数接口

### 📊 统计数据RPC

#### 1. 获取仪表盘统计数据
```javascript
const { data, error } = await supabase.rpc('get_dashboard_stats_with_billing_types', {
  p_start_date: '2024-01-01',
  p_end_date: '2024-12-31',
  p_project_id: null  // null表示所有项目
});
```

**响应数据结构:**
```json
{
  "overview": {
    "totalRecords": 1250,
    "totalWeight": 45680.5,
    "totalVolume": 12340.0,
    "totalTrips": 890,
    "totalCost": 2580000,
    "actualTransportCount": 1100,
    "returnCount": 150,
    "weightRecordsCount": 800,
    "tripRecordsCount": 300,
    "volumeRecordsCount": 150
  },
  "dailyTransportStats": [
    {
      "date": "2024-01-01",
      "actualTransport": 125.5,
      "returns": 0
    }
  ],
  "dailyCostStats": [
    {
      "date": "2024-01-01", 
      "totalCost": 15000
    }
  ]
}
```

#### 2. 获取项目看板数据
```javascript
const { data, error } = await supabase.rpc('get_project_dashboard_data', {
  p_selected_project_id: 'project-uuid',
  p_report_date: '2024-01-15'
});
```

**响应数据结构:**
```json
{
  "project_details": [
    {
      "id": "uuid",
      "name": "项目A",
      "partner_name": "合作伙伴A",
      "start_date": "2024-01-01",
      "planned_total_tons": 10000,
      "billing_type_id": 1
    }
  ],
  "daily_report": {
    "trip_count": 15,
    "total_tonnage": 680.5,
    "daily_receivable_amount": 95000
  },
  "seven_day_trend": [
    {
      "date": "2024-01-09",
      "trip_count": 12,
      "total_tonnage": 540.0,
      "daily_receivable_amount": 75000
    }
  ],
  "summary_stats": {
    "total_trips": 450,
    "total_tonnage": 20500.5,
    "total_cost": 2850000,
    "avg_cost": 6333.33
  },
  "driver_report_table": [
    {
      "driver_name": "张师傅",
      "license_plate": "京A12345",
      "phone": "13800138000",
      "daily_trip_count": 3,
      "total_trip_count": 45,
      "total_tonnage": 2025.5,
      "total_driver_receivable": 285000,
      "total_partner_payable": 285000
    }
  ]
}
```

### 🚛 物流记录RPC

#### 1. 添加物流记录（带成本计算）
```javascript
const { error } = await supabase.rpc('add_logistics_record_with_costs', {
  p_project_id: 'project-uuid',
  p_project_name: '项目A',
  p_driver_name: '张师傅',
  p_license_plate: '京A12345',
  p_driver_phone: '13800138000',
  p_loading_date: '2024-01-15 08:30:00',
  p_unloading_date: '2024-01-15 16:30:00',
  p_loading_location: '北京某煤矿',
  p_unloading_location: '天津某电厂',
  p_loading_weight: 45.5,
  p_unloading_weight: 45.0,
  p_transport_type: '实际运输',
  p_current_cost: 1000,
  p_extra_cost: 200,
  p_chain_id: 'chain-uuid',
  p_remarks: '正常运输'
});
```

#### 2. 更新物流记录
```javascript
const { error } = await supabase.rpc('update_logistics_record_via_recalc', {
  p_record_id: 'record-uuid',
  p_project_id: 'project-uuid',
  // ... 其他参数与添加记录相同
});
```

### 📥 批量导入RPC

#### 1. 预览导入数据
```javascript
const { data, error } = await supabase.rpc('preview_import_with_duplicates_check', {
  p_records: [
    {
      project_name: "项目A",
      driver_name: "张师傅",
      license_plate: "京A12345",
      loading_date: "2024-01-15",
      loading_location: "北京某地",
      unloading_location: "天津某地",
      loading_weight: 45.5,
      chain_id: "chain-uuid",
      current_cost: 1000,
      extra_cost: 200,
      transport_type: "实际运输"
    }
    // ... 更多记录
  ]
});
```

**响应数据:**
```json
{
  "total_count": 100,
  "new_count": 85,
  "duplicate_count": 15,
  "new_records": [/* 新记录数组 */],
  "duplicate_records": [/* 重复记录数组 */],
  "preview_successful": true
}
```

#### 2. 执行批量导入
```javascript
const { data, error } = await supabase.rpc('batch_import_logistics_records_with_update', {
  p_records: {
    create_records: [/* 新建记录数组 */],
    update_records: [/* 更新记录数组 */]
  }
});
```

**响应数据:**
```json
{
  "created_count": 85,
  "updated_count": 10,
  "error_count": 5,
  "errors": [
    {
      "row": 23,
      "message": "项目不存在",
      "record": {/* 错误记录数据 */}
    }
  ],
  "success": false
}
```

### 💰 财务管理RPC

#### 1. 获取付款申请数据
```javascript
const { data, error } = await supabase.rpc('get_payment_request_data_v2', {
  p_start_date: '2024-01-01',
  p_end_date: '2024-01-31',
  p_project_name: null,
  p_partner_name: null,
  p_limit: 50,
  p_offset: 0
});
```

#### 2. 处理付款申请
```javascript
const { error } = await supabase.rpc('process_payment_application', {
  p_record_ids: ['uuid1', 'uuid2', 'uuid3'],
  p_application_amount: 150000,
  p_application_reason: '正常付款申请'
});
```

#### 3. 财务统计函数
```javascript
// 获取总应收款
const { data: totalReceivables } = await supabase.rpc('get_total_receivables');

// 获取月度应收款
const { data: monthlyReceivables } = await supabase.rpc('get_monthly_receivables');

// 获取待付款金额
const { data: pendingPayments } = await supabase.rpc('get_pending_payments');

// 获取月度趋势
const { data: trends } = await supabase.rpc('get_monthly_trends');
```

### 🔍 数据查询RPC

#### 1. 获取增强物流记录汇总
```javascript
const { data, error } = await supabase.rpc('get_logistics_summary_and_records_enhanced', {
  p_start_date: '2024-01-01',
  p_end_date: '2024-01-31',
  p_project_name: '项目A',
  p_driver_name: null,
  p_license_plate: null,
  p_driver_phone: null,
  p_other_platform_name: null,
  p_waybill_numbers: null,
  p_has_scale_record: null,
  p_limit: 50,
  p_offset: 0
});
```

#### 2. 获取所有筛选记录ID
```javascript
const { data, error } = await supabase.rpc('get_all_filtered_record_ids', {
  p_start_date: '2024-01-01',
  p_end_date: '2024-01-31',
  p_project_name: null,
  p_driver_name: null,
  p_license_plate: null,
  p_driver_phone: null,
  p_other_platform_name: null,
  p_waybill_numbers: null,
  p_has_scale_record: null
});
```

---

## 实时订阅接口

### 📡 WebSocket订阅

#### 1. 订阅物流记录变更
```javascript
const subscription = supabase
  .channel('logistics_records_changes')
  .on('postgres_changes', 
    { 
      event: '*', 
      schema: 'public', 
      table: 'logistics_records' 
    }, 
    (payload) => {
      console.log('物流记录变更:', payload);
      // 处理数据变更
      if (payload.eventType === 'INSERT') {
        console.log('新增记录:', payload.new);
      } else if (payload.eventType === 'UPDATE') {
        console.log('更新记录:', payload.new);
      } else if (payload.eventType === 'DELETE') {
        console.log('删除记录:', payload.old);
      }
    }
  )
  .subscribe();

// 取消订阅
subscription.unsubscribe();
```

#### 2. 订阅项目变更
```javascript
const projectSubscription = supabase
  .channel('projects_changes')
  .on('postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'projects',
      filter: 'project_status=eq.进行中'  // 只订阅进行中的项目
    },
    (payload) => {
      console.log('项目变更:', payload);
    }
  )
  .subscribe();
```

#### 3. 订阅用户权限变更
```javascript
const permissionSubscription = supabase
  .channel('user_permissions_changes')
  .on('postgres_changes',
    {
      event: '*',
      schema: 'public', 
      table: 'user_permissions',
      filter: `user_id=eq.${userId}`  // 只订阅当前用户的权限变更
    },
    (payload) => {
      console.log('权限变更:', payload);
      // 刷新用户权限缓存
      refreshUserPermissions();
    }
  )
  .subscribe();
```

### 🔄 自定义频道通信
```javascript
// 创建自定义频道
const customChannel = supabase.channel('custom_events');

// 发送自定义事件
customChannel.send({
  type: 'broadcast',
  event: 'dashboard_refresh',
  payload: { userId: 'user-uuid', timestamp: Date.now() }
});

// 监听自定义事件
customChannel.on('broadcast', { event: 'dashboard_refresh' }, (payload) => {
  console.log('收到仪表盘刷新事件:', payload);
});

customChannel.subscribe();
```

---

## 文件上传接口

### 📁 Supabase Storage API

#### 1. 上传文件
```javascript
// 上传单个文件
const { data, error } = await supabase.storage
  .from('contracts')  // bucket名称
  .upload('public/contract_001.pdf', file, {
    cacheControl: '3600',
    upsert: false
  });

if (data) {
  console.log('文件上传成功:', data.path);
}
```

#### 2. 获取文件URL
```javascript
// 获取公共文件URL
const { data } = supabase.storage
  .from('contracts')
  .getPublicUrl('public/contract_001.pdf');

console.log('文件URL:', data.publicUrl);

// 获取签名URL（私有文件）
const { data: signedData, error } = await supabase.storage
  .from('contracts')
  .createSignedUrl('private/contract_001.pdf', 3600); // 1小时有效期

if (signedData) {
  console.log('签名URL:', signedData.signedUrl);
}
```

#### 3. 删除文件
```javascript
const { data, error } = await supabase.storage
  .from('contracts')
  .remove(['public/contract_001.pdf']);
```

#### 4. 批量上传
```javascript
// 批量上传多个文件
const uploadPromises = files.map(file => 
  supabase.storage
    .from('documents')
    .upload(`public/${file.name}`, file)
);

const results = await Promise.all(uploadPromises);
console.log('批量上传结果:', results);
```

### 📋 文件管理最佳实践

#### 1. 文件命名规范
```javascript
// 生成唯一文件名
function generateFileName(originalName, userId) {
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(2);
  const extension = originalName.split('.').pop();
  return `${userId}/${timestamp}_${randomId}.${extension}`;
}

// 使用示例
const fileName = generateFileName('contract.pdf', 'user-uuid');
// 结果: user-uuid/1705123456789_abc123.pdf
```

#### 2. 文件类型验证
```javascript
function validateFileType(file, allowedTypes) {
  return allowedTypes.includes(file.type);
}

// 使用示例
const allowedTypes = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
];

if (!validateFileType(file, allowedTypes)) {
  throw new Error('不支持的文件类型');
}
```

#### 3. 文件大小限制
```javascript
function validateFileSize(file, maxSizeMB) {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  return file.size <= maxSizeBytes;
}

// 使用示例
if (!validateFileSize(file, 10)) { // 10MB限制
  throw new Error('文件大小超过限制');
}
```

---

## 错误处理

### ❌ 错误类型和处理

#### 1. HTTP状态码
```javascript
// 统一错误处理函数
function handleApiError(error) {
  switch (error.status) {
    case 400:
      return '请求参数错误';
    case 401:
      return '未授权访问，请重新登录';
    case 403:
      return '权限不足，无法访问';
    case 404:
      return '请求的资源不存在';
    case 409:
      return '数据冲突，请刷新后重试';
    case 422:
      return '数据验证失败';
    case 429:
      return '请求过于频繁，请稍后重试';
    case 500:
      return '服务器内部错误';
    case 503:
      return '服务暂时不可用';
    default:
      return '未知错误，请联系技术支持';
  }
}
```

#### 2. Supabase错误处理
```javascript
async function safeApiCall(apiFunction) {
  try {
    const { data, error } = await apiFunction();
    
    if (error) {
      // PostgreSQL错误
      if (error.code) {
        switch (error.code) {
          case '23505': // 唯一约束违反
            throw new Error('数据已存在，请检查后重试');
          case '23503': // 外键约束违反
            throw new Error('关联数据不存在');
          case '42501': // 权限不足
            throw new Error('权限不足，无法执行操作');
          case 'PGRST116': // 行级安全策略违反
            throw new Error('数据访问权限不足');
          default:
            throw new Error(`数据库错误: ${error.message}`);
        }
      }
      
      // RPC函数错误
      if (error.message) {
        throw new Error(error.message);
      }
      
      throw new Error('API调用失败');
    }
    
    return data;
  } catch (err) {
    console.error('API调用错误:', err);
    throw err;
  }
}

// 使用示例
try {
  const projects = await safeApiCall(() => 
    supabase.from('projects').select('*')
  );
  console.log('项目列表:', projects);
} catch (error) {
  console.error('获取项目列表失败:', error.message);
}
```

#### 3. 网络错误处理
```javascript
// 带重试机制的API调用
async function apiCallWithRetry(apiFunction, maxRetries = 3) {
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await apiFunction();
    } catch (error) {
      lastError = error;
      
      // 网络错误或服务器错误才重试
      if (error.status >= 500 || !error.status) {
        const delay = Math.pow(2, i) * 1000; // 指数退避
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // 其他错误直接抛出
      throw error;
    }
  }
  
  throw lastError;
}
```

### 🔍 调试工具

#### 1. 开发环境调试
```javascript
// 启用详细日志
if (process.env.NODE_ENV === 'development') {
  // 拦截所有Supabase请求
  const originalFrom = supabase.from;
  supabase.from = function(table) {
    console.log(`Supabase query on table: ${table}`);
    const query = originalFrom.call(this, table);
    
    // 拦截查询方法
    const originalSelect = query.select;
    query.select = function(...args) {
      console.log(`Select query:`, args);
      return originalSelect.apply(this, args);
    };
    
    return query;
  };
}
```

#### 2. 性能监控
```javascript
// API调用性能监控
async function monitoredApiCall(name, apiFunction) {
  const startTime = performance.now();
  
  try {
    const result = await apiFunction();
    const endTime = performance.now();
    
    console.log(`API调用 ${name} 耗时: ${endTime - startTime}ms`);
    
    // 记录到分析服务
    if (endTime - startTime > 1000) {
      console.warn(`API调用 ${name} 耗时过长: ${endTime - startTime}ms`);
    }
    
    return result;
  } catch (error) {
    const endTime = performance.now();
    console.error(`API调用 ${name} 失败，耗时: ${endTime - startTime}ms`, error);
    throw error;
  }
}

// 使用示例
const projects = await monitoredApiCall('获取项目列表', () =>
  supabase.from('projects').select('*')
);
```

---

## SDK使用示例

### 🛠️ JavaScript/TypeScript SDK

#### 1. 初始化配置
```typescript
// supabase-client.ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types/database';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});

// 类型安全的数据库操作
export type Tables = Database['public']['Tables'];
export type LogisticsRecord = Tables['logistics_records']['Row'];
export type Project = Tables['projects']['Row'];
```

#### 2. 业务服务封装
```typescript
// services/LogisticsService.ts
export class LogisticsService {
  // 获取物流记录
  static async getRecords(filters: {
    projectId?: string;
    startDate?: string;
    endDate?: string;
    driverName?: string;
    limit?: number;
    offset?: number;
  }): Promise<LogisticsRecord[]> {
    let query = supabase
      .from('logistics_records')
      .select(`
        *,
        projects(name, manager),
        partner_chains(chain_name)
      `);

    if (filters.projectId) {
      query = query.eq('project_id', filters.projectId);
    }
    
    if (filters.startDate) {
      query = query.gte('loading_date', filters.startDate);
    }
    
    if (filters.endDate) {
      query = query.lte('loading_date', filters.endDate);
    }
    
    if (filters.driverName) {
      query = query.ilike('driver_name', `%${filters.driverName}%`);
    }

    const { data, error } = await query
      .order('loading_date', { ascending: false })
      .limit(filters.limit || 50)
      .range(filters.offset || 0, (filters.offset || 0) + (filters.limit || 50) - 1);

    if (error) throw error;
    return data || [];
  }

  // 创建物流记录
  static async createRecord(record: Omit<LogisticsRecord, 'id' | 'created_at' | 'updated_at'>): Promise<LogisticsRecord> {
    const { data, error } = await supabase.rpc('add_logistics_record_with_costs', {
      p_project_id: record.project_id,
      p_project_name: record.project_name,
      p_driver_name: record.driver_name,
      p_license_plate: record.license_plate,
      p_driver_phone: record.driver_phone,
      p_loading_date: record.loading_date,
      p_unloading_date: record.unloading_date,
      p_loading_location: record.loading_location,
      p_unloading_location: record.unloading_location,
      p_loading_weight: record.loading_weight,
      p_unloading_weight: record.unloading_weight,
      p_transport_type: record.transport_type,
      p_current_cost: record.current_cost,
      p_extra_cost: record.extra_cost,
      p_chain_id: record.chain_id,
      p_remarks: record.remarks
    });

    if (error) throw error;
    return data;
  }

  // 批量导入
  static async batchImport(records: any[]): Promise<{
    created_count: number;
    updated_count: number;
    error_count: number;
    errors: any[];
  }> {
    const { data, error } = await supabase.rpc('batch_import_logistics_records_with_update', {
      p_records: { create_records: records, update_records: [] }
    });

    if (error) throw error;
    return data;
  }
}
```

#### 3. React Hook封装
```typescript
// hooks/useLogisticsRecords.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LogisticsService } from '../services/LogisticsService';

export function useLogisticsRecords(filters: {
  projectId?: string;
  startDate?: string;
  endDate?: string;
  driverName?: string;
}) {
  return useQuery({
    queryKey: ['logistics_records', filters],
    queryFn: () => LogisticsService.getRecords(filters),
    staleTime: 5 * 60 * 1000, // 5分钟缓存
    refetchOnWindowFocus: false,
  });
}

export function useCreateLogisticsRecord() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: LogisticsService.createRecord,
    onSuccess: () => {
      // 刷新相关查询
      queryClient.invalidateQueries({ queryKey: ['logistics_records'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard_stats'] });
    },
  });
}

export function useBatchImportLogistics() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: LogisticsService.batchImport,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['logistics_records'] });
    },
  });
}
```

#### 4. React组件使用示例
```tsx
// components/LogisticsRecordList.tsx
import React, { useState } from 'react';
import { useLogisticsRecords, useCreateLogisticsRecord } from '../hooks/useLogisticsRecords';

export function LogisticsRecordList() {
  const [filters, setFilters] = useState({
    projectId: '',
    startDate: '',
    endDate: '',
    driverName: ''
  });

  const { data: records, isLoading, error } = useLogisticsRecords(filters);
  const createMutation = useCreateLogisticsRecord();

  const handleCreate = async (recordData: any) => {
    try {
      await createMutation.mutateAsync(recordData);
      toast.success('创建成功');
    } catch (error) {
      toast.error('创建失败: ' + error.message);
    }
  };

  if (isLoading) return <div>加载中...</div>;
  if (error) return <div>错误: {error.message}</div>;

  return (
    <div>
      {/* 筛选器 */}
      <div className="filters">
        <input
          type="text"
          placeholder="司机姓名"
          value={filters.driverName}
          onChange={(e) => setFilters(prev => ({ ...prev, driverName: e.target.value }))}
        />
        <input
          type="date"
          value={filters.startDate}
          onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
        />
        {/* 更多筛选器... */}
      </div>

      {/* 记录列表 */}
      <div className="records">
        {records?.map(record => (
          <div key={record.id} className="record-item">
            <h3>{record.auto_number}</h3>
            <p>司机: {record.driver_name}</p>
            <p>项目: {record.project_name}</p>
            <p>重量: {record.loading_weight}吨</p>
            <p>费用: ¥{record.driver_payable_cost}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 📱 移动端SDK使用

#### 1. React Native配置
```typescript
// react-native-supabase.ts
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = 'your-project-url';
const supabaseAnonKey = 'your-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

#### 2. 移动端特定功能
```typescript
// services/MobileLogisticsService.ts
export class MobileLogisticsService extends LogisticsService {
  // 离线数据同步
  static async syncOfflineData() {
    const offlineRecords = await AsyncStorage.getItem('offline_records');
    if (offlineRecords) {
      const records = JSON.parse(offlineRecords);
      for (const record of records) {
        try {
          await this.createRecord(record);
          // 同步成功，从离线存储中删除
          await this.removeOfflineRecord(record.id);
        } catch (error) {
          console.error('同步离线记录失败:', error);
        }
      }
    }
  }

  // 保存到离线存储
  static async saveOfflineRecord(record: any) {
    const offlineRecords = await AsyncStorage.getItem('offline_records');
    const records = offlineRecords ? JSON.parse(offlineRecords) : [];
    records.push({ ...record, id: Date.now().toString() });
    await AsyncStorage.setItem('offline_records', JSON.stringify(records));
  }

  // 获取位置信息
  static async getCurrentLocation(): Promise<{latitude: number; longitude: number}> {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
        },
        (error) => reject(error),
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 1000 }
      );
    });
  }
}
```

---

## 📚 附录

### 🔧 开发工具

#### 1. Postman集合
```json
{
  "info": {
    "name": "物流管理系统 API",
    "description": "完整的API接口集合"
  },
  "auth": {
    "type": "bearer",
    "bearer": [
      {
        "key": "token",
        "value": "{{access_token}}"
      }
    ]
  },
  "variable": [
    {
      "key": "base_url",
      "value": "https://your-project.supabase.co"
    },
    {
      "key": "api_key",
      "value": "your-anon-key"
    }
  ]
}
```

#### 2. 环境变量配置
```env
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# 开发环境
NODE_ENV=development
NEXT_PUBLIC_API_DEBUG=true

# 生产环境
NODE_ENV=production
NEXT_PUBLIC_API_DEBUG=false
```

### 📖 最佳实践

#### 1. 性能优化
- 使用适当的索引优化查询性能
- 实现客户端缓存减少API调用
- 使用分页避免大量数据传输
- 启用gzip压缩减少传输大小

#### 2. 安全考虑
- 始终验证用户输入
- 使用RLS策略保护数据
- 定期更新访问令牌
- 记录敏感操作的审计日志

#### 3. 错误处理
- 提供友好的错误消息
- 实现重试机制处理网络问题
- 记录详细的错误日志
- 优雅降级处理API不可用情况

---

*本API文档涵盖了物流管理系统的完整接口规范，建议开发者参考此文档进行前端开发和集成工作。*
