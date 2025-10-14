// 增强的日志处理工具 - 借鉴数据维护-数据导入的专业处理
// 提供详细的调试信息、进度反馈和错误处理

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  data?: any;
}

export interface ImportProgress {
  current: number;
  total: number;
  percentage: number;
  currentStep: string;
  errors: string[];
  warnings: string[];
}

export class EnhancedLogger {
  private logs: LogEntry[] = [];
  private onLogUpdate?: (logs: LogEntry[]) => void;

  constructor(onLogUpdate?: (logs: LogEntry[]) => void) {
    this.onLogUpdate = onLogUpdate;
  }

  // 添加日志
  private addLog(level: LogEntry['level'], message: string, data?: any): void {
    const logEntry: LogEntry = {
      timestamp: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
      level,
      message,
      data
    };
    
    this.logs.push(logEntry);
    console.log(`[${logEntry.timestamp}] ${level.toUpperCase()}: ${message}`, data || '');
    
    if (this.onLogUpdate) {
      this.onLogUpdate([...this.logs]);
    }
  }

  // 信息日志
  info(message: string, data?: any): void {
    this.addLog('info', message, data);
  }

  // 警告日志
  warn(message: string, data?: any): void {
    this.addLog('warn', message, data);
  }

  // 错误日志
  error(message: string, data?: any): void {
    this.addLog('error', message, data);
  }

  // 成功日志
  success(message: string, data?: any): void {
    this.addLog('success', message, data);
  }

  // 调试日志
  debug(message: string, data?: any): void {
    this.addLog('info', `[DEBUG] ${message}`, data);
  }

  // 获取所有日志
  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  // 清空日志
  clear(): void {
    this.logs = [];
    if (this.onLogUpdate) {
      this.onLogUpdate([]);
    }
  }

  // 获取格式化的日志文本
  getFormattedLogs(): string[] {
    return this.logs.map(log => 
      `[${log.timestamp}] ${log.level.toUpperCase()}: ${log.message}`
    );
  }
}

// 导入进度管理器
export class ImportProgressManager {
  private progress: ImportProgress;
  private onProgressUpdate?: (progress: ImportProgress) => void;

  constructor(total: number, onProgressUpdate?: (progress: ImportProgress) => void) {
    this.progress = {
      current: 0,
      total,
      percentage: 0,
      currentStep: '准备中...',
      errors: [],
      warnings: []
    };
    this.onProgressUpdate = onProgressUpdate;
  }

  // 更新进度
  updateProgress(current: number, step: string): void {
    this.progress.current = current;
    this.progress.percentage = Math.round((current / this.progress.total) * 100);
    this.progress.currentStep = step;
    
    if (this.onProgressUpdate) {
      this.onProgressUpdate({ ...this.progress });
    }
  }

  // 添加错误
  addError(error: string): void {
    this.progress.errors.push(error);
    if (this.onProgressUpdate) {
      this.onProgressUpdate({ ...this.progress });
    }
  }

  // 添加警告
  addWarning(warning: string): void {
    this.progress.warnings.push(warning);
    if (this.onProgressUpdate) {
      this.onProgressUpdate({ ...this.progress });
    }
  }

  // 获取当前进度
  getProgress(): ImportProgress {
    return { ...this.progress };
  }

  // 重置进度
  reset(total: number): void {
    this.progress = {
      current: 0,
      total,
      percentage: 0,
      currentStep: '准备中...',
      errors: [],
      warnings: []
    };
    if (this.onProgressUpdate) {
      this.onProgressUpdate({ ...this.progress });
    }
  }
}

// 数据验证结果处理器
export class ValidationResultProcessor {
  private logger: EnhancedLogger;

  constructor(logger: EnhancedLogger) {
    this.logger = logger;
  }

  // 处理验证结果
  processValidationResults(
    validRows: any[], 
    invalidRows: { index: number; errors: string[] }[]
  ): { processedRows: any[]; summary: string } {
    
    this.logger.info(`数据验证完成`, {
      total: validRows.length + invalidRows.length,
      valid: validRows.length,
      invalid: invalidRows.length
    });

    // 记录无效行详情
    invalidRows.forEach(({ index, errors }) => {
      this.logger.error(`第${index + 1}行验证失败`, {
        errors,
        rowIndex: index
      });
    });

    // 生成摘要
    const summary = `验证完成：${validRows.length}条有效记录，${invalidRows.length}条无效记录`;
    
    if (invalidRows.length > 0) {
      this.logger.warn(`发现${invalidRows.length}条无效记录，将在导入时跳过`);
    }

    return {
      processedRows: validRows,
      summary
    };
  }
}

// Excel解析错误处理器
export class ExcelParseErrorHandler {
  private logger: EnhancedLogger;

  constructor(logger: EnhancedLogger) {
    this.logger = logger;
  }

  // 处理Excel解析错误
  handleParseError(error: any, context: string): void {
    this.logger.error(`Excel解析错误 (${context})`, {
      error: error.message,
      stack: error.stack,
      context
    });

    // 根据错误类型提供具体建议
    if (error.message.includes('file')) {
      this.logger.warn('文件读取失败，请检查文件格式和大小');
    } else if (error.message.includes('sheet')) {
      this.logger.warn('工作表解析失败，请检查Excel文件是否包含数据');
    } else if (error.message.includes('date')) {
      this.logger.warn('日期解析失败，请检查日期格式是否正确');
    } else {
      this.logger.warn('未知解析错误，请检查文件内容');
    }
  }

  // 处理数据格式错误
  handleDataFormatError(rowIndex: number, field: string, value: any, expectedType: string): void {
    this.logger.error(`第${rowIndex + 1}行数据格式错误`, {
      field,
      value,
      expectedType,
      rowIndex
    });

    this.logger.warn(`字段"${field}"的值"${value}"不符合${expectedType}格式要求`);
  }
}

// 导入结果处理器
export class ImportResultProcessor {
  private logger: EnhancedLogger;

  constructor(logger: EnhancedLogger) {
    this.logger = logger;
  }

  // 处理导入结果
  processImportResult(result: any): { summary: string; details: string[] } {
    const successCount = result?.success_count || 0;
    const errorCount = result?.error_count || 0;
    const errors = result?.errors || [];

    this.logger.info('导入完成', {
      successCount,
      errorCount,
      totalErrors: errors.length
    });

    // 记录成功信息
    if (successCount > 0) {
      this.logger.success(`成功导入${successCount}条记录`);
    }

    // 记录错误详情
    if (errorCount > 0) {
      this.logger.error(`导入失败${errorCount}条记录`);
      errors.forEach((error: any, index: number) => {
        this.logger.error(`错误${index + 1}: ${error.error || error}`, error);
      });
    }

    // 生成摘要
    const summary = `导入完成：成功${successCount}条，失败${errorCount}条`;
    const details = [
      `总记录数：${successCount + errorCount}`,
      `成功导入：${successCount}条`,
      `导入失败：${errorCount}条`,
      `成功率：${successCount + errorCount > 0 ? Math.round((successCount / (successCount + errorCount)) * 100) : 0}%`
    ];

    return { summary, details };
  }
}

// 创建增强的日志记录器
export const createEnhancedLogger = (onLogUpdate?: (logs: LogEntry[]) => void): EnhancedLogger => {
  return new EnhancedLogger(onLogUpdate);
};

// 创建导入进度管理器
export const createImportProgressManager = (
  total: number, 
  onProgressUpdate?: (progress: ImportProgress) => void
): ImportProgressManager => {
  return new ImportProgressManager(total, onProgressUpdate);
};
