'use client'

import { useState } from 'react'
import { Fab, Tooltip } from '@mui/material'
import { Feedback as FeedbackIcon } from '@mui/icons-material'
import { FeedbackModal } from './FeedbackModal'

export function FeedbackButton() {
  const [open, setOpen] = useState(false)

  const handleOpen = () => {
    setOpen(true)
  }

  const handleClose = () => {
    setOpen(false)
  }

  return (
    <>
      <Tooltip title="Send Feedback" placement="left">
        <Fab
          color="primary"
          aria-label="feedback"
          onClick={handleOpen}
          sx={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 1000,
          }}
        >
          <FeedbackIcon />
        </Fab>
      </Tooltip>

      <FeedbackModal open={open} onClose={handleClose} />
    </>
  )
}
