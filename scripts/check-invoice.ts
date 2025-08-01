import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkInvoice() {
  const invoiceId = 'cmdrbnji6000ballws3akfbgt'
  
  try {
    // Check if invoice exists at all
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          }
        }
      }
    })
    
    if (!invoice) {
      console.log('❌ Invoice not found in database')
    } else {
      console.log('✅ Invoice found:')
      console.log('   Invoice ID:', invoice.id)
      console.log('   Invoice Number:', invoice.invoiceNumber)
      console.log('   Owner User ID:', invoice.userId)
      console.log('   Owner Email:', invoice.user.email)
      console.log('   Created:', invoice.createdAt)
    }
    
    // Also check who is trying to access it
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
      }
    })
    
    console.log('\n📋 All users in system:')
    users.forEach(user => {
      console.log(`   - ${user.email} (ID: ${user.id})`)
    })
    
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkInvoice()