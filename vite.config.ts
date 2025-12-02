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
  
  // ✅ 优化依赖预构建，加快首次加载速度
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react/jsx-runtime',
      'react-router-dom',
      '@supabase/supabase-js',
      '@tanstack/react-query',
      'recharts', // ✅ 明确包含 recharts，确保正确预构建
    ],
    // 排除大型库，让它们按需加载
    exclude: ['xlsx'],
    // ✅ 强制重新构建依赖，确保 recharts 正确初始化
    force: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // 强制所有React导入指向同一个实例
      "react": path.resolve(__dirname, "./node_modules/react"),
      "react-dom": path.resolve(__dirname, "./node_modules/react-dom"),
    },
    // 确保只有一个 React 实例，解决 @radix-ui 等库的 Hooks 错误
    dedupe: [
      'react', 
      'react-dom',
      'react/jsx-runtime',
      '@radix-ui/react-tooltip',
      '@radix-ui/react-dialog',
      '@radix-ui/react-select',
      '@radix-ui/react-tabs'
    ],
  },
  build: {
    // 确保资源目录正确配置
    assetsDir: 'assets', // 资源文件输出到 dist/assets/
    outDir: 'dist',      // 构建输出目录
    // 确保 base 路径正确（相对路径，适配 Cloudflare Pages）
    base: '/',
    // 使用内容哈希确保文件名稳定性
    cssCodeSplit: true,
    // ✅ 确保所有资源都使用绝对路径（相对于 base）
    assetsInlineLimit: 4096, // 小于 4KB 的资源内联
    // 优化代码分割
    rollupOptions: {
      output: {
        // 确保使用 ES 模块格式，避免 CommonJS 问题
        format: 'es',
        // ✅ 使用固定长度的哈希（8位），确保文件名可预测且稳定
        // ✅ 所有 chunk 使用统一的命名格式
        chunkFileNames: 'assets/[name]-[hash:8].js',
        entryFileNames: 'assets/[name]-[hash:8].js',
        assetFileNames: (assetInfo) => {
          // 根据文件类型分类存储，使用固定长度哈希
          const info = assetInfo.name?.split('.') || [];
          const ext = info[info.length - 1] || 'unknown';
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext)) {
            return 'assets/images/[name]-[hash:8].[ext]';
          } else if (/woff2?|ttf|eot/i.test(ext)) {
            return 'assets/fonts/[name]-[hash:8].[ext]';
          }
          return 'assets/[name]-[hash:8].[ext]';
        },
        // 手动代码分割：将大型库单独打包
        // ✅ 关键修复：保守策略 - 将所有可能依赖 React 的库都打包到 react-vendor
        manualChunks: (id) => {
          if (!id.includes('node_modules')) {
            return; // 非 node_modules 的代码不处理
          }
          
          // ✅ 明确不依赖 React 的库，单独打包
          if (id.includes('xlsx')) return 'xlsx-vendor';
          if (id.includes('@supabase/supabase-js')) return 'supabase-vendor';
          if (id.includes('date-fns')) return 'date-fns-vendor';
          if (id.includes('clsx') || id.includes('tailwind-merge') || id.includes('class-variance-authority')) {
            return 'utils-vendor';
          }
          if (id.includes('zod')) return 'zod-vendor';
          
          // ✅ 所有其他库（包括 React、recharts、@radix-ui、@tanstack/react-query 等）都打包到 react-vendor
          // 这样可以确保它们都使用同一个 React 实例，避免 createContext、forwardRef、useLayoutEffect 等错误
          return 'react-vendor';
        },
      },
    },
    // 提高 chunk 大小警告阈值
    chunkSizeWarningLimit: 2000, // 提高到 2MB，因为 react-vendor 会比较大
    // 确保源映射正确（生产环境关闭以减小体积）
    sourcemap: false,
    // 优化构建性能
    minify: 'esbuild',
    // ✅ 改为 esnext 以支持现代浏览器（Chrome 80+, Edge, iOS 14+）
    // 可以生成更小、更快的代码（使用原生 ES Modules）
    target: 'esnext',
    // ✅ 优化 CSS 代码分割
    cssCodeSplit: true,
    // ✅ 减少 chunk 数量，加快初始加载
    reportCompressedSize: false, // 禁用压缩大小报告，加快构建速度
  },
}));
