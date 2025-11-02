// PWA 工具函数

/**
 * 检查是否在 PWA 模式下运行
 */
export const isPWA = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true ||
    document.referrer.includes('android-app://')
  );
};

/**
 * 检查是否在企业微信中
 */
export const isWeCom = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  const ua = window.navigator.userAgent.toLowerCase();
  return ua.includes('wxwork');
};

/**
 * 检查是否在微信中
 */
export const isWeChat = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  const ua = window.navigator.userAgent.toLowerCase();
  return ua.includes('micromessenger') && !isWeCom();
};

/**
 * 提示用户安装 PWA
 */
export const promptPWAInstall = () => {
  let deferredPrompt: any = null;

  window.addEventListener('beforeinstallprompt', (e) => {
    // 阻止默认的安装提示
    e.preventDefault();
    deferredPrompt = e;
    
    // 这里可以显示自定义的安装提示
    console.log('💡 PWA 可以被安装');
  });

  return {
    canInstall: () => deferredPrompt !== null,
    install: async () => {
      if (!deferredPrompt) {
        return false;
      }
      
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`用户选择: ${outcome}`);
      
      deferredPrompt = null;
      return outcome === 'accepted';
    }
  };
};

/**
 * 清除所有缓存
 */
export const clearAllCaches = async (): Promise<void> => {
  if ('serviceWorker' in navigator && 'caches' in window) {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map(name => caches.delete(name)));
    console.log('🗑️ 所有缓存已清除');
  }
};

/**
 * 检查 Service Worker 更新
 */
export const checkForUpdates = async (): Promise<void> => {
  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
      await registration.update();
      console.log('🔄 检查更新完成');
    }
  }
};

/**
 * 获取应用运行环境信息
 */
export const getEnvironmentInfo = () => {
  return {
    isPWA: isPWA(),
    isWeCom: isWeCom(),
    isWeChat: isWeChat(),
    isOnline: navigator.onLine,
    serviceWorkerSupported: 'serviceWorker' in navigator,
    userAgent: navigator.userAgent
  };
};

