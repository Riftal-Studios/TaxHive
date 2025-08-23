import { unlink } from 'fs/promises'
import path from 'path'
import Logger from '@/lib/logger'

export async function cleanupOldPDF(oldPdfUrl: string | null): Promise<void> {
  if (!oldPdfUrl) return
  
  // Only cleanup local files (not S3 URLs)
  if (!oldPdfUrl.startsWith('/uploads/invoices/')) return
  
  try {
    const filename = oldPdfUrl.replace('/uploads/invoices/', '')
    const filePath = path.join(process.cwd(), 'uploads', 'invoices', filename)
    
    await unlink(filePath)
    Logger.info(`Cleaned up old PDF: ${filename}`)
  } catch (error) {
    // Ignore errors - file might not exist
    Logger.warn('Failed to cleanup old PDF:', error)
  }
}