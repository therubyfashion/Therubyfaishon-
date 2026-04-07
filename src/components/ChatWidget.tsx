import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MessageCircle, X, Send, Image as ImageIcon, 
  Paperclip, User, Check, CheckCheck, Smile,
  MoreVertical, Phone, Video, Minimize2, Maximize2
} from 'lucide-react';
import { 
  collection, addDoc, query, orderBy, 
  onSnapshot, doc, updateDoc, serverTimestamp,
  setDoc, getDoc, where, limit
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';

interface Message {
  id: string;
  text: string;
  senderId: string;
  createdAt: any;
  image?: string;
  type?: 'text' | 'image';
}

export default function ChatWidget() {
  const { user, isAdmin } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
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

  useEffect(() => {
    if (!user || !isOpen) return;

    const chatId = user.uid;
    const q = query(
      collection(db, 'chats', chatId, 'messages'),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];
      setMessages(msgs);
      
      // Reset unread count for user when chat is open
      updateDoc(doc(db, 'chats', chatId), {
        unreadCountUser: 0
      }).catch(() => {});
    });

    return () => unsubscribe();
  }, [user, isOpen, isAdmin]);

  useEffect(() => {
    if (!user) return;

    const chatId = user.uid;
    const unsubscribe = onSnapshot(doc(db, 'chats', chatId), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        if (!isOpen) {
          setUnreadCount(data.unreadCountUser || 0);
        }
      }
    });

    return () => unsubscribe();
  }, [user, isOpen, isAdmin]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (e?: React.FormEvent, imageUrl?: string) => {
    if (e) e.preventDefault();
    if (!user || (!message.trim() && !imageUrl)) return;

    const chatId = user.uid;
    const text = message.trim();
    setMessage('');

    try {
      // Ensure chat document exists
      const chatRef = doc(db, 'chats', chatId);
      const chatDoc = await getDoc(chatRef);
      
      if (!chatDoc.exists()) {
        await setDoc(chatRef, {
          userId: user.uid,
          userName: user.displayName || 'Anonymous',
          userEmail: user.email,
          lastMessage: imageUrl ? 'Sent an image' : text,
          lastMessageAt: serverTimestamp(),
          unreadCountAdmin: 1,
          unreadCountUser: 0,
          status: 'active',
          createdAt: serverTimestamp()
        });
      } else {
        await updateDoc(chatRef, {
          lastMessage: imageUrl ? 'Sent an image' : text,
          lastMessageAt: serverTimestamp(),
          unreadCountAdmin: (chatDoc.data().unreadCountAdmin || 0) + 1
        });
      }

      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        text: text || '',
        image: imageUrl || null,
        type: imageUrl ? 'image' : 'text',
        senderId: user.uid,
        createdAt: serverTimestamp()
      });

    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message");
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1024 * 1024) { // 1MB limit
      toast.error("Image size must be less than 1MB");
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

                  {messages.map((msg) => (
                    <div 
                      key={msg.id}
                      className={`flex ${msg.senderId === user.uid ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-[80%] space-y-1 ${msg.senderId === user.uid ? 'items-end' : 'items-start'}`}>
                        <div className={`p-3 rounded-2xl text-sm shadow-sm ${
                          msg.senderId === user.uid 
                            ? 'bg-ruby text-white rounded-tr-none' 
                            : 'bg-white text-[#1A2C54] border border-gray-100 rounded-tl-none'
                        }`}>
                          {msg.type === 'image' ? (
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
                        <div className={`flex items-center space-x-1 px-1 ${msg.senderId === user.uid ? 'justify-end' : 'justify-start'}`}>
                          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                            {msg.createdAt ? new Date(msg.createdAt.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...'}
                          </span>
                          {msg.senderId === user.uid && <CheckCheck size={10} className="text-ruby" />}
                        </div>
                      </div>
                    </div>
                  ))}
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
