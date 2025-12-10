import React, { useState, useEffect, useRef } from 'react';
import { getSocket, disconnectSocket } from '../../config/socket';
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastMessageIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (open) {
      loadTicketData();
      loadStatuses();
      loadLabels();
    }
  }, [open, estimateId]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // WebSocket para actualizar el chat en tiempo real
  useEffect(() => {
    if (open && tabValue === 1 && ticket?.chat_id) {
      const socket = getSocket();
      const chatId = Number(ticket.chat_id); // Asegurar que sea número

      console.log(`🔌 Setting up WebSocket for chat ${chatId} (type: ${typeof chatId}), socket connected: ${socket.connected}, socket id: ${socket.id}`);

      // Función para unirse a la sala
      const joinChatRoom = () => {
        if (!socket.connected) {
          console.warn('⚠️ Socket not connected, cannot join room');
          return;
        }
        
        // Asegurar que chatId sea un número
        const numericChatId = Number(chatId);
        if (isNaN(numericChatId)) {
          console.error('❌ Invalid chatId:', chatId);
          return;
        }
        
        socket.emit('join-chat', numericChatId);
        console.log(`🔌 Emitted join-chat for chat-${numericChatId} (socket: ${socket.id})`);
        
        // Verificar después de un momento si se unió correctamente
        setTimeout(() => {
          // No hay forma directa de verificar, pero podemos confiar en el backend
          console.log(`✅ Should be joined to chat-${numericChatId}`);
        }, 500);
      };

      // Esperar a que el socket esté conectado
      if (socket.connected) {
        joinChatRoom();
      } else {
        console.log('⏳ Socket not connected, waiting for connection...');
        const connectHandler = () => {
          console.log('✅ Socket connected, joining chat room');
          joinChatRoom();
        };
        socket.once('connect', connectHandler);
      }

      // Escuchar nuevos mensajes
      const handleNewMessage = (newMessage: ChatMessage) => {
        console.log('📥 Received new message via WebSocket:', {
          id: newMessage.id,
          sender: newMessage.sender_name,
          text: newMessage.message_text.substring(0, 50) + '...'
        });
        setChatMessages((prevMessages) => {
          // Evitar duplicados
          if (prevMessages.some(msg => msg.id === newMessage.id)) {
            console.log('⚠️ Duplicate message ignored:', newMessage.id);
            return prevMessages;
          }
          console.log('✅ Adding new message to chat, total messages:', prevMessages.length + 1);
          return [...prevMessages, newMessage];
        });
        lastMessageIdRef.current = newMessage.id;
        
        // Auto-scroll
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      };

      socket.on('new-message', handleNewMessage);

      // También escuchar eventos de conexión para debugging y re-join si se desconecta
      const handleConnect = () => {
        console.log('✅ Socket reconnected, rejoining chat room');
        joinChatRoom();
      };
      socket.on('connect', handleConnect);

      // Limpiar al desmontar o cambiar de pestaña
      return () => {
        console.log(`🔌 Cleaning up WebSocket for chat ${chatId}`);
        if (socket.connected) {
          socket.emit('leave-chat', Number(chatId));
        }
        socket.off('new-message', handleNewMessage);
        socket.off('connect', handleConnect);
      };
    }
  }, [open, tabValue, ticket?.chat_id]);

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
        const messages = ticketData.chat.messages || [];
        setChatMessages(messages);
        // Guardar el ID del último mensaje para comparar en polling
        if (messages.length > 0) {
          lastMessageIdRef.current = messages[messages.length - 1].id;
        }
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

      // Send message (también envía SMS automáticamente si hay teléfono)
      const message = await followUpTicketService.addMessageToChat(chatId, {
        sender_type: 'agent',
        sender_name: 'Agent', // TODO: Get from current user
        message_text: newMessage,
        send_sms: true // Enviar SMS a través del webhook
      });

      console.log('✅ Message sent, waiting for WebSocket update:', message.id);

      // Agregar inmediatamente para feedback visual, pero el WebSocket lo actualizará
      setChatMessages([...chatMessages, message]);
      lastMessageIdRef.current = message.id;
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
              <Box sx={{ display: 'flex', flexDirection: 'column', height: '500px' }}>
                
                {/* Messages Container */}
                <Box 
                  sx={{ 
                    flex: 1, 
                    p: 2, 
                    mb: 2, 
                    overflowY: 'auto',
                    backgroundColor: '#e5ddd5',
                    backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'100\' height=\'100\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cdefs%3E%3Cpattern id=\'grid\' width=\'100\' height=\'100\' patternUnits=\'userSpaceOnUse\'%3E%3Cpath d=\'M 100 0 L 0 0 0 100\' fill=\'none\' stroke=\'%23ffffff\' stroke-width=\'0.5\' opacity=\'0.1\'/%3E%3C/pattern%3E%3C/defs%3E%3Crect width=\'100\' height=\'100\' fill=\'url(%23grid)\'/%3E%3C/svg%3E")',
                    borderRadius: 1,
                    border: '1px solid',
                    borderColor: 'divider'
                  }}
                >
                  {chatMessages.length === 0 ? (
                    <Box sx={{ textAlign: 'center', py: 8 }}>
                      <Typography color="text.secondary" variant="body2" sx={{ fontStyle: 'italic' }}>
                        No messages yet. Start the conversation!
                      </Typography>
                    </Box>
                  ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                      {chatMessages.map((message, index) => {
                        const isAgent = message.sender_type === 'agent';
                        const showDateSeparator = index === 0 || 
                          new Date(message.sent_at).toDateString() !== 
                          new Date(chatMessages[index - 1].sent_at).toDateString();
                        
                        return (
                          <React.Fragment key={message.id}>
                            {showDateSeparator && (
                              <Box sx={{ textAlign: 'center', my: 1 }}>
                                <Chip 
                                  label={new Date(message.sent_at).toLocaleDateString('en-US', { 
                                    weekday: 'long', 
                                    year: 'numeric', 
                                    month: 'long', 
                                    day: 'numeric' 
                                  })}
                                  size="small"
                                  sx={{ 
                                    backgroundColor: 'rgba(0, 0, 0, 0.15)',
                                    color: 'rgba(0, 0, 0, 0.7)',
                                    fontSize: '0.7rem',
                                    fontWeight: 500,
                                    border: '1px solid rgba(0, 0, 0, 0.1)'
                                  }}
                                />
                              </Box>
                            )}
                            <Box
                              sx={{
                                display: 'flex',
                                justifyContent: isAgent ? 'flex-end' : 'flex-start',
                                alignItems: 'flex-end',
                                gap: 1
                              }}
                            >
                              {!isAgent && (
                                <Box
                                  sx={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: '50%',
                                    backgroundColor: 'primary.main',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'white',
                                    fontSize: '0.75rem',
                                    fontWeight: 'bold',
                                    flexShrink: 0
                                  }}
                                >
                                  {message.sender_name.charAt(0).toUpperCase()}
                                </Box>
                              )}
                              <Box
                                sx={{
                                  maxWidth: '75%',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: isAgent ? 'flex-end' : 'flex-start'
                                }}
                              >
                                {!isAgent && (
                                  <Typography 
                                    variant="caption" 
                                    sx={{ 
                                      mb: 0.5, 
                                      px: 1,
                                      color: 'text.secondary',
                                      fontSize: '0.7rem'
                                    }}
                                  >
                                    {message.sender_name}
                                  </Typography>
                                )}
                                <Paper
                                  elevation={0}
                                  sx={{
                                    p: 1.5,
                                    px: 2,
                                    borderRadius: isAgent 
                                      ? '18px 18px 4px 18px' 
                                      : '18px 18px 18px 4px',
                                    backgroundColor: isAgent ? '#dcf8c6' : '#ffffff',
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                                    wordBreak: 'break-word'
                                  }}
                                >
                                  <Typography 
                                    variant="body2" 
                                    sx={{ 
                                      color: isAgent ? '#000' : '#000',
                                      lineHeight: 1.4,
                                      whiteSpace: 'pre-wrap'
                                    }}
                                  >
                                    {message.message_text}
                                  </Typography>
                                </Paper>
                                <Typography 
                                  variant="caption" 
                                  sx={{ 
                                    mt: 0.5, 
                                    px: 1,
                                    color: 'rgba(0, 0, 0, 0.6)',
                                    fontSize: '0.65rem',
                                    fontWeight: 500
                                  }}
                                >
                                  {new Date(message.sent_at).toLocaleTimeString('en-US', { 
                                    hour: 'numeric', 
                                    minute: '2-digit',
                                    hour12: true 
                                  })}
                                </Typography>
                              </Box>
                              {isAgent && (
                                <Box
                                  sx={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: '50%',
                                    backgroundColor: 'primary.main',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'white',
                                    fontSize: '0.75rem',
                                    fontWeight: 'bold',
                                    flexShrink: 0
                                  }}
                                >
                                  A
                                </Box>
                              )}
                            </Box>
                          </React.Fragment>
                        );
                      })}
                      <div ref={messagesEndRef} />
                    </Box>
                  )}
                </Box>

                {/* Message Input */}
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
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
                    maxRows={4}
                    variant="outlined"
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '24px',
                        backgroundColor: 'background.paper',
                      }
                    }}
                  />
                  <IconButton
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim() || sendingMessage}
                    sx={{
                      backgroundColor: 'primary.main',
                      color: 'white',
                      width: 48,
                      height: 48,
                      '&:hover': {
                        backgroundColor: 'primary.dark',
                      },
                      '&:disabled': {
                        backgroundColor: 'action.disabledBackground',
                        color: 'action.disabled'
                      }
                    }}
                  >
                    {sendingMessage ? (
                      <CircularProgress size={20} color="inherit" />
                    ) : (
                      <SendIcon />
                    )}
                  </IconButton>
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

