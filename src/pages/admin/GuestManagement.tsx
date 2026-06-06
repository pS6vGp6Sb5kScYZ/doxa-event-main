import React, { useEffect, useState } from 'react';
import {
  UserPlus, Search, Download, QrCode, Pencil, Trash2,
  CheckCircle, Clock, XCircle, X, ScanLine, Copy, Eye
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useEvent } from '../../contexts/EventContext';
import { Guest } from '../../lib/types';
import QRCodeDisplay from '../../components/QRCodeDisplay';
import { useGuestList } from '../../hooks/useGuestList';

const STATUS_LABELS: Record<Guest['status'], string> = {
  pending: 'En attente',
  confirmed: 'Confirmé',
  declined: 'Refusé',
};
const STATUS_COLORS: Record<Guest['status'], string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  confirmed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  declined: 'bg-red-50 text-red-700 border-red-200',
};

interface GuestForm {
  name: string;
  email: string;
  phone: string;
  table_name: string;
  seats: number;
}

const empty: GuestForm = { name: '', email: '', phone: '', table_name: '', seats: 1 };

export default function GuestManagement() {
  const { event } = useEvent();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | Guest['status']>('all');
  const [modal, setModal] = useState<'add' | 'edit' | 'qr' | null>(null);
  const [selected, setSelected] = useState<Guest | null>(null);
  const [form, setForm] = useState<GuestForm>(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const { guests, loading, refresh, total, page, pageCount, setPage } = useGuestList({
    eventId: event?.id || '',
    pageSize: 5,
    filters: { status: filter === 'all' ? undefined : filter, searchTerm: search || undefined },
  });

  const inviteUrl = (token: string) => `${window.location.origin}/invite/${token}`;

  const openAdd = () => { setForm(empty); setSelected(null); setModal('add'); setError(''); };
  const openEdit = (g: Guest) => {
    setSelected(g);
    setForm({ name: g.name, email: g.email, phone: g.phone, table_name: g.table_name, seats: g.seats });
    setModal('edit');
    setError('');
  };
  const openQR = (g: Guest) => { setSelected(g); setModal('qr'); };

  const save = async () => {
    if (!event || !form.name.trim()) { setError('Le nom est requis.'); return; }
    if (form.email && !form.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      setError('Email invalide.');
      return;
    }
    setSaving(true);
    setError('');

    try {
      if (modal === 'add') {
        const { error } = await supabase.from('guests').insert({
          event_id: event.id,
          qr_token: crypto.randomUUID(),
          ...form,
        });
        if (error) throw error;
        setPage(0);
      } else if (modal === 'edit' && selected) {
        const { error } = await supabase.from('guests').update(form).eq('id', selected.id);
        if (error) throw error;
      }

      setModal(null);
      setSearch('');
      setFilter('all');
      await refresh();
        // notify dashboard and other listeners that guests changed
        try { window.dispatchEvent(new CustomEvent('guest:changed', { detail: { eventId: event.id } })); } catch (e) {}
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    }
    setSaving(false);
  };

  const remove = async (id: string) => {
    if (!confirm('Supprimer cet invité ?')) return;
    try {
      const { error } = await supabase.from('guests').delete().eq('id', id);
      if (error) throw error;
      setSearch('');
      setFilter('all');
      await refresh();
      try { window.dispatchEvent(new CustomEvent('guest:changed', { detail: { eventId: event?.id } })); } catch (e) {}
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la suppression');
    }
  };

  const exportCSV = () => {
    const rows = [
      ['Nom', 'Email', 'Téléphone', 'Table', 'Places', 'Statut', 'Arrivée', 'Lien invitation'],
      ...guests.map(g => [g.name, g.email, g.phone, g.table_name, g.seats, g.status, g.checked_in ? 'Oui' : 'Non', inviteUrl(g.qr_token)]),
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'invites.csv'; a.click();
  };

  const copyLink = (token: string) => {
    navigator.clipboard.writeText(inviteUrl(token));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm text-stone-400 uppercase tracking-wide font-medium">Gestion</p>
          <h1 className="font-serif text-3xl text-stone-800 mt-0.5">Invités ({total})</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="btn-secondary flex items-center gap-2 text-sm">
            <Download className="w-4 h-4" /> Exporter
          </button>
          <button onClick={openAdd} className="btn-primary flex items-center gap-2 text-sm">
            <UserPlus className="w-4 h-4" /> Ajouter
          </button>
        </div>
      </div>

      {error && !loading && (
        <div className="rounded-2xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            type="text"
            placeholder="Rechercher un invité..."
            className="input-field pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {(['all', 'pending', 'confirmed', 'declined'] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
                filter === s ? 'bg-terracotta-600 text-white border-terracotta-600' : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300'
              }`}
            >
              {s === 'all' ? 'Tous' : STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading && guests.length === 0 ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, idx) => (
              <div key={idx} className="h-14 rounded-2xl bg-stone-100 animate-pulse" />
            ))}
          </div>
        ) : guests.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 text-stone-200 mx-auto mb-3" strokeWidth={1} />
            <p className="text-stone-400">Aucun invité trouvé</p>
            <button onClick={openAdd} className="btn-primary mt-4 text-sm">Ajouter le premier invité</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-stone-100">
                  <th className="text-left text-xs font-medium text-stone-400 uppercase tracking-wide px-5 py-3">Nom</th>
                  <th className="text-left text-xs font-medium text-stone-400 uppercase tracking-wide px-5 py-3 hidden md:table-cell">Table</th>
                  <th className="text-left text-xs font-medium text-stone-400 uppercase tracking-wide px-5 py-3 hidden sm:table-cell">Statut</th>
                  <th className="text-left text-xs font-medium text-stone-400 uppercase tracking-wide px-5 py-3 hidden lg:table-cell">Arrivée</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {guests.map(g => (
                  <tr key={g.id} className="hover:bg-stone-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-stone-800 text-sm">{g.name}</p>
                      {g.email && <p className="text-xs text-stone-400 mt-0.5">{g.email}</p>}
                    </td>
                    <td className="px-5 py-3.5 hidden md:table-cell text-sm text-stone-600">{g.table_name || '—'}</td>
                    <td className="px-5 py-3.5 hidden sm:table-cell">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full border ${STATUS_COLORS[g.status]}`}>
                        {STATUS_LABELS[g.status]}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 hidden lg:table-cell">
                      {g.checked_in ? (
                        <span className="flex items-center gap-1.5 text-xs text-emerald-600">
                          <ScanLine className="w-3.5 h-3.5" /> Arrivé
                        </span>
                      ) : (
                        <span className="text-xs text-stone-400">En attente</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => window.open(inviteUrl(g.qr_token), '_blank') } title="Voir l'invitation" className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-all">
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => copyLink(g.qr_token)} title="Copier le lien" className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-all">
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => openQR(g)} title="Voir QR" className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-all">
                          <QrCode className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => openEdit(g)} title="Modifier" className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-all">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => remove(g.id)} title="Supprimer" className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pageCount > 1 && (
          <div className="px-5 py-4 border-t border-stone-100 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-sm text-stone-500">
            <span>Invités {(page * 5) + 1} – {Math.min(total, (page + 1) * 5)} sur {total}</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page === 0}
                className="px-3 py-2 rounded-lg border border-stone-200 bg-white text-stone-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Précédent
              </button>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page >= pageCount - 1}
                className="px-3 py-2 rounded-lg border border-stone-200 bg-white text-stone-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Suivant
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {(modal === 'add' || modal === 'edit') && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md animate-slide-up">
            <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
              <h2 className="font-serif text-lg text-stone-800">
                {modal === 'add' ? 'Nouvel invité' : 'Modifier invité'}
              </h2>
              <button onClick={() => setModal(null)} className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
              <div>
                <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1.5">Nom *</label>
                <input
                  className="input-field"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="Prénom Nom"
                  maxLength={100}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1.5">Email</label>
                  <input
                    className="input-field"
                    type="email"
                    value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                    placeholder="email@..."
                    maxLength={254}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1.5">Téléphone</label>
                  <input
                    className="input-field"
                    value={form.phone}
                    onChange={e => setForm({ ...form, phone: e.target.value })}
                    placeholder="+243..."
                    maxLength={20}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1.5">Table</label>
                  <input
                    className="input-field"
                    value={form.table_name}
                    onChange={e => setForm({ ...form, table_name: e.target.value })}
                    placeholder="Table 1"
                    maxLength={50}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1.5">Places</label>
                  <input
                    className="input-field"
                    type="number"
                    min={1}
                    max={20}
                    value={form.seats}
                    onChange={e => setForm({ ...form, seats: Number(e.target.value) })}
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-stone-100">
              <button onClick={() => setModal(null)} className="btn-secondary flex-1">Annuler</button>
              <button onClick={save} className="btn-primary flex-1" disabled={saving}>
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Modal */}
      {modal === 'qr' && selected && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm animate-slide-up">
            <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
              <h2 className="font-serif text-lg text-stone-800">QR Code — {selected.name}</h2>
              <button onClick={() => setModal(null)} className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 flex flex-col items-center gap-4">
              <QRCodeDisplay value={inviteUrl(selected.qr_token)} size={220} />
              <div className="w-full bg-stone-50 rounded-xl p-3">
                <p className="text-xs text-stone-500 mb-1">Lien d'invitation personnel</p>
                <p className="text-xs text-stone-700 break-all font-mono">{inviteUrl(selected.qr_token)}</p>
              </div>
              <button
                onClick={() => copyLink(selected.qr_token)}
                className="btn-secondary w-full flex items-center justify-center gap-2 text-sm"
              >
                <Copy className="w-3.5 h-3.5" /> Copier le lien
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Users({ className, strokeWidth }: { className?: string; strokeWidth?: number }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={strokeWidth || 2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
