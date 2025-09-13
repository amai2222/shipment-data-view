// Placeholder component for TemplateBasedImport
import React from 'react';

interface TemplateBasedImportProps {
  onImportComplete?: () => void;
}

export default function TemplateBasedImport({ onImportComplete }: TemplateBasedImportProps) {
  return (
    <div className="p-4 text-center text-muted-foreground">
      基于模板的导入功能正在开发中
    </div>
  );
}