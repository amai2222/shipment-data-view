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
    ],
    exclude: ['xlsx'],
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
      // 其他 radix 组件通常不需要手动列出，只要 react 核心被去重即可
    ],
  },
  
  build: {
    assetsDir: 'assets',
    outDir: 'dist',
    base: '/',
    cssCodeSplit: true,
    assetsInlineLimit: 4096,
    
    // ✅ 修改 1: 降低目标版本以提高稳定性，避免 ESNext 的激进初始化导致的 TDZ 错误
    target: 'es2020', 
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
        
         // ✅ 修改 2: 更安全的拆包策略
         // 关键原则：所有依赖 React 的库必须能访问到 React 实例
         manualChunks: (id) => {
           if (id.includes('node_modules')) {
             
             // 1. 明确不依赖 React 的库，单独打包
             if (id.includes('xlsx')) return 'xlsx-vendor';
             if (id.includes('@supabase/supabase-js')) return 'supabase-vendor';
             if (id.includes('date-fns')) return 'date-fns-vendor';
             if (id.includes('zod')) return 'zod-vendor';
             
             // 2. 核心 React 依赖和所有依赖 React 的库打包在一起
             // 这样可以确保它们都使用同一个 React 实例
             if (
               id.includes('react') || 
               id.includes('react-dom') || 
               id.includes('react-router') ||
               id.includes('scheduler') ||
               id.includes('prop-types') ||
               id.includes('@radix-ui') ||  // Radix UI 依赖 React
               id.includes('@tanstack/react-query') ||  // React Query 依赖 React
               id.includes('recharts') ||  // Recharts 依赖 React
               id.includes('lucide-react') ||  // Lucide React 依赖 React
               id.includes('class-variance-authority') ||  // CVA 可能依赖 React
               id.includes('clsx') ||
               id.includes('tailwind-merge')
             ) {
               return 'react-vendor';
             }
             
             // 3. 其他不确定的库也打包到 react-vendor，确保安全
             // 这样可以避免 createContext、forwardRef 等错误
             return 'react-vendor';
           }
         },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
}));