# 开发指南

## 项目架构

### 技术栈
- **前端**: React 18.3.1 + TypeScript 5.5.3 + Vite 5.4.1
- **UI框架**: Tailwind CSS + shadcn/ui
- **状态管理**: React Query + Context API
- **路由**: React Router DOM 6.26.2
- **后端**: Supabase (PostgreSQL + Auth + Realtime)
- **构建工具**: Vite + ESLint + TypeScript

### 项目结构
```
src/
├── components/          # 可复用组件
│   ├── ui/             # 基础UI组件 (shadcn/ui)
│   ├── permissions/    # 权限管理组件
│   ├── contracts/      # 合同管理组件
│   └── userManagement/ # 用户管理组件
├── pages/              # 页面组件
│   ├── mobile/         # 移动端页面
│   ├── Settings/       # 设置页面
│   ├── BusinessEntry/  # 业务录入页面
│   └── DataMaintenance/ # 数据维护页面
├── hooks/              # 自定义Hooks
│   ├── usePermissions.ts      # 权限管理Hook
│   ├── useUserManagement.ts   # 用户管理Hook
│   ├── useProjectStatus.ts    # 项目状态Hook
│   └── useMemoryLeakFix.ts    # 内存泄漏修复Hook
├── services/           # 业务服务
│   ├── UserManagementService.ts
│   ├── ProjectStatusService.ts
│   └── PermissionDatabaseService.ts
├── types/              # TypeScript类型定义
│   ├── index.ts
│   ├── permission.ts
│   └── userManagement.ts
├── utils/              # 工具函数
│   ├── device.ts       # 设备检测
│   ├── performanceMonitor.ts # 性能监控
│   └── memoryOptimization.ts # 内存优化
├── contexts/           # React Context
│   └── AuthContext.tsx
├── integrations/       # 第三方集成
│   └── supabase/
└── lib/                # 库文件
    └── utils.ts
```

## 开发规范

### 代码规范

#### 1. TypeScript 规范
```typescript
// ✅ 好的做法
interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  is_active: boolean;
}

// ❌ 避免的做法
const user: any = { ... };
```

#### 2. 组件规范
```typescript
// ✅ 函数式组件 + Hooks
interface ComponentProps {
  title: string;
  onSave: (data: any) => void;
}

export function MyComponent({ title, onSave }: ComponentProps) {
  const [loading, setLoading] = useState(false);
  
  const handleSave = useCallback(async (data: any) => {
    setLoading(true);
    try {
      await onSave(data);
    } finally {
      setLoading(false);
    }
  }, [onSave]);

  return (
    <div>
      <h1>{title}</h1>
      {/* 组件内容 */}
    </div>
  );
}
```

#### 3. Hook 规范
```typescript
// ✅ 自定义Hook
export function useUserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await UserManagementService.getUsers();
      setUsers(data);
    } catch (error) {
      console.error('加载用户失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    users,
    loading,
    loadUsers
  };
}
```

#### 4. 服务层规范
```typescript
// ✅ 服务类
export class UserManagementService {
  static async getUsers(): Promise<User[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('is_active', true);

    if (error) throw error;
    return data || [];
  }

  static async createUser(userData: UserCreateData): Promise<ServiceResult> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .insert(userData)
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        data,
        message: '用户创建成功'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: '用户创建失败'
      };
    }
  }
}
```

### 样式规范

#### 1. Tailwind CSS 使用
```typescript
// ✅ 使用 Tailwind 类名
<div className="flex items-center justify-between p-4 bg-white rounded-lg shadow-md">
  <h2 className="text-xl font-semibold text-gray-900">标题</h2>
  <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
    按钮
  </button>
</div>

// ❌ 避免内联样式
<div style={{ display: 'flex', padding: '16px' }}>
```

#### 2. 响应式设计
```typescript
// ✅ 响应式类名
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* 移动端1列，平板2列，桌面3列 */}
</div>
```

### 状态管理规范

#### 1. 本地状态
```typescript
// ✅ 使用 useState
const [loading, setLoading] = useState(false);
const [data, setData] = useState<DataType[]>([]);
```

#### 2. 全局状态
```typescript
// ✅ 使用 Context + useReducer
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialState);
  
  return (
    <AuthContext.Provider value={{ ...state, dispatch }}>
      {children}
    </AuthContext.Provider>
  );
}
```

#### 3. 服务器状态
```typescript
// ✅ 使用 React Query
const { data, loading, error } = useQuery({
  queryKey: ['users'],
  queryFn: UserManagementService.getUsers,
  staleTime: 5 * 60 * 1000, // 5分钟
});
```

## 性能优化

### 1. 组件优化
```typescript
// ✅ 使用 React.memo
export const ExpensiveComponent = React.memo(({ data }: Props) => {
  return <div>{/* 复杂渲染逻辑 */}</div>;
});

// ✅ 使用 useMemo
const expensiveValue = useMemo(() => {
  return heavyCalculation(data);
}, [data]);

// ✅ 使用 useCallback
const handleClick = useCallback((id: string) => {
  onItemClick(id);
}, [onItemClick]);
```

