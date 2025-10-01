/**
 * Client Service Layer
 * 
 * Handles all client-related business logic including CRUD operations,
 * validation, and client portal access management.
 */

import { db } from '@/lib/prisma'
import { cache } from '@/lib/cache/redis-cache'
import { generateSecureToken } from '@/lib/utils/token'
import Logger from '@/lib/logger'
import type { Client, ClientPortalAccess } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

// Types
export interface CreateClientInput {
  userId: string
  name: string
  email: string
  phone?: string
  company?: string
  address?: string
  city?: string
  state?: string
  country: string
  postalCode?: string
  gstin?: string
  pan?: string
  isActive?: boolean
}

export interface UpdateClientInput {
  id: string
  userId: string
  name?: string
  email?: string
  phone?: string
  company?: string
  address?: string
  city?: string
  state?: string
  country?: string
  postalCode?: string
  gstin?: string
  pan?: string
  isActive?: boolean
}

export interface ClientFilter {
  userId: string
  isActive?: boolean
  country?: string
  search?: string
}

export type ClientWithPortalAccess = Client & {
  portalAccess?: ClientPortalAccess | null
}

/**
 * Client Service Class
 */
export class ClientService {
  /**
   * Create a new client
   */
  async createClient(input: CreateClientInput): Promise<Client> {
    const { userId, ...clientData } = input
    
    // Check for duplicate email
    const existingClient = await db.client.findFirst({
      where: {
        userId,
        email: clientData.email,
      },
    })
    
    if (existingClient) {
      throw new Error('A client with this email already exists')
    }
    
    // Validate GSTIN if provided (for Indian clients)
    if (clientData.country === 'India' && clientData.gstin) {
      if (!this.validateGSTIN(clientData.gstin)) {
        throw new Error('Invalid GSTIN format')
      }
    }
    
    const client = await db.client.create({
      data: {
        ...clientData,
        userId,
        isActive: clientData.isActive ?? true,
      },
    })
    
    // Clear cache
    await cache.clearType('clients', userId)
    
    Logger.info('Client created', { clientId: client.id, userId })
    
    return client
  }

  /**
   * Get client by ID
   */
  async getClientById(id: string, userId: string): Promise<ClientWithPortalAccess | null> {
    const cacheKey = `${id}:details`
    
    return await cache.cached(
      'clients',
      cacheKey,
      async () => {
        return await db.client.findUnique({
          where: { id, userId },
          include: {
            portalAccess: true,
          },
        })
      },
      {
        userId,
        ttl: 600, // Cache for 10 minutes
      }
    )
  }

