import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

// Upload PDF to storage (local filesystem for now, S3/R2 in production)
export async function uploadPDF(buffer: Buffer, filename: string): Promise<string> {
  const uploadsDir = path.join(process.cwd(), 'uploads', 'invoices')
  await mkdir(uploadsDir, { recursive: true })
  
  const filePath = path.join(uploadsDir, filename)
  await writeFile(filePath, buffer)
  
  // Return a URL that can be served by Next.js
  // In production, this would upload to S3/CloudFlare R2
  return `/uploads/invoices/${filename}`
}