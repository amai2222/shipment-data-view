// 文件路径: supabase/functions/qiniu-upload/index.ts
// 版本: V2 (修正上传地址并优化配置)
// 描述: 此版本从环境变量读取所有七牛云配置，包括正确的上传地址，解决了硬编码导致的上传失败问题。

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// HMAC-SHA1 签名函数 (与您原版相同，逻辑正确)
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
  
  // 将 ArrayBuffer 转换为 Base64 URL Safe 字符串
  const signatureBytes = new Uint8Array(signature)
  let binaryString = ''
  for (let i = 0; i < signatureBytes.byteLength; i++) {
    binaryString += String.fromCharCode(signatureBytes[i])
  }
  return btoa(binaryString).replace(/\+/g, '-').replace(/\//g, '_')
}


serve(async (req) => {
  // 处理 CORS 预检请求
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // ★★★ 优化点 1: 从环境变量中读取所有配置 ★★★
    const QINIU_ACCESS_KEY = Deno.env.get('QINIU_ACCESS_KEY')
    const QINIU_SECRET_KEY = Deno.env.get('QINIU_SECRET_KEY')
    const QINIU_BUCKET = Deno.env.get('QINIU_BUCKET')
    const QINIU_DOMAIN = Deno.env.get('QINIU_DOMAIN')
    const QINIU_UPLOAD_URL = Deno.env.get('QINIU_UPLOAD_URL') // <-- 使用正确的上传地址

    if (!QINIU_ACCESS_KEY || !QINIU_SECRET_KEY || !QINIU_BUCKET || !QINIU_DOMAIN || !QINIU_UPLOAD_URL) {
      throw new Error('Qiniu environment variables are not fully configured in Supabase Secrets.')
    }

    const { files, folder = 'default-folder' } = await req.json()
    
    if (!files || !Array.isArray(files) || files.length === 0) {
      throw new Error('Files array is required and cannot be empty.')
    }

    const uploadedUrls: string[] = []
    
    for (const file of files) {
      const { fileName, fileData } = file
      
      const timestamp = Date.now()
      const uniqueFileName = `${folder}/${timestamp}-${fileName}`
      
      const putPolicy = {
        scope: `${QINIU_BUCKET}:${uniqueFileName}`,
        deadline: Math.floor(Date.now() / 1000) + 3600, // 1小时有效期
        returnBody: '{"key":"$(key)","hash":"$(etag)"}'
      }
      
      const encodedPutPolicy = btoa(JSON.stringify(putPolicy))
      const sign = await generateSign(encodedPutPolicy, QINIU_SECRET_KEY)
      const uploadToken = `${QINIU_ACCESS_KEY}:${sign}:${encodedPutPolicy}`
      
      const binaryData = Uint8Array.from(atob(fileData), c => c.charCodeAt(0))
      
      const formData = new FormData()
      formData.append('key', uniqueFileName)
      formData.append('token', uploadToken)
      formData.append('file', new Blob([binaryData]), fileName)
      
      // ★★★ 修正点: 使用从环境变量获取的正确上传地址 ★★★
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
