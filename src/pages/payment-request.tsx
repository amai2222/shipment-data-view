// 文件路径: /src/pages/payment-request.tsx
// [fEP04 Debug Step 5] 终极路由验证测试

// --- 导入Next.js的路由钩子 ---
import { useRouter } from 'next/router';

export default function PaymentRequest() {
  // --- 获取路由信息 ---
  const router = useRouter();

  return (
    <div style={{ padding: '40px', fontFamily: 'monospace', lineHeight: '1.8' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '20px', borderBottom: '2px solid' }}>
        终极路由验证测试
      </h1>
      
      <p style={{ marginBottom: '20px' }}>
        此页面由 <strong>/src/pages/payment-request.tsx</strong> 文件渲染。
      </p>

      <div style={{ padding: '20px', border: '2px solid red', backgroundColor: '#fff0f0' }}>
        <p>请核对浏览器地址栏中的URL。</p>
        <p>
          根据 Next.js 的路由系统，此页面报告的路径是: 
          <strong style={{ fontSize: '20px', color: 'red', marginLeft: '10px' }}>
            {router.pathname}
          </strong>
        </p>
      </div>

      <p style={{ marginTop: '20px' }}>
        <strong>结论：</strong> 如果上方红色显示的路径与您浏览器地址栏中的路径 (例如 /payment-request) <strong>完全一致</strong>，则证明路由和文件路径是正确的。
      </p>
    </div>
  );
}
