"use client";

import React from "react";
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  CardActionArea,
  Chip,
  Alert,
  Button,
  CircularProgress,
} from "@mui/material";
import {
  AccountBalance as LedgerIcon,
  Receipt as JournalIcon,
  AccountTree as ChartIcon,
  TrendingUp as PLIcon,
  Balance as BalanceIcon,
} from "@mui/icons-material";
import { useRouter } from "next/navigation";
import { api } from "@/lib/trpc/client";

const accountingCards = [
  {
    title: "Trial Balance",
    description: "View debit and credit totals for all accounts",
    icon: <LedgerIcon fontSize="large" />,
    href: "/accounting/trial-balance",
    color: "#1976d2",
  },
  {
    title: "Profit & Loss",
    description: "Revenue and expenses for a period",
    icon: <PLIcon fontSize="large" />,
    href: "/accounting/profit-loss",
    color: "#2e7d32",
  },
  {
    title: "Balance Sheet",
    description: "Assets, liabilities, and equity snapshot",
    icon: <BalanceIcon fontSize="large" />,
    href: "/accounting/balance-sheet",
    color: "#ed6c02",
  },
  {
    title: "Journal Entries",
    description: "View all accounting transactions",
    icon: <JournalIcon fontSize="large" />,
    href: "/accounting/journal-entries",
    color: "#9c27b0",
  },
  {
    title: "Chart of Accounts",
    description: "Manage your GL accounts",
    icon: <ChartIcon fontSize="large" />,
    href: "/accounting/chart-of-accounts",
    color: "#0288d1",
  },
];

export function AccountingOverview() {
  const router = useRouter();
  const trialBalance = api.accounting.getTrialBalance.useQuery(undefined, {
    retry: false,
  });
  const periods = api.accounting.getPeriods.useQuery(undefined, {
    retry: false,
  });
  const initAccounts = api.glAccounts.initializeDefaults.useMutation();

  const handleInitialize = async () => {
    await initAccounts.mutateAsync();
    trialBalance.refetch();
  };

  const hasNoAccounts = trialBalance.error?.message?.includes("not found");

  return (
    <Box>
      <Box sx={{ mb: 3, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            Accounting
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Double-entry general ledger and financial reports
          </Typography>
        </Box>
      </Box>

      {hasNoAccounts && (
        <Alert
          severity="info"
          sx={{ mb: 3 }}
          action={
            <Button
              color="inherit"
              size="small"
              onClick={handleInitialize}
              disabled={initAccounts.isPending}
            >
              {initAccounts.isPending ? "Initializing..." : "Initialize Accounts"}
            </Button>
          }
        >
          Chart of accounts not found. Initialize default accounts to get started.
        </Alert>
      )}

      {initAccounts.isSuccess && (
        <Alert severity="success" sx={{ mb: 3 }}>
          Chart of accounts initialized successfully!
        </Alert>
      )}

      <Grid container spacing={3} sx={{ mb: 4 }}>
        {accountingCards.map((card) => (
          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={card.title}>
            <Card elevation={2}>
              <CardActionArea onClick={() => router.push(card.href)}>
                <CardContent sx={{ textAlign: "center", py: 4 }}>
                  <Box sx={{ color: card.color, mb: 2 }}>{card.icon}</Box>
                  <Typography variant="h6" fontWeight={600} gutterBottom>
                    {card.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {card.description}
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Quick Summary */}
      {trialBalance.data && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" fontWeight={600} gutterBottom>
            Trial Balance Summary
          </Typography>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Typography variant="body2" color="text.secondary">Total Debits</Typography>
              <Typography variant="h5" fontWeight={600}>
                {trialBalance.data.totalDebits.toLocaleString("en-IN", { style: "currency", currency: "INR" })}
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Typography variant="body2" color="text.secondary">Total Credits</Typography>
              <Typography variant="h5" fontWeight={600}>
                {trialBalance.data.totalCredits.toLocaleString("en-IN", { style: "currency", currency: "INR" })}
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Typography variant="body2" color="text.secondary">Status</Typography>
              <Chip
                label={trialBalance.data.isBalanced ? "Balanced" : "Unbalanced"}
                color={trialBalance.data.isBalanced ? "success" : "error"}
                sx={{ mt: 0.5 }}
              />
            </Grid>
          </Grid>
        </Paper>
      )}

      {trialBalance.isLoading && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {/* Period Status */}
      {periods.data && periods.data.length > 0 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" fontWeight={600} gutterBottom>
            Accounting Periods
          </Typography>
          <Grid container spacing={1}>
            {periods.data.slice(0, 6).map((period: { id: string; period: string; status: string }) => (
              <Grid size={{ xs: 6, sm: 4, md: 2 }} key={period.id}>
                <Paper variant="outlined" sx={{ p: 1.5, textAlign: "center" }}>
                  <Typography variant="body2" fontWeight={600}>{period.period}</Typography>
                  <Chip
                    label={period.status}
                    size="small"
                    color={
                      period.status === "CLOSED" ? "success" :
                      period.status === "OPEN" ? "primary" : "default"
                    }
                    sx={{ mt: 0.5 }}
                  />
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Paper>
      )}
    </Box>
  );
}
