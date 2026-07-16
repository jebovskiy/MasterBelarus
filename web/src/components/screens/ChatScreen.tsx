import { useEffect, useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/auth';
import { useHaptic } from '@/hooks/useHaptic';
import { apiGet, apiPost, apiDelete } from '@/lib/api';

type Message = {
  id: string;
  order_id: string;
  sender_id: string;
  text: string;
  created_at: string;
};

type MessagesResponse = {
  messages: Message[];
  other_read_at: string | null;
};

type Conversation = {
  order_id: string;
  category: string;
  description: string;
  price: number | null;
  status: string;
  other_participant_name: string;
  other_participant_id?: string;
  last_message: string;
  last_message_at: string;
  unread: number;
};

type Props = { onBack: () => void; onOpenOrder?: (id: string) => void; initialOrderId?: string | null };

export default function ChatScreen({ onBack, onOpenOrder, initialOrderId }: Props) {
  const { t } = useTranslation();
  const profile = useAuthStore((s) => s.profile);
  const { impact, notification } = useHaptic();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(initialOrderId ?? null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [otherReadAt, setOtherReadAt] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingConv, setLoadingConv] = useState(true);
  const [loadingMsg, setLoadingMsg] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const msgCountRef = useRef(0);
  const convLoadedRef = useRef(false);

  // Block/hide state
  const [menuOpen, setMenuOpen] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'block' | 'unblock' | 'hide' | null>(null);

  const markRead = useCallback(async (orderId: string) => {
    await apiPost(`/orders/${orderId}/read`, {});
  }, []);

  const loadConversations = useCallback(async () => {
    if (!profile) return;
    const res = await apiGet<{ conversations: Conversation[] }>('/orders/chats');
    if ('data' in res && res.data) {
      setConversations(res.data.conversations ?? []);
    }
    setLoadingConv(false);
  }, [profile]);

  useEffect(() => { void loadConversations(); }, [loadConversations]);

  // Check if current chat partner is blocked
  const checkBlocked = useCallback(async (orderId: string) => {
    const conv = conversations.find((c) => c.order_id === orderId);
    if (!conv?.other_participant_id) { setBlocked(false); return; }
    const res = await apiGet<{ blocks: { blocked_id: string }[] }>('/blocks');
    if ('data' in res && res.data) {
      setBlocked(res.data.blocks.some((b) => b.blocked_id === conv.other_participant_id));
    }
  }, [conversations]);

  const loadMessages = useCallback(async (orderId: string, isPoll = false) => {
    if (!isPoll) {
      setLoadingMsg(true);
      await markRead(orderId);
      void checkBlocked(orderId);
      if (!convLoadedRef.current) {
        convLoadedRef.current = true;
        void loadConversations();
      }
    }
    const res = await apiGet<MessagesResponse>(`/orders/${orderId}/messages`);
    if ('data' in res && res.data) {
      setMessages(res.data.messages);
      setOtherReadAt(res.data.other_read_at);
    }
    if (!isPoll) setLoadingMsg(false);
  }, [markRead, loadConversations, checkBlocked]);

  useEffect(() => {
    if (activeOrderId) {
      void loadMessages(activeOrderId);
      const interval = setInterval(() => { if (!document.hidden) void loadMessages(activeOrderId, true); }, 3000);
      return () => clearInterval(interval);
    }
  }, [activeOrderId, loadMessages]);

  useEffect(() => {
    if (messages.length === 0) return;
    const isNew = messages.length > msgCountRef.current;
    msgCountRef.current = messages.length;
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: isNew ? 'smooth' : 'instant' });
    });
  }, [messages, loadingMsg]);

  const sendMessage = async () => {
    if (!input.trim() || !activeOrderId) return;
    setSending(true);
    impact('light');
    const res = await apiPost(`/orders/${activeOrderId}/messages`, { text: input.trim() });
    setSending(false);
    if ('error' in res) { notification('error'); return; }
    setInput('');
    void loadMessages(activeOrderId);
    void loadConversations();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  const handleBlock = async () => {
    if (!activeOrderId) return;
    const conv = conversations.find((c) => c.order_id === activeOrderId);
    if (!conv?.other_participant_id) return;
    impact('medium');
    const res = await apiPost(`/blocks/${conv.other_participant_id}`);
    setConfirmAction(null);
    setMenuOpen(false);
    if ('error' in res) { notification('error'); return; }
    setBlocked(true);
  };

  const handleUnblock = async () => {
    if (!activeOrderId) return;
    const conv = conversations.find((c) => c.order_id === activeOrderId);
    if (!conv?.other_participant_id) return;
    impact('light');
    const res = await apiDelete(`/blocks/${conv.other_participant_id}`);
    setConfirmAction(null);
    setMenuOpen(false);
    if ('error' in res) { notification('error'); return; }
    setBlocked(false);
  };

  const handleHide = async () => {
    if (!activeOrderId) return;
    impact('medium');
    const res = await apiPost(`/blocks/chats/hide/${activeOrderId}`);
    setConfirmAction(null);
    setMenuOpen(false);
    if ('error' in res) { notification('error'); return; }
    setActiveOrderId(null);
    void loadConversations();
  };

  const inputCls = 'w-full bg-[#f4f4f6] text-slate-800 placeholder-slate-400 rounded-xl p-4 border-transparent focus:ring-2 focus:ring-slate-400 focus:bg-white transition-all outline-none text-base';

  // Conversation list view
  if (!activeOrderId) {
    return (
      <div className="min-h-screen bg-[#f4f4f6] flex flex-col">
        <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-xl border-b border-slate-100">
          <div className="flex items-center gap-3 px-5 h-14">
            <button onClick={onBack} className="text-sm font-semibold text-slate-500">{t('common.back')}</button>
            <h2 className="text-base font-bold text-slate-800">{t('chat.title')}</h2>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pt-4 space-y-2">
          {loadingConv && [0, 1].map((i) => (
            <div key={i} className="bg-white rounded-2xl p-4 animate-pulse shadow-sm border border-slate-100">
              <div className="h-4 w-24 bg-slate-200 rounded mb-2" />
              <div className="h-3 w-full bg-slate-100 rounded" />
            </div>
          ))}
          {!loadingConv && conversations.length === 0 && (
            <div className="text-center py-16">
              <span className="text-4xl block mb-3">💬</span>
              <p className="text-sm text-slate-400">{t('chat.no_chats')}</p>
            </div>
          )}
          {conversations.map((c) => (
            <button
              key={c.order_id}
              onClick={() => setActiveOrderId(c.order_id)}
              className="w-full bg-white rounded-2xl p-4 shadow-sm border border-slate-100 text-left hover:scale-[1.01] active:scale-[0.99] transition-transform"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold">{t(`home.categories.${c.category}`)}</span>
                {c.unread > 0 && (
                  <span className="w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">{c.unread}</span>
                )}
              </div>
              <p className="text-sm font-semibold text-slate-800 line-clamp-1">{c.other_participant_name}</p>
              <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{c.description} — {c.price ? `${c.price} BYN` : t('master.negotiable')}</p>
              {c.last_message && <p className="text-sm text-slate-600 line-clamp-1 mt-1">{c.last_message}</p>}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Message view
  const conv = conversations.find((c) => c.order_id === activeOrderId);

  return (
    <div className="min-h-screen bg-[#f4f4f6] flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-xl border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-3 px-5 h-14">
          <button onClick={() => { setActiveOrderId(null); void loadConversations(); }} className="text-sm font-semibold text-slate-500">{t('common.back')}</button>
          <h2 className="text-base font-bold text-slate-800 truncate max-w-[180px]">
            {conv?.other_participant_name ?? t('chat.conversation')}
          </h2>
          {onOpenOrder && (
            <button onClick={() => onOpenOrder(activeOrderId)} className="ml-auto text-xs font-semibold text-slate-500">{t('chat.view_order')}</button>
          )}
          <div className="relative">
            <button onClick={() => setMenuOpen(!menuOpen)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 bg-white rounded-xl shadow-lg border border-slate-100 py-1 min-w-[180px]">
                  {blocked ? (
                    <button onClick={() => setConfirmAction('unblock')} className="w-full text-left px-4 py-2.5 text-sm text-blue-600 hover:bg-slate-50">{t('chat.unblock')}</button>
                  ) : (
                    <button onClick={() => setConfirmAction('block')} className="w-full text-left px-4 py-2.5 text-sm text-rose-500 hover:bg-slate-50">{t('chat.block')}</button>
                  )}
                  <button onClick={() => setConfirmAction('hide')} className="w-full text-left px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50">{t('chat.hide')}</button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Blocked banner */}
      {blocked && (
        <div className="bg-rose-50 border-b border-rose-100 px-4 py-3 text-center shrink-0">
          <p className="text-xs font-semibold text-rose-700">{t('chat.blocked_banner')}</p>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {loadingMsg && (
          <div className="text-center py-8">
            <div className="w-6 h-6 border-2 border-slate-300 border-t-slate-800 rounded-full animate-spin mx-auto" />
          </div>
        )}
        {!loadingMsg && messages.length === 0 && (
          <div className="text-center py-16">
            <p className="text-sm text-slate-400">{t('chat.no_messages')}</p>
          </div>
        )}
        {messages.map((m) => {
          const isMine = m.sender_id === profile?.id;
          const isRead = isMine && otherReadAt && new Date(m.created_at) <= new Date(otherReadAt);
          return (
            <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${isMine ? 'bg-white text-slate-800 shadow-sm border border-slate-100 rounded-br-md' : 'bg-white text-slate-800 shadow-sm border border-slate-100 rounded-bl-md'}`}>
                <p className="text-sm leading-relaxed">{m.text}</p>
                <div className={`flex items-center gap-1 mt-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
                  <span className="text-[10px] text-slate-400">
                    {new Date(m.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {isMine && (
                    <span className={`text-[10px] ${isRead ? 'text-sky-400' : 'text-slate-500'}`}>
                      {isRead ? '✓✓' : '✓'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="sticky bottom-0 bg-white border-t border-slate-100 px-4 py-3 shrink-0">
        {blocked ? (
          <p className="text-xs text-slate-400 text-center py-2">{t('chat.blocked_input')}</p>
        ) : (
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value.slice(0, 2000))}
              onKeyDown={handleKeyDown}
              placeholder={t('chat.input_placeholder')}
              rows={1}
              className={`${inputCls} resize-none min-h-[48px] max-h-[120px]`}
            />
            <button
              onClick={() => void sendMessage()}
              disabled={!input.trim() || sending}
              className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0 disabled:opacity-30 hover:scale-[1.05] active:scale-[0.95] transition-transform"
            >
              {sending ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Confirm dialog */}
      {confirmAction && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40" onClick={() => setConfirmAction(null)}>
          <div className="bg-white rounded-2xl p-6 mx-6 max-w-sm w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <p className="text-base font-bold text-slate-900 mb-2">
              {confirmAction === 'block' && t('chat.confirm_block')}
              {confirmAction === 'unblock' && t('chat.confirm_unblock')}
              {confirmAction === 'hide' && t('chat.confirm_hide')}
            </p>
            <p className="text-sm text-slate-500 mb-5">
              {confirmAction === 'block' && t('chat.confirm_block_desc')}
              {confirmAction === 'unblock' && t('chat.confirm_unblock_desc')}
              {confirmAction === 'hide' && t('chat.confirm_hide_desc')}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmAction(null)} className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-sm font-semibold">{t('common.cancel')}</button>
              <button
                onClick={() => {
                  if (confirmAction === 'block') void handleBlock();
                  else if (confirmAction === 'unblock') void handleUnblock();
                  else if (confirmAction === 'hide') void handleHide();
                }}
                className={`flex-1 py-2.5 rounded-xl text-white text-sm font-semibold ${confirmAction === 'block' ? 'bg-rose-500' : confirmAction === 'unblock' ? 'bg-blue-500' : 'bg-slate-800'}`}
              >
                {t('common.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
