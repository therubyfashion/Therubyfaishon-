import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MessageCircle, X, Send, Image as ImageIcon, 
  Paperclip, User, Check, CheckCheck, Smile,
  MoreVertical, Phone, Video, Minimize2, Maximize2
} from 'lucide-react';
import { supabase } from '../supabase';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';

interface Message {
  id: string;
  text: string;
  senderId: string;
  senderRole?: string;
  createdAt: any;
  image?: string;
  type?: 'text' | 'image';
}

export default function ChatWidget() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleOpenChat = () => {
      setIsOpen(true);
      setIsMinimized(false);
    };
    window.addEventListener('open-ruby-chat', handleOpenChat);
    return () => window.removeEventListener('open-ruby-chat', handleOpenChat);
  }, []);

  const currentUserId = user?.id || user?.uid;

  // Initialize or fetch chat ID for user
  useEffect(() => {
    if (!currentUserId) return;

    let isMounted = true;

    const initChat = async () => {
      try {
        const { data: existingChats, error } = await supabase
          .from('chats')
          .select('id')
          .eq('user_id', currentUserId)
          .order('created_at', { ascending: false })
          .limit(1);

        if (error) {
          console.error("Error fetching user chat:", error);
          return;
        }

        if (existingChats && existingChats.length > 0) {
          if (isMounted) setActiveChatId(existingChats[0].id);
        }
      } catch (err) {
        console.error("Chat init error:", err);
      }
    };

    initChat();

    return () => { isMounted = false; };
  }, [currentUserId]);

  // Load messages & subscribe in real-time when activeChatId is set
  useEffect(() => {
    if (!currentUserId || !activeChatId) return;

    let isMounted = true;

    const fetchMessages = async () => {
      try {
        const { data, error } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('chat_id', activeChatId)
          .order('created_at', { ascending: true });

        if (error) {
          console.error("Error loading chat messages:", error);
          return;
        }

        if (data && isMounted) {
          const msgs: Message[] = data.map((m: any) => {
            const isImg = m.message?.startsWith('data:image/') || m.message?.startsWith('http://') || m.message?.startsWith('https://');
            return {
              id: m.id,
              text: m.message,
              senderId: m.sender_id,
              senderRole: m.sender_role,
              createdAt: m.created_at,
              type: isImg ? 'image' : 'text',
              image: isImg ? m.message : undefined
            };
          });
          setMessages(msgs);
        }

        // If chat widget is open, mark admin messages as read
        if (isOpen) {
          await supabase
            .from('chat_messages')
            .update({ is_read: true })
            .eq('chat_id', activeChatId)
            .eq('sender_role', 'admin')
            .eq('is_read', false);

          if (isMounted) setUnreadCount(0);
        }
      } catch (err) {
        console.error("Error fetching messages:", err);
      }
    };

    fetchMessages();

    // Real-time subscription to chat_messages for current chat
    const channel = supabase
      .channel(`user_chat_msgs_${activeChatId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `chat_id=eq.${activeChatId}`
        },
        (payload) => {
          const m = payload.new;
          if (!m) return;

          const isImg = m.message?.startsWith('data:image/') || m.message?.startsWith('http://') || m.message?.startsWith('https://');

          setMessages((prev) => {
            if (prev.some((item) => item.id === m.id)) return prev;
            return [
              ...prev,
              {
                id: m.id,
                text: m.message,
                senderId: m.sender_id,
                senderRole: m.sender_role,
                createdAt: m.created_at,
                type: isImg ? 'image' : 'text',
                image: isImg ? m.message : undefined
              }
            ];
          });

          if (m.sender_role === 'admin') {
            if (isOpen) {
              supabase
                .from('chat_messages')
                .update({ is_read: true })
                .eq('id', m.id)
                .then(() => {});
            } else {
              setUnreadCount((prev) => prev + 1);
            }
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [currentUserId, activeChatId, isOpen]);

  // Fetch unread count when widget is closed
  useEffect(() => {
    if (!currentUserId || !activeChatId || isOpen) return;

    const fetchUnread = async () => {
      const { count } = await supabase
        .from('chat_messages')
        .select('id', { count: 'exact', head: true })
        .eq('chat_id', activeChatId)
        .eq('sender_role', 'admin')
        .eq('is_read', false);

      if (typeof count === 'number') {
        setUnreadCount(count);
      }
    };

    fetchUnread();
  }, [currentUserId, activeChatId, isOpen]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const getOrCreateChatId = async (): Promise<string | null> => {
    if (!currentUserId) return null;
    if (activeChatId) return activeChatId;

    const { data: existingChats } = await supabase
      .from('chats')
      .select('id')
      .eq('user_id', currentUserId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (existingChats && existingChats.length > 0) {
      const existingId = existingChats[0].id;
      setActiveChatId(existingId);
      return existingId;
    }

    const nowIso = new Date().toISOString();
    const { data: newChat, error } = await supabase
      .from('chats')
      .insert({
        user_id: currentUserId,
        status: 'open',
        last_message: 'Chat started',
        last_message_at: nowIso,
        created_at: nowIso
      })
      .select('id')
      .single();

    if (error || !newChat) {
      console.error("Error creating chat in Supabase:", error);
      toast.error("Failed to start chat");
      return null;
    }

    setActiveChatId(newChat.id);
    return newChat.id;
  };

  const handleSendMessage = async (e?: React.FormEvent, imageUrl?: string) => {
    if (e) e.preventDefault();
    if (!user || (!message.trim() && !imageUrl)) return;

    const text = message.trim();
    const messageContent = imageUrl || text;
    setMessage('');

    try {
      const chatIdToUse = await getOrCreateChatId();
      if (!chatIdToUse) return;

      const nowIso = new Date().toISOString();

      // Insert message into chat_messages
      const { error: msgErr } = await supabase
        .from('chat_messages')
        .insert({
          chat_id: chatIdToUse,
          sender_id: currentUserId,
          sender_role: 'user',
          message: messageContent,
          is_read: false,
          created_at: nowIso
        });

      if (msgErr) throw msgErr;

      // Update chats table
      await supabase
        .from('chats')
        .update({
          last_message: imageUrl ? 'Sent an image' : text,
          last_message_at: nowIso,
          status: 'open'
        })
        .eq('id', chatIdToUse);

    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message");
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      toast.error("Image size must be less than 5MB");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      handleSendMessage(undefined, base64String);
    };
    reader.readAsDataURL(file);
  };

  if (!user) return null;

  return (
    <div className="fixed bottom-24 sm:bottom-8 right-4 sm:right-8 z-[9999]">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ 
              opacity: 1, 
              y: 0, 
              scale: 1,
              height: isMinimized ? '64px' : '500px',
              width: '350px'
            }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="bg-white rounded-[2rem] shadow-2xl border border-gray-100 flex flex-col overflow-hidden mb-4"
          >
            {/* Header */}
            <div className="bg-[#1A2C54] p-4 flex items-center justify-between text-white">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-ruby rounded-xl flex items-center justify-center shadow-lg">
                  <MessageCircle size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-widest">The Ruby Support</h3>
                  <div className="flex items-center space-x-1">
                    <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Online</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button 
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="p-2 hover:bg-white/10 rounded-xl transition-all"
                >
                  {isMinimized ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
                </button>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-2 hover:bg-white/10 rounded-xl transition-all"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {!isMinimized && (
              <>
                {/* Messages */}
                <div 
                  ref={scrollRef}
                  className="flex-grow overflow-y-auto p-4 space-y-4 bg-gray-50/50"
                >
                  <div className="text-center space-y-2 py-4">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Today</p>
                    <p className="text-[11px] text-gray-400 bg-white px-4 py-2 rounded-full inline-block shadow-sm border border-gray-100">
                      Welcome to The Ruby Support! How can we help you today?
                    </p>
                  </div>

                  {messages.map((msg) => {
                    const isUserMsg = msg.senderRole === 'user' || msg.senderId === currentUserId;
                    return (
                      <div 
                        key={msg.id}
                        className={`flex ${isUserMsg ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-[80%] space-y-1 ${isUserMsg ? 'items-end' : 'items-start'}`}>
                          <div className={`p-3 rounded-2xl text-sm shadow-sm ${
                            isUserMsg 
                              ? 'bg-ruby text-white rounded-tr-none' 
                              : 'bg-white text-[#1A2C54] border border-gray-100 rounded-tl-none'
                          }`}>
                            {msg.type === 'image' && msg.image ? (
                              <img 
                                src={msg.image} 
                                alt="Sent image" 
                                className="rounded-lg max-w-full h-auto cursor-pointer hover:opacity-90 transition-all"
                                onClick={() => window.open(msg.image, '_blank')}
                              />
                            ) : (
                              <p className="leading-relaxed">{msg.text}</p>
                            )}
                          </div>
                          <div className={`flex items-center space-x-1 px-1 ${isUserMsg ? 'justify-end' : 'justify-start'}`}>
                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                              {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...'}
                            </span>
                            {isUserMsg && <CheckCheck size={10} className="text-ruby" />}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Input */}
                <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-gray-100">
                  <div className="flex items-center space-x-2 bg-gray-50 rounded-2xl p-2 border border-gray-100 focus-within:ring-2 focus-within:ring-ruby/20 transition-all">
                    <button 
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2 text-gray-400 hover:text-ruby hover:bg-ruby/5 rounded-xl transition-all"
                    >
                      <ImageIcon size={20} />
                    </button>
                    <input 
                      type="file"
                      ref={fileInputRef}
                      onChange={handleImageUpload}
                      accept="image/*"
                      className="hidden"
                    />
                    <input 
                      type="text"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Type your message..."
                      className="flex-grow bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm font-medium text-[#1A2C54] focus:ring-2 focus:ring-ruby/20 focus:border-ruby/30 outline-none transition-all"
                    />
                    <button 
                      type="submit"
                      disabled={!message.trim()}
                      className="p-2 bg-ruby text-white rounded-xl shadow-lg shadow-ruby/20 hover:bg-ruby-dark transition-all disabled:opacity-50 disabled:shadow-none"
                    >
                      <Send size={18} />
                    </button>
                  </div>
                </form>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
