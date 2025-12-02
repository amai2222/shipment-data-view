import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  
  // 优化依赖预构建
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react/jsx-runtime',
      'react-router-dom',
      '@supabase/supabase-js',
      '@tanstack/react-query',
      'recharts',
      // ✅ 包含所有 @radix-ui 组件，确保正确预构建和初始化顺序
      '@radix-ui/react-dialog',
      '@radix-ui/react-select',
      '@radix-ui/react-tabs',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-tooltip',
      '@radix-ui/react-toast',
      '@radix-ui/react-checkbox',
      '@radix-ui/react-switch',
      '@radix-ui/react-popover',
      '@radix-ui/react-label',
      '@radix-ui/react-slot',
      // ✅ 包含其他可能依赖 React 的库
      'lucide-react',
      'class-variance-authority',
      'clsx',
      'tailwind-merge',
    ],
    exclude: ['xlsx'],
    // ✅ 强制重新构建，确保所有依赖正确初始化
    force: true,
    // ✅ 使用 esbuild 选项，确保正确的模块格式
    esbuildOptions: {
      target: 'es2015',
    },
  },
  
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    // ✅ 保持这个 dedupe 配置，这是解决 "Multiple React Instances" 问题的核心
    dedupe: [
      'react', 
      'react-dom',
      'react/jsx-runtime',
      '@radix-ui/react-tooltip',
      '@radix-ui/react-dialog',
      '@radix-ui/react-select',
      '@radix-ui/react-tabs',
      // 其他 radix 组件通常不需要手动列出，只要 react 核心被去重即可
    ],
    // ✅ 确保使用物理路径解析，避免符号链接导致的模块重复
    preserveSymlinks: false,
  },
  
  build: {
    assetsDir: 'assets',
    outDir: 'dist',
    base: '/',
    cssCodeSplit: true,
    assetsInlineLimit: 4096,
    
    // ✅ 修改 1: 使用更保守的目标版本，避免 TDZ (Temporal Dead Zone) 错误
    // es2015 使用更传统的模块系统，避免 ESNext 的激进优化导致的初始化顺序问题
    target: 'es2015', 
    minify: 'esbuild',
    sourcemap: false,

    rollupOptions: {
      output: {
        format: 'es',
        chunkFileNames: 'assets/[name]-[hash:8].js',
        entryFileNames: 'assets/[name]-[hash:8].js',
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name?.split('.') || [];
          const ext = info[info.length - 1] || 'unknown';
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext)) {
            return 'assets/images/[name]-[hash:8].[ext]';
          } else if (/woff2?|ttf|eot/i.test(ext)) {
            return 'assets/fonts/[name]-[hash:8].[ext]';
          }
          return 'assets/[name]-[hash:8].[ext]';
        },
        
        // ✅ 修改 2: 最安全的拆包策略 - 避免初始化顺序问题
        // 关键原则：所有依赖 React 的库必须能访问到 React 实例
        // 使用更保守的策略，将大部分库打包在一起，避免 TDZ (Temporal Dead Zone) 错误
        manualChunks: (id) => {
          if (!id.includes('node_modules')) {
            return; // 非 node_modules 的代码不处理
          }
          
          // 1. 明确不依赖 React 的库，单独打包（这些库不会导致 React 相关错误）
          if (id.includes('xlsx')) return 'xlsx-vendor';
          if (id.includes('@supabase/supabase-js')) return 'supabase-vendor';
          if (id.includes('date-fns')) return 'date-fns-vendor';
          if (id.includes('zod')) return 'zod-vendor';
          
          // 2. 所有其他库（包括 React、@radix-ui、recharts、@tanstack/react-query 等）都打包到 react-vendor
          // 这样可以确保它们都使用同一个 React 实例，避免 createContext、forwardRef、useLayoutEffect 等错误
          // 同时避免模块初始化顺序问题（TDZ 错误）
          return 'react-vendor';
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
}));