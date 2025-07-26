import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

// Rate limiting map (in production, use Redis or similar)
const uploadAttempts = new Map<string, number[]>()
const RATE_LIMIT_WINDOW = 60 * 1000 // 1 minute
const MAX_UPLOADS_PER_WINDOW = 10

function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const userAttempts = uploadAttempts.get(userId) || []
  
  // Filter out old attempts
  const recentAttempts = userAttempts.filter(time => now - time < RATE_LIMIT_WINDOW)
  
  if (recentAttempts.length >= MAX_UPLOADS_PER_WINDOW) {
    return false
  }
  
  // Add current attempt
  recentAttempts.push(now)
  uploadAttempts.set(userId, recentAttempts)
  
  return true
}

function sanitizeFilename(filename: string): string {
  // Remove potentially dangerous characters and sequences
  return filename
    .replace(/[^a-zA-Z0-9.\-_]/g, '_')  // Allow only safe characters
    .replace(/\.{2,}/g, '_')            // Prevent directory traversal
    .replace(/^\./, '_')                // Prevent hidden files
    .substring(0, 100)                  // Limit filename length
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check rate limiting
    if (!checkRateLimit(session.user.id)) {
      return NextResponse.json({ 
        error: 'Too many uploads. Please try again later.' 
      }, { status: 429 })
    }

    // Get the file from the request
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File too large (max 5MB)' }, { status: 400 })
    }

    // Validate file type (more restrictive)
    const allowedTypes = [
      'application/pdf',
      'image/png', 
      'image/jpeg',
      'image/jpg',
      'image/webp'
    ]
    const allowedExtensions = ['.pdf', '.png', '.jpg', '.jpeg', '.webp']
    
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type' }, { status: 400 })
    }

    // Additional validation: check file extension
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'))
    if (!allowedExtensions.includes(fileExtension)) {
      return NextResponse.json({ error: 'Invalid file extension' }, { status: 400 })
    }

    // Create upload directory if it doesn't exist
    const uploadDir = join(process.cwd(), 'uploads', session.user.id)
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true })
    }

    // Generate secure filename
    const timestamp = Date.now()
    const randomSuffix = Math.random().toString(36).substring(2, 8)
    const safeName = sanitizeFilename(file.name)
    const fileName = `${timestamp}_${randomSuffix}_${safeName}`
    const filePath = join(uploadDir, fileName)

    // Basic file content validation (magic number check)
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    
    // Check for common file signatures
    const isPDF = buffer.slice(0, 4).toString() === '%PDF'
    const isPNG = buffer.slice(0, 8).toString('hex') === '89504e470d0a1a0a'
    const isJPEG = buffer.slice(0, 3).toString('hex') === 'ffd8ff'
    const isWebP = buffer.slice(0, 4).toString() === 'RIFF' && buffer.slice(8, 12).toString() === 'WEBP'
    
    if (file.type === 'application/pdf' && !isPDF) {
      return NextResponse.json({ error: 'Invalid PDF file' }, { status: 400 })
    }
    if (file.type === 'image/png' && !isPNG) {
      return NextResponse.json({ error: 'Invalid PNG file' }, { status: 400 })
    }
    if ((file.type === 'image/jpeg' || file.type === 'image/jpg') && !isJPEG) {
      return NextResponse.json({ error: 'Invalid JPEG file' }, { status: 400 })
    }
    if (file.type === 'image/webp' && !isWebP) {
      return NextResponse.json({ error: 'Invalid WebP file' }, { status: 400 })
    }

    await writeFile(filePath, buffer)

    // Return the file URL
    const fileUrl = `/uploads/${session.user.id}/${fileName}`

    return NextResponse.json({ 
      url: fileUrl,
      name: file.name,
      size: file.size,
      type: file.type
    })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}