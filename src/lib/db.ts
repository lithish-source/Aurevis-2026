import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Self-healing singleton: if the cached client predates the latest
// `prisma db push` (e.g. a new model like SocialPost was added while the dev
// server was running), drop it and build a fresh one from the regenerated
// client in node_modules.
function createDb(): PrismaClient {
  const cached = globalForPrisma.prisma
  if (cached) {
    const hasLatestModel = typeof (cached as { socialPost?: unknown }).socialPost === 'object'
    if (hasLatestModel) return cached
    cached.$disconnect().catch(() => undefined)
  }
  const fresh = new PrismaClient({
    log: ['query'],
  })
  if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = fresh
  return fresh
}

export const db = createDb()
