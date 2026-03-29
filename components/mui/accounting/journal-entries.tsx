"use client";

import React from "react";
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
} from "@mui/material";
import { Visibility as ViewIcon } from "@mui/icons-material";
import { useRouter } from "next/navigation";
import { api } from "@/lib/trpc/client";

const statusColors: Record<string, "default" | "primary" | "success" | "error" | "warning"> = {
  DRAFT: "default",
  POSTED: "success",
  REVERSED: "warning",
  VOID: "error",
};

const formatINR = (amount: number) =>
  amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function JournalEntries() {
  const router = useRouter();
  const { data, isLoading, error } = api.journalEntries.list.useQuery();

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) return <Alert severity="error">{error.message}</Alert>;

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} sx={{ mb: 3 }}>Journal Entries</Typography>

      {data?.entries.length === 0 && (
        <Alert severity="info">No journal entries found. They will appear here when invoices and payments are recorded with the ledger enabled.</Alert>
      )}

      {data && data.entries.length > 0 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Entry #</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Lines</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Total Debit</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {data.entries.map((entry: Record<string, unknown> & { id: string; lines: Array<Record<string, unknown>> }) => {
                const totalDebit = entry.lines.reduce(
                  (sum: number, line: Record<string, unknown>) => sum + Number(line.debitAmount), 0
                );
                return (
                  <TableRow key={entry.id} hover>
                    <TableCell sx={{ fontFamily: "monospace", fontSize: "0.85rem" }}>
                      {entry.entryNumber}
                    </TableCell>
                    <TableCell>
                      {new Date(entry.entryDate).toLocaleDateString("en-IN")}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={entry.entryType.replace(/_/g, " ")}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell sx={{ maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {entry.description}
                    </TableCell>
                    <TableCell>{entry._count.lines}</TableCell>
                    <TableCell>
                      <Chip
                        label={entry.status}
                        size="small"
                        color={statusColors[entry.status] || "default"}
                      />
                    </TableCell>
                    <TableCell align="right" sx={{ fontFamily: "monospace" }}>
                      {formatINR(totalDebit)}
                    </TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => router.push(`/accounting/journal-entries/${entry.id}`)}
                      >
                        <ViewIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
