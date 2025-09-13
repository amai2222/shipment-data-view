// Simplified Excel import hook - disabled for now
import { useState, useRef } from 'react';
import { useToast } from "@/hooks/use-toast";

export interface ImportPreviewResultWithUpdate {
  success_count: number;
  error_count: number;
  inserted_count: number;
  updated_count: number;
  error_details: any[];
  duplicate_records: any[];
}

export type ImportStep = 'idle' | 'preprocessing' | 'preview' | 'confirmation' | 'processing';

export function useExcelImportWithUpdate(onSuccess?: () => void) {
  const [importStep, setImportStep] = useState<ImportStep>('idle');
  const [validatedRows, setValidatedRows] = useState<any[]>([]);
  const [importPreview, setImportPreview] = useState<ImportPreviewResultWithUpdate | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [updateMode, setUpdateMode] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importMode, setImportMode] = useState<'create' | 'update'>('create');
  const [importLogs, setImportLogs] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importLogRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const handleFileSelect = () => {
    toast({
      title: "功能暂时禁用",
      description: "Excel导入功能正在维护中",
      variant: "destructive",
    });
  };

  const resetImport = () => {
    setImportStep('idle');
    setValidatedRows([]);
    setImportPreview(null);
    setSelectedFile(null);
    setIsImporting(false);
    setUpdateMode(false);
    setIsImportModalOpen(false);
    setImportMode('create');
    setImportLogs([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const performImport = () => {
    toast({
      title: "功能暂时禁用",
      description: "Excel导入功能正在维护中",
      variant: "destructive",
    });
  };

  return {
    importStep,
    validatedRows,
    importPreview,
    selectedFile,
    isImporting,
    updateMode,
    fileInputRef,
    handleFileSelect,
    resetImport,
    performImport,
    setUpdateMode,
    // 添加缺失的属性
    isImportModalOpen,
    importMode,
    setImportMode,
    importLogs,
    importLogRef,
    handleExcelImport: handleFileSelect,
    executeFinalImport: performImport,
    closeImportModal: resetImport,
  };
}