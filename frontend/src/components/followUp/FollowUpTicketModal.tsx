import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Typography,
  Paper,
  Divider,
  IconButton,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  FormControlLabel,
  Checkbox
} from '@mui/material';
import {
  Close as CloseIcon,
  Send as SendIcon,
  Person as PersonIcon,
  Label as LabelIcon,
  Notes as NotesIcon
} from '@mui/icons-material';
import followUpTicketService, { 
  FollowUpTicket, 
  FollowUpStatus, 
  FollowUpLabel, 
  ChatMessage 
} from '../../services/followUpTicketService';

interface FollowUpTicketModalProps {
  open: boolean;
  onClose: () => void;
  estimateId: number;
  estimateName: string;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`tabpanel-${index}`}
      aria-labelledby={`tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

const FollowUpTicketModal: React.FC<FollowUpTicketModalProps> = ({ 
  open, 
  onClose, 
  estimateId, 
  estimateName 
}) => {
  const [ticket, setTicket] = useState<FollowUpTicket | null>(null);
  const [statuses, setStatuses] = useState<FollowUpStatus[]>([]);
  const [labels, setLabels] = useState<FollowUpLabel[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);
  
  // Form states
  const [selectedStatus, setSelectedStatus] = useState<number | null>(null);
  const [selectedLabel, setSelectedLabel] = useState<number | null>(null);
  const [followedUp, setFollowedUp] = useState(false);
  const [notes, setNotes] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  
  // Chat states
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  useEffect(() => {
    if (open) {
      loadTicketData();
      loadStatuses();
      loadLabels();
    }
  }, [open, estimateId]);

  const loadTicketData = async () => {
    try {
      setLoading(true);
      setError(null);
      const ticketData = await followUpTicketService.getTicketByEstimateId(estimateId);
      
      if (!ticketData) {
        throw new Error('No ticket data received');
      }
      
      setTicket(ticketData);
      
      // Set form values
      setSelectedStatus(ticketData.status_id || null);
      setSelectedLabel(ticketData.label_id || null);
      setFollowedUp(ticketData.followed_up || false);
      setNotes(ticketData.notes || '');
      setFollowUpDate(ticketData.follow_up_date || '');
      
      // Load chat if exists
      if (ticketData.chat_id && ticketData.chat) {
        setChatMessages(ticketData.chat.messages || []);
      }
    } catch (err: any) {
      // Ignorar errores de requests canceladas (navegación rápida)
      if (err.message?.includes('cancelled') || err.message?.includes('canceled')) {
        console.log('Request cancelled - ignoring');
        setLoading(false);
        return;
      }
      
      console.error('Error loading ticket data:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load ticket data');
    } finally {
      setLoading(false);
    }
  };

  const loadStatuses = async () => {
    try {
      const statusesData = await followUpTicketService.getAllStatuses();
      setStatuses(statusesData || []);
    } catch (err) {
      console.error('Error loading statuses:', err);
      setStatuses([]);
    }
  };

  const loadLabels = async () => {
    try {
      const labelsData = await followUpTicketService.getAllLabels();
      setLabels(labelsData || []);
    } catch (err) {
      console.error('Error loading labels:', err);
      setLabels([]);
    }
  };

  const handleSave = async () => {
    if (!ticket) return;

    try {
      setSaving(true);
      setError(null);

      await followUpTicketService.updateTicket(ticket.id, {
        status_id: selectedStatus || undefined,
        label_id: selectedLabel || undefined,
        followed_up: followedUp,
        notes: notes,
        follow_up_date: followUpDate || undefined
      });

      // Reload ticket data
      await loadTicketData();
      
    } catch (err: any) {
      // Ignorar errores de requests canceladas
      if (err.message?.includes('cancelled') || err.message?.includes('canceled')) {
        console.log('Save request cancelled - ignoring');
        return;
      }
      
      setError(err.message || 'Failed to save ticket');
    } finally {
      setSaving(false);
    }
  };

  const handleSendMessage = async () => {
    if (!ticket || !newMessage.trim()) return;

    try {
      setSendingMessage(true);
      
      // Create chat if doesn't exist
      let chatId = ticket.chat_id;
      if (!chatId) {
        const chat = await followUpTicketService.getOrCreateChat(ticket.id);
        chatId = chat.id;
      }

      // Send message
      const message = await followUpTicketService.addMessageToChat(chatId, {
        sender_type: 'agent',
        sender_name: 'Agent', // TODO: Get from current user
        message_text: newMessage
      });

      // Add to local messages
      setChatMessages([...chatMessages, message]);
      setNewMessage('');

    } catch (err: any) {
      // Ignorar errores de requests canceladas
      if (err.message?.includes('cancelled') || err.message?.includes('canceled')) {
        console.log('Send message request cancelled - ignoring');
        return;
      }
      
      setError(err.message || 'Failed to send message');
    } finally {
      setSendingMessage(false);
    }
  };

  const getStatusColor = (statusName: string) => {
    switch (statusName) {
      case 'Lost': return 'error';
      case 'Sold': return 'success';
      case 'Negotiating': return 'warning';
      default: return 'default';
    }
  };

  const getLabelColor = (labelName: string) => {
    switch (labelName) {
      case 'PMP': return 'primary';
      case 'Discount': return 'secondary';
      case 'Other': return 'default';
      default: return 'default';
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
      PaperProps={{
        sx: { minHeight: '600px' }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h6">Follow-Up: {estimateName}</Typography>
            {ticket && (
              <Typography variant="caption" color="textSecondary">
                Ticket ID: {ticket.id}
              </Typography>
            )}
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        ) : (
          <>
            <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
              <Tab label="Details" icon={<NotesIcon />} iconPosition="start" />
              <Tab 
                label={`Chat ${chatMessages.length > 0 ? `(${chatMessages.length})` : ''}`} 
                icon={<PersonIcon />} 
                iconPosition="start" 
              />
            </Tabs>

            {/* Details Tab */}
            <TabPanel value={tabValue} index={0}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                
                {/* Status */}
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={selectedStatus || ''}
                    onChange={(e) => setSelectedStatus(e.target.value as number)}
                    label="Status"
                  >
                    {statuses.map((status) => (
                      <MenuItem key={status.id} value={status.id}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Chip 
                            label={status.name} 
                            size="small" 
                            color={getStatusColor(status.name)} 
                          />
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {/* Label */}
                <FormControl fullWidth>
                  <InputLabel>Label</InputLabel>
                  <Select
                    value={selectedLabel || ''}
                    onChange={(e) => setSelectedLabel(e.target.value as number)}
                    label="Label"
                  >
                    <MenuItem value="">
                      <em>None</em>
                    </MenuItem>
                    {labels.map((label) => (
                      <MenuItem key={label.id} value={label.id}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <LabelIcon fontSize="small" />
                          <Chip 
                            label={label.name} 
                            size="small" 
                            color={getLabelColor(label.name)} 
                          />
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {/* Follow-up Date */}
                <TextField
                  label="Follow-up Date"
                  type="date"
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                />

                {/* Followed Up Checkbox */}
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={followedUp}
                      onChange={(e) => setFollowedUp(e.target.checked)}
                    />
                  }
                  label="Mark as followed up"
                />

                {/* Notes */}
                <TextField
                  label="Internal Notes"
                  multiline
                  rows={4}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add internal notes about this follow-up..."
                  fullWidth
                />

              </Box>
            </TabPanel>

            {/* Chat Tab */}
            <TabPanel value={tabValue} index={1}>
              <Box sx={{ display: 'flex', flexDirection: 'column', height: '400px' }}>
                
                {/* Messages Container */}
                <Paper 
                  variant="outlined" 
                  sx={{ 
                    flex: 1, 
                    p: 2, 
                    mb: 2, 
                    overflowY: 'auto',
                    backgroundColor: '#f5f5f5'
                  }}
                >
                  {chatMessages.length === 0 ? (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                      <Typography color="textSecondary">
                        No messages yet. Start the conversation!
                      </Typography>
                    </Box>
                  ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {chatMessages.map((message) => (
                        <Box
                          key={message.id}
                          sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: message.sender_type === 'agent' ? 'flex-end' : 'flex-start'
                          }}
                        >
                          <Paper
                            sx={{
                              p: 1.5,
                              maxWidth: '70%',
                              backgroundColor: message.sender_type === 'agent' ? '#1976d2' : '#fff',
                              color: message.sender_type === 'agent' ? '#fff' : '#000'
                            }}
                          >
                            <Typography variant="caption" sx={{ fontWeight: 'bold', display: 'block' }}>
                              {message.sender_name}
                            </Typography>
                            <Typography variant="body2">
                              {message.message_text}
                            </Typography>
                            <Typography variant="caption" sx={{ display: 'block', mt: 0.5, opacity: 0.7 }}>
                              {new Date(message.sent_at).toLocaleString()}
                            </Typography>
                          </Paper>
                        </Box>
                      ))}
                    </Box>
                  )}
                </Paper>

                {/* Message Input */}
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <TextField
                    fullWidth
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    multiline
                    maxRows={3}
                  />
                  <Button
                    variant="contained"
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim() || sendingMessage}
                    endIcon={sendingMessage ? <CircularProgress size={20} /> : <SendIcon />}
                  >
                    Send
                  </Button>
                </Box>
              </Box>
            </TabPanel>
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Close
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={saving || loading}
          startIcon={saving ? <CircularProgress size={20} /> : undefined}
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default FollowUpTicketModal;

