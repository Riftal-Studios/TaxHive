import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixBalanceDue() {
  try {
    console.log('🔧 Fixing balance due for all invoices...')
    
    // Get all invoices
    const invoices = await prisma.invoice.findMany({
      include: {
        payments: true,
      }
    })
    
    console.log(`Found ${invoices.length} invoices to check`)
    
    let fixedCount = 0
    
    for (const invoice of invoices) {
      // Calculate total amount paid
      const totalPaid = invoice.payments.reduce((sum, payment) => {
        return sum + Number(payment.amount)
      }, 0)
      
      // Calculate what balance due should be
      const correctBalanceDue = Number(invoice.totalAmount) - totalPaid
      
      // Check if it needs fixing
      if (Number(invoice.balanceDue) !== correctBalanceDue) {
        console.log(`\n📄 Invoice ${invoice.invoiceNumber}:`)
        console.log(`   Total Amount: ${invoice.currency} ${Number(invoice.totalAmount)}`)
        console.log(`   Amount Paid: ${invoice.currency} ${totalPaid}`)
        console.log(`   Current Balance Due: ${invoice.currency} ${Number(invoice.balanceDue)}`)
        console.log(`   Correct Balance Due: ${invoice.currency} ${correctBalanceDue}`)
        
        // Determine payment status
        let paymentStatus: string
        if (correctBalanceDue === 0) {
          paymentStatus = 'PAID'
        } else if (totalPaid > 0) {
          paymentStatus = 'PARTIALLY_PAID'
        } else {
          paymentStatus = 'UNPAID'
        }
        
        // Update the invoice
        await prisma.invoice.update({
          where: { id: invoice.id },
          data: {
            amountPaid: totalPaid,
            balanceDue: correctBalanceDue,
            paymentStatus,
          }
        })
        
        console.log(`   ✅ Fixed!`)
        fixedCount++
      }
    }
    
    console.log(`\n✨ Fixed ${fixedCount} invoices`)
    
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

fixBalanceDue()