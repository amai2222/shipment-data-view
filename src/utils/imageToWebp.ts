/**
 * 工具: 上传图片前端自动转 WebP(零服务端成本)
 *
 * 设计目标:
 *  - 在浏览器本地把 JPEG/PNG 转成 WebP,体积通常降 40%~60%
 *  - 不改后端:qiniu-upload 函数按 fileName 的扩展名生成 key,
 *    因此这里把 fileName 后缀改成 .webp 即可,最终 URL 自然是 .webp
 *  - 转换失败/浏览器不支持 WebP/非图片文件 => 原样返回,保证上传不中断
 *
 * 输入/输出结构与现有上传点完全一致: { fileName, fileData(base64,不含data:前缀) }
 */

/** 上传项结构(与 qiniu-upload 函数的入参保持一致) */
export interface UploadFileItem {
  fileName: string;
  fileData: string; // 纯 base64,不含 data: 前缀
  customName?: string; // 部分上传点(证件/车辆)使用的自定义命名
}

const WEBP_QUALITY = 0.82;
const MAX_EDGE = 1920;

const RASTER_EXT = /\.(jpe?g|png|bmp|webp)$/i;

/** 把 Blob 转成纯 base64(分块处理,避免大图 String.fromCharCode 爆栈) */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.substring(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** 从 base64 还原 Blob */
function base64ToBlob(base64: string, mime: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

function mimeFromFileName(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  if (ext === 'bmp') return 'image/bmp';
  if (ext === 'webp') return 'image/webp';
  return 'application/octet-stream';
}

function withWebpExt(name: string): string {
  return RASTER_EXT.test(name) ? name.replace(/\.[^.]+$/, '.webp') : `${name}.webp`;
}

/** 等比缩放尺寸 */
function fitSize(width: number, height: number): { width: number; height: number } {
  if (width <= MAX_EDGE && height <= MAX_EDGE) return { width, height };
  const ratio = MAX_EDGE / Math.max(width, height);
  return { width: Math.round(width * ratio), height: Math.round(height * ratio) };
}

/** 浏览器是否支持 WebP 编码 */
function supportsWebpEncoding(): boolean {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
  } catch {
    return false;
  }
}

/** 解码图片;优先 createImageBitmap 以正确应用手机照片 EXIF 方向 */
async function decodeImage(blob: Blob): Promise<CanvasImageSource & { width: number; height: number }> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(blob, { imageOrientation: 'from-image' });
    } catch {
      // 部分旧内核对 imageOrientation 选项不支持,降级再试一次
      try {
        return await createImageBitmap(blob);
      } catch {
        // continue to Image fallback
      }
    }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img as CanvasImageSource & { width: number; height: number });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('图片解码失败'));
    };
    img.src = url;
  });
}

/**
 * 把单个上传项转成 WebP(失败时原样返回)
 */
export async function imageFileToWebp(file: UploadFileItem): Promise<UploadFileItem> {
  if (!file || !file.fileData) return file;
  if (!RASTER_EXT.test(file.fileName)) return file; // PDF/合同等非位图不动
  if (/\.webp$/i.test(file.fileName)) return file; // 已是 webp

  try {
    const mime = mimeFromFileName(file.fileName);
    const blob = base64ToBlob(file.fileData, mime);
    const img = await decodeImage(blob);
    const { width, height } = fitSize(img.width, img.height);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;

    ctx.drawImage(img, 0, 0, width, height);
    const webpBlob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/webp', WEBP_QUALITY);
    });
    if (!webpBlob) return file;

    // 转后更大(极少数小图/特殊图)则保留原图,避免负优化
    if (webpBlob.size >= blob.size) return file;

    const fileData = await blobToBase64(webpBlob);
    return { ...file, fileName: withWebpExt(file.fileName), fileData };
  } catch (error) {
    console.warn('[imageToWebp] 转换失败,使用原图:', file.fileName, error);
    return file;
  }
}

/**
 * 批量转换上传文件为 WebP(并发)
 * 供所有图片上传点在 supabase.functions.invoke('qiniu-upload') 之前调用
 */
export async function toWebpUploadFiles(files: UploadFileItem[]): Promise<UploadFileItem[]> {
  if (!files || files.length === 0) return files;
  if (!supportsWebpEncoding()) return files; // 老浏览器不支持则整批原样
  return Promise.all(files.map(imageFileToWebp));
}
