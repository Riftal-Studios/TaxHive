"use client";

import React, { useState } from "react";
import {
  Box,
  Typography,
  Paper,
  TextField,
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
  IconButton,
} from "@mui/material";
import { Visibility as ViewIcon } from "@mui/icons-material";
import { useRouter } from "next/navigation";
import { api } from "@/lib/trpc/client";

export function UsersList() {
  const router = useRouter();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [search, setSearch] = useState("");

  const { data, isLoading, error } = api.admin.getAllUsers.useQuery({
    page: page + 1,
    limit: rowsPerPage,
    search: search || undefined,
  });

  if (error) return <Alert severity="error">{error.message}</Alert>;

  return (
    <Box>
      <Typography variant="h4" fontWeight="bold" mb={3}>
        User Management
      </Typography>

      <Paper sx={{ p: 2, mb: 3 }}>
        <TextField
          fullWidth
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          size="small"
        />
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
                  <TableCell>Name</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>GSTIN</TableCell>
                  <TableCell align="right">Invoices</TableCell>
                  <TableCell align="right">Clients</TableCell>
                  <TableCell>Onboarded</TableCell>
                  <TableCell>Joined</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data?.users.map((user) => (
                  <TableRow key={user.id} hover>
                    <TableCell>{user.name || "—"}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Chip
                        label={user.role}
                        color={user.role === "ADMIN" ? "error" : "default"}
                        size="small"
                      />
                    </TableCell>
                    <TableCell sx={{ fontFamily: "monospace", fontSize: "0.85rem" }}>
                      {user.gstin || "—"}
                    </TableCell>
                    <TableCell align="right">{user._count.invoices}</TableCell>
                    <TableCell align="right">{user._count.clients}</TableCell>
                    <TableCell>
                      <Chip
                        label={user.onboardingCompleted ? "Yes" : "No"}
                        color={user.onboardingCompleted ? "success" : "warning"}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      {new Date(user.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => router.push(`/admin/users/${user.id}`)}
                      >
                        <ViewIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
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
