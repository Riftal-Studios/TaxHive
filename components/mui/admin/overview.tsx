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
  CircularProgress,
  Alert,
} from "@mui/material";
import {
  People as UsersIcon,
  Receipt as InvoiceIcon,
  Business as ClientsIcon,
  Feedback as FeedbackIcon,
  AttachMoney as RevenueIcon,
  PersonAdd as NewUsersIcon,
} from "@mui/icons-material";
import { useRouter } from "next/navigation";
import { api } from "@/lib/trpc/client";

export function AdminOverview() {
  const router = useRouter();
  const { data: userStats, isLoading: loadingUsers } = api.admin.getUserStats.useQuery();
  const { data: metrics, isLoading: loadingMetrics } = api.admin.getSystemMetrics.useQuery();

  if (loadingUsers || loadingMetrics) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  const statCards = [
    { title: "Total Users", value: userStats?.totalUsers ?? 0, icon: <UsersIcon />, href: "/admin/users" },
    { title: "Active Users", value: userStats?.activeUsers ?? 0, icon: <UsersIcon color="success" /> },
    { title: "New (30 days)", value: userStats?.newUsersThisMonth ?? 0, icon: <NewUsersIcon color="primary" /> },
    { title: "Total Invoices", value: metrics?.totalInvoices ?? 0, icon: <InvoiceIcon /> },
    { title: "Total Clients", value: metrics?.totalClients ?? 0, icon: <ClientsIcon /> },
    {
      title: "Total Revenue",
      value: `₹${((metrics?.totalRevenue ?? 0) / 100000).toFixed(1)}L`,
      icon: <RevenueIcon color="success" />,
    },
    { title: "Total Feedback", value: metrics?.totalFeedback ?? 0, icon: <FeedbackIcon />, href: "/admin/feedback" },
    { title: "Pending Feedback", value: metrics?.pendingFeedback ?? 0, icon: <FeedbackIcon color="warning" />, href: "/admin/feedback" },
  ];

  return (
    <Box>
      <Typography variant="h4" fontWeight="bold" mb={3}>
        Admin Dashboard
      </Typography>

      {(userStats?.adminCount ?? 0) <= 1 && (
        <Alert severity="info" sx={{ mb: 3 }}>
          You are the only admin user.
        </Alert>
      )}

      <Grid container spacing={3}>
        {statCards.map((card) => (
          <Grid size={{ xs: 12, sm: 6, md: 3 }} key={card.title}>
            <Card>
              <CardActionArea
                onClick={() => card.href && router.push(card.href)}
                disabled={!card.href}
              >
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    {card.icon}
                    <Typography variant="h4" fontWeight="bold">
                      {card.value}
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary" mt={1}>
                    {card.title}
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3} mt={1}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" mb={2}>Quick Actions</Typography>
            <CardActionArea onClick={() => router.push("/admin/users")} sx={{ p: 2, mb: 1, borderRadius: 1 }}>
              <Typography>Manage Users</Typography>
            </CardActionArea>
            <CardActionArea onClick={() => router.push("/admin/feedback")} sx={{ p: 2, borderRadius: 1 }}>
              <Typography>Review Feedback ({metrics?.pendingFeedback ?? 0} pending)</Typography>
            </CardActionArea>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
