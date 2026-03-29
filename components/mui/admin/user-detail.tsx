"use client";

import React from "react";
import {
  Box,
  Typography,
  Paper,
  Grid,
  Chip,
  CircularProgress,
  Alert,
  Button,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
} from "@mui/material";
import { ArrowBack as BackIcon } from "@mui/icons-material";
import { useRouter } from "next/navigation";
import { api } from "@/lib/trpc/client";

export function UserDetail({ id }: { id: string }) {
  const router = useRouter();
  const { data: user, isLoading, error } = api.admin.getUserById.useQuery({ id });

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) return <Alert severity="error">{error.message}</Alert>;
  if (!user) return <Alert severity="warning">User not found</Alert>;

  const infoFields = [
    { label: "Email", value: user.email },
    { label: "Name", value: user.name || "—" },
    { label: "Role", value: user.role },
    { label: "GSTIN", value: user.gstin || "—" },
    { label: "PAN", value: user.pan || "—" },
    { label: "Address", value: user.address || "—" },
    { label: "Onboarding", value: user.onboardingCompleted ? `Complete` : `Step: ${user.onboardingStep || "not started"}` },
    { label: "Joined", value: new Date(user.createdAt).toLocaleDateString() },
    { label: "Updated", value: new Date(user.updatedAt).toLocaleDateString() },
  ];

  return (
    <Box>
      <Button startIcon={<BackIcon />} onClick={() => router.push("/admin/users")} sx={{ mb: 2 }}>
        Back to Users
      </Button>

      <Typography variant="h4" fontWeight="bold" mb={3}>
        {user.name || user.email}
        <Chip label={user.role} color={user.role === "ADMIN" ? "error" : "default"} size="small" sx={{ ml: 2 }} />
      </Typography>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" mb={2}>User Information</Typography>
            {infoFields.map((field) => (
              <Box key={field.label} display="flex" justifyContent="space-between" py={0.5} borderBottom="1px solid" borderColor="divider">
                <Typography variant="body2" color="text.secondary">{field.label}</Typography>
                <Typography variant="body2">{field.value}</Typography>
              </Box>
            ))}
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" mb={2}>Statistics</Typography>
            <Grid container spacing={2}>
              {[
                { label: "Invoices", value: user._count.invoices },
                { label: "Clients", value: user._count.clients },
                { label: "Feedback", value: user._count.feedback },
                { label: "LUTs", value: user._count.luts },
                { label: "Vouchers", value: user._count.paymentVouchers },
              ].map((stat) => (
                <Grid size={{ xs: 6 }} key={stat.label}>
                  <Typography variant="h5" fontWeight="bold">{stat.value}</Typography>
                  <Typography variant="body2" color="text.secondary">{stat.label}</Typography>
                </Grid>
              ))}
            </Grid>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12 }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" mb={2}>Recent Invoices</Typography>
            {user.recentInvoices.length === 0 ? (
              <Typography color="text.secondary">No invoices yet</Typography>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Invoice #</TableCell>
                      <TableCell align="right">Amount (INR)</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Date</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {user.recentInvoices.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell sx={{ fontFamily: "monospace" }}>{inv.invoiceNumber}</TableCell>
                        <TableCell align="right">₹{Number(inv.totalAmount).toLocaleString()}</TableCell>
                        <TableCell><Chip label={inv.status} size="small" /></TableCell>
                        <TableCell>{new Date(inv.createdAt).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
