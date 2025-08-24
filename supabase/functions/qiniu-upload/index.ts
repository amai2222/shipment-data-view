import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const QINIU_ACCESS_KEY = Deno.env.get('QINIU_ACCESS_KEY')
    const QINIU_SECRET_KEY = Deno.env.get('QINIU_SECRET_KEY')
    
    if (!QINIU_ACCESS_KEY || !QINIU_SECRET_KEY) {
      throw new Error('Qiniu credentials not configured')
    }

    const { files, folder = 'scale-records' } = await req.json()
    
    if (!files || !Array.isArray(files)) {
      throw new Error('Files array is required')
    }

    const BUCKET = 'zkzy-tuku'
    const DOMAIN = 'photo.325218.xyz'
    
    // Generate upload token for each file
    const uploadedUrls: string[] = []
    
    for (const file of files) {
      const { fileName, fileData } = file
      
      // Generate unique filename with timestamp
      const timestamp = Date.now()
      const uniqueFileName = `${folder}/${timestamp}-${fileName}`
      
      // Create upload policy
      const putPolicy = {
        scope: `${BUCKET}:${uniqueFileName}`,
        deadline: Math.floor(Date.now() / 1000) + 3600, // 1 hour
        returnBody: '{"key":"$(key)","hash":"$(etag)","fsize":$(fsize),"bucket":"$(bucket)","name":"$(x:name)"}'
      }
      
      // Generate upload token
      const encodedPutPolicy = btoa(JSON.stringify(putPolicy))
      const sign = await generateSign(encodedPutPolicy, QINIU_SECRET_KEY)
      const uploadToken = `${QINIU_ACCESS_KEY}:${sign}:${encodedPutPolicy}`
      
      // Convert base64 to binary
      const binaryData = Uint8Array.from(atob(fileData), c => c.charCodeAt(0))
      
      // Create form data for upload
      const formData = new FormData()
      formData.append('key', uniqueFileName)
      formData.append('token', uploadToken)
      formData.append('file', new Blob([binaryData]), fileName)
      
      // Upload to Qiniu
      const uploadResponse = await fetch('https://upload.qiniup.com/', {
        method: 'POST',
        body: formData
      })
      
      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text()
        console.error('Qiniu upload error:', errorText)
        throw new Error(`Upload failed: ${errorText}`)
      }
      
      const uploadResult = await uploadResponse.json()
      const fileUrl = `https://${DOMAIN}/${uploadResult.key}`
      uploadedUrls.push(fileUrl)
      
      console.log('File uploaded successfully:', fileUrl)
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        urls: uploadedUrls 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Error in qiniu-upload:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})

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
  const signatureArray = new Uint8Array(signature)
  
  // Convert to base64
  let binary = ''
  signatureArray.forEach(byte => binary += String.fromCharCode(byte))
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_')
}