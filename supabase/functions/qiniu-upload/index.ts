// 文件路径: supabase/functions/qiniu-upload/index.ts
// 版本: V7 (指定存储类型为归档直读)
// 描述: 在上传策略(putPolicy)中添加 "fileType: 4"，确保文件以“归档直读”模式存储。
//      同时保留了 V6 版本的所有功能。

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function safeUrlsafeBase64Encode(str: string): string {
  const utf8Bytes = new TextEncoder().encode(str);
  let binaryString = '';
  utf8Bytes.forEach(byte => {
    binaryString += String.fromCharCode(byte);
  });
  const base64 = btoa(binaryString);
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
    
    // 支持两种命名模式：磅单和合同
    const isContractUpload = namingParams?.projectName === 'hetong'
    if (!isContractUpload && (!namingParams || !namingParams.projectName || !namingParams.date || !namingParams.licensePlate || !namingParams.tripNumber)) {
        throw new Error('For scale records: namingParams object with projectName, date, licensePlate, and tripNumber is required.')
    }
    if (isContractUpload && (!namingParams || !namingParams.customName)) {
        throw new Error('For contracts: namingParams object with customName is required.')
    }

    const uploadedUrls: string[] = []
    
    for (const [index, file] of files.entries()) {
      const { fileName, fileData } = file
      let qiniuKey: string
      
      if (isContractUpload) {
        // 合同文件命名
        const { customName } = namingParams
        const fileExtension = fileName.substring(fileName.lastIndexOf('.'))
        qiniuKey = `hetong/${customName}${fileExtension}`
      } else {
        // 磅单文件命名（原有逻辑）
        const { projectName, date, licensePlate, tripNumber } = namingParams
        const folderName = `${projectName}-${date}-${licensePlate}-第${tripNumber}车次`
        const fileExtension = fileName.substring(fileName.lastIndexOf('.'))
        const newFileName = `${projectName}-${date}-${licensePlate}-第${tripNumber}车次-${index + 1}${fileExtension}`
        qiniuKey = `scale/${folderName}/${newFileName}`
      }

      const putPolicy = {
        scope: `${QINIU_BUCKET}:${qiniuKey}`,
        deadline: Math.floor(Date.now() / 1000) + 3600,
        returnBody: '{"key":"$(key)","hash":"$(etag)"}',
        // ★★★ 关键修改: 指定文件存储类型为归档直读 ★★★
        fileType: 4 
      }
      
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
