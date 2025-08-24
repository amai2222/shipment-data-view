// 文件路径: supabase/functions/qiniu-upload/index.ts
// 版本: V5 (修复中文编码问题)
// 描述: 修复了当项目名称等包含中文字符时，btoa 函数编码失败的致命错误。
//      引入了一个安全的 Base64 编码辅助函数来正确处理 UTF-8 字符。

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ★ 新增: 安全的 Base64 编码函数，可以正确处理中文字符 ★
function safeUrlsafeBase64Encode(str: string): string {
  // 1. 将字符串编码为 UTF-8 字节数组
  const utf8Bytes = new TextEncoder().encode(str);
  
  // 2. 将字节数组转换为二进制字符串，这是 btoa 可以处理的格式
  let binaryString = '';
  utf8Bytes.forEach(byte => {
    binaryString += String.fromCharCode(byte);
  });
  
  // 3. 使用 btoa 进行 Base64 编码
  const base64 = btoa(binaryString);
  
  // 4. 转换为 URL 安全的 Base64 格式
  return base64.replace(/\+/g, '-').replace(/\//g, '_');
}

async function generateSign(data: string, secretKey: string): Promise<string> {
  const encoder = new TextEncoder()
  const keyData = encoder.encode(secretKey)
  const dataToSign = encoder.encode(data)
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  )
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, dataToSign)
  
  const signatureBytes = new Uint8Array(signature)
  let binaryString = ''
  for (let i = 0; i < signatureBytes.byteLength; i++) {
    binaryString += String.fromCharCode(signatureBytes[i])
  }
  return btoa(binaryString).replace(/\+/g, '-').replace(/\//g, '_')
}


serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const QINIU_ACCESS_KEY = Deno.env.get('QINIU_ACCESS_KEY')
    const QINIU_SECRET_KEY = Deno.env.get('QINIU_SECRET_KEY')
    const QINIU_BUCKET = Deno.env.get('QINIU_BUCKET')
    const QINIU_DOMAIN = Deno.env.get('QINIU_DOMAIN')
    const QINIU_UPLOAD_URL = Deno.env.get('QINIU_UPLOAD_URL')

    if (!QINIU_ACCESS_KEY || !QINIU_SECRET_KEY || !QINIU_BUCKET || !QINIU_DOMAIN || !QINIU_UPLOAD_URL) {
      throw new Error('Qiniu environment variables are not fully configured in Supabase Secrets.')
    }

    const { files, namingParams } = await req.json()
    
    if (!files || !Array.isArray(files) || files.length === 0) {
      throw new Error('Files array is required and cannot be empty.')
    }
    if (!namingParams || !namingParams.projectName || !namingParams.date || !namingParams.licensePlate || !namingParams.tripNumber) {
        throw new Error('namingParams object with projectName, date, licensePlate, and tripNumber is required.')
    }

    const uploadedUrls: string[] = []
    
    for (const [index, file] of files.entries()) {
      const { fileName, fileData } = file
      const { projectName, date, licensePlate, tripNumber } = namingParams;
      
      const folderName = `${projectName}-${date}-${licensePlate}-第${tripNumber}车次`;
      const fileExtension = fileName.substring(fileName.lastIndexOf('.'));
      const newFileName = `${projectName}-${date}-${licensePlate}-第${tripNumber}车次-${index + 1}${fileExtension}`;
      const qiniuKey = `${folderName}/${newFileName}`;

      const putPolicy = {
        scope: `${QINIU_BUCKET}:${qiniuKey}`,
        deadline: Math.floor(Date.now() / 1000) + 3600,
        returnBody: '{"key":"$(key)","hash":"$(etag)"}'
      }
      
      // ★ 修改: 使用新的安全编码函数，替换掉有问题的 btoa ★
      const encodedPutPolicy = safeUrlsafeBase64Encode(JSON.stringify(putPolicy));
      
      const sign = await generateSign(encodedPutPolicy, QINIU_SECRET_KEY)
      const uploadToken = `${QINIU_ACCESS_KEY}:${sign}:${encodedPutPolicy}`
      
      const binaryData = Uint8Array.from(atob(fileData), c => c.charCodeAt(0))
      
      const formData = new FormData()
      formData.append('key', qiniuKey)
      formData.append('token', uploadToken)
      formData.append('file', new Blob([binaryData]), fileName)
      
      const uploadResponse = await fetch(QINIU_UPLOAD_URL, {
        method: 'POST',
        body: formData
      })
      
      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text()
        console.error('Qiniu upload error response:', errorText)
        throw new Error(`Upload to Qiniu failed: ${uploadResponse.statusText}`)
      }
      
      const uploadResult = await uploadResponse.json()
      const fileUrl = `https://${QINIU_DOMAIN}/${uploadResult.key}`
      uploadedUrls.push(fileUrl)
    }

    return new Response(
      JSON.stringify({ success: true, urls: uploadedUrls }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    console.error('Critical error in qiniu-upload function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
