import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params

    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Handle inbox subfolder: /uploads/inbox/{userId}/{filename}
    // Or regular uploads: /uploads/{userId}/{filename}
    let userId: string
    let fileName: string
    let basePath: string

    if (path[0] === 'inbox') {
      // Inbox uploads: /uploads/inbox/{userId}/{filename}
      userId = path[1]
      fileName = path.slice(2).join('/')
      basePath = join(process.cwd(), 'uploads', 'inbox', userId)
    } else {
      // Regular uploads: /uploads/{userId}/{filename}
      userId = path[0]
      fileName = path.slice(1).join('/')
      basePath = join(process.cwd(), 'uploads', userId)
    }

    // Security check: ensure user can only access their own files
    if (userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Construct file path
    const filePath = join(basePath, fileName)

    // Check if file exists
    if (!existsSync(filePath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    // Read file
    const file = await readFile(filePath)

    // Determine content type
    const extension = fileName.split('.').pop()?.toLowerCase()
    const contentTypeMap: Record<string, string> = {
      pdf: 'application/pdf',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      webp: 'image/webp',
      csv: 'text/csv',
      txt: 'text/plain',
    }
    const contentType = extension ? contentTypeMap[extension] ?? 'application/octet-stream' : 'application/octet-stream'

    // Return file
    return new NextResponse(file, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${fileName}"`,
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (error) {
    console.error('File serving error:', error)
    return NextResponse.json({ error: 'Failed to serve file' }, { status: 500 })
  }
}