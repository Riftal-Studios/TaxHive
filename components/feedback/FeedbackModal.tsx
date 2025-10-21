"use client";

import { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  Button,
  FormControl,
  InputLabel,
  Box,
  Alert,
  CircularProgress,
  ListItemIcon,
  ListItemText,
} from "@mui/material";
import {
  BugReport as BugIcon,
  Lightbulb as LightbulbIcon,
  Help as HelpIcon,
  Chat as ChatIcon,
} from "@mui/icons-material";
import { api } from "@/lib/trpc/client";

interface FeedbackModalProps {
  open: boolean;
  onClose: () => void;
}

type FeedbackType = "BUG" | "FEATURE" | "QUESTION" | "OTHER";

export function FeedbackModal({ open, onClose }: FeedbackModalProps) {
  const [type, setType] = useState<FeedbackType>("FEATURE");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const createFeedback = api.feedback.create.useMutation({
    onSuccess: () => {
      setSuccess(true);
      setMessage("");
      setType("FEATURE");

      // Close modal after 2 seconds
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 2000);
    },
    onError: (err) => {
      setError(err.message || "Failed to send feedback. Please try again.");
    },
  });

  const handleSubmit = async () => {
    setError(null);

    if (message.length < 10) {
      setError("Message must be at least 10 characters long.");
      return;
    }

    if (message.length > 2000) {
      setError("Message must not exceed 2000 characters.");
      return;
    }

    try {
      await createFeedback.mutateAsync({
        type,
        message,
        pageUrl: typeof window !== "undefined" ? window.location.href : "",
        userAgent:
          typeof window !== "undefined" ? navigator.userAgent : undefined,
      });
    } catch {
      // Error already handled in onError callback
    }
  };

  const handleClose = () => {
    if (!createFeedback.isPending) {
      setMessage("");
      setType("FEATURE");
      setError(null);
      setSuccess(false);
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Send Feedback</DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2, display: "flex", flexDirection: "column", gap: 3 }}>
          {success && (
            <Alert severity="success">
              Thank you for your feedback! We appreciate your input.
            </Alert>
          )}

          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          <FormControl fullWidth>
            <InputLabel id="feedback-type-label">Type</InputLabel>
            <Select
              labelId="feedback-type-label"
              id="feedback-type"
              value={type}
              label="Type"
              onChange={(e) => setType(e.target.value as FeedbackType)}
              disabled={createFeedback.isPending || success}
            >
              <MenuItem value="BUG">
                <ListItemIcon>
                  <BugIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Report a Bug</ListItemText>
              </MenuItem>
              <MenuItem value="FEATURE">
                <ListItemIcon>
                  <LightbulbIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Request a Feature</ListItemText>
              </MenuItem>
              <MenuItem value="QUESTION">
                <ListItemIcon>
                  <HelpIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Ask a Question</ListItemText>
              </MenuItem>
              <MenuItem value="OTHER">
                <ListItemIcon>
                  <ChatIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Other</ListItemText>
              </MenuItem>
            </Select>
          </FormControl>

          <TextField
            multiline
            rows={6}
            fullWidth
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Tell us what's on your mind..."
            label="Message"
            disabled={createFeedback.isPending || success}
            helperText={`${message.length}/2000 characters (minimum 10)`}
            error={message.length > 0 && message.length < 10}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={createFeedback.isPending}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={
            message.length < 10 ||
            message.length > 2000 ||
            createFeedback.isPending ||
            success
          }
          startIcon={
            createFeedback.isPending ? <CircularProgress size={20} /> : null
          }
        >
          {createFeedback.isPending ? "Sending..." : "Send"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
