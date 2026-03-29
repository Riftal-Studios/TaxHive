"use client";

import React, { useState } from "react";
import {
  Box,
  Typography,
  Paper,
  Chip,
  CircularProgress,
  Alert,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TablePagination,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from "@mui/material";
import { api } from "@/lib/trpc/client";

const statusColors: Record<string, "default" | "warning" | "success"> = {
  NEW: "warning",
  REVIEWED: "default",
  RESOLVED: "success",
};

export function FeedbackList() {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [statusFilter, setStatusFilter] = useState<string>("");

  const utils = api.useUtils();
  const { data, isLoading, error } = api.admin.getAllFeedback.useQuery({
    page: page + 1,
    limit: rowsPerPage,
    status: (statusFilter || undefined) as "NEW" | "REVIEWED" | "RESOLVED" | undefined,
  });

  const updateStatus = api.admin.updateFeedbackStatus.useMutation({
    onSuccess: () => utils.admin.getAllFeedback.invalidate(),
  });

  if (error) return <Alert severity="error">{error.message}</Alert>;

  return (
    <Box>
      <Typography variant="h4" fontWeight="bold" mb={3}>
        Feedback Management
      </Typography>

      <Paper sx={{ p: 2, mb: 3 }}>
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Filter by Status</InputLabel>
          <Select
            value={statusFilter}
            label="Filter by Status"
            onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="NEW">New</MenuItem>
            <MenuItem value="REVIEWED">Reviewed</MenuItem>
            <MenuItem value="RESOLVED">Resolved</MenuItem>
          </Select>
        </FormControl>
      </Paper>

      <TableContainer component={Paper}>
        {isLoading ? (
          <Box display="flex" justifyContent="center" p={4}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Type</TableCell>
                  <TableCell>Message</TableCell>
                  <TableCell>User</TableCell>
                  <TableCell>Page</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data?.feedback.map((fb) => (
                  <TableRow key={fb.id} hover>
                    <TableCell>
                      <Chip label={fb.type} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell sx={{ maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {fb.message}
                    </TableCell>
                    <TableCell>{fb.user.name || fb.user.email}</TableCell>
                    <TableCell sx={{ maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {fb.pageUrl}
                    </TableCell>
                    <TableCell>
                      <Chip label={fb.status} color={statusColors[fb.status]} size="small" />
                    </TableCell>
                    <TableCell>{new Date(fb.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <FormControl size="small" sx={{ minWidth: 110 }}>
                        <Select
                          value={fb.status}
                          onChange={(e) =>
                            updateStatus.mutate({
                              id: fb.id,
                              status: e.target.value as "NEW" | "REVIEWED" | "RESOLVED",
                            })
                          }
                          size="small"
                        >
                          <MenuItem value="NEW">New</MenuItem>
                          <MenuItem value="REVIEWED">Reviewed</MenuItem>
                          <MenuItem value="RESOLVED">Resolved</MenuItem>
                        </Select>
                      </FormControl>
                    </TableCell>
                  </TableRow>
                ))}
                {data?.feedback.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      <Typography color="text.secondary" py={2}>No feedback found</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <TablePagination
              component="div"
              count={data?.total ?? 0}
              page={page}
              onPageChange={(_, p) => setPage(p)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(e) => {
                setRowsPerPage(parseInt(e.target.value, 10));
                setPage(0);
              }}
            />
          </>
        )}
      </TableContainer>
    </Box>
  );
}
