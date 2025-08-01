import { Tooltip, Box, styled } from '@mui/material'
import { Lock as LockIcon, LockOpen as LockOpenIcon } from '@mui/icons-material'

const DarkModeTooltip = styled(({ className, ...props }: { className?: string } & React.ComponentProps<typeof Tooltip>) => (
  <Tooltip {...props} classes={{ popper: className }} />
))(({ theme }) => ({
  [`& .MuiTooltip-tooltip`]: {
    backgroundColor: theme.palette.mode === 'dark' ? theme.palette.grey[800] : theme.palette.grey[700],
    color: theme.palette.mode === 'dark' ? theme.palette.grey[100] : theme.palette.common.white,
    boxShadow: theme.shadows[1],
    fontSize: '0.875rem',
  },
  [`& .MuiTooltip-arrow`]: {
    color: theme.palette.mode === 'dark' ? theme.palette.grey[800] : theme.palette.grey[700],
  },
}))

interface PasswordStrengthMeterProps {
  password: string
  confirmPassword?: string
  isConfirmField?: boolean
}

interface PasswordRequirement {
  label: string
  test: (password: string) => boolean
}

const requirements: PasswordRequirement[] = [
  {
    label: 'At least 8 characters',
    test: (password) => password.length >= 8,
  },
  {
    label: 'One uppercase letter',
    test: (password) => /[A-Z]/.test(password),
  },
  {
    label: 'One lowercase letter',
    test: (password) => /[a-z]/.test(password),
  },
  {
    label: 'One number',
    test: (password) => /[0-9]/.test(password),
  },
  {
    label: 'One special character',
    test: (password) => /[!@#$%^&*(),.?":{}|<>\-_+=\[\]\/\\]/.test(password),
  },
]

export function PasswordStrengthIcon({ password, confirmPassword, isConfirmField }: PasswordStrengthMeterProps) {
  if (isConfirmField) {
    // For confirm password field, check if passwords match
    const matches = password && confirmPassword && password === confirmPassword
    const color = !confirmPassword ? 'action' : matches ? 'success' : 'error'
    const Icon = matches ? LockIcon : LockOpenIcon
    
    return (
      <DarkModeTooltip 
        title={!confirmPassword ? 'Enter password confirmation' : matches ? 'Passwords match' : 'Passwords do not match'}
        arrow
        placement="top"
      >
        <Icon color={color} />
      </DarkModeTooltip>
    )
  }
  
  // For main password field, check requirements
  if (!password) {
    return <LockOpenIcon color="action" />
  }
  
  const failedRequirements = requirements.filter((req) => !req.test(password))
  const allPassed = failedRequirements.length === 0
  const color = allPassed ? 'success' : 'error'
  const Icon = allPassed ? LockIcon : LockOpenIcon
  
  const tooltipContent = allPassed ? (
    'Password meets all requirements'
  ) : (
    <Box>
      <Box sx={{ fontWeight: 'bold', mb: 0.5 }}>Requirements not met:</Box>
      {failedRequirements.map((req, index) => (
        <Box key={index} sx={{ opacity: 0.9 }}>• {req.label}</Box>
      ))}
    </Box>
  )
  
  return (
    <DarkModeTooltip 
      title={tooltipContent}
      arrow
      placement="top"
    >
      <Icon color={color} />
    </DarkModeTooltip>
  )
}

// Keep this for backward compatibility
export default function PasswordStrengthMeter() {
  return null
}