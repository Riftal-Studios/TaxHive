import { MUIInvoiceDetail } from '@/components/mui/invoice-detail'

export default function InvoicePage({ params }: { params: { id: string } }) {
  return <MUIInvoiceDetail invoiceId={params.id} />
}