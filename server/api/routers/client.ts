import { z } from 'zod'
import { createTRPCRouter, protectedProcedure } from '@/server/api/trpc'
import { TRPCError } from '@trpc/server'
import Logger from '@/lib/logger'
import { ClientService } from '@/server/services/client.service'

// Initialize service instance
const clientService = new ClientService()

export const clientRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        email: z.string().email(),
        company: z.string().optional(),
        address: z.string().min(1),
        country: z.string().min(1),
        phone: z.string().optional(),
        taxId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Ensure user ID exists
      if (!ctx.session.user.id) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'User ID not found in session',
        })
      }

      // Use service layer for business logic
      return await clientService.createClient({
        ...input,
        userId: ctx.session.user.id,
      })
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    // Use service layer for listing clients
    return await clientService.listClients({
      userId: ctx.session.user.id,
    })
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      // Use service layer to get client
      const client = await clientService.getClientById(
        input.id,
        ctx.session.user.id
      )

      if (!client) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Client not found',
        })
      }

      return client
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1),
        email: z.string().email(),
        company: z.string().optional(),
        address: z.string().min(1),
        country: z.string().min(1),
        phone: z.string().optional(),
        taxId: z.string().optional(),
        isActive: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input

      // Use service layer to update client
      return await clientService.updateClient(
        id,
        data,
        ctx.session.user.id
      )
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Use service layer to delete client
      await clientService.deleteClient(
        input.id,
        ctx.session.user.id
      )

      return { success: true }
    }),
})