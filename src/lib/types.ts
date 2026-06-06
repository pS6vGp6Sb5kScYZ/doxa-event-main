export interface EventSettings {
  id: string;
  organizer_id: string;
  groom_name: string;
  bride_name: string;
  event_date: string;
  city: string;
  subtitle: string;
  invite_text: string;
  rsvp_deadline: string | null;
  ceremony_location: string;
  ceremony_address: string;
  ceremony_time: string;
  reception_location: string;
  reception_address: string;
  reception_time: string;
  couple_photo_url: string;
  gallery_photos: string[];
  background_music_url: string;
  drinks_with_alcohol: string[];
  drinks_without_alcohol: string[];
  dress_code: string;
  created_at: string;
  updated_at: string;
}

export interface Guest {
  id: string;
  event_id: string;
  name: string;
  email: string;
  phone: string;
  table_name: string;
  seats: number;
  qr_token: string;
  status: 'pending' | 'confirmed' | 'declined';
  checked_in: boolean;
  checked_in_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RsvpResponse {
  id: string;
  guest_id: string;
  response: 'present' | 'absent';
  responded_at: string;
}

export interface DrinkPreference {
  id: string;
  guest_id: string;
  drink_name: string;
  has_alcohol: boolean;
  created_at: string;
}

export interface GuestbookMessage {
  id: string;
  event_id: string;
  guest_id: string | null;
  author_name: string;
  content: string;
  admin_reply: string;
  is_visible: boolean;
  created_at: string;
}

export interface ScanEvent {
  id: string;
  event_id: string;
  guest_id: string | null;
  qr_token: string;
  result: 'valid' | 'duplicate' | 'invalid';
  scanned_by: string | null;
  scanned_at: string;
}

export type Database = {
  public: {
    Tables: {
      event_settings: {
        Row: EventSettings;
        Insert: Partial<EventSettings>;
        Update: Partial<EventSettings>;
      };
      guests: {
        Row: Guest;
        Insert: Partial<Guest>;
        Update: Partial<Guest>;
      };
      rsvp_responses: {
        Row: RsvpResponse;
        Insert: Partial<RsvpResponse>;
        Update: Partial<RsvpResponse>;
      };
      drink_preferences: {
        Row: DrinkPreference;
        Insert: Partial<DrinkPreference>;
        Update: Partial<DrinkPreference>;
      };
      guestbook_messages: {
        Row: GuestbookMessage;
        Insert: Partial<GuestbookMessage>;
        Update: Partial<GuestbookMessage>;
      };
      scan_events: {
        Row: ScanEvent;
        Insert: Partial<ScanEvent>;
        Update: Partial<ScanEvent>;
      };
    };
  };
};
