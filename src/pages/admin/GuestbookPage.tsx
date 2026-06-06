import React, { useEffect, useState } from 'react';
import { MessageSquare, Eye, EyeOff, Trash2, Send, X, Filter } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useEvent } from '../../contexts/EventContext';
import { GuestbookMessage } from '../../lib/types';
import { sanitizeText } from '../../lib/sanitize';

type FilterType = 'all' | 'no_reply' | 'hidden';

export default function GuestbookPage() {
  const { event } = useEvent();
  const [messages, setMessages] = useState<GuestbookMessage[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replyInputs, setReplyInputs] = useState<Record<string, string>>({});
  const [sending, setSending] = useState<string | null>(null);

  const load = async () => {
    if (!event) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('guestbook_messages')
        .select('*')
        .eq('event_id', event.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setMessages((data || []) as GuestbookMessage[]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Impossible de charger les messages';
      setError(message);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [event]);

  const filtered = messages.filter(m => {
    if (filter === 'no_reply') return !m.admin_reply;
    if (filter === 'hidden') return !m.is_visible;
    return true;
  });

  const toggleVisible = async (m: GuestbookMessage) => {
    try {
      const { error } = await supabase
        .from('guestbook_messages')
        .update({ is_visible: !m.is_visible })
        .eq('id', m.id);
      if (error) throw error;
      await load();
    } catch (err) {
      console.error('Failed to toggle visibility:', err);
    }
  };

  const deleteMsg = async (id: string) => {
    if (!confirm('Supprimer ce message ?')) return;
    try {
      const { error } = await supabase
        .from('guestbook_messages')
        .delete()
        .eq('id', id);
      if (error) throw error;
      await load();
    } catch (err) {
      console.error('Failed to delete message:', err);
    }
  };

  const sendReply = async (m: GuestbookMessage) => {
    const reply = replyInputs[m.id]?.trim();
    if (!reply) return;
    setSending(m.id);
    try {
      const { error } = await supabase
        .from('guestbook_messages')
        .update({ admin_reply: reply })
        .eq('id', m.id);
      if (error) throw error;
      setReplyInputs(prev => ({ ...prev, [m.id]: '' }));
      await load();
    } catch (err) {
      console.error('Failed to send reply:', err);
    }
    setSending(null);
  };

  const clearReply = async (m: GuestbookMessage) => {
    if (!confirm('Supprimer votre réponse ?')) return;
    try {
      const { error } = await supabase
        .from('guestbook_messages')
        .update({ admin_reply: '' })
        .eq('id', m.id);
      if (error) throw error;
      await load();
    } catch (err) {
      console.error('Failed to clear reply:', err);
    }
  };

  const fmt = (date: string) => new Date(date).toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <p className="text-sm text-stone-400 uppercase tracking-wide font-medium">Messages</p>
        <h1 className="font-serif text-3xl text-stone-800 mt-0.5">Livre d'or ({messages.length})</h1>
      </div>

      <div className="flex gap-2 flex-wrap">
        {([['all', 'Tous'], ['no_reply', 'Sans réponse'], ['hidden', 'Masqués']] as [FilterType, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              filter === key ? 'bg-terracotta-600 text-white' : 'bg-white border border-stone-200 text-stone-600 hover:border-stone-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && !loading && (
        <div className="rounded-2xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div key={idx} className="card h-24 animate-pulse bg-stone-100 rounded-3xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <MessageSquare className="w-12 h-12 text-stone-200 mx-auto mb-3" strokeWidth={1} />
          <p className="text-stone-400">Aucun message</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(m => (
            <div key={m.id} className={`card p-5 transition-opacity ${!m.is_visible ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium text-stone-800 text-sm">{m.author_name}</p>
                    <span className="text-xs text-stone-400">{fmt(m.created_at)}</span>
                    {!m.is_visible && (
                      <span className="text-xs bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full">Masqué</span>
                    )}
                  </div>
                  <p className="text-stone-700 text-sm leading-relaxed">{sanitizeText(m.content)}</p>

                  {m.admin_reply && (
                    <div className="mt-3 border-l-2 border-terracotta-200 pl-3 bg-terracotta-50/50 rounded-r-lg py-2">
                      <p className="text-xs text-terracotta-600 font-medium mb-0.5">Votre réponse</p>
                      <p className="text-sm text-stone-700 italic">{sanitizeText(m.admin_reply)}</p>
                      <button onClick={() => clearReply(m)} className="text-xs text-stone-400 hover:text-red-500 mt-1 transition-colors">
                        Supprimer la réponse
                      </button>
                    </div>
                  )}

                  {!m.admin_reply && (
                    <div className="mt-3 flex gap-2">
                      <input
                        className="input-field flex-1 text-sm py-2"
                        placeholder="Répondre..."
                        value={replyInputs[m.id] || ''}
                        onChange={e => setReplyInputs(prev => ({ ...prev, [m.id]: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Enter') sendReply(m); }}
                      />
                      <button
                        onClick={() => sendReply(m)}
                        disabled={sending === m.id || !replyInputs[m.id]?.trim()}
                        className="btn-primary px-3 py-2 flex items-center gap-1.5 text-sm"
                      >
                        <Send className="w-3.5 h-3.5" />
                        {sending === m.id ? '...' : 'Envoyer'}
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => toggleVisible(m)}
                    title={m.is_visible ? 'Masquer' : 'Afficher'}
                    className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-all"
                  >
                    {m.is_visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => deleteMsg(m.id)}
                    className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
