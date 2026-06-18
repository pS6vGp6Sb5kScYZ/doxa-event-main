import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { EventSettings } from '../lib/types';
import { useAuth } from './AuthContext';

interface EventContextType {
  event: EventSettings | null;
  events: EventSettings[];
  selectedEventId: string | null;
  selectEvent: (id: string | null) => void;
  loading: boolean;
  refresh: () => Promise<void>;
}

const EventContext = createContext<EventContextType | undefined>(undefined);

const EVENT_CACHE_KEY = 'doxa:event_settings_cache_v1';
const EVENT_CACHE_TTL = 5 * 60 * 1000;

function loadEventCache() {
  try {
    const raw = localStorage.getItem(EVENT_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { events: EventSettings[]; selectedEventId: string | null; ts: number };
    if (Date.now() - parsed.ts > EVENT_CACHE_TTL) {
      localStorage.removeItem(EVENT_CACHE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function saveEventCache(events: EventSettings[], selectedEventId: string | null) {
  try {
    localStorage.setItem(EVENT_CACHE_KEY, JSON.stringify({ events, selectedEventId, ts: Date.now() }));
  } catch {
    // ignore localStorage errors
  }
}

export function EventProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const cache = loadEventCache();
  const [events, setEvents] = useState<EventSettings[]>(cache?.events || []);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(() => {
    return localStorage.getItem('selectedEventId') || cache?.selectedEventId || null;
  });
  const [loading, setLoading] = useState(() => !cache);

  const load = async () => {
    if (!user) {
      setEvents([]);
      setSelectedEventId(null);
      setLoading(false);
      return;
    }

    if (!events.length) {
      setLoading(true);
    }

    const { data } = await supabase
      .from('event_settings')
      .select('*')
      .eq('organizer_id', user.id)
      .order('event_date', { ascending: false });

    const eventsList = (data || []) as EventSettings[];
    setEvents(eventsList);

    const storedSelectedEventId = localStorage.getItem('selectedEventId');
    let nextSelectedEventId = storedSelectedEventId || selectedEventId;

    if (eventsList.length === 0) {
      nextSelectedEventId = null;
      localStorage.removeItem('selectedEventId');
    } else if (!nextSelectedEventId || !eventsList.find(e => e.id === nextSelectedEventId)) {
      nextSelectedEventId = eventsList[0].id;
      localStorage.setItem('selectedEventId', nextSelectedEventId);
    }

    if (nextSelectedEventId !== selectedEventId) {
      setSelectedEventId(nextSelectedEventId);
    }

    saveEventCache(eventsList, nextSelectedEventId);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [user]);

  const event = selectedEventId ? events.find(e => e.id === selectedEventId) || null : null;

  const selectEvent = (id: string | null) => {
    const nextId = id || null;
    setSelectedEventId(nextId);
    if (nextId) {
      localStorage.setItem('selectedEventId', nextId);
    } else {
      localStorage.removeItem('selectedEventId');
    }

    saveEventCache(events, nextId);
  };

  return (
    <EventContext.Provider value={{ event, events, selectedEventId, selectEvent, loading, refresh: load }}>
      {children}
    </EventContext.Provider>
  );
}

export function useEvent() {
  const ctx = useContext(EventContext);
  if (!ctx) throw new Error('useEvent must be used within EventProvider');
  return ctx;
}
