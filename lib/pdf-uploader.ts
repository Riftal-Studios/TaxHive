import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import Logger from '@/lib/logger'

// Check if we should use S3 uploader
const useS3 = process.env.AWS_ACCESS_KEY_ID && process.env.AWS_S3_BUCKET

// Dynamically import S3 uploader if configured
const s3Uploader = useS3 
  ? import('./pdf-uploader-s3').then(m => m.uploadPDF)
  : null

// Upload PDF to storage (S3 if configured, otherwise local filesystem)
export async function uploadPDF(buffer: Buffer, filename: string): Promise<string> {
  // Use S3 uploader if available
  if (s3Uploader) {
    try {
      const uploadToS3 = await s3Uploader
      return await uploadToS3(buffer, filename)
    } catch (error) {
      Logger.error('S3 upload failed, falling back to local storage:', error)
    }
  }

  // Default to local filesystem
  const uploadsDir = path.join(process.cwd(), 'uploads', 'invoices')
  await mkdir(uploadsDir, { recursive: true })
  
  const filePath = path.join(uploadsDir, filename)
  await writeFile(filePath, buffer)
  
  // Return a URL that can be served by Next.js
  return `/uploads/invoices/${filename}`
}