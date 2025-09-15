// 简化占位符组件
import React from 'react';

interface Props {
  trackingNumbers?: any[];
}

export function ExternalTrackingNumbersDisplay({ trackingNumbers = [] }: Props) {
  return (
    <div className="p-2">
      <p>外部追踪号码显示 (占位符)</p>
    </div>
  );
}