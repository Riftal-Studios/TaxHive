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
  Button,
  Grid,
} from "@mui/material";
import { ArrowBack as BackIcon } from "@mui/icons-material";
import { useRouter } from "next/navigation";
import { api } from "@/lib/trpc/client";

const formatINR = (amount: number) =>
  amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const statusColors: Record<string, "default" | "primary" | "success" | "error" | "warning"> = {
  DRAFT: "default",
  POSTED: "success",
  REVERSED: "warning",
  VOID: "error",
};

export function JournalEntryDetail({ id }: { id: string }) {
  const router = useRouter();
  const { data: entry, isLoading, error } = api.journalEntries.getById.useQuery({ id });
  const postMutation = api.journalEntries.post.useMutation();
  const utils = api.useUtils();

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) return <Alert severity="error">{error.message}</Alert>;
  if (!entry) return null;

  const totalDebit = entry.lines.reduce((sum: number, line: Record<string, unknown>) => sum + Number(line.debitAmount), 0);
  const totalCredit = entry.lines.reduce((sum: number, line: Record<string, unknown>) => sum + Number(line.creditAmount), 0);

  const handlePost = async () => {
    await postMutation.mutateAsync({ id });
    utils.journalEntries.getById.invalidate({ id });
  };

  return (
    <Box>
      <Button startIcon={<BackIcon />} onClick={() => router.push("/accounting/journal-entries")} sx={{ mb: 2 }}>
        Back to Journal Entries
      </Button>

      <Box sx={{ mb: 3, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <Box>
          <Typography variant="h4" fontWeight={700}>{entry.entryNumber}</Typography>
          <Typography variant="body2" color="text.secondary">
            {entry.entryType.replace(/_/g, " ")} | {new Date(entry.entryDate).toLocaleDateString("en-IN")}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          <Chip
            label={entry.status}
            color={statusColors[entry.status] || "default"}
          />
          {entry.status === "DRAFT" && (
            <Button
              variant="contained"
              size="small"
              onClick={handlePost}
              disabled={postMutation.isPending}
            >
              Post Entry
            </Button>
          )}
        </Box>
      </Box>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="body2" color="text.secondary">Description</Typography>
            <Typography>{entry.description}</Typography>
            {entry.notes && (
              <>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Notes</Typography>
                <Typography>{entry.notes}</Typography>
              </>
            )}
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 2 }}>
            <Grid container spacing={1}>
              <Grid size={{ xs: 6 }}>
                <Typography variant="body2" color="text.secondary">Fiscal Period</Typography>
                <Typography>{entry.fiscalPeriod}</Typography>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <Typography variant="body2" color="text.secondary">Fiscal Year</Typography>
                <Typography>{entry.fiscalYear}</Typography>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <Typography variant="body2" color="text.secondary">Source</Typography>
                <Typography>{entry.sourceType || "Manual"}{entry.sourceId ? ` (${entry.sourceId.slice(0, 8)}...)` : ""}</Typography>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <Typography variant="body2" color="text.secondary">Posted At</Typography>
                <Typography>{entry.postedAt ? new Date(entry.postedAt).toLocaleString("en-IN") : "Not posted"}</Typography>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
      </Grid>

      {entry.reversalOf && (
        <Alert severity="info" sx={{ mb: 2 }}>
          This entry reverses: {entry.reversalOf.entryNumber}
        </Alert>
      )}

      {entry.reversals && entry.reversals.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Reversed by: {entry.reversals.map((r: Record<string, unknown>) => r.entryNumber as string).join(", ")}
        </Alert>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Account Code</TableCell>
              <TableCell>Account Name</TableCell>
              <TableCell>Description</TableCell>
              <TableCell align="right">Debit</TableCell>
              <TableCell align="right">Credit</TableCell>
              <TableCell>Currency</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {entry.lines.map((line: Record<string, unknown> & { id: string; account: { accountCode: string; accountName: string } }) => (
              <TableRow key={line.id}>
                <TableCell sx={{ fontFamily: "monospace" }}>{line.account.accountCode}</TableCell>
                <TableCell>{line.account.accountName}</TableCell>
                <TableCell sx={{ maxWidth: 250 }}>{line.description}</TableCell>
                <TableCell align="right" sx={{ fontFamily: "monospace", color: Number(line.debitAmount) > 0 ? "primary.main" : undefined }}>
                  {Number(line.debitAmount) > 0 ? formatINR(Number(line.debitAmount)) : ""}
                </TableCell>
                <TableCell align="right" sx={{ fontFamily: "monospace", color: Number(line.creditAmount) > 0 ? "error.main" : undefined }}>
                  {Number(line.creditAmount) > 0 ? formatINR(Number(line.creditAmount)) : ""}
                </TableCell>
                <TableCell>
                  {line.currency && (
                    <Typography variant="body2" color="text.secondary">
                      {line.currency}
                      {line.foreignDebit && Number(line.foreignDebit) > 0 && ` ${Number(line.foreignDebit).toFixed(2)} DR`}
                      {line.foreignCredit && Number(line.foreignCredit) > 0 && ` ${Number(line.foreignCredit).toFixed(2)} CR`}
                      {line.exchangeRate && ` @${Number(line.exchangeRate).toFixed(2)}`}
                    </Typography>
                  )}
                </TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell colSpan={3} sx={{ fontWeight: 700 }}>TOTALS</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700, fontFamily: "monospace" }}>
                {formatINR(totalDebit)}
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 700, fontFamily: "monospace" }}>
                {formatINR(totalCredit)}
              </TableCell>
              <TableCell>
                <Chip
                  label={Math.abs(totalDebit - totalCredit) < 0.01 ? "Balanced" : "Unbalanced"}
                  size="small"
                  color={Math.abs(totalDebit - totalCredit) < 0.01 ? "success" : "error"}
                />
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
