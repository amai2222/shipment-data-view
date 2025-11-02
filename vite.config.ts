import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { visualizer } from 'rollup-plugin-visualizer';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === 'development' && componentTagger(),
    // 构建分析插件（仅生产环境）
    mode === 'production' && visualizer({
      open: false,
      gzipSize: true,
      brotliSize: true,
      filename: 'dist/stats.html'
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // 代码分割优化
    rollupOptions: {
      output: {
        // 手动分包策略
        manualChunks: {
          // React 核心库
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // UI 组件库
          'ui-vendor': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-select',
            '@radix-ui/react-tabs',
            '@radix-ui/react-toast',
            '@radix-ui/react-popover',
            '@radix-ui/react-scroll-area'
          ],
          // Supabase
          'supabase': ['@supabase/supabase-js'],
          // 图表库
          'charts': ['recharts'],
          // 工具库
          'utils': ['date-fns', 'clsx', 'tailwind-merge'],
          // 查询库
          'query': ['@tanstack/react-query'],
          // 图标库
          'icons': ['lucide-react'],
          // Excel 处理
          'excel': ['xlsx']
        },
        // 文件命名
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]'
      }
    },
    // 压缩配置
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: mode === 'production', // 生产环境移除 console
        drop_debugger: true,
        pure_funcs: mode === 'production' ? ['console.log', 'console.info'] : []
      }
    },
    // 代码块大小警告
    chunkSizeWarningLimit: 1000,
    // 启用 CSS 代码分割
    cssCodeSplit: true,
    // Source map 配置
    sourcemap: mode !== 'production',
    // 优化依赖预构建
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true
    }
  },
  // 优化配置
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@supabase/supabase-js',
      '@tanstack/react-query'
    ],
    exclude: ['@radix-ui/*']
  },
  // 性能优化
  esbuild: {
    logOverride: { 'this-is-undefined-in-esm': 'silent' },
    drop: mode === 'production' ? ['console', 'debugger'] : []
  }
}));
