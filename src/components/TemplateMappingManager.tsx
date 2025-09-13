// Placeholder component for TemplateMappingManager
import React from 'react';

interface TemplateMappingManagerProps {
  onMappingChange?: (mapping: any) => void;
}

export default function TemplateMappingManager({ onMappingChange }: TemplateMappingManagerProps) {
  return (
    <div className="p-4 text-center text-muted-foreground">
      模板映射管理功能正在开发中
    </div>
  );
}