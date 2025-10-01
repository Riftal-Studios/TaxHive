import { MUILUTManagement } from '@/components/mui/lut-management'
import { Box, Typography } from '@mui/material'

export default function LUTsPage() {
  return (
    <Box>
      <Box mb={4}>
        <Typography variant="h4" component="h1" fontWeight={600} gutterBottom>
          LUT Management
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage your Letter of Undertaking for zero-rated exports
        </Typography>
      </Box>
      <MUILUTManagement />
    </Box>
  )
}