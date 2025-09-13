import { toast } from '@/hooks/use-toast';

export interface ErrorContext {
  operation: string;
  recordId?: string;
  additionalInfo?: string;
}

export class ScaleRecordError extends Error {
  public context: ErrorContext;
  public userMessage: string;

  constructor(message: string, context: ErrorContext, userMessage?: string) {
    super(message);
    this.name = 'ScaleRecordError';
    this.context = context;
    this.userMessage = userMessage || this.getDefaultUserMessage(context);
  }

  private getDefaultUserMessage(context: ErrorContext): string {
    const messages: Record<string, string> = {
      'load_records': '加载磅单记录失败',
      'create_record': '创建磅单记录失败',
      'update_record': '更新磅单记录失败',
      'delete_record': '删除磅单记录失败',
      'bulk_delete': '批量删除失败',
      'load_waybill': '加载运单详情失败',
      'upload_images': '上传图片失败',
      'delete_images': '删除图片失败',
      'link_waybill': '关联运单失败'
    };

    return messages[context.operation] || '操作失败';
  }
}

export function handleScaleRecordError(error: unknown, context: ErrorContext): void {
  console.error(`ScaleRecord Error [${context.operation}]:`, error);
  
  let userMessage = '操作失败，请重试';
  
  if (error instanceof ScaleRecordError) {
    userMessage = error.userMessage;
  } else if (error instanceof Error) {
    // 根据错误类型提供更具体的用户消息
    if (error.message.includes('network') || error.message.includes('fetch')) {
      userMessage = '网络连接失败，请检查网络后重试';
    } else if (error.message.includes('permission') || error.message.includes('unauthorized')) {
      userMessage = '权限不足，请联系管理员';
    } else if (error.message.includes('constraint') || error.message.includes('duplicate')) {
      userMessage = '数据冲突，请检查输入内容';
    }
  }

  if (context.additionalInfo) {
    userMessage += ` (${context.additionalInfo})`;
  }

  toast({
    title: "错误",
    description: userMessage,
    variant: "destructive",
  });
}

export function createScaleRecordError(
  message: string, 
  context: ErrorContext, 
  userMessage?: string
): ScaleRecordError {
  return new ScaleRecordError(message, context, userMessage);
}
