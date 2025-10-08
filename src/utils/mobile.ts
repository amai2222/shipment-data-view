/**
 * 移动端工具函数库
 */

/**
 * 防止iOS橡皮筋效果
 */
export function preventIOSBounce() {
  if (typeof window === 'undefined') return;
  
  let startY = 0;
  
  document.body.addEventListener('touchstart', (e) => {
    startY = e.touches[0].pageY;
  }, { passive: true });

  document.body.addEventListener('touchmove', (e) => {
    const target = e.target as HTMLElement;
    const scrollable = target.closest('[data-scrollable]');
    
    if (!scrollable) {
      e.preventDefault();
    }
  }, { passive: false });
}

/**
 * 禁用双击缩放
 */
export function disableDoubleTapZoom() {
  if (typeof window === 'undefined') return;
  
  let lastTouchEnd = 0;
  
  document.addEventListener('touchend', (event) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) {
      event.preventDefault();
    }
    lastTouchEnd = now;
  }, { passive: false });
}

/**
 * 获取安全区域
 */
export function getSafeAreaInsets() {
  if (typeof window === 'undefined') {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }

  const computedStyle = getComputedStyle(document.documentElement);
  
  return {
    top: parseInt(computedStyle.getPropertyValue('env(safe-area-inset-top)') || '0'),
    right: parseInt(computedStyle.getPropertyValue('env(safe-area-inset-right)') || '0'),
    bottom: parseInt(computedStyle.getPropertyValue('env(safe-area-inset-bottom)') || '0'),
    left: parseInt(computedStyle.getPropertyValue('env(safe-area-inset-left)') || '0')
  };
}

/**
 * 判断是否支持触觉反馈
 */
export function supportsHapticFeedback(): boolean {
  return 'vibrate' in navigator;
}

/**
 * 触发触觉反馈
 */
export function triggerHaptic(type: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' = 'light') {
  if (!supportsHapticFeedback()) return;

  const patterns = {
    light: 10,
    medium: 20,
    heavy: 30,
    success: [10, 50, 10],
    warning: [10, 50, 10, 50, 10],
    error: [50, 100, 50]
  };

  navigator.vibrate(patterns[type]);
}

/**
 * 检测是否为慢速网络
 */
export function isSlowConnection(): boolean {
  if (typeof window === 'undefined' || !('connection' in navigator)) {
    return false;
  }

  const connection = (navigator as any).connection;
  const effectiveType = connection?.effectiveType;
  
  return effectiveType === 'slow-2g' || effectiveType === '2g';
}

/**
 * 获取网络状态
 */
export function getNetworkStatus() {
  if (typeof window === 'undefined' || !('connection' in navigator)) {
    return {
      online: true,
      effectiveType: '4g',
      downlink: undefined,
      rtt: undefined
    };
  }

  const connection = (navigator as any).connection;
  
  return {
    online: navigator.onLine,
    effectiveType: connection?.effectiveType || '4g',
    downlink: connection?.downlink,
    rtt: connection?.rtt
  };
}

/**
 * 格式化文件大小(移动端友好)
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * 检测是否为全面屏设备
 */
export function isNotchedDevice(): boolean {
  if (typeof window === 'undefined') return false;
  
  const safeArea = getSafeAreaInsets();
  return safeArea.top > 20 || safeArea.bottom > 0;
}

/**
 * 平滑滚动到顶部
 */
export function scrollToTop(smooth = true) {
  window.scrollTo({
    top: 0,
    behavior: smooth ? 'smooth' : 'auto'
  });
}

/**
 * 平滑滚动到元素
 */
export function scrollToElement(element: HTMLElement | string, offset = 0) {
  const el = typeof element === 'string' 
    ? document.querySelector(element) 
    : element;
    
  if (!el) return;
  
  const top = el.getBoundingClientRect().top + window.pageYOffset - offset;
  
  window.scrollTo({
    top,
    behavior: 'smooth'
  });
}

/**
 * 复制到剪贴板(移动端兼容)
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      // 降级方案
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      const result = document.execCommand('copy');
      textArea.remove();
      return result;
    }
  } catch (error) {
    console.error('复制失败:', error);
    return false;
  }
}

/**
 * 分享内容(使用Web Share API)
 */
export async function shareContent(data: {
  title?: string;
  text?: string;
  url?: string;
}): Promise<boolean> {
  if (!navigator.share) {
    console.warn('Web Share API 不支持');
    return false;
  }

  try {
    await navigator.share(data);
    return true;
  } catch (error) {
    if ((error as Error).name !== 'AbortError') {
      console.error('分享失败:', error);
    }
    return false;
  }
}

/**
 * 打开电话
 */
export function callPhone(phoneNumber: string) {
  window.location.href = `tel:${phoneNumber}`;
}

/**
 * 发送短信
 */
export function sendSMS(phoneNumber: string, message?: string) {
  const url = message 
    ? `sms:${phoneNumber}?body=${encodeURIComponent(message)}`
    : `sms:${phoneNumber}`;
  window.location.href = url;
}

/**
 * 打开地图导航
 */
export function openMap(latitude: number, longitude: number, label?: string) {
  const url = label
    ? `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}&query_place_id=${encodeURIComponent(label)}`
    : `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
  window.open(url, '_blank');
}

/**
 * 节流函数(移动端滚动优化)
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null;
  let lastExecTime = 0;

  return function (this: any, ...args: Parameters<T>) {
    const currentTime = Date.now();

    if (currentTime - lastExecTime > delay) {
      func.apply(this, args);
      lastExecTime = currentTime;
    } else {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => {
        func.apply(this, args);
        lastExecTime = Date.now();
      }, delay - (currentTime - lastExecTime));
    }
  };
}

/**
 * 防抖函数(移动端输入优化)
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null;

  return function (this: any, ...args: Parameters<T>) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      func.apply(this, args);
    }, delay);
  };
}

/**
 * 图片压缩(移动端上传优化)
 */
export async function compressImage(
  file: File,
  maxWidth = 1920,
  maxHeight = 1080,
  quality = 0.8
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // 计算缩放比例
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width *= ratio;
          height *= ratio;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('无法创建canvas上下文'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('图片压缩失败'));
            }
          },
          file.type,
          quality
        );
      };

      img.onerror = () => reject(new Error('图片加载失败'));
      img.src = e.target?.result as string;
    };

    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsDataURL(file);
  });
}

