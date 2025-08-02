import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

// Initialize S3 client
const s3Client = process.env.AWS_ACCESS_KEY_ID && process.env.AWS_S3_BUCKET
  ? new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    })
  : null

// Upload PDF to S3 or local filesystem
export async function uploadPDF(buffer: Buffer, filename: string): Promise<string> {
  // Use S3 if configured
  if (s3Client && process.env.AWS_S3_BUCKET) {
    try {
      const key = `invoices/${filename}`
      
      const command = new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: 'application/pdf',
        // Optional: Add metadata
        Metadata: {
          'uploaded-by': 'gsthive',
          'upload-date': new Date().toISOString(),
        },
        // Optional: Make publicly readable (configure based on your needs)
        // ACL: 'public-read',
      })

      await s3Client.send(command)
      
      // Return S3 URL
      // For private buckets, you might want to use CloudFront or generate signed URLs
      return `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`
    } catch (error) {
      console.error('S3 upload failed, falling back to local storage:', error)
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
  if (!s3Client || !process.env.AWS_S3_BUCKET) {
    return null
  }

  try {
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner')
    const { GetObjectCommand } = await import('@aws-sdk/client-s3')
    
    const command = new GetObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key,
    })

    return await getSignedUrl(s3Client, command, { expiresIn })
  } catch (error) {
    console.error('Failed to generate signed URL:', error)
    return null
  }
}