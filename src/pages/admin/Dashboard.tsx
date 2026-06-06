import React, { useEffect, useState } from 'react';
import { Users, CheckCircle, Clock, XCircle, ScanLine, MessageSquare, Wine, TrendingUp, RefreshCw, Plus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useEvent } from '../../contexts/EventContext';
import { ScanEvent } from '../../lib/types';
import { useStatsCache } from '../../hooks/useStatsCache';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const { event } = useEvent();
  const { stats: cacheStats, loading: statsLoading, error: statsError, refetch: refreshStats } = useStatsCache(event?.id || '', 3000);
  const [recentScans, setRecentScans] = useState<Array<ScanEvent & { guests: { name: string } | null }>>([]);
  const [messageCount, setMessageCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const pollIntervalRef = React.useRef<NodeJS.Timeout | null>(null);

  const load = async () => {
    if (!event) return;
    setLoading(true);
    setLoadError(null);

    try {
      const [messagesRes, scansRes] = await Promise.all([
        supabase.from('guestbook_messages').select('id').eq('event_id', event.id),
        supabase.from('scan_events').select('*, guests(name)').eq('event_id', event.id).order('scanned_at', { ascending: false }).limit(5),
      ]);

      if (messagesRes.error) throw messagesRes.error;
      if (scansRes.error) throw scansRes.error;

      setMessageCount(messagesRes.data?.length || 0);
      setRecentScans((scansRes.data || []) as any);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Impossible de charger les données du tableau de bord.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    await refreshStats();
    await load();
  };

  useEffect(() => { load(); }, [event]);

  useEffect(() => {
    if (!event) return;
    // Use polling instead of realtime subscriptions for better scalability (3-second interval)
    pollIntervalRef.current = setInterval(() => {
      load();
      refreshStats();
    }, 3000);

    const handleScanEvent = (e: any) => {
      // Immediate refresh when a scan completes
      load();
      refreshStats();
    };

    const handleGuestChanged = (e: any) => {
      load();
      refreshStats();
    };

    window.addEventListener('scan:completed', handleScanEvent);
    window.addEventListener('guest:changed', handleGuestChanged);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      window.removeEventListener('scan:completed', handleScanEvent);
      window.removeEventListener('guest:changed', handleGuestChanged);
    };
  }, [event, refreshStats]);

  if (!event) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <p className="text-sm text-stone-400 uppercase tracking-wide font-medium">Vue d'ensemble</p>
          <h1 className="font-serif text-3xl text-stone-800 mt-0.5">Tableau de bord</h1>
        </div>

        <div className="card p-12 text-center">
          <Users className="w-16 h-16 text-stone-200 mx-auto mb-4" strokeWidth={1} />
          <h3 className="font-serif text-lg text-stone-800 mb-2">Aucun événement créé</h3>
          <p className="text-stone-500 mb-6">Commencez par créer votre premier événement pour voir le tableau de bord.</p>
          <Link to="/admin/settings" className="btn-primary inline-flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Créer un événement
          </Link>
        </div>
      </div>
    );
  }

  if (loadError) return <div className="text-center py-12 text-red-500">{loadError}</div>;
  if (statsError) return <div className="text-center py-12 text-red-500">Erreur de chargement des statistiques : {statsError}</div>;
  if (!cacheStats && statsLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="h-8 w-56 bg-stone-100 rounded-full animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, idx) => (
            <div key={idx} className="h-28 rounded-3xl bg-stone-100 animate-pulse" />
          ))}
        </div>
        <div className="grid md:grid-cols-2 gap-5">
          <div className="h-72 rounded-3xl bg-stone-100 animate-pulse" />
          <div className="h-72 rounded-3xl bg-stone-100 animate-pulse" />
        </div>
      </div>
    );
  }

  const stats = {
    total: cacheStats?.total_guests || 0,
    confirmed: cacheStats?.confirmed_count || 0,
    pending: cacheStats ? (cacheStats.total_guests - cacheStats.confirmed_count - cacheStats.absent_count) : 0,
    declined: cacheStats?.absent_count || 0,
    checkedIn: cacheStats?.checked_in_count || 0,
    messages: messageCount,
    rate: cacheStats && cacheStats.total_guests > 0 ? Math.round((cacheStats.confirmed_count / cacheStats.total_guests) * 100) : 0,
  };

  const statCards = [
    { label: 'INVITÉS', value: stats.total, icon: Users, color: 'text-blue-500', bg: 'bg-blue-50' },
    { label: 'CONFIRMÉS', value: stats.confirmed, icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-50' },
    { label: 'EN ATTENTE', value: stats.pending, icon: Clock, color: 'text-amber-500', bg: 'bg-amber-50' },
    { label: 'REFUSÉS', value: stats.declined, icon: XCircle, color: 'text-red-500', bg: 'bg-red-50' },
    { label: 'ARRIVÉES SCANNÉES', value: stats.checkedIn, icon: ScanLine, color: 'text-terracotta-500', bg: 'bg-terracotta-50' },
    { label: 'MESSAGES', value: stats.messages, icon: MessageSquare, color: 'text-stone-500', bg: 'bg-stone-50' },
    { label: 'SCANS', value: cacheStats?.scan_count || 0, icon: Wine, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'TAUX CONFIRMÉ', value: `${stats.rate}%`, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  ];

  const rsvpData = [
    { label: 'Confirmés', value: stats.confirmed, color: 'bg-terracotta-500' },
    { label: 'En attente', value: stats.pending, color: 'bg-amber-400' },
    { label: 'Refusés', value: stats.declined, color: 'bg-red-400' },
  ];
  const totalRsvp = stats.confirmed + stats.pending + stats.declined || 1;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-stone-400 uppercase tracking-wide font-medium">Vue d'ensemble</p>
          <h1 className="font-serif text-3xl text-stone-800 mt-0.5">Tableau de bord</h1>
        </div>
      </div>
      <button onClick={refreshStats} className="flex items-center gap-2 text-sm text-stone-500 hover:text-stone-800 bg-white border border-stone-200 px-3 py-2 rounded-lg transition-all">
        <RefreshCw className={`w-3.5 h-3.5 ${statsLoading ? 'animate-spin' : ''}`} />
        Mis à jour en temps réel
      </button>
      

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="stat-card">
            <div className={`w-9 h-9 ${bg} rounded-xl flex items-center justify-center`}>
              <Icon className={`w-4.5 h-4.5 ${color}`} strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-2xl font-semibold text-stone-800">{value}</p>
              <p className="text-xs text-stone-400 font-medium tracking-wide mt-0.5">{label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        <div className="card p-5">
          <h2 className="font-serif text-lg text-stone-700 mb-4">Répartition RSVP</h2>
          <div className="space-y-3">
            {rsvpData.map(({ label, value, color }) => (
              <div key={label}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-stone-600">{label}</span>
                  <span className="font-medium text-stone-800">{value}</span>
                </div>
                <div className="h-2.5 bg-stone-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${color} rounded-full transition-all duration-700`}
                    style={{ width: `${(value / totalRsvp) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 flex justify-center">
            <div className="relative w-32 h-32">
              <svg viewBox="0 0 36 36" className="w-32 h-32 -rotate-90">
                {(() => {
                  const segments = [
                    { value: stats.confirmed, color: '#c44e27' },
                    { value: stats.pending, color: '#fbbf24' },
                    { value: stats.declined, color: '#f87171' },
                  ];
                  let offset = 0;
                  return segments.map(({ value, color }, i) => {
                    const pct = (value / totalRsvp) * 100;
                    const el = (
                      <circle
                        key={i}
                        cx="18" cy="18" r="15.9"
                        fill="none"
                        stroke={color}
                        strokeWidth="3.5"
                        strokeDasharray={`${pct} ${100 - pct}`}
                        strokeDashoffset={-offset}
                      />
                    );
                    offset += pct;
                    return el;
                  });
                })()}
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-xl font-semibold text-stone-800">{stats.rate}%</p>
                  <p className="text-xs text-stone-400">confirmés</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <h2 className="font-serif text-lg text-stone-700 mb-4">Dernières arrivées</h2>
          {recentScans.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-stone-400">
              <ScanLine className="w-10 h-10 mb-2" strokeWidth={1} />
              <p className="text-sm">Aucun scan pour le moment</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentScans.slice(0, 5).map(scan => (
                <div key={scan.id} className="flex items-center justify-between py-2 border-b border-stone-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-stone-800">
                      {scan.guests?.name || 'Inconnu'}
                    </p>
                    <p className="text-xs text-stone-400">
                      {new Date(scan.scanned_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                    scan.result === 'valid' ? 'bg-emerald-50 text-emerald-700' :
                    scan.result === 'duplicate' ? 'bg-amber-50 text-amber-700' :
                    'bg-red-50 text-red-700'
                  }`}>
                    {scan.result === 'valid' ? 'Valide' : scan.result === 'duplicate' ? 'Déjà scanné' : 'Invalide'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
