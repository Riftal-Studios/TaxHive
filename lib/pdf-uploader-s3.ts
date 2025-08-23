import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import Logger from '@/lib/logger'

// S3 Configuration
const s3Config = {
  bucket: process.env.AWS_S3_BUCKET || process.env.S3_BUCKET,
  region: process.env.AWS_S3_REGION || process.env.AWS_REGION || 'us-east-1',
  endpoint: process.env.AWS_S3_ENDPOINT || process.env.AWS_ENDPOINT_URL, // For S3-compatible services
  forcePathStyle: process.env.AWS_S3_FORCE_PATH_STYLE === 'true', // For MinIO/LocalStack
  publicRead: process.env.AWS_S3_PUBLIC_READ === 'true', // Make uploads public by default
}

// Initialize S3 client
const s3Client = process.env.AWS_ACCESS_KEY_ID && s3Config.bucket
  ? new S3Client({
      region: s3Config.region,
      endpoint: s3Config.endpoint,
      forcePathStyle: s3Config.forcePathStyle,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    })
  : null

// Upload PDF to S3 or local filesystem
export async function uploadPDF(buffer: Buffer, filename: string): Promise<string> {
  // Use S3 if configured
  if (s3Client && s3Config.bucket) {
    try {
      const key = `invoices/${filename}`
      
      const command = new PutObjectCommand({
        Bucket: s3Config.bucket,
        Key: key,
        Body: buffer,
        ContentType: 'application/pdf',
        // Optional: Add metadata
        Metadata: {
          'uploaded-by': 'gsthive',
          'upload-date': new Date().toISOString(),
        },
        // Set ACL based on configuration
        ...(s3Config.publicRead && { ACL: 'public-read' }),
      })

      await s3Client.send(command)
      
      // Return S3 URL
      if (s3Config.endpoint) {
        // Custom endpoint (e.g., CloudFlare R2, MinIO)
        return `${s3Config.endpoint}/${s3Config.bucket}/${key}`
      } else {
        // Standard AWS S3 URL
        return `https://${s3Config.bucket}.s3.${s3Config.region}.amazonaws.com/${key}`
      }
    } catch (error) {
      Logger.error('S3 upload failed, falling back to local storage:', error)
      // Fall back to local storage on error
    }
  }

  // Fallback to local filesystem
  const uploadsDir = path.join(process.cwd(), 'uploads', 'invoices')
  await mkdir(uploadsDir, { recursive: true })
  
  const filePath = path.join(uploadsDir, filename)
  await writeFile(filePath, buffer)
  
  return `/uploads/invoices/${filename}`
}

// Generate a signed URL for private S3 objects (optional)
export async function getSignedUrl(key: string, expiresIn = 3600): Promise<string | null> {
  if (!s3Client || !s3Config.bucket) {
    return null
  }

  try {
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner')
    const { GetObjectCommand } = await import('@aws-sdk/client-s3')
    
    const command = new GetObjectCommand({
      Bucket: s3Config.bucket,
      Key: key,
    })

    return await getSignedUrl(s3Client, command, { expiresIn })
  } catch (error) {
    Logger.error('Failed to generate signed URL:', error)
    return null
  }
}