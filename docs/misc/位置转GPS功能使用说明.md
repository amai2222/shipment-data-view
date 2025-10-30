# 位置转GPS功能使用说明

## 📍 功能概述

位置转GPS功能是一个基于高德地图API的智能地理编码服务，可以将中文地址自动转换为精确的GPS坐标（经纬度），并提取详细的地址信息。

## 🚀 主要特性

### ✨ 核心功能
- **智能地理编码**：将中文地址转换为GPS坐标
- **模糊地址处理**：支持不完整或模糊的地址输入
- **批量处理**：支持同时处理多个地址
- **多策略编码**：使用多种策略提高编码成功率
- **结果验证**：自动验证编码结果的准确性

### 🎯 支持的地址类型
- **完整地址**：北京市朝阳区建国门外大街1号
- **模糊地址**：北京朝阳区附近、上海浦东新区
- **简化地址**：北京朝阳区、上海浦东
- **主要地名**：北京市、上海市

## 🛠️ 技术架构

### 后端服务
- **Supabase Edge Function**：`amap-geocoding`
- **高德地图API**：提供地理编码服务
- **PostgreSQL数据库**：存储地理编码结果

### 前端服务
- **SupabaseAMapService**：调用Edge Function
- **LocationGeocodingService**：管理地理编码流程
- **智能地址处理**：预处理和优化地址

## 📋 数据库结构

### locations表扩展字段
```sql
-- 地理编码相关字段
address TEXT,                    -- 详细地址
latitude DECIMAL(10, 7),         -- 纬度 (-90 到 90)
longitude DECIMAL(10, 7),        -- 经度 (-180 到 180)
formatted_address TEXT,          -- 格式化地址
province TEXT,                   -- 省份
city TEXT,                       -- 城市
district TEXT,                   -- 区县
township TEXT,                   -- 乡镇
street TEXT,                     -- 街道
street_number TEXT,              -- 门牌号
adcode TEXT,                     -- 行政区划代码
citycode TEXT,                   -- 城市编码
geocoding_status geocoding_status, -- 编码状态
geocoding_updated_at TIMESTAMP WITH TIME ZONE, -- 更新时间
geocoding_error TEXT             -- 错误信息
```

### 地理编码状态枚举
```sql
CREATE TYPE geocoding_status AS ENUM (
    'pending',   -- 待处理
    'success',   -- 成功
    'failed',    -- 失败
    'retry'      -- 重试
);
```

## 🔧 配置步骤

### 1. 环境变量配置
在Supabase项目设置中添加：
```bash
AMAP_API_KEY=您的高德地图API密钥
```

### 2. 数据库迁移
执行SQL迁移脚本：
```sql
-- 运行 supabase/migrations/20250113000001_add_geocoding_support.sql
```

### 3. Edge Function部署
部署地理编码Edge Function：
```bash
supabase functions deploy amap-geocoding
```

## 📖 使用方法

### 1. 单个地址地理编码

#### 前端调用示例
```typescript
import { SupabaseAMapService } from '@/services/SupabaseAMapService';

const amapService = new SupabaseAMapService(supabase);

// 基本地理编码
const result = await amapService.geocode({
  address: '北京市朝阳区建国门外大街1号',
  city: '北京'
});

// 智能地理编码（推荐）
const smartResult = await amapService.smartGeocode(
  '北京朝阳区附近',
  '北京'
);
```

#### API调用示例
```javascript
const response = await fetch('/functions/v1/amap-geocoding', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    action: 'smart_geocode',
    data: {
      address: '北京市朝阳区建国门外大街1号',
      city: '北京'
    }
  })
});

const result = await response.json();
```

### 2. 批量地址地理编码

```typescript
const addresses = [
  '北京市朝阳区建国门外大街1号',
  '上海市浦东新区陆家嘴环路1000号',
  '广州市天河区珠江新城花城大道85号'
];

const batchResult = await amapService.batchGeocode(addresses);
```

### 3. 更新地点地理编码信息

```typescript
const locationData = {
  id: 'location-uuid',
  name: '北京总部',
  address: '北京市朝阳区建国门外大街1号',
  latitude: 39.9042,
  longitude: 116.4074,
  formatted_address: '北京市朝阳区建国门外大街1号',
  province: '北京市',
  city: '北京市',
  district: '朝阳区',
  geocoding_status: 'success'
};

await supabase.functions.invoke('amap-geocoding', {
  body: {
    action: 'update_location_geocoding',
    data: locationData
  }
});
```

## 🎯 智能地理编码策略

### 策略1：直接编码
- 使用原始地址进行地理编码
- 适用于完整、准确的地址

### 策略2：城市提取
- 从地址中提取城市信息
- 分离城市和详细地址进行编码
- 适用于包含城市信息的地址

### 策略3：地址简化
- 移除门牌号、楼层等详细信息
- 保留主要地理信息
- 适用于过于详细的地址

### 策略4：主要地点提取
- 只保留省、市、区县信息
- 适用于模糊或不完整的地址

## 📊 返回数据格式

### 成功响应
```json
{
  "success": true,
  "data": {
    "status": "1",
    "info": "OK",
    "infocode": "10000",
    "count": "1",
    "geocodes": [
      {
        "formatted_address": "北京市朝阳区建国门外大街1号",
        "country": "中国",
        "province": "北京市",
        "city": "北京市",
        "district": "朝阳区",
        "township": "建国门外街道",
        "adcode": "110105",
        "citycode": "010",
        "street": "建国门外大街",
        "number": "1号",
        "location": "116.4074,39.9042",
        "level": "门牌号"
      }
    ]
  }
}
```

### 错误响应
```json
{
  "success": false,
  "error": "地理编码失败: 地址解析失败"
}
```

## 🔍 地址预处理功能

### 自动清理
- 去除多余空格
- 移除标点符号（逗号、括号、顿号）
- 标准化地址格式

### 城市识别
- 自动识别省、市、区县信息
- 支持直辖市、自治区、特别行政区
- 智能提取城市代码

### 地址简化
- 移除门牌号、楼层信息
- 保留主要地理标识
- 提高编码成功率

## ⚡ 性能优化

### 批量处理
- 限制并发数量（默认5个）
- 添加请求延迟（200ms）
- 避免API限制

### 缓存机制
- 数据库存储编码结果
- 避免重复编码
- 提高响应速度

### 错误处理
- 多策略重试
- 详细错误日志
- 用户友好提示

## 🛡️ 安全特性

### 认证验证
- 用户身份验证
- JWT令牌验证
- 权限控制

### API密钥保护
- 环境变量存储
- 服务端调用
- 客户端不可见

### 数据验证
- 坐标范围检查
- 地址格式验证
- 结果质量评估

## 📈 监控和日志

### 状态跟踪
- 实时编码状态
- 成功/失败统计
- 处理时间记录

### 错误日志
- 详细错误信息
- 失败原因分析
- 重试建议

### 性能指标
- 编码成功率
- 平均响应时间
- API调用次数

## 🔧 故障排除

### 常见问题

#### 1. 地理编码失败
**原因**：地址不准确或API限制
**解决**：
- 检查地址格式
- 尝试简化地址
- 检查API密钥配置

#### 2. 坐标无效
**原因**：返回的坐标超出有效范围
**解决**：
- 验证坐标范围
- 重新进行地理编码
- 检查地址准确性

#### 3. 批量处理超时
**原因**：地址数量过多或网络问题
**解决**：
- 减少批量大小
- 增加重试次数
- 检查网络连接

### 调试方法

#### 1. 检查API密钥
```sql
-- 在Supabase SQL编辑器中检查环境变量
SELECT current_setting('app.settings.amap_api_key', true);
```

#### 2. 查看编码状态
```sql
-- 查看地点编码状态
SELECT 
  name,
  address,
  geocoding_status,
  geocoding_error,
  geocoding_updated_at
FROM locations 
WHERE geocoding_status = 'failed';
```

#### 3. 测试Edge Function
```javascript
// 测试Edge Function连接
const testResponse = await fetch('/functions/v1/amap-geocoding', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    action: 'geocode',
    data: {
      address: '北京市',
      city: '北京'
    }
  })
});
```

## 📚 最佳实践

### 1. 地址输入建议
- 使用标准地址格式
- 包含省市区信息
- 避免使用简称或别名

### 2. 批量处理建议
- 单次处理不超过50个地址
- 添加适当的延迟
- 监控API调用频率

### 3. 错误处理建议
- 实现重试机制
- 记录失败原因
- 提供用户反馈

### 4. 性能优化建议
- 缓存常用地址
- 异步处理大批量
- 定期清理失败记录

## 🎯 使用场景

### 1. 物流配送
- 自动获取收货地址坐标
- 优化配送路线规划
- 提高配送效率

### 2. 位置服务
- 用户位置定位
- 附近服务搜索
- 地图显示功能

### 3. 数据分析
- 地址标准化
- 地理信息统计
- 区域分析报告

### 4. 业务管理
- 客户地址管理
- 服务区域划分
- 业务数据可视化

## 📞 技术支持

### 联系方式
- 技术支持：通过项目Issues提交问题
- 文档更新：定期更新使用说明
- 功能建议：欢迎提出改进建议

### 更新日志
- **v1.0.0**：基础地理编码功能
- **v1.1.0**：添加智能编码策略
- **v1.2.0**：支持批量处理
- **v1.3.0**：增强错误处理和监控

---

**注意**：使用本功能需要有效的高德地图API密钥，请确保已正确配置环境变量。
