// 文件路径: src/pages/payment-request.tsx
// [EXPZb Debug Step 3] 终极单点测试

// --- 只导入最基础的 Button 组件 ---
import { Button } from "@/components/ui/button";

export default function PaymentRequest() {
  return (
    <div style={{ padding: '40px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '20px' }}>
        单点测试：
      </h1>
      
      <p style={{ marginBottom: '20px' }}>
        如果能看到下面的按钮，说明 Button 组件是好的。
      </p>

      {/* --- 只渲染一个最基础的 Button --- */}
      <Button variant="default">
        这是一个测试按钮
      </Button>
    </div>
  );
}
