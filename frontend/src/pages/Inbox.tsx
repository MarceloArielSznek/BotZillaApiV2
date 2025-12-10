import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemAvatar,
  Avatar,
  ListItemText,
  CircularProgress,
  Alert,
  Chip,
  Divider,
  TextField,
  InputAdornment,
  Badge,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  Search as SearchIcon,
  Phone as PhoneIcon,
  Send as SendIcon,
  FilterList as FilterListIcon,
  DeleteOutline as DeleteIcon,
  InfoOutlined as InfoIcon,
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import followUpTicketService, { ChatMessage } from '../services/followUpTicketService';
import { getSocket } from '../config/socket';
import branchService from '../services/branchService';
import salespersonService from '../services/salespersonService';
import EstimateDetailsModal from '../components/estimates/EstimateDetailsModal';

interface ChatItem {
  id: number;
  ticketId: number;
  estimateId: number;
  customerName: string;
  customerPhone: string;
  lastMessage: {
    text: string;
    sender: string;
    senderType: string;
    sentAt: string;
  };
  updatedAt: string;
  unreadCount: number;
  branchId?: number;
  branchName?: string;
  salesPersonId?: number;
  salesPersonName?: string;
}

const Inbox: React.FC = () => {
  const theme = useTheme();
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedChat, setSelectedChat] = useState<ChatItem | null>(null);
  
  // Filters
  const [selectedBranchId, setSelectedBranchId] = useState<number | ''>('');
  const [selectedSalesPersonId, setSelectedSalesPersonId] = useState<number | ''>('');
  const [branches, setBranches] = useState<any[]>([]);
  const [salesPersons, setSalesPersons] = useState<any[]>([]);
  
  // Chat states
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [ticket, setTicket] = useState<any>(null);
  const lastSentMessageIdRef = useRef<number | null>(null);
  const [estimateModalOpen, setEstimateModalOpen] = useState(false);

  useEffect(() => {
    loadChats();
    loadFiltersData();
  }, []);

  // Escuchar actualizaciones del inbox en tiempo real
  useEffect(() => {
    const socket = getSocket();
    
    const handleInboxUpdate = (updatedChat: ChatItem) => {
      console.log('📬 Received inbox update:', updatedChat.id);
      setChats((prevChats) => {
        // Buscar si el chat ya existe en la lista
        const existingIndex = prevChats.findIndex(chat => chat.id === updatedChat.id);
        
        if (existingIndex >= 0) {
          // Actualizar el chat existente
          const updatedChats = [...prevChats];
          updatedChats[existingIndex] = updatedChat;
          
          // Reordenar: primero los no leídos, luego por fecha
          updatedChats.sort((a, b) => {
            if (a.unreadCount > 0 && b.unreadCount === 0) return -1;
            if (a.unreadCount === 0 && b.unreadCount > 0) return 1;
            return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
          });
          
          return updatedChats;
        } else {
          // Si es un chat nuevo, agregarlo y ordenar
          const newChats = [...prevChats, updatedChat];
          newChats.sort((a, b) => {
            if (a.unreadCount > 0 && b.unreadCount === 0) return -1;
            if (a.unreadCount === 0 && b.unreadCount > 0) return 1;
            return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
          });
          return newChats;
        }
      });
      
      // Si el chat actualizado es el seleccionado, actualizar también el estado
      setSelectedChat((prevSelected) => {
        if (prevSelected && prevSelected.id === updatedChat.id) {
          return updatedChat;
        }
        return prevSelected;
      });
    };

    socket.on('inbox-update', handleInboxUpdate);

    return () => {
      socket.off('inbox-update', handleInboxUpdate);
    };
  }, []); // Sin dependencias para que solo se registre una vez

  // Recargar chats cuando cambian los filtros
  useEffect(() => {
    loadChats();
  }, [selectedBranchId, selectedSalesPersonId]);

  // Cuando cambia el branch, actualizar la lista de salespersons y limpiar el filtro de salesperson
  useEffect(() => {
    if (selectedBranchId) {
      loadSalesPersons(selectedBranchId);
      // Limpiar el filtro de salesperson cuando cambia el branch
      setSelectedSalesPersonId('');
    } else {
      // Si no hay branch seleccionado, cargar todos los salespersons
      loadSalesPersons();
      setSelectedSalesPersonId('');
    }
  }, [selectedBranchId]);

  useEffect(() => {
    if (selectedChat) {
      loadChatData(selectedChat.estimateId);
    } else {
      // Limpiar mensajes cuando se cierra el chat
      setChatMessages([]);
      setTicket(null);
    }
  }, [selectedChat]);

  // Scroll al final cuando se cargan los mensajes por primera vez
  useEffect(() => {
    if (chatMessages.length > 0 && !loadingChat) {
      // Esperar a que el DOM se actualice
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
      }, 150);
    }
  }, [loadingChat]); // Solo cuando termina de cargar

  // Auto-scroll to bottom when new messages arrive (solo cuando realmente hay un nuevo mensaje)
  const prevMessagesLengthRef = useRef(0);
  useEffect(() => {
    // Solo hacer scroll si hay más mensajes que antes (nuevo mensaje agregado)
    if (chatMessages.length > prevMessagesLengthRef.current && messagesEndRef.current) {
      const container = messagesEndRef.current.parentElement?.parentElement;
      if (container) {
        const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 300;
        // Solo hacer scroll si estamos cerca del final o es el primer mensaje
        if (isNearBottom || prevMessagesLengthRef.current === 0) {
          setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          }, 100);
        }
      }
    }
    prevMessagesLengthRef.current = chatMessages.length;
  }, [chatMessages.length]); // Solo cuando cambia la cantidad de mensajes

  // WebSocket para actualizar el chat en tiempo real
  useEffect(() => {
    if (selectedChat && ticket?.chat_id) {
      const socket = getSocket();
      const chatId = ticket.chat_id;

      console.log(`🔌 Setting up WebSocket for chat ${chatId}, socket connected: ${socket.connected}`);

      const joinChatRoom = () => {
        if (!socket.connected) {
          console.warn('⚠️ Socket not connected, cannot join room');
          return;
        }
        
        const numericChatId = Number(chatId);
        if (isNaN(numericChatId)) {
          console.error('❌ Invalid chatId:', chatId);
          return;
        }
        
        socket.emit('join-chat', numericChatId);
        console.log(`🔌 Emitted join-chat for chat-${numericChatId}`);
      };

      if (socket.connected) {
        joinChatRoom();
      } else {
        socket.once('connect', () => {
          console.log('✅ Socket connected, joining chat room');
          joinChatRoom();
        });
      }

      const handleNewMessage = (newMessage: ChatMessage) => {
        console.log('📥 Received new message via WebSocket:', newMessage.id);
        setChatMessages((prevMessages) => {
          // Verificar duplicados por ID
          if (prevMessages.some(msg => msg.id === newMessage.id)) {
            console.log('⚠️ Duplicate message ignored:', newMessage.id);
            return prevMessages;
          }
          // Si es el último mensaje que enviamos, no agregarlo (ya está en el estado)
          if (lastSentMessageIdRef.current === newMessage.id) {
            console.log('⚠️ Ignoring own message from WebSocket:', newMessage.id);
            lastSentMessageIdRef.current = null; // Reset después de ignorarlo
            return prevMessages;
          }
          console.log('✅ Adding new message from WebSocket');
          // Agregar el nuevo mensaje y ordenar por fecha (más antiguos primero)
          const updatedMessages = [...prevMessages, newMessage];
          return updatedMessages.sort((a, b) => {
            return new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime();
          });
        });
      };

      socket.on('new-message', handleNewMessage);

      const handleConnect = () => {
        console.log('✅ Socket reconnected, rejoining chat room');
        joinChatRoom();
      };
      socket.on('connect', handleConnect);

      return () => {
        if (socket.connected) {
          socket.emit('leave-chat', Number(chatId));
        }
        socket.off('new-message', handleNewMessage);
        socket.off('connect', handleConnect);
      };
    }
  }, [selectedChat, ticket?.chat_id]);

  const loadChats = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: any = { limit: 100 };
      if (selectedBranchId) params.branchId = selectedBranchId;
      if (selectedSalesPersonId) params.salesPersonId = selectedSalesPersonId;
      
      const response = await followUpTicketService.getAllChats(params);
      if (response && response.data) {
        // El backend ya ordena: primero los no leídos, luego por fecha
        // Solo necesitamos mantener ese orden
        setChats(response.data || []);
      } else {
        setChats([]);
      }
    } catch (err: any) {
      if (err.message?.includes('cancelled') || err.message?.includes('canceled')) {
        console.log('Request cancelled - ignoring');
        setChats([]);
        return;
      }
      console.error('Error loading chats:', err);
      setError(err.message || 'Failed to load chats');
    } finally {
      setLoading(false);
    }
  };

  const loadFiltersData = async () => {
    try {
      const branchesData = await branchService.getBranches({ limit: 100 });
      
      if (branchesData?.branches) {
        setBranches(branchesData.branches);
      } else if (Array.isArray(branchesData)) {
        setBranches(branchesData);
      }
      
      // Cargar salespersons inicialmente (sin filtro de branch)
      await loadSalesPersons();
    } catch (err) {
      console.error('Error loading filters data:', err);
    }
  };

  const loadSalesPersons = async (branchId?: number) => {
    try {
      const params: any = { limit: 1000 };
      if (branchId) {
        params.branchId = branchId;
      }
      
      const salesPersonsData = await salespersonService.getSalesPersons(params);
      
      if (Array.isArray(salesPersonsData)) {
        setSalesPersons(salesPersonsData);
      } else if (salesPersonsData?.salespersons) {
        setSalesPersons(salesPersonsData.salespersons);
      } else {
        setSalesPersons([]);
      }
    } catch (err) {
      console.error('Error loading salespersons:', err);
      setSalesPersons([]);
    }
  };

  const loadChatData = async (estimateId: number) => {
    try {
      setLoadingChat(true);
      const ticketData = await followUpTicketService.getTicketByEstimateId(estimateId);
      setTicket(ticketData);
      
      if (ticketData.chat_id && ticketData.chat) {
        const messages = ticketData.chat.messages || [];
        // Asegurar que los mensajes estén ordenados por fecha (más antiguos primero)
        const sortedMessages = [...messages].sort((a, b) => {
          return new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime();
        });
        setChatMessages(sortedMessages);
        
        // Marcar mensajes como leídos cuando se abre el chat
        await followUpTicketService.markMessagesAsRead(ticketData.chat_id);
        
        // Actualizar solo el badge del chat seleccionado sin recargar toda la lista
        setChats((prevChats) =>
          prevChats.map((chat) =>
            chat.id === ticketData.chat_id
              ? { ...chat, unreadCount: 0 }
              : chat
          )
        );

        // Scroll al final cuando se carga el chat por primera vez
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
        }, 100);
      }
    } catch (err: any) {
      console.error('Error loading chat data:', err);
    } finally {
      setLoadingChat(false);
    }
  };

  const handleClearChat = async () => {
    if (!selectedChat || !ticket?.chat_id) return;

    if (!window.confirm('Are you sure you want to clear all messages in this chat? This action cannot be undone.')) {
      return;
    }

    try {
      await followUpTicketService.clearChat(ticket.chat_id);
      // Limpiar los mensajes del estado local
      setChatMessages([]);
      // Recargar el chat para actualizar el estado
      await loadChatData(selectedChat.estimateId);
      // Recargar la lista de chats para actualizar el preview
      await loadChats();
    } catch (err: any) {
      console.error('Error clearing chat:', err);
      alert('Failed to clear chat. Please try again.');
    }
  };

  const handleSendMessage = async () => {
    if (!selectedChat || !ticket || !newMessage.trim()) return;

    try {
      setSendingMessage(true);
      
      let chatId = ticket.chat_id;
      if (!chatId) {
        const chat = await followUpTicketService.getOrCreateChat(ticket.id);
        chatId = chat.id;
        setTicket({ ...ticket, chat_id: chatId });
      }

      const message = await followUpTicketService.addMessageToChat(chatId, {
        sender_type: 'agent',
        sender_name: 'Agent',
        message_text: newMessage,
        send_sms: true
      });

      // Guardar el ID del mensaje enviado para evitar duplicados del WebSocket
      lastSentMessageIdRef.current = message.id;

      // Agregar mensaje localmente (el WebSocket también lo recibirá pero lo ignoraremos)
      setChatMessages((prev) => {
        // Verificar que no esté ya agregado
        if (prev.some(msg => msg.id === message.id)) {
          return prev;
        }
        // Agregar y ordenar por fecha (más antiguos primero)
        const updatedMessages = [...prev, message];
        return updatedMessages.sort((a, b) => {
          return new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime();
        });
      });
      setNewMessage('');
      
      // Actualizar el último mensaje en la lista de chats sin recargar todo
      setChats((prevChats) =>
        prevChats.map((chat) =>
          chat.id === selectedChat.id
            ? {
                ...chat,
                lastMessage: {
                  text: message.message_text,
                  sender: message.sender_name,
                  senderType: message.sender_type,
                  sentAt: message.sent_at,
                },
                updatedAt: new Date().toISOString(),
              }
            : chat
        )
      );
    } catch (err: any) {
      console.error('Error sending message:', err);
    } finally {
      setSendingMessage(false);
    }
  };

  const filteredChats = chats.filter(chat => {
    const searchLower = searchTerm.toLowerCase();
    return (
      chat.customerName.toLowerCase().includes(searchLower) ||
      chat.customerPhone.includes(searchTerm) ||
      chat.lastMessage.text.toLowerCase().includes(searchLower)
    );
  });

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box sx={{ height: 'calc(100vh - 120px)', display: 'flex', gap: 2 }}>
      {/* Left Panel - Chat List */}
      <Paper
        elevation={0}
        sx={{
          width: '400px',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: theme.palette.background.paper,
          border: `1px solid ${theme.palette.divider}`,
        }}
      >
        {/* Search Header */}
        <Box sx={{ p: 2, borderBottom: `1px solid ${theme.palette.divider}` }}>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, color: theme.palette.primary.main }}>
            Inbox
          </Typography>
          <TextField
            fullWidth
            size="small"
            placeholder="Search chats..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: theme.palette.text.secondary, fontSize: 20 }} />
                </InputAdornment>
              ),
            }}
            sx={{
              mb: 2,
              '& .MuiOutlinedInput-root': {
                backgroundColor: theme.palette.background.default,
              },
            }}
          />
          
          {/* Filters */}
          <Box sx={{ display: 'flex', gap: 1, flexDirection: 'column' }}>
            <FormControl fullWidth size="small">
              <InputLabel>Branch</InputLabel>
              <Select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value as number | '')}
                label="Branch"
              >
                <MenuItem value="">
                  <em>All Branches</em>
                </MenuItem>
                {branches.map((branch) => (
                  <MenuItem key={branch.id} value={branch.id}>
                    {branch.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            
            <FormControl fullWidth size="small">
              <InputLabel>Sales Person</InputLabel>
              <Select
                value={selectedSalesPersonId}
                onChange={(e) => setSelectedSalesPersonId(e.target.value as number | '')}
                label="Sales Person"
              >
                <MenuItem value="">
                  <em>All Sales Persons</em>
                </MenuItem>
                {salesPersons.map((sp) => (
                  <MenuItem key={sp.id} value={sp.id}>
                    {sp.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </Box>

        {/* Chat List */}
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          {filteredChats.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                {searchTerm ? 'No chats found' : 'No chats with messages yet'}
              </Typography>
            </Box>
          ) : (
            <List sx={{ p: 0 }}>
              {filteredChats.map((chat, index) => (
                <React.Fragment key={chat.id}>
                  <ListItem disablePadding>
                    <ListItemButton
                      onClick={() => setSelectedChat(chat)}
                      selected={selectedChat?.id === chat.id}
                      sx={{
                        py: 1.5,
                        px: 2,
                        '&.Mui-selected': {
                          backgroundColor: 'rgba(76, 175, 80, 0.08)',
                          '&:hover': {
                            backgroundColor: 'rgba(76, 175, 80, 0.12)',
                          },
                        },
                        '&:hover': {
                          backgroundColor: 'rgba(76, 175, 80, 0.04)',
                        },
                      }}
                    >
                      <ListItemAvatar>
                        <Badge
                          badgeContent={chat.unreadCount > 0 ? chat.unreadCount : undefined}
                          color="primary"
                          max={99}
                        >
                          <Avatar
                            sx={{
                              bgcolor: theme.palette.primary.main,
                              width: 48,
                              height: 48,
                              fontSize: '1rem',
                              fontWeight: 600,
                            }}
                          >
                            {getInitials(chat.customerName)}
                          </Avatar>
                        </Badge>
                      </ListItemAvatar>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                            <Typography
                              variant="subtitle2"
                              sx={{
                                fontWeight: 600,
                                color: theme.palette.text.primary,
                              }}
                            >
                              {chat.customerName}
                            </Typography>
                            <Typography
                              variant="caption"
                              sx={{
                                color: theme.palette.text.secondary,
                                fontSize: '0.7rem',
                              }}
                            >
                              {formatTime(chat.lastMessage.sentAt)}
                            </Typography>
                          </Box>
                        }
                        secondary={
                          <Typography
                            variant="body2"
                            sx={{
                              color: theme.palette.text.secondary,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              display: '-webkit-box',
                              WebkitLineClamp: 1,
                              WebkitBoxOrient: 'vertical',
                            }}
                          >
                            {chat.lastMessage.senderType === 'customer' ? chat.customerName : 'You'}: {chat.lastMessage.text}
                          </Typography>
                        }
                      />
                    </ListItemButton>
                  </ListItem>
                  {index < filteredChats.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          )}
        </Box>
      </Paper>

      {/* Right Panel - Chat Window */}
      <Paper
        elevation={0}
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: theme.palette.background.paper,
          border: `1px solid ${theme.palette.divider}`,
        }}
      >
        {!selectedChat ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <Typography variant="body1" color="text.secondary">
              Select a chat to start messaging
            </Typography>
          </Box>
        ) : loadingChat ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            {/* Chat Header */}
            <Box
              sx={{
                p: 2,
                borderBottom: `1px solid ${theme.palette.divider}`,
                display: 'flex',
                alignItems: 'center',
                gap: 2,
              }}
            >
              <Avatar
                sx={{
                  bgcolor: theme.palette.primary.main,
                  width: 40,
                  height: 40,
                }}
              >
                {getInitials(selectedChat.customerName)}
              </Avatar>
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  {selectedChat.customerName}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {selectedChat.customerPhone}
                </Typography>
              </Box>
              <IconButton
                onClick={() => setEstimateModalOpen(true)}
                color="primary"
                size="small"
                sx={{
                  '&:hover': {
                    backgroundColor: theme.palette.primary.light + '20',
                  },
                }}
                title="View Estimate Details"
              >
                <InfoIcon />
              </IconButton>
              <IconButton
                onClick={handleClearChat}
                color="error"
                size="small"
                sx={{
                  '&:hover': {
                    backgroundColor: theme.palette.error.light + '20',
                  },
                }}
                title="Clear Chat"
              >
                <DeleteIcon />
              </IconButton>
            </Box>

            {/* Messages Container */}
            <Box
              sx={{
                flex: 1,
                p: 2,
                overflowY: 'auto',
                backgroundColor: '#e5ddd5',
                backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'100\' height=\'100\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cdefs%3E%3Cpattern id=\'grid\' width=\'100\' height=\'100\' patternUnits=\'userSpaceOnUse\'%3E%3Cpath d=\'M 100 0 L 0 0 0 100\' fill=\'none\' stroke=\'%23ffffff\' stroke-width=\'0.5\' opacity=\'0.1\'/%3E%3C/pattern%3E%3C/defs%3E%3Crect width=\'100\' height=\'100\' fill=\'url(%23grid)\'/%3E%3C/svg%3E")',
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
                            <Avatar
                              sx={{
                                width: 32,
                                height: 32,
                                bgcolor: theme.palette.primary.main,
                                fontSize: '0.75rem',
                                fontWeight: 'bold',
                              }}
                            >
                              {message.sender_name.charAt(0).toUpperCase()}
                            </Avatar>
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
                                  color: 'rgba(0, 0, 0, 0.7)',
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
                                  color: '#000',
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
                            <Avatar
                              sx={{
                                width: 32,
                                height: 32,
                                bgcolor: theme.palette.primary.main,
                                fontSize: '0.75rem',
                                fontWeight: 'bold',
                              }}
                            >
                              A
                            </Avatar>
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
            <Box
              sx={{
                p: 2,
                borderTop: `1px solid ${theme.palette.divider}`,
                display: 'flex',
                gap: 1,
                alignItems: 'flex-end',
              }}
            >
              <TextField
                fullWidth
                placeholder="Write a message..."
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
                size="small"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '24px',
                    backgroundColor: theme.palette.background.default,
                  }
                }}
              />
              <IconButton
                onClick={handleSendMessage}
                disabled={!newMessage.trim() || sendingMessage}
                sx={{
                  backgroundColor: theme.palette.primary.main,
                  color: 'white',
                  width: 40,
                  height: 40,
                  '&:hover': {
                    backgroundColor: theme.palette.primary.dark,
                  },
                  '&:disabled': {
                    backgroundColor: theme.palette.action.disabledBackground,
                    color: theme.palette.action.disabled
                  }
                }}
              >
                {sendingMessage ? (
                  <CircularProgress size={20} color="inherit" />
                ) : (
                  <SendIcon fontSize="small" />
                )}
              </IconButton>
            </Box>
          </>
        )}
      </Paper>

      {/* Estimate Details Modal */}
      {selectedChat && (
        <EstimateDetailsModal
          estimateId={selectedChat.estimateId}
          open={estimateModalOpen}
          onClose={() => setEstimateModalOpen(false)}
        />
      )}
    </Box>
  );
};

export default Inbox;
