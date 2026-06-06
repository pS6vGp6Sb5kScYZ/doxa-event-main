import { supabase } from '../lib/supabase';
import { EventSettings } from '../lib/types';

export class EventService {
  async listUserEvents(userId: string, limit = 50, offset = 0): Promise<{
    events: EventSettings[];
    total: number;
  }> {
    const { data, count, error } = await supabase
      .from('event_settings')
      .select('*', { count: 'exact' })
      .eq('organizer_id', userId)
      .order('event_date', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return { events: data as EventSettings[], total: count || 0 };
  }

  async getEventById(eventId: string): Promise<EventSettings> {
    const { data, error } = await supabase
      .from('event_settings')
      .select('*')
      .eq('id', eventId)
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error('Event not found');
    return data as EventSettings;
  }

  async createEvent(organizer_id: string, event: Partial<EventSettings>): Promise<EventSettings> {
    const { data, error } = await supabase
      .from('event_settings')
      .insert({
        ...event,
        organizer_id,
      })
      .select()
      .single();

    if (error) throw error;
    return data as EventSettings;
  }

  async updateEvent(eventId: string, updates: Partial<EventSettings>): Promise<EventSettings> {
    const { data, error } = await supabase
      .from('event_settings')
      .update(updates)
      .eq('id', eventId)
      .select()
      .single();

    if (error) throw error;
    return data as EventSettings;
  }

  async deleteEvent(eventId: string): Promise<void> {
    const { error } = await supabase
      .from('event_settings')
      .delete()
      .eq('id', eventId);

    if (error) throw error;
  }
}

export const eventService = new EventService();
