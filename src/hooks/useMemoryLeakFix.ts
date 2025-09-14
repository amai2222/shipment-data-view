// 内存泄漏修复 Hook - 确保正确清理资源
// 文件: src/hooks/useMemoryLeakFix.ts

import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useMemoryLeakFix() {
  const cleanupFunctions = useRef<(() => void)[]>([]);
  const channels = useRef<any[]>([]);
  const timers = useRef<NodeJS.Timeout[]>([]);
  const abortControllers = useRef<AbortController[]>([]);

  // 添加清理函数
  const addCleanup = useCallback((fn: () => void) => {
    cleanupFunctions.current.push(fn);
  }, []);

  // 添加 Supabase 频道
  const addChannel = useCallback((channel: any) => {
    channels.current.push(channel);
    addCleanup(() => {
      try {
        supabase.removeChannel(channel);
      } catch (error) {
        console.warn('清理频道失败:', error);
      }
    });
  }, [addCleanup]);

  // 添加定时器
  const addTimer = useCallback((timer: NodeJS.Timeout) => {
    timers.current.push(timer);
    addCleanup(() => {
      try {
        clearTimeout(timer);
      } catch (error) {
        console.warn('清理定时器失败:', error);
      }
    });
  }, [addCleanup]);

  // 添加 AbortController
  const addAbortController = useCallback((controller: AbortController) => {
    abortControllers.current.push(controller);
    addCleanup(() => {
      try {
        controller.abort();
      } catch (error) {
        console.warn('清理 AbortController 失败:', error);
      }
    });
  }, [addCleanup]);

  // 清理所有资源
  const cleanup = useCallback(() => {
    // 清理自定义函数
    cleanupFunctions.current.forEach(fn => {
      try {
        fn();
      } catch (error) {
        console.warn('清理函数执行失败:', error);
      }
    });

    // 清理 Supabase 频道
    channels.current.forEach(channel => {
      try {
        supabase.removeChannel(channel);
      } catch (error) {
        console.warn('清理频道失败:', error);
      }
    });

    // 清理定时器
    timers.current.forEach(timer => {
      try {
        clearTimeout(timer);
      } catch (error) {
        console.warn('清理定时器失败:', error);
      }
    });

    // 清理 AbortController
    abortControllers.current.forEach(controller => {
      try {
        controller.abort();
      } catch (error) {
        console.warn('清理 AbortController 失败:', error);
      }
    });

    // 清空数组
    cleanupFunctions.current = [];
    channels.current = [];
    timers.current = [];
    abortControllers.current = [];
  }, []);

  // 组件卸载时自动清理
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    addCleanup,
    addChannel,
    addTimer,
    addAbortController,
    cleanup
  };
}

// 优化的实时订阅 Hook
export function useOptimizedRealtimeSubscription(
  tableName: string,
  callback: (payload: any) => void,
  enabled: boolean = true
) {
  const { addChannel, cleanup } = useMemoryLeakFix();

  useEffect(() => {
    if (!enabled) return;

    const channel = supabase
      .channel(`${tableName}_changes`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: tableName
        },
        callback
      )
      .subscribe();

    addChannel(channel);

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch (error) {
        console.warn('清理订阅失败:', error);
      }
    };
  }, [tableName, callback, enabled, addChannel]);

  return cleanup;
}

// 优化的定时器 Hook
export function useOptimizedTimer(
  callback: () => void,
  delay: number,
  enabled: boolean = true
) {
  const { addTimer } = useMemoryLeakFix();

  useEffect(() => {
    if (!enabled || delay <= 0) return;

    const timer = setTimeout(callback, delay);
    addTimer(timer);

    return () => {
      try {
        clearTimeout(timer);
      } catch (error) {
        console.warn('清理定时器失败:', error);
      }
    };
  }, [callback, delay, enabled, addTimer]);
}

// 优化的 AbortController Hook
export function useOptimizedAbortController() {
  const { addAbortController } = useMemoryLeakFix();
  const controllerRef = useRef<AbortController | null>(null);

  const createController = useCallback(() => {
    // 清理之前的 controller
    if (controllerRef.current) {
      try {
        controllerRef.current.abort();
      } catch (error) {
        console.warn('清理之前的 AbortController 失败:', error);
      }
    }

    // 创建新的 controller
    const controller = new AbortController();
    controllerRef.current = controller;
    addAbortController(controller);

    return controller;
  }, [addAbortController]);

  const abort = useCallback(() => {
    if (controllerRef.current) {
      try {
        controllerRef.current.abort();
      } catch (error) {
        console.warn('中止请求失败:', error);
      }
    }
  }, []);

  return {
    createController,
    abort,
    signal: controllerRef.current?.signal
  };
}
