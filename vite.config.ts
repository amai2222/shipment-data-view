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
    dedupe: ['react', 'react-dom', '@radix-ui/react-tooltip'],
  },
  build: {
    // 优化代码分割
    rollupOptions: {
      output: {
        manualChunks: {
          // 将大型库单独打包
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
  },
}));
