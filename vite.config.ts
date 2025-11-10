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
    // 优化代码分割
    rollupOptions: {
      output: {
        // 确保使用 ES 模块格式，避免 CommonJS 问题
        format: 'es',
        // ✅ 使用内容哈希（contenthash）而非随机哈希（hash）
        // 相同内容 = 相同哈希值，避免不必要的文件名变化
        chunkFileNames: (chunkInfo) => {
          // 为 vendor 包使用固定名称，便于缓存
          const vendorChunks = ['xlsx-vendor', 'recharts-vendor', 'react-vendor', 'tanstack-vendor', 'supabase-vendor', 'ui-vendor'];
          if (vendorChunks.includes(chunkInfo.name)) {
            return 'assets/[name].[hash].js';
          }
          // 其他chunk使用内容哈希
          return 'assets/[name]-[hash].js';
        },
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          // 根据文件类型分类存储
          const info = assetInfo.name.split('.');
          const ext = info[info.length - 1];
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext)) {
            return 'assets/images/[name]-[hash].[ext]';
          } else if (/woff2?|ttf|eot/i.test(ext)) {
            return 'assets/fonts/[name]-[hash].[ext]';
          }
          return 'assets/[name]-[hash].[ext]';
        },
        // 手动代码分割：将大型库单独打包
        manualChunks: {
          'xlsx-vendor': ['xlsx'],
          'recharts-vendor': ['recharts'],
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'tanstack-vendor': ['@tanstack/react-query'],
          'supabase-vendor': ['@supabase/supabase-js'],
          'ui-vendor': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-select',
            '@radix-ui/react-tabs',
            '@radix-ui/react-toast',
            '@radix-ui/react-tooltip',
            '@radix-ui/react-checkbox',
            '@radix-ui/react-switch'
          ],
        },
      },
    },
    // 提高 chunk 大小警告阈值
    chunkSizeWarningLimit: 1000,
    // 确保源映射正确（生产环境关闭以减小体积）
    sourcemap: false,
    // 优化构建性能
    minify: 'esbuild',
    target: 'es2015',
  },
}));