  /**
   * List clients with filters
   */
  async listClients(filter: ClientFilter): Promise<Client[]> {
    const { userId, isActive, country, search } = filter
    const cacheKey = `list:${isActive ?? 'all'}:${country ?? 'all'}:${search ?? 'all'}`
    
    return await cache.cached(
      'clients',
      cacheKey,
      async () => {
        const where: any = { userId }
        
        if (isActive !== undefined) {
          where.isActive = isActive
        }
        
        if (country) {
          where.country = country
        }
        
        if (search) {
          where.OR = [
            { name: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { company: { contains: search, mode: 'insensitive' } },
          ]
        }
        
        return await db.client.findMany({
          where,
          orderBy: { name: 'asc' },
        })
      },
      {
        userId,
        ttl: 600, // Cache for 10 minutes
      }
    )
  }

  /**
   * Update client
   */
  async updateClient(input: UpdateClientInput): Promise<Client> {
    const { id, userId, ...updateData } = input
    
    // Validate GSTIN if updated
    if (updateData.country === 'India' && updateData.gstin) {
      if (!this.validateGSTIN(updateData.gstin)) {
        throw new Error('Invalid GSTIN format')
      }
    }
    
    const client = await db.client.update({
      where: { id, userId },
      data: updateData,
    })
    
    // Clear cache
    await cache.clearType('clients', userId)
    
    Logger.info('Client updated', { clientId: id, userId })
    
    return client
  }

  /**
   * Delete client
   */
  async deleteClient(id: string, userId: string): Promise<void> {
    // Check if client has invoices
    const invoiceCount = await db.invoice.count({
      where: { clientId: id, userId },
    })
    
    if (invoiceCount > 0) {
      throw new Error('Cannot delete client with existing invoices')
    }
    
    await db.client.delete({
      where: { id, userId },
    })
    
    // Clear cache
    await cache.clearType('clients', userId)
    
    Logger.info('Client deleted', { clientId: id, userId })
  }

  /**
   * Enable client portal access
   */
  async enablePortalAccess(clientId: string, userId: string): Promise<ClientPortalAccess> {
    const client = await this.getClientById(clientId, userId)
    
    if (!client) {
      throw new Error('Client not found')
    }
    
    if (client.portalAccess) {
      throw new Error('Portal access already enabled for this client')
    }
    
    // Generate secure access token
    const accessToken = generateSecureToken()
    const hashedToken = await bcrypt.hash(accessToken, 10)
    
    const portalAccess = await db.clientPortalAccess.create({
      data: {
        clientId,
        accessToken: hashedToken,
        isActive: true,
        lastAccessAt: null,
      },
    })
    
    // Clear cache
    await cache.clearType('clients', userId)
    
    Logger.info('Client portal access enabled', { clientId, userId })
    
    // Return with unhashed token for initial sharing
    return {
      ...portalAccess,
      accessToken, // This is the unhashed token to share with client
    }
  }

  /**
   * Disable client portal access
   */
  async disablePortalAccess(clientId: string, userId: string): Promise<void> {
    const client = await this.getClientById(clientId, userId)
    
    if (!client) {
      throw new Error('Client not found')
    }
    
    if (!client.portalAccess) {
      throw new Error('Portal access not enabled for this client')
    }
    
    await db.clientPortalAccess.update({
      where: { id: client.portalAccess.id },
      data: { isActive: false },
    })
    
    // Clear cache
    await cache.clearType('clients', userId)
    
    Logger.info('Client portal access disabled', { clientId, userId })
  }

  /**
   * Reset client portal access token
   */
  async resetPortalAccessToken(clientId: string, userId: string): Promise<string> {
    const client = await this.getClientById(clientId, userId)
    
    if (!client) {
      throw new Error('Client not found')
    }
    
    if (!client.portalAccess) {
      throw new Error('Portal access not enabled for this client')
    }
    
    // Generate new secure access token
    const newAccessToken = generateSecureToken()
    const hashedToken = await bcrypt.hash(newAccessToken, 10)
    
    await db.clientPortalAccess.update({
      where: { id: client.portalAccess.id },
      data: { accessToken: hashedToken },
    })
    
    // Clear cache
    await cache.clearType('clients', userId)
    
    Logger.info('Client portal access token reset', { clientId, userId })
    
    return newAccessToken // Return unhashed token for sharing
  }

  /**
   * Get client statistics
   */
  async getClientStats(userId: string): Promise<{
    totalClients: number
    activeClients: number
    clientsByCountry: Record<string, number>
    portalEnabledCount: number
  }> {
    const cacheKey = `stats:${userId}`
    
    return await cache.cached(
      'clients',
      cacheKey,
      async () => {
        const clients = await db.client.findMany({
          where: { userId },
          include: { portalAccess: true },
        })
        
        const clientsByCountry: Record<string, number> = {}
        let activeClients = 0
        let portalEnabledCount = 0
        
        for (const client of clients) {
          if (client.isActive) {
            activeClients++
          }
          
          if (client.portalAccess?.isActive) {
            portalEnabledCount++
          }
          
          clientsByCountry[client.country] = (clientsByCountry[client.country] || 0) + 1
        }
        
        return {
          totalClients: clients.length,
          activeClients,
          clientsByCountry,
          portalEnabledCount,
        }
      },
      {
        userId,
        ttl: 600, // Cache for 10 minutes
      }
    )
  }

  /**
   * Import clients from CSV
   */
  async importClientsFromCSV(
    userId: string,
    csvData: Array<Partial<CreateClientInput>>
  ): Promise<{
    imported: number
    failed: number
    errors: Array<{ row: number; error: string }>
  }> {
    let imported = 0
    let failed = 0
    const errors: Array<{ row: number; error: string }> = []
    
    for (let i = 0; i < csvData.length; i++) {
      try {
        const clientData = csvData[i]
        
        if (!clientData.name || !clientData.email || !clientData.country) {
          throw new Error('Missing required fields: name, email, or country')
        }
        
        await this.createClient({
          userId,
          name: clientData.name,
          email: clientData.email,
          country: clientData.country,
          phone: clientData.phone,
          company: clientData.company,
          address: clientData.address,
          city: clientData.city,
          state: clientData.state,
          postalCode: clientData.postalCode,
          gstin: clientData.gstin,
          pan: clientData.pan,
        })
        
        imported++
      } catch (error) {
        failed++
        errors.push({
          row: i + 1,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }
    
    // Clear cache after bulk import
    await cache.clearType('clients', userId)
    
    Logger.info('Client import completed', { userId, imported, failed })
    
    return { imported, failed, errors }
  }

  /**
   * Validate GSTIN format
   */
  private validateGSTIN(gstin: string): boolean {
    // GSTIN format: 2 digits (state code) + 10 characters (PAN) + 1 digit + 1 character + 1 digit
    const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/
    return gstinRegex.test(gstin)
  }

  /**
   * Get clients with outstanding invoices
   */
  async getClientsWithOutstandingInvoices(userId: string): Promise<Array<{
    client: Client
    outstandingAmount: number
    overdueAmount: number
    invoiceCount: number
  }>> {
    const cacheKey = `outstanding:${userId}`
    
    return await cache.cached(
      'clients',
      cacheKey,
      async () => {
        const invoices = await db.invoice.findMany({
          where: {
            userId,
            paymentStatus: { not: 'PAID' },
          },
          include: { client: true },
        })
        
        const clientMap = new Map<string, {
          client: Client
          outstandingAmount: number
          overdueAmount: number
          invoiceCount: number
        }>()
        
        const now = new Date()
        
        for (const invoice of invoices) {
          const clientId = invoice.clientId
          
          if (!clientMap.has(clientId)) {
            clientMap.set(clientId, {
              client: invoice.client,
              outstandingAmount: 0,
              overdueAmount: 0,
              invoiceCount: 0,
            })
          }
          
          const clientData = clientMap.get(clientId)!
          clientData.outstandingAmount += Number(invoice.balanceDue)
          clientData.invoiceCount++
          
          if (invoice.dueDate < now) {
            clientData.overdueAmount += Number(invoice.balanceDue)
          }
        }
        
        return Array.from(clientMap.values())
      },
      {
        userId,
        ttl: 300, // Cache for 5 minutes
      }
    )
  }
}

// Export singleton instance
export const clientService = new ClientService()