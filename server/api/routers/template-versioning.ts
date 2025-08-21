import { z } from 'zod'
import { createTRPCRouter, protectedProcedure } from '@/server/api/trpc'
import { TRPCError } from '@trpc/server'

// Input validation schemas
const createVersionSchema = z.object({
  templateId: z.string(),
  version: z.string(),
  changes: z.record(z.any()), // JSON object describing changes
  effectiveDate: z.date().optional() // Default to now if not provided
})

const getVersionHistorySchema = z.object({
  templateId: z.string(),
  limit: z.number().int().positive().max(100).optional().default(50),
  offset: z.number().int().nonnegative().optional().default(0)
})

const rollbackToVersionSchema = z.object({
  templateId: z.string(),
  versionId: z.string(),
  reason: z.string().optional()
})

const compareVersionsSchema = z.object({
  templateId: z.string(),
  versionId1: z.string(),
  versionId2: z.string()
})

export const templateVersioningRouter = createTRPCRouter({
  // Create a new version of a template
  createVersion: protectedProcedure
    .input(createVersionSchema)
    .mutation(async ({ ctx, input }) => {
      const { templateId, version, changes, effectiveDate } = input
      const userId = ctx.session.user.id

      // Verify the template exists and belongs to the user
      const template = await ctx.db.recurringInvoice.findFirst({
        where: {
          id: templateId,
          userId
        },
        include: {
          currentVersion: true,
          versions: {
            orderBy: { createdAt: 'desc' },
            take: 1
          }
        }
      })

      if (!template) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Template not found'
        })
      }

      // Check if version already exists
      const existingVersion = await ctx.db.templateVersion.findFirst({
        where: {
          templateId,
          version
        }
      })

      if (existingVersion) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: `Version ${version} already exists for this template`
        })
      }

      // Get the current/latest version for linking
      const previousVersion = template.currentVersion || template.versions[0] || null

      // Create the new version
      const newVersion = await ctx.db.templateVersion.create({
        data: {
          templateId,
          version,
          changes,
          effectiveDate: effectiveDate || new Date(),
          createdBy: userId,
          previousVersionId: previousVersion?.id || null
        },
        include: {
          previousVersion: true
        }
      })

      // Update the template to reference this as the current version
      await ctx.db.recurringInvoice.update({
        where: { id: templateId },
        data: { currentVersionId: newVersion.id }
      })

      return newVersion
    }),

  // Get version history for a template
  getVersionHistory: protectedProcedure
    .input(getVersionHistorySchema)
    .query(async ({ ctx, input }) => {
      const { templateId, limit, offset } = input
      const userId = ctx.session.user.id

      // Verify the template exists and belongs to the user
      const template = await ctx.db.recurringInvoice.findFirst({
        where: {
          id: templateId,
          userId
        }
      })

      if (!template) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Template not found'
        })
      }

      // Get versions with pagination
      const versions = await ctx.db.templateVersion.findMany({
        where: { templateId },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
        include: {
          previousVersion: {
            select: {
              id: true,
              version: true
            }
          }
        }
      })

      // Get total count for pagination
      const totalCount = await ctx.db.templateVersion.count({
        where: { templateId }
      })

      return {
        versions,
        totalCount,
        hasMore: offset + limit < totalCount
      }
    }),

  // Rollback to a previous version
  rollbackToVersion: protectedProcedure
    .input(rollbackToVersionSchema)
    .mutation(async ({ ctx, input }) => {
      const { templateId, versionId, reason } = input
      const userId = ctx.session.user.id

      // Verify the template exists and belongs to the user
      const template = await ctx.db.recurringInvoice.findFirst({
        where: {
          id: templateId,
          userId
        }
      })

      if (!template) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Template not found'
        })
      }

      // Verify the version exists for this template
      const targetVersion = await ctx.db.templateVersion.findFirst({
        where: {
          id: versionId,
          templateId
        }
      })

      if (!targetVersion) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Version not found'
        })
      }

      // Get current version number for creating rollback version
      const currentVersion = await ctx.db.templateVersion.findFirst({
        where: { templateId },
        orderBy: { createdAt: 'desc' }
      })

      // Generate new version number (increment patch version)
      const currentVersionParts = currentVersion?.version.split('.') || ['1', '0', '0']
      const newPatchVersion = parseInt(currentVersionParts[2] || '0') + 1
      const rollbackVersionNumber = `${currentVersionParts[0]}.${currentVersionParts[1]}.${newPatchVersion}`

      // Create a new version entry for the rollback
      const rollbackVersion = await ctx.db.templateVersion.create({
        data: {
          templateId,
          version: rollbackVersionNumber,
          changes: {
            type: 'rollback',
            rolledBackTo: targetVersion.version,
            reason: reason || 'Manual rollback',
            originalChanges: targetVersion.changes
          },
          effectiveDate: new Date(),
          createdBy: userId,
          previousVersionId: currentVersion?.id || null
        }
      })

      // Update the template to use this rollback version as current
      await ctx.db.recurringInvoice.update({
        where: { id: templateId },
        data: { currentVersionId: rollbackVersion.id }
      })

      return rollbackVersion
    }),

  // Compare changes between two versions
  compareVersions: protectedProcedure
    .input(compareVersionsSchema)
    .query(async ({ ctx, input }) => {
      const { templateId, versionId1, versionId2 } = input
      const userId = ctx.session.user.id

      // Verify the template exists and belongs to the user
      const template = await ctx.db.recurringInvoice.findFirst({
        where: {
          id: templateId,
          userId
        }
      })

      if (!template) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Template not found'
        })
      }

      // Get both versions
      const [version1, version2] = await Promise.all([
        ctx.db.templateVersion.findFirst({
          where: {
            id: versionId1,
            templateId
          }
        }),
        ctx.db.templateVersion.findFirst({
          where: {
            id: versionId2,
            templateId
          }
        })
      ])

      if (!version1 || !version2) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'One or both versions not found'
        })
      }

      // Compare the changes
      const comparison = {
        version1: {
          id: version1.id,
          version: version1.version,
          changes: version1.changes,
          effectiveDate: version1.effectiveDate,
          createdAt: version1.createdAt
        },
        version2: {
          id: version2.id,
          version: version2.version,
          changes: version2.changes,
          effectiveDate: version2.effectiveDate,
          createdAt: version2.createdAt
        },
        // Simple diff - in a real implementation, you might want a more sophisticated diff
        differences: {
          changesAdded: Object.keys(version2.changes as Record<string, unknown>).filter(
            key => !(key in (version1.changes as Record<string, unknown>))
          ),
          changesRemoved: Object.keys(version1.changes as Record<string, unknown>).filter(
            key => !(key in (version2.changes as Record<string, unknown>))
          ),
          changesModified: Object.keys(version2.changes as Record<string, unknown>).filter(
            key => key in (version1.changes as Record<string, unknown>) && 
            JSON.stringify((version1.changes as Record<string, unknown>)[key]) !== 
            JSON.stringify((version2.changes as Record<string, unknown>)[key])
          )
        }
      }

      return comparison
    }),

  // Get current version for a template
  getCurrentVersion: protectedProcedure
    .input(z.object({ templateId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { templateId } = input
      const userId = ctx.session.user.id

      // Verify the template exists and belongs to the user
      const template = await ctx.db.recurringInvoice.findFirst({
        where: {
          id: templateId,
          userId
        },
        include: {
          currentVersion: true
        }
      })

      if (!template) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Template not found'
        })
      }

      return template.currentVersion
    })
})