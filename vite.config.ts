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
        // 既保证了 React 单例，又避免了将所有东西塞进一个包导致的初始化顺序死锁
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            
            // 1. 核心 React 依赖 (必须在一起以避免 Context/Hooks 问题)
            if (
              id.includes('react') || 
              id.includes('react-dom') || 
              id.includes('react-router') ||
              id.includes('scheduler') ||
              id.includes('prop-types')
            ) {
              return 'react-core';
            }

            // 2. 大型独立库 (单独拆分，减少主包体积)
            if (id.includes('recharts')) return 'recharts-vendor';
            if (id.includes('xlsx')) return 'xlsx-vendor';
            if (id.includes('@supabase')) return 'supabase-vendor';
            if (id.includes('lottie')) return 'lottie-vendor';
            
            // 3. UI 组件库 (Radix, Lucide 等通常可以放一起)
            if (
                id.includes('@radix-ui') || 
                id.includes('lucide') ||
                id.includes('class-variance-authority') ||
                id.includes('clsx') ||
                id.includes('tailwind-merge')
            ) {
              return 'ui-vendor';
            }
            
            // 4. 其他所有第三方库
            return 'vendor';
          }
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
}));