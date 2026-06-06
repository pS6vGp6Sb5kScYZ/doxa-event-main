import React, { useEffect, useState } from 'react';
import { Save, Upload, AlertCircle, CheckCircle, Trash2, Heart, Clock, MapPin, Plus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useEvent } from '../../contexts/EventContext';
import { useAuth } from '../../contexts/AuthContext';
import { EventSettings } from '../../lib/types';

const SETTINGS_CACHE_TTL = 5 * 60 * 1000;

function getSettingsCacheKey(eventId: string) {
  return `doxa:settings_form_cache_v1:${eventId}`;
}

function loadSettingsCache(eventId: string) {
  try {
    const raw = localStorage.getItem(getSettingsCacheKey(eventId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { form: Partial<EventSettings>; ts: number };
    if (Date.now() - parsed.ts > SETTINGS_CACHE_TTL) {
      localStorage.removeItem(getSettingsCacheKey(eventId));
      return null;
    }
    return parsed.form;
  } catch {
    return null;
  }
}

function saveSettingsCache(eventId: string, form: Partial<EventSettings>) {
  try {
    localStorage.setItem(getSettingsCacheKey(eventId), JSON.stringify({ form, ts: Date.now() }));
  } catch {
    // ignore storage errors
  }
}

export default function SettingsPage() {
  const { event, refresh, selectEvent, loading: eventLoading } = useEvent();
  const { user } = useAuth();
  const cachedForm = event?.id ? loadSettingsCache(event.id) : null;
  const [form, setForm] = useState<Partial<EventSettings>>(cachedForm || {});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newEventForm, setNewEventForm] = useState({
    groom_name: '',
    bride_name: '',
    event_date: '',
    event_time: '',
  });

  useEffect(() => {
    if (!event) {
      if (!event?.id) {
        setForm({});
      }
      return;
    }

    const cached = loadSettingsCache(event.id);
    setForm(cached || event);
  }, [event?.id]);

  useEffect(() => {
    if (!event?.id) return;
    saveSettingsCache(event.id, form);
  }, [event?.id, form]);

  const createEvent = async () => {
    if (!user || !newEventForm.groom_name.trim() || !newEventForm.bride_name.trim() || !newEventForm.event_date) {
      setMessage({ type: 'error', text: 'Veuillez remplir tous les champs requis.' });
      return;
    }

    setCreating(true);
    setMessage(null);

    const eventDateTime = `${newEventForm.event_date}T${newEventForm.event_time || '14:00'}:00`;
    const { data, error } = await supabase
      .from('event_settings')
      .insert({
        organizer_id: user.id,
        groom_name: newEventForm.groom_name,
        bride_name: newEventForm.bride_name,
        event_date: eventDateTime,
        ceremony_time: newEventForm.event_time || '14:00',
        city: '',
        subtitle: 'Notre Mariage',
        invite_text: 'Sont heureux de vous inviter à leur union',
        rsvp_deadline: newEventForm.event_date,
      })
      .select()
      .single();

    if (error) {
      setMessage({ type: 'error', text: 'Erreur: ' + error.message });
    } else {
      setMessage({ type: 'success', text: 'Événement créé avec succès!' });
      selectEvent(data.id);
      refresh();
      setNewEventForm({ groom_name: '', bride_name: '', event_date: '', event_time: '' });
    }
    setCreating(false);
  };

  const save = async () => {
    if (!event) return;
    setSaving(true);
    setMessage(null);
    const { error } = await supabase.from('event_settings').update(form).eq('id', event.id);
    if (error) {
      setMessage({ type: 'error', text: error.message });
    } else {
      setMessage({ type: 'success', text: 'Paramètres enregistrés avec succès.' });
      refresh();
      setForm({});
    }
    setSaving(false);
  };

  const deleteEvent = async () => {
    if (!event) return;
    if (!window.confirm(`Êtes-vous certain de vouloir supprimer cet événement ? Tous les invités, scans et messages seront supprimés.`)) {
      return;
    }

    setSaving(true);
    setMessage(null);
    const { error } = await supabase.from('event_settings').delete().eq('id', event.id);
    if (error) {
      setMessage({ type: 'error', text: error.message });
      setSaving(false);
    } else {
      setMessage({ type: 'success', text: 'Événement supprimé avec succès.' });
      selectEvent(null);
      refresh();
      setSaving(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !event) return;

    setUploadingPhoto(true);
    const fileName = `${event.id}-couple-${Date.now()}.jpg`;
    const { error } = await supabase.storage.from('wedding-photos').upload(fileName, file);

    if (error) {
      setMessage({ type: 'error', text: 'Erreur d\'upload: ' + error.message });
    } else {
      const { data } = supabase.storage.from('wedding-photos').getPublicUrl(fileName);
      setForm({ ...form, couple_photo_url: data.publicUrl });
      setMessage({ type: 'success', text: 'Photo téléchargée.' });
    }
    setUploadingPhoto(false);
  };

  const showSkeleton = eventLoading && !event && !Object.keys(form).length;

  if (showSkeleton) {
    return (
      <div className="min-h-screen p-6 bg-cream-100">
        <div className="space-y-6 max-w-4xl mx-auto">
          <div className="h-10 bg-stone-100 rounded-full animate-pulse w-1/3" />
          <div className="grid gap-4 lg:grid-cols-2">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="h-52 rounded-3xl bg-stone-100 animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="space-y-6 animate-fade-in max-w-xl">
        <div>
          <p className="text-sm text-stone-400 uppercase tracking-wide font-medium">Configuration</p>
          <h1 className="font-serif text-3xl text-stone-800 mt-0.5">Créer un événement</h1>
          <p className="text-stone-500 text-sm mt-1">Commencez par créer votre premier événement.</p>
        </div>

        {message && (
          <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {message.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {message.text}
          </div>
        )}

        <div className="card p-6 space-y-4">
          <h2 className="font-serif text-lg text-stone-700 flex items-center gap-2">
            <Heart className="w-5 h-5 text-terracotta-500" strokeWidth={1.5} /> Informations de base
          </h2>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1.5">Marié *</label>
              <input
                className="input-field"
                value={newEventForm.groom_name}
                onChange={e => setNewEventForm({ ...newEventForm, groom_name: e.target.value })}
                placeholder="Prénom Nom"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1.5">Mariée *</label>
              <input
                className="input-field"
                value={newEventForm.bride_name}
                onChange={e => setNewEventForm({ ...newEventForm, bride_name: e.target.value })}
                placeholder="Prénom Nom"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1.5">Date du mariage *</label>
              <input
                type="date"
                className="input-field"
                value={newEventForm.event_date}
                onChange={e => setNewEventForm({ ...newEventForm, event_date: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1.5">Heure</label>
              <input
                type="time"
                className="input-field"
                value={newEventForm.event_time}
                onChange={e => setNewEventForm({ ...newEventForm, event_time: e.target.value })}
                defaultValue="14:00"
              />
            </div>
          </div>

          <button
            onClick={createEvent}
            disabled={creating}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            {creating ? 'Création...' : 'Créer l\'événement'}
          </button>

          {message?.type === 'success' && (
            <button
              onClick={() => setNewEventForm({ groom_name: '', bride_name: '', event_date: '', event_time: '' })}
              className="w-full px-4 py-2 text-terracotta-600 hover:text-terracotta-700 border border-terracotta-200 rounded-lg text-sm font-medium transition-all"
            >
              <Plus className="w-4 h-4 inline mr-2" />
              Ajouter un autre mariage
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <p className="text-sm text-stone-400 uppercase tracking-wide font-medium">Configuration</p>
        <h1 className="font-serif text-3xl text-stone-800 mt-0.5">Paramètres de l'invitation</h1>
        <p className="text-stone-500 text-sm mt-1">Modifiez tous les textes, dates, photos et boissons.</p>
      </div>

      {message && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm ${
          message.type === 'success'
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {message.text}
        </div>
      )}

      {/* Preview */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Form */}
        <div className="space-y-5">
          <div className="card p-6 space-y-4">
            <h2 className="font-serif text-lg text-stone-700 flex items-center gap-2">
              <Heart className="w-5 h-5 text-terracotta-500" strokeWidth={1.5} /> Couple & date
            </h2>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1.5">Marié</label>
                <input
                  className="input-field"
                  value={form.groom_name || ''}
                  onChange={e => setForm({ ...form, groom_name: e.target.value })}
                  placeholder="Prénom Nom"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1.5">Mariée</label>
                <input
                  className="input-field"
                  value={form.bride_name || ''}
                  onChange={e => setForm({ ...form, bride_name: e.target.value })}
                  placeholder="Prénom Nom"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1.5">Date & heure</label>
                <input
                  className="input-field"
                  type="datetime-local"
                  value={form.event_date?.slice(0, 16) || ''}
                  onChange={e => setForm({ ...form, event_date: new Date(e.target.value).toISOString() })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1.5">Ville</label>
                <input
                  className="input-field"
                  value={form.city || ''}
                  onChange={e => setForm({ ...form, city: e.target.value })}
                  placeholder="Kinshasa"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1.5">Sous-titre</label>
              <input
                className="input-field"
                value={form.subtitle || ''}
                onChange={e => setForm({ ...form, subtitle: e.target.value })}
                placeholder="Notre Mariage"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1.5">Texte invitation</label>
              <textarea
                className="input-field resize-none"
                rows={2}
                value={form.invite_text || ''}
                onChange={e => setForm({ ...form, invite_text: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1.5">Date limite RSVP</label>
              <input
                className="input-field"
                type="date"
                value={form.rsvp_deadline || ''}
                onChange={e => setForm({ ...form, rsvp_deadline: e.target.value })}
              />
            </div>
          </div>

          <div className="card p-6 space-y-4">
            <h2 className="font-serif text-lg text-stone-700 flex items-center gap-2">
              <Clock className="w-5 h-5 text-terracotta-500" strokeWidth={1.5} /> Cérémonie
            </h2>

            <div>
              <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1.5">Lieu</label>
              <input
                className="input-field"
                value={form.ceremony_location || ''}
                onChange={e => setForm({ ...form, ceremony_location: e.target.value })}
                placeholder="Église"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1.5">Adresse</label>
              <input
                className="input-field"
                value={form.ceremony_address || ''}
                onChange={e => setForm({ ...form, ceremony_address: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1.5">Horaire</label>
              <input
                className="input-field"
                type="time"
                value={form.ceremony_time || ''}
                onChange={e => setForm({ ...form, ceremony_time: e.target.value })}
              />
            </div>
          </div>

          <div className="card p-6 space-y-4">
            <h2 className="font-serif text-lg text-stone-700 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-terracotta-500" strokeWidth={1.5} /> Réception
            </h2>

            <div>
              <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1.5">Lieu</label>
              <input
                className="input-field"
                value={form.reception_location || ''}
                onChange={e => setForm({ ...form, reception_location: e.target.value })}
                placeholder="Salle de réception"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1.5">Adresse</label>
              <input
                className="input-field"
                value={form.reception_address || ''}
                onChange={e => setForm({ ...form, reception_address: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1.5">Horaire</label>
              <input
                className="input-field"
                value={form.reception_time || ''}
                onChange={e => setForm({ ...form, reception_time: e.target.value })}
                placeholder="10h30 - 19h00"
              />
            </div>
          </div>

          <div className="card p-6 space-y-4">
            <h2 className="font-serif text-lg text-stone-700">Photo du couple</h2>

            <label className="flex flex-col items-center gap-3 p-4 border-2 border-dashed border-stone-200 rounded-xl hover:border-terracotta-300 hover:bg-terracotta-50/30 cursor-pointer transition-all">
              <Upload className="w-5 h-5 text-stone-400" />
              <div className="text-center">
                <p className="text-sm font-medium text-stone-700">Cliquez pour importer</p>
                <p className="text-xs text-stone-500">JPG, PNG jusqu'à 5MB</p>
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                disabled={uploadingPhoto}
                className="hidden"
              />
            </label>

            {form.couple_photo_url && (
              <div className="relative rounded-xl overflow-hidden bg-stone-100 h-40">
                <img src={form.couple_photo_url} alt="Couple" className="w-full h-full object-cover" />
                <button
                  onClick={() => setForm({ ...form, couple_photo_url: '' })}
                  className="absolute top-2 right-2 bg-red-600 text-white p-1.5 rounded-lg hover:bg-red-700 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button onClick={save} className="btn-primary flex items-center gap-2 flex-1" disabled={saving}>
              <Save className="w-4 h-4" /> {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
            <button
              onClick={deleteEvent}
              className="btn-danger flex items-center gap-2"
              disabled={saving}
            >
              <Trash2 className="w-4 h-4" /> Supprimer l'événement
            </button>
          </div>
        </div>

        {/* Live Preview */}
        <div className="sticky top-8 h-fit">
          <div className="card overflow-hidden">
            <div className="bg-white border-b border-stone-100 p-6 text-center">
              <Heart className="w-6 h-6 text-terracotta-500 mx-auto mb-3" strokeWidth={1.5} />
              <h1 className="font-script text-3xl text-terracotta-600 leading-tight mb-1">
                {form.groom_name?.split(' ')[0] || 'Prénom'} & {form.bride_name?.split(' ')[0] || 'Prénom'}
              </h1>
              <p className="text-xs text-stone-500">
                {form.event_date ? new Date(form.event_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Date'} - {form.city || 'Ville'}
              </p>
            </div>

            <div className="p-6 space-y-5 bg-cream-50">
              <div className="text-center py-2">
                <p className="text-sm text-stone-500">Aperçu sur l'invitation</p>
              </div>

              {form.couple_photo_url && (
                <div className="relative rounded-lg overflow-hidden bg-stone-100 h-32">
                  <img src={form.couple_photo_url} alt="Couple" className="w-full h-full object-cover" />
                </div>
              )}

              <div className="bg-white rounded-lg p-4 space-y-3 border border-stone-100">
                <div>
                  <p className="text-xs text-stone-400 font-medium mb-1">CÉRÉMONIE</p>
                  <p className="text-sm font-medium text-stone-800">{form.ceremony_time || '--:--'}</p>
                  <p className="text-xs text-stone-600">{form.ceremony_location || 'Lieu'}</p>
                </div>
                <div className="border-t border-stone-100 pt-3">
                  <p className="text-xs text-stone-400 font-medium mb-1">RÉCEPTION</p>
                  <p className="text-sm font-medium text-stone-800">{form.reception_time || 'Horaire'}</p>
                  <p className="text-xs text-stone-600">{form.reception_location || 'Lieu'}</p>
                </div>
              </div>

              <div className="text-center">
                <p className="text-xs text-stone-400 italic">Les invités verront cet aperçu sur leur invitation personnelle</p>
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              setNewEventForm({ groom_name: '', bride_name: '', event_date: '', event_time: '' });
              setMessage(null);
            }}
            className="w-full px-4 py-3 text-terracotta-600 hover:text-terracotta-700 border border-terracotta-200 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Ajouter un autre mariage
          </button>
        </div>
      </div>
    </div>
  );
}
