import { MUIInvoiceDetail } from '@/components/mui/invoice-detail'

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <MUIInvoiceDetail invoiceId={id} />
}