### 2. 内存管理
```typescript
// ✅ 使用内存泄漏修复Hook
export function useMemoryLeakFix() {
  const cleanupFunctions = useRef<(() => void)[]>([]);
  
  const addCleanup = useCallback((fn: () => void) => {
    cleanupFunctions.current.push(fn);
  }, []);

  useEffect(() => {
    return () => {
      cleanupFunctions.current.forEach(fn => fn());
    };
  }, []);

  return { addCleanup };
}
```

### 3. 虚拟化
```typescript
// ✅ 使用虚拟滚动
import { FixedSizeList as List } from 'react-window';

const VirtualizedList = ({ items }: { items: any[] }) => (
  <List
    height={400}
    itemCount={items.length}
    itemSize={50}
    itemData={items}
  >
    {({ index, style, data }) => (
      <div style={style}>
        {data[index].name}
      </div>
    )}
  </List>
);
```

## 权限管理

### 1. 权限检查
```typescript
// ✅ 权限检查Hook
export function usePermissions() {
  const { profile } = useAuth();
  
  const hasPermission = useCallback((permission: string) => {
    if (!profile) return false;
    return profile.permissions?.includes(permission) || false;
  }, [profile]);

  const hasRole = useCallback((role: UserRole) => {
    return profile?.role === role;
  }, [profile]);

  return { hasPermission, hasRole };
}
```

### 2. 路由保护
```typescript
// ✅ 受保护的路由
<Route path="/admin" element={
  <ProtectedRoute requiredRoles={['admin']}>
    <AdminPage />
  </ProtectedRoute>
} />
```

### 3. 组件级权限
```typescript
// ✅ 条件渲染
function AdminPanel() {
  const { hasRole } = usePermissions();
  
  if (!hasRole('admin')) {
    return <div>权限不足</div>;
  }
  
  return <div>管理员面板</div>;
}
```

## 错误处理

### 1. 错误边界
```typescript
// ✅ 错误边界组件
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <div>出现错误，请刷新页面</div>;
    }

    return this.props.children;
  }
}
```

### 2. API错误处理
```typescript
// ✅ 统一错误处理
export async function apiCall<T>(fn: () => Promise<T>): Promise<ApiResult<T>> {
  try {
    const data = await fn();
    return { success: true, data };
  } catch (error) {
    console.error('API调用失败:', error);
    return {
      success: false,
      error: error.message || '未知错误'
    };
  }
}
```

## 测试规范

### 1. 单元测试
```typescript
// ✅ 组件测试
import { render, screen } from '@testing-library/react';
import { MyComponent } from './MyComponent';

test('renders component correctly', () => {
  render(<MyComponent title="测试标题" />);
  expect(screen.getByText('测试标题')).toBeInTheDocument();
});
```

### 2. Hook测试
```typescript
// ✅ Hook测试
import { renderHook, act } from '@testing-library/react';
import { useUserManagement } from './useUserManagement';

test('loads users correctly', async () => {
  const { result } = renderHook(() => useUserManagement());
  
  await act(async () => {
    await result.current.loadUsers();
  });
  
  expect(result.current.users).toHaveLength(2);
});
```

## 部署规范

### 1. 环境变量
```env
# .env.local
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_APP_ENV=development
```

### 2. 构建配置
```typescript
// vite.config.ts
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'terser',
  },
});
```

### 3. Docker配置
```dockerfile
# Dockerfile
FROM node:18-alpine as builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

## 调试技巧

### 1. 开发工具
- **React DevTools**: 组件状态调试
- **Redux DevTools**: 状态管理调试
- **Network Tab**: API请求调试
- **Console**: 日志输出

### 2. 性能调试
```typescript
// ✅ 性能监控
import { performanceMonitor } from '@/utils/performanceMonitor';

const result = await performanceMonitor.measure(
  'api-call',
  () => apiFunction()
);

console.log('API调用耗时:', result.duration);
```

### 3. 内存调试
```typescript
// ✅ 内存使用监控
if (process.env.NODE_ENV === 'development') {
  setInterval(() => {
    const memory = (performance as any).memory;
    if (memory) {
      console.log('内存使用:', {
        used: Math.round(memory.usedJSHeapSize / 1024 / 1024) + 'MB',
        total: Math.round(memory.totalJSHeapSize / 1024 / 1024) + 'MB'
      });
    }
  }, 30000);
}
```

## 最佳实践

### 1. 代码组织
- 按功能模块组织代码
- 保持组件单一职责
- 使用自定义Hook提取逻辑
- 统一错误处理

### 2. 性能优化
- 使用React.memo避免不必要的重渲染
- 使用useMemo和useCallback优化计算
- 实现虚拟滚动处理大数据
- 使用代码分割减少初始加载

### 3. 用户体验
- 提供加载状态反馈
- 实现错误边界
- 使用骨架屏提升感知性能
- 实现离线支持

### 4. 安全性
- 验证所有用户输入
- 使用HTTPS传输
- 实现CSRF保护
- 定期更新依赖

## 更新记录

- 2025-01-27: 初始版本，包含完整的开发指南
- 2025-01-27: 添加性能优化和内存管理章节
- 2025-01-27: 完善权限管理和错误处理规范
- 2025-01-27: 添加测试和部署规范
