'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import {
  Box,
  Typography,
  Button,
  Breadcrumbs,
  Link,
  Paper,
  Grid,
  Alert,
  Stack,
} from '@mui/material'
import {
  ArrowBack as BackIcon,
  Info as InfoIcon,
} from '@mui/icons-material'
import NextLink from 'next/link'
import { GSTR2BUploadForm } from '@/components/itc'

export default function UploadGSTR2BPage() {
  const router = useRouter()

  const handleUploadSuccess = (_uploadId: string, _entriesCount: number) => {
    // Navigate to the period view after successful upload
    // We need to get the period from the upload - for now redirect to main page
    router.push('/itc-reconciliation')
  }

  return (
    <Box>
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link component={NextLink} href="/itc-reconciliation" underline="hover" color="inherit">
          ITC Reconciliation
        </Link>
        <Typography color="text.primary">Upload GSTR-2B</Typography>
      </Breadcrumbs>

      <Stack direction="row" alignItems="center" spacing={2} mb={3}>
        <Button
          startIcon={<BackIcon />}
          onClick={() => router.back()}
          variant="text"
        >
          Back
        </Button>
        <Box>
          <Typography variant="h4" fontWeight="bold">
            Upload GSTR-2B
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Upload your GSTR-2B JSON file downloaded from GST Portal
          </Typography>
        </Box>
      </Stack>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 8 }}>
          <GSTR2BUploadForm onUploadSuccess={handleUploadSuccess} />
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              <InfoIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
              How to Download GSTR-2B
            </Typography>
            <Box component="ol" sx={{ pl: 2, '& li': { mb: 1.5 } }}>
              <li>
                <Typography variant="body2">
                  Login to <strong>GST Portal</strong> (gst.gov.in)
                </Typography>
              </li>
              <li>
                <Typography variant="body2">
                  Go to <strong>Services → Returns → GSTR-2B</strong>
                </Typography>
              </li>
              <li>
                <Typography variant="body2">
                  Select the <strong>Return Period</strong> (month/year)
                </Typography>
              </li>
              <li>
                <Typography variant="body2">
                  Click <strong>Download</strong> and select <strong>JSON</strong> format
                </Typography>
              </li>
              <li>
                <Typography variant="body2">
                  Upload the downloaded file here
                </Typography>
              </li>
            </Box>

            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="body2">
                GSTR-2B is auto-populated by the GST system based on your suppliers&apos; filed returns.
                It shows ITC available for the period.
              </Typography>
            </Alert>
          </Paper>

          <Paper sx={{ p: 3, mt: 2 }}>
            <Typography variant="subtitle2" color="primary" gutterBottom>
              Supported Sections
            </Typography>
            <Stack spacing={1}>
              <Typography variant="body2">
                <strong>B2B</strong> - Invoices from registered suppliers
              </Typography>
              <Typography variant="body2">
                <strong>B2BA</strong> - Amended B2B invoices
              </Typography>
              <Typography variant="body2">
                <strong>CDNR</strong> - Credit/Debit notes
              </Typography>
              <Typography variant="body2">
                <strong>CDNRA</strong> - Amended credit/debit notes
              </Typography>
              <Typography variant="body2">
                <strong>IMPG</strong> - Import of goods
              </Typography>
              <Typography variant="body2">
                <strong>IMPGSEZ</strong> - Import from SEZ
              </Typography>
            </Stack>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  )
}
