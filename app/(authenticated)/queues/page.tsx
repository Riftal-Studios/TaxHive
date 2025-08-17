'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/trpc/client'
import {
  Box,
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Button,
  Chip,
  LinearProgress,
  Alert,
  Tab,
  Tabs,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material'
import {
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Refresh as RefreshIcon,
  Delete as DeleteIcon,
  Replay as RetryIcon,
  Schedule as ScheduleIcon,
  Email as EmailIcon,
  PictureAsPdf as PdfIcon,
  AttachMoney as MoneyIcon,
  Receipt as ReceiptIcon,
  Warning as WarningIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  HourglassEmpty as WaitingIcon,
  CloudDownload as CloudDownloadIcon,
} from '@mui/icons-material'
import { format } from 'date-fns'

interface QueueMetrics {
  name: string
  waiting: number
  active: number
  completed: number
  failed: number
  delayed: number
  paused: number
}

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <div hidden={value !== index}>
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  )
}

export default function QueuesPage() {
  const [tabValue, setTabValue] = useState(0)
  const [metrics, setMetrics] = useState<QueueMetrics[]>([])
  const [selectedQueue, setSelectedQueue] = useState<string>('')
  const [testJobDialogOpen, setTestJobDialogOpen] = useState(false)
  const [testJobType, setTestJobType] = useState('')
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null)
  
  const { data: queueMetrics, refetch: refetchMetrics } = api.queues.getMetrics.useQuery()
  const { data: queueJobs } = api.queues.getJobs.useQuery(
    { queueName: selectedQueue },
    { enabled: !!selectedQueue }
  )
  
  const pauseQueueMutation = api.queues.pauseQueue.useMutation({
    onSuccess: () => refetchMetrics(),
  })
  
  const resumeQueueMutation = api.queues.resumeQueue.useMutation({
    onSuccess: () => refetchMetrics(),
  })
  
  const cleanQueueMutation = api.queues.cleanQueue.useMutation({
    onSuccess: () => refetchMetrics(),
  })
  
  const addTestJobMutation = api.queues.addTestJob.useMutation({
    onSuccess: () => {
      setTestJobDialogOpen(false)
      refetchMetrics()
    },
  })
  
  useEffect(() => {
    if (queueMetrics) {
      setMetrics(queueMetrics)
    }
  }, [queueMetrics])
  
  useEffect(() => {
    // Auto-refresh every 5 seconds
    const interval = setInterval(() => {
      refetchMetrics()
    }, 5000)
    setRefreshInterval(interval)
    
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [refetchMetrics])
  
  const getQueueIcon = (queueName: string) => {
    if (queueName.includes('pdf')) return <PdfIcon />
    if (queueName.includes('email')) return <EmailIcon />
    if (queueName.includes('exchange')) return <MoneyIcon />
    if (queueName.includes('invoice')) return <ReceiptIcon />
    if (queueName.includes('gst')) return <ReceiptIcon />
    return <ScheduleIcon />
  }
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'success'
      case 'failed': return 'error'
      case 'active': return 'info'
      case 'waiting': return 'warning'
      case 'delayed': return 'default'
      case 'paused': return 'secondary'
      default: return 'default'
    }
  }
  
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <SuccessIcon fontSize="small" />
      case 'failed': return <ErrorIcon fontSize="small" />
      case 'active': return <PlayIcon fontSize="small" />
      case 'waiting': return <WaitingIcon fontSize="small" />
      case 'delayed': return <ScheduleIcon fontSize="small" />
      case 'paused': return <PauseIcon fontSize="small" />
      default: return null
    }
  }
  
  const handlePauseQueue = (queueName: string) => {
    pauseQueueMutation.mutate({ queueName })
  }
  
  const handleResumeQueue = (queueName: string) => {
    resumeQueueMutation.mutate({ queueName })
  }
  
  const handleCleanQueue = (queueName: string, status: 'completed' | 'failed') => {
    cleanQueueMutation.mutate({ queueName, status })
  }
  
  const handleAddTestJob = () => {
    if (!testJobType) return
    
    const testJobData: any = {}
    
    switch (testJobType) {
      case 'pdf-generation':
        testJobData.type = 'pdf'
        testJobData.data = {
          type: 'invoice',
          entityId: 'test-invoice-id',
          userId: 'test-user-id',
        }
        break
      case 'email-notification':
        testJobData.type = 'email'
        testJobData.data = {
          type: 'welcome',
          to: 'test@example.com',
          userId: 'test-user-id',
        }
        break
      case 'exchange-rates':
        testJobData.type = 'exchange'
        testJobData.data = {
          source: 'RBI',
        }
        break
      default:
        return
    }
    
    addTestJobMutation.mutate(testJobData)
  }
  
  const totalJobs = metrics.reduce((sum, m) => 
    sum + m.waiting + m.active + m.completed + m.failed + m.delayed, 0
  )
  
  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 4 }}>
        {/* Page Header */}
        <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              Queue Management
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Monitor and manage background job queues
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={() => refetchMetrics()}
            >
              Refresh
            </Button>
            <Button
              variant="contained"
              startIcon={<PlayIcon />}
              onClick={() => setTestJobDialogOpen(true)}
            >
              Add Test Job
            </Button>
          </Box>
        </Box>
        
        {/* Summary Cards */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Total Jobs
                </Typography>
                <Typography variant="h4">
                  {totalJobs.toLocaleString()}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Active Jobs
                </Typography>
                <Typography variant="h4" color="info.main">
                  {metrics.reduce((sum, m) => sum + m.active, 0)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Failed Jobs
                </Typography>
                <Typography variant="h4" color="error.main">
                  {metrics.reduce((sum, m) => sum + m.failed, 0)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Completed Jobs
                </Typography>
                <Typography variant="h4" color="success.main">
                  {metrics.reduce((sum, m) => sum + m.completed, 0)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
        
        {/* Queue Status Alert */}
        {metrics.some(m => m.failed > 10) && (
          <Alert severity="warning" sx={{ mb: 3 }}>
            <Typography variant="body2">
              Some queues have high failure rates. Please review failed jobs.
            </Typography>
          </Alert>
        )}
        
        {/* Tabs */}
        <Paper sx={{ mb: 3 }}>
          <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
            <Tab label="Overview" />
            <Tab label="Jobs" />
            <Tab label="Scheduled" />
          </Tabs>
        </Paper>
        
        {/* Overview Tab */}
        <TabPanel value={tabValue} index={0}>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Queue</TableCell>
                  <TableCell align="right">Waiting</TableCell>
                  <TableCell align="right">Active</TableCell>
                  <TableCell align="right">Completed</TableCell>
                  <TableCell align="right">Failed</TableCell>
                  <TableCell align="right">Delayed</TableCell>
                  <TableCell align="center">Status</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {metrics.map((metric) => (
                  <TableRow key={metric.name}>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {getQueueIcon(metric.name)}
                        <Typography variant="body2" fontWeight="medium">
                          {metric.name}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      {metric.waiting > 0 ? (
                        <Chip label={metric.waiting} size="small" color="warning" />
                      ) : (
                        metric.waiting
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {metric.active > 0 ? (
                        <Chip label={metric.active} size="small" color="info" />
                      ) : (
                        metric.active
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {metric.completed > 0 ? (
                        <Chip label={metric.completed} size="small" color="success" />
                      ) : (
                        metric.completed
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {metric.failed > 0 ? (
                        <Chip label={metric.failed} size="small" color="error" />
                      ) : (
                        metric.failed
                      )}
                    </TableCell>
                    <TableCell align="right">{metric.delayed}</TableCell>
                    <TableCell align="center">
                      {metric.paused > 0 ? (
                        <Chip label="Paused" size="small" color="secondary" />
                      ) : (
                        <Chip label="Running" size="small" color="success" />
                      )}
                    </TableCell>
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                        {metric.paused > 0 ? (
                          <IconButton
                            size="small"
                            onClick={() => handleResumeQueue(metric.name)}
                            title="Resume Queue"
                          >
                            <PlayIcon />
                          </IconButton>
                        ) : (
                          <IconButton
                            size="small"
                            onClick={() => handlePauseQueue(metric.name)}
                            title="Pause Queue"
                          >
                            <PauseIcon />
                          </IconButton>
                        )}
                        <IconButton
                          size="small"
                          onClick={() => handleCleanQueue(metric.name, 'completed')}
                          title="Clean Completed Jobs"
                        >
                          <DeleteIcon />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => setSelectedQueue(metric.name)}
                          title="View Jobs"
                        >
                          <ScheduleIcon />
                        </IconButton>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>
        
        {/* Jobs Tab */}
        <TabPanel value={tabValue} index={1}>
          <FormControl fullWidth sx={{ mb: 3 }}>
            <InputLabel>Select Queue</InputLabel>
            <Select
              value={selectedQueue}
              onChange={(e) => setSelectedQueue(e.target.value)}
              label="Select Queue"
            >
              {metrics.map((metric) => (
                <MenuItem key={metric.name} value={metric.name}>
                  {metric.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          
          {selectedQueue && queueJobs && (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Job ID</TableCell>
                    <TableCell>Name</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Progress</TableCell>
                    <TableCell>Created</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {queueJobs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        <Typography variant="body2" color="text.secondary">
                          No jobs found in this queue
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    queueJobs.map((job: any) => (
                      <TableRow key={job.id}>
                        <TableCell>{job.id}</TableCell>
                        <TableCell>{job.name}</TableCell>
                        <TableCell>
                          <Chip
                            label={job.status}
                            size="small"
                            color={getStatusColor(job.status) as any}
                            icon={getStatusIcon(job.status)}
                          />
                        </TableCell>
                        <TableCell>
                          {job.progress > 0 && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <LinearProgress
                                variant="determinate"
                                value={job.progress}
                                sx={{ flexGrow: 1 }}
                              />
                              <Typography variant="caption">{job.progress}%</Typography>
                            </Box>
                          )}
                        </TableCell>
                        <TableCell>
                          {format(new Date(job.createdAt), 'MMM d, HH:mm')}
                        </TableCell>
                        <TableCell>
                          {job.status === 'failed' && (
                            <IconButton size="small" title="Retry Job">
                              <RetryIcon />
                            </IconButton>
                          )}
                          <IconButton size="small" title="Remove Job">
                            <DeleteIcon />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </TabPanel>
        
        {/* Scheduled Tab */}
        <TabPanel value={tabValue} index={2}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Scheduled Jobs
            </Typography>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Job</TableCell>
                  <TableCell>Schedule</TableCell>
                  <TableCell>Next Run</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CloudDownloadIcon />
                      <Typography variant="body2">
                        RBI Exchange Rates
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>Daily at 1:30 PM IST</TableCell>
                  <TableCell>Tomorrow, 1:30 PM</TableCell>
                  <TableCell>
                    <Chip label="Active" size="small" color="success" />
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Paper>
        </TabPanel>
        
        {/* Add Test Job Dialog */}
        <Dialog open={testJobDialogOpen} onClose={() => setTestJobDialogOpen(false)}>
          <DialogTitle>Add Test Job</DialogTitle>
          <DialogContent>
            <FormControl fullWidth sx={{ mt: 2 }}>
              <InputLabel>Job Type</InputLabel>
              <Select
                value={testJobType}
                onChange={(e) => setTestJobType(e.target.value)}
                label="Job Type"
              >
                <MenuItem value="pdf-generation">PDF Generation</MenuItem>
                <MenuItem value="email-notification">Email Notification</MenuItem>
                <MenuItem value="exchange-rates">Exchange Rates</MenuItem>
              </Select>
            </FormControl>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setTestJobDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleAddTestJob}
              variant="contained"
              disabled={!testJobType}
            >
              Add Job
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Container>
  )
}