// 简化占位符组件
import React from 'react';

interface Props {
  value?: any[];
  onChange?: (value: any[]) => void;
}

export function EnhancedExternalTrackingNumbersInput({ value = [], onChange }: Props) {
  return (
    <div className="p-4 border rounded">
      <p>外部追踪号码输入 (占位符)</p>
    </div>
  );
}