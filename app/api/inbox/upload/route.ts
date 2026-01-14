/**
 * Inbox Document Upload API Route
 *
 * Handles file uploads for the smart invoice inbox.
 * Accepts documents with source type metadata and queues them for AI processing.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import { db } from '@/lib/prisma'
import { DocumentSourceType, DocumentStatus, ReviewStatus } from '@prisma/client'
import { getQueueService } from '@/lib/queue'

// Allowed file types for inbox uploads
const ALLOWED_TYPES: Record<string, string[]> = {
  // Documents
  'application/pdf': ['.pdf'],
  'text/csv': ['.csv'],
  // Images
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/webp': ['.webp'],
  // Text
  'text/plain': ['.txt'],
}

// Max file size: 10MB for inbox uploads
const MAX_FILE_SIZE = 10 * 1024 * 1024

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const sourceType = formData.get('sourceType') as string | null
    const sourcePlatform = formData.get('sourcePlatform') as string | null

    // Validate file
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      )
    }

    if (!Object.keys(ALLOWED_TYPES).includes(file.type)) {
      return NextResponse.json(
        { error: `Invalid file type: ${file.type}. Allowed types: PDF, CSV, PNG, JPEG, WebP, TXT` },
        { status: 400 }
      )
    }

    // Validate source type
    if (!sourceType || !Object.values(DocumentSourceType).includes(sourceType as DocumentSourceType)) {
      return NextResponse.json(
        { error: 'Invalid or missing sourceType' },
        { status: 400 }
      )
    }

    // Create upload directory
    const uploadDir = join(process.cwd(), 'uploads', 'inbox', userId)
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true })
    }

    // Generate unique filename
    const timestamp = Date.now()
    const randomSuffix = Math.random().toString(36).substring(2, 8)
    const extension = getFileExtension(file.name, file.type)
    const safeOriginalName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const filename = `${timestamp}_${randomSuffix}${extension}`
    const filePath = join(uploadDir, filename)

    // Save file to disk
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filePath, buffer)

    // Generate file URL
    const fileUrl = `/uploads/inbox/${userId}/${filename}`

    // Create document record in database
    const document = await db.documentUpload.create({
      data: {
        userId,
        filename,
        originalFilename: safeOriginalName,
        mimeType: file.type,
        fileSize: file.size,
        fileUrl,
        sourceType: sourceType as DocumentSourceType,
        sourcePlatform: sourcePlatform || undefined,
        status: DocumentStatus.PENDING,
        reviewStatus: ReviewStatus.PENDING_REVIEW,
      },
    })

    // Queue document for AI processing
    let jobId: string | undefined
    try {
      const queueService = getQueueService()
      const job = await queueService.enqueue('DOCUMENT_PROCESSING', {
        documentUploadId: document.id,
        userId,
        sourceType,
        filename: safeOriginalName,
        fileUrl,
        mimeType: file.type,
      })

      jobId = job.id

      // Update document with job ID
      await db.documentUpload.update({
        where: { id: document.id },
        data: { processingJobId: job.id },
      })
    } catch (queueError) {
      console.error('Failed to queue document for processing:', queueError)
      // Document is still created, can be reprocessed later
    }

    return NextResponse.json({
      success: true,
      document: {
        id: document.id,
        filename: document.filename,
        originalFilename: document.originalFilename,
        mimeType: document.mimeType,
        fileSize: document.fileSize,
        fileUrl: document.fileUrl,
        sourceType: document.sourceType,
        status: document.status,
        reviewStatus: document.reviewStatus,
        createdAt: document.createdAt,
      },
      jobId,
    })
  } catch (error) {
    console.error('Inbox upload error:', error)
    return NextResponse.json(
      { error: 'Upload failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * Get file extension from filename or mime type
 */
function getFileExtension(filename: string, mimeType: string): string {
  // Try to get from filename first
  const dotIndex = filename.lastIndexOf('.')
  if (dotIndex !== -1) {
    return filename.substring(dotIndex).toLowerCase()
  }

  // Fall back to mime type mapping
  const extensions = ALLOWED_TYPES[mimeType]
  return extensions ? extensions[0] : ''
}

/**
 * GET handler to return allowed file types
 */
export async function GET() {
  return NextResponse.json({
    allowedTypes: Object.keys(ALLOWED_TYPES),
    maxFileSize: MAX_FILE_SIZE,
    maxFileSizeMB: MAX_FILE_SIZE / 1024 / 1024,
    sourceTypes: Object.values(DocumentSourceType),
  })
}
