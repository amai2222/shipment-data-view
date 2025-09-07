// 文件路径: src/utils/device.ts
// 描述: 一个简单的工具函数，用于检测当前设备是否为移动设备（基于屏幕宽度）。

export const isMobile = (): boolean => {
  // 768px 是平板电脑的常见断点，我们将其及以下的设备视作“移动端”
  return window.innerWidth <= 768;
};
