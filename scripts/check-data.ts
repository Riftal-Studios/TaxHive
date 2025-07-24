import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkData() {
  const user = await prisma.user.findUnique({ 
    where: { email: 'nasiridrishi@outlook.com' } 
  })
  
  if (user) {
    const invoiceCount = await prisma.invoice.count({ 
      where: { userId: user.id } 
    })
    const lastInvoice = await prisma.invoice.findFirst({ 
      where: { userId: user.id }, 
      orderBy: { invoiceNumber: 'desc' } 
    })
    console.log('User ID:', user.id)
    console.log('Invoice count:', invoiceCount)
    console.log('Last invoice number:', lastInvoice?.invoiceNumber)
  } else {
    console.log('User not found')
  }
  
  await prisma.$disconnect()
}

checkData().catch(console.error)