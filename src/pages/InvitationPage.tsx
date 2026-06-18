import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { DrinkPreference, EventSettings, Guest, GuestbookMessage } from '../lib/types';
import QRCodeDisplay from '../components/QRCodeDisplay';

type GuestbookEntry = {
  name: string;
  date: string;
  tag: string;
  title: string;
  msg: string;
};

const DEFAULT_DRINKS = {
  Castel: false,
  Nkoy: false,
  Heineken: false,
  Beaufort: false,
  Savana: false,
  Sprite: false,
  Coca: false,
  Maltina: false,
};

const INVITATION_CACHE_TTL = 5 * 60 * 1000;

function getInvitationCacheKey(token: string) {
  return `doxa:invitation_cache_v1:${token}`;
}

function loadInvitationCache(token: string) {
  try {
    const raw = localStorage.getItem(getInvitationCacheKey(token));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { event: EventSettings | null; guest: Guest | null; dbGuestbook: GuestbookMessage[]; drinks: Record<string, boolean>; presence: 'present' | 'absent' | null; ts: number };
    if (Date.now() - parsed.ts > INVITATION_CACHE_TTL) {
      localStorage.removeItem(getInvitationCacheKey(token));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function saveInvitationCache(token: string, data: { event: EventSettings | null; guest: Guest | null; dbGuestbook: GuestbookMessage[]; drinks: Record<string, boolean>; presence: 'present' | 'absent' | null; }) {
  try {
    localStorage.setItem(getInvitationCacheKey(token), JSON.stringify({ ...data, ts: Date.now() }));
  } catch {
    // ignore storage errors
  }
}

function formatFrenchDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

const WEDDING_DATE = new Date('2026-05-31T08:30:00');

function useCountdown(target: Date) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const diff = Math.max(0, target.getTime() - now.getTime());

  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
  };
}

function useReveal<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('reveal');
          io.disconnect();
        }
      },
      { threshold: 0.15 },
    );

    io.observe(el);
    return () => io.disconnect();
  }, []);

  return ref;
}

function Section({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useReveal<HTMLElement>();
  return (
    <section
      ref={ref}
      style={{ animationDelay: `${delay}ms` }}
      className="card-elegant bg-card border border-border rounded-md p-6 md:p-8 relative"
    >
      {children}
    </section>
  );
}

function SectionTitle({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <h2 className="font-serif text-2xl text-primary flex items-center gap-2 border-b border-border pb-3 mb-5">
      <span aria-hidden className="heart-beat">{icon}</span>
      <span className="italic">{children}</span>
    </h2>
  );
}

function Confetti() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const confetti = Array.from({ length: 80 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height - canvas.height,
      vx: (Math.random() - 0.5) * 4,
      vy: Math.random() * 3 + 2,
      size: Math.random() * 4 + 2,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.1,
      color: ['#c44e27', '#fbbf24', '#f87171', '#6ee7b7'][Math.floor(Math.random() * 4)],
    }));

    let animationId: number;
    let elapsed = 0;
    const duration = 2500; // 2.5 secondes

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      elapsed += 16;
      const progress = Math.min(elapsed / duration, 1);

      confetti.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotationSpeed;
        p.vy += 0.1; // gravity

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, 1 - progress * 1.5);
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      });

      if (progress < 1) {
        animationId = requestAnimationFrame(animate);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };

    animate();

    return () => cancelAnimationFrame(animationId);
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-50" />;
}

function Petals() {
  const petals = Array.from({ length: 12 });
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden z-0">
      {petals.map((_, i) => {
        const left = (i * 8.3 + Math.random() * 5) % 100;
        const duration = 12 + Math.random() * 10;
        const delay = Math.random() * 15;
        const symbol = ['✿', '❀', '✾', '❁'][i % 4];
        return (
          <span
            key={i}
            className="petal"
            style={{
              left: `${left}%`,
              animationDuration: `${duration}s`,
              animationDelay: `${delay}s`,
              color: i % 2 ? 'rgba(239, 119, 75, 0.5)' : 'rgba(249, 177, 137, 0.4)',
            }}
          >
            {symbol}
          </span>
        );
      })}
    </div>
  );
}

function InvitationSkeleton() {
  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="h-24 rounded-[2rem] bg-stone-200 animate-pulse" />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="h-48 rounded-3xl bg-stone-200 animate-pulse" />
          <div className="h-48 rounded-3xl bg-stone-200 animate-pulse" />
        </div>
        <div className="grid gap-4">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="h-32 rounded-3xl bg-stone-200 animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}

function DrinkChip({ name, active, onClick }: { name: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 rounded border text-sm transition-all duration-300 hover:scale-105 ${
        active
          ? 'chip-active text-primary-foreground border-primary'
          : 'bg-card border-border text-foreground hover:border-primary/40'
      }`}
    >
      <span className={`w-3 h-3 rounded-sm border flex items-center justify-center text-[9px] transition-all ${
        active ? 'bg-primary-foreground/20 border-primary-foreground' : 'border-muted-foreground'
      }`}>
        {active ? '✓' : ''}
      </span>
      {name}
    </button>
  );
}

export default function InvitationPage() {
  const params = useParams<{ token?: string }>();
  const [searchParams] = useSearchParams();
  const token = params.token || searchParams.get('token') || undefined;
  const cachedInvitation = token ? loadInvitationCache(token) : null;
  const [event, setEvent] = useState<EventSettings | null>(cachedInvitation?.event || null);
  const [guest, setGuest] = useState<Guest | null>(cachedInvitation?.guest || null);
  const [dbGuestbook, setDbGuestbook] = useState<GuestbookMessage[]>(cachedInvitation?.dbGuestbook || []);
  const [isLoading, setIsLoading] = useState<boolean>(!Boolean(cachedInvitation));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [drinks, setDrinks] = useState<Record<string, boolean>>(cachedInvitation?.drinks || {
    ...DEFAULT_DRINKS,
    Beaufort: true,
    Sprite: true,
    Coca: true,
  });
  const [presence, setPresence] = useState<'present' | 'absent' | null>(cachedInvitation?.presence || null);
  const [guestbook, setGuestbook] = useState<GuestbookEntry[]>([
    { name: 'Couple Hon. Patrick Eshiba', date: '28/05/2026', tag: 'COUPLE', title: 'Congratulations!', msg: 'Thank you!' },
    { name: 'Joe Calrson', date: '30/05/2026', tag: 'COUPLE', title: 'Congratulations!', msg: 'Thank you' },
  ]);
  const [gbName, setGbName] = useState('');
  const [gbMsg, setGbMsg] = useState('');
  const [savingPresence, setSavingPresence] = useState(false);
  const [savingDrinks, setSavingDrinks] = useState(false);
  const [savingGb, setSavingGb] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  const { days, hours, minutes, seconds } = useCountdown(event ? new Date(event.event_date) : WEDDING_DATE);
  const formattedDate = formatFrenchDate(event?.event_date ?? WEDDING_DATE.toISOString());

  const inviteUrl = useMemo(() => {
    if (!token || typeof window === 'undefined') return '';
    return `${window.location.origin}/invite/${token}`;
  }, [token]);

  useEffect(() => {
    const loadInvitation = async () => {
      if (!token) {
        setLoadError('No invitation token provided.');
        setIsLoading(false);
        return;
      }
      // special preview mode: allow opening /invite/preview?event_id=... to render a preview
      if (token === 'preview') {
        const eventId = searchParams.get('event_id');
        try {
          if (!eventId) throw new Error('No event_id provided for preview.');
          const { data: eventData, error: eventError } = await supabase
            .from('event_settings')
            .select('*')
            .eq('id', eventId)
            .single();
          if (eventError) throw eventError;
          if (!eventData) throw new Error('Event not found for preview.');

          // create a lightweight mock guest for preview
          const mockGuest = {
            id: 'preview-guest',
            name: 'Cher invité',
            email: null,
            phone: null,
            table_name: 'Preview Table',
            seats: 1,
            status: 'pending',
            checked_in: false,
            checked_in_at: null,
            created_at: null,
            updated_at: null,
            qr_token: 'preview',
          } as unknown as Guest;

          setEvent(eventData as EventSettings);
          setGuest(mockGuest);
          setGbName(mockGuest.name || '');
          setDbGuestbook([]);
          setDrinks({ ...DEFAULT_DRINKS });
          setPresence(null);
          saveInvitationCache(token, { event: eventData as EventSettings, guest: mockGuest, dbGuestbook: [], drinks: { ...DEFAULT_DRINKS }, presence: null });
          setIsLoading(false);
          return;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          setLoadError(msg);
          setIsLoading(false);
          return;
        }
      }

      if (!cachedInvitation) {
        setIsLoading(true);
      }

      try {
        const { data: invitationData, error: invitationError } = await supabase.rpc('get_invitation_by_token', { p_qr_token: token }) as { data: any; error: any };

        if (invitationError) throw invitationError;
        if (!invitationData || Object.keys(invitationData).length === 0) throw new Error('Invitation not found');

        const guestData = invitationData.guest as Guest | null;
        const eventData = invitationData.event as EventSettings | null;

        if (!guestData) throw new Error('Invitation not found');
        if (!eventData) throw new Error('Event not found');

        setGuest(guestData);
        setGbName(guestData.name || '');
        const newPresence = guestData.status === 'confirmed' ? 'present' : guestData.status === 'declined' ? 'absent' : null;
        setPresence(newPresence);
        setEvent(eventData);

        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 3000);

        const prefs = invitationData.drinks as Array<{ drink_name: string }> | null;
        const prefMap: Record<string, boolean> = { ...DEFAULT_DRINKS };
        (prefs ?? []).forEach((pref) => {
          if (pref && pref.drink_name) prefMap[pref.drink_name] = true;
        });
        setDrinks(prefMap);

        const messages = invitationData.messages as GuestbookMessage[] | null;
        setDbGuestbook(messages ?? []);

        saveInvitationCache(token, {
          event: eventData,
          guest: guestData,
          dbGuestbook: messages ?? [],
          drinks: prefMap,
          presence: newPresence,
        });
      } catch (error) {
        console.error(error);
        const msg = error instanceof Error ? error.message : String(error);
        setLoadError(msg);
      } finally {
        setIsLoading(false);
      }
    };

    loadInvitation();
  }, [token]);

  const toggleDrink = (k: string) => setDrinks((d) => ({ ...d, [k]: !d[k] }));

  const savePresence = async (p: 'present' | 'absent') => {
    if (!guest || !event) return;
    setSavingPresence(true);
    setFeedbackMsg(null);
    
    // Emit optimistic event immediately so admin sees the change right away
    const optimisticStatus = p === 'present' ? 'confirmed' : 'declined';
    try {
      window.dispatchEvent(new CustomEvent('guest:rsvp', {
        detail: { eventId: event.id, guestId: guest.id, status: optimisticStatus, timestamp: new Date().toISOString(), optimistic: true },
      }));
    } catch (e) {
      // ignore
    }
    
    try {
      const status = p === 'present' ? 'confirmed' : 'declined';
      const { error } = await supabase
        .from('guests')
        .update({ status })
        .eq('id', guest.id);
      
      if (error) throw error;
      setPresence(p);
      // Emit confirmation event (the data is now persisted)
      try {
        window.dispatchEvent(new CustomEvent('guest:rsvp', {
          detail: { eventId: event.id, guestId: guest.id, status, timestamp: new Date().toISOString(), optimistic: false },
        }));
      } catch (e) {
        // ignore event dispatch errors
      }
      setFeedbackMsg({ type: 'success', text: 'Response saved successfully!' });
      setTimeout(() => setFeedbackMsg(null), 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error saving';
      setFeedbackMsg({ type: 'error', text: msg });
      // Revert optimistic change on error
      try {
        const revertedStatus = p === 'present' ? 'declined' : 'confirmed';
        window.dispatchEvent(new CustomEvent('guest:rsvp', {
          detail: { eventId: event.id, guestId: guest.id, status: revertedStatus, timestamp: new Date().toISOString(), optimistic: false },
        }));
      } catch (e) {}
    } finally {
      setSavingPresence(false);
    }
  };

  const saveDrinks = async () => {
    if (!guest || !event) return;
    setSavingDrinks(true);
    setFeedbackMsg(null);
    try {
      // Delete existing preferences
      await supabase.from('drink_preferences').delete().eq('guest_id', guest.id);
      
      // Insert selected drinks
      const selectedDrinks = Object.entries(drinks)
        .filter(([_, active]) => active)
        .map(([name]) => ({ guest_id: guest.id, drink_name: name }));
      
      if (selectedDrinks.length > 0) {
        const { error } = await supabase.from('drink_preferences').insert(selectedDrinks);
        if (error) throw error;
      }
      setFeedbackMsg({ type: 'success', text: 'Preferences saved!' });
      setTimeout(() => setFeedbackMsg(null), 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error saving';
      setFeedbackMsg({ type: 'error', text: msg });
    } finally {
      setSavingDrinks(false);
    }
  };

  const submitGbDb = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gbName.trim() || !gbMsg.trim() || !guest || !event) return;
    setSavingGb(true);
    try {
      const { error } = await supabase.from('guestbook_messages').insert({
        event_id: event.id,
        author_name: gbName,
        content: gbMsg,
        is_visible: true,
      });
      
      if (error) throw error;
      // Reload guestbook
      const { data: messages } = await supabase
        .from('guestbook_messages')
        .select('*')
        .eq('event_id', event.id)
        .eq('is_visible', true)
        .order('created_at', { ascending: false });
      
      setDbGuestbook(messages || []);
      setGbMsg('');
      setFeedbackMsg({ type: 'success', text: 'Message saved!' });
      setTimeout(() => setFeedbackMsg(null), 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error saving';
      setFeedbackMsg({ type: 'error', text: msg });
    } finally {
      setSavingGb(false);
    }
  };

  const submitGb = (e: React.FormEvent) => {
    e.preventDefault();
    if (!gbName.trim() || !gbMsg.trim()) return;
    setGuestbook((g) => [...g, { name: gbName, date: new Date().toLocaleDateString('en-GB'), tag: 'GUEST', title: '', msg: gbMsg }]);
    setGbMsg('');
  };

  const groomName = event?.groom_name ?? '';
  const brideName = event?.bride_name ?? '';
  const inviteText = event?.invite_text ?? 'joyfully invite you to celebrate their wedding.';
  const ceremonyLocation = event?.ceremony_location ?? 'Tabernacle Church';
  const ceremonyAddress = event?.ceremony_address ?? '123 Revolution Avenue, Kampala';
  const ceremonyTime = event?.ceremony_time ?? '08h30 précise';
  const receptionLocation = event?.reception_location ?? 'Salle MONA';
  const receptionAddress = event?.reception_address ?? '456 30 June Blvd, Kampala';
  const receptionTime = event?.reception_time ?? '16h30 - 19h00';
  const tableName = guest?.table_name ?? "Sweet Star of Love";
  const seats = guest?.seats ?? 1;
  const dressCode = event?.dress_code ?? 'Terracotta & White Elegance';
  const alcoholDrinks = event?.drinks_with_alcohol?.length ? event.drinks_with_alcohol : ['Castel', 'Nkoy', 'Heineken', 'Beaufort'];
  const nonAlcoholicDrinks = event?.drinks_without_alcohol?.length ? event.drinks_without_alcohol : ['Savana', 'Sprite', 'Coca', 'Maltina'];

  const rsvpDeadline = event?.event_date
    ? formatFrenchDate(new Date(new Date(event.event_date).getTime() - 24 * 60 * 60 * 1000).toISOString())
    : null;

  const getIframeSrc = (html: string | null | undefined) => {
    if (!html) return null;
    const match = html.match(/<iframe\b[^>]*\bsrc=(['"])(.*?)\1[^>]*>/i);
    return match ? match[2] : null;
  };

  const ceremonyMapSrc = getIframeSrc(event?.ceremony_map_embed);
  const receptionMapSrc = getIframeSrc(event?.reception_map_embed);

  const displayedGuestbook = dbGuestbook.length
    ? dbGuestbook.map((m) => ({
        name: m.author_name,
        date: new Date(m.created_at).toLocaleDateString('en-GB'),
        tag: 'GUEST',
        title: '',
        msg: m.content,
      }))
    : guestbook;

  if (isLoading) {
    return <InvitationSkeleton />;
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6 text-center">
        <div>
          <p className="text-lg font-medium">Invitation not found</p>
          <p className="text-sm text-muted-foreground mt-2">{loadError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-6 px-4 relative bg-background">
      {showConfetti && <Confetti />}
      <Petals />
      <main className="max-w-2xl mx-auto space-y-5 relative z-10">
        <Section>
          <div className="text-center py-8 px-12 sm:px-16 md:px-20">
            <div className="ornament mb-6 text-xs">✦</div>
            <h1 className="font-script text-5xl md:text-6xl leading-tight shimmer-title break-words">
              {(groomName || brideName) ? (
                <>
                  {groomName} &<br />{brideName}
                </>
              ) : (
                <>Invitation</>
              )}
            </h1>
            <p className="font-serif italic text-muted-foreground mt-8 text-sm px-6 sm:px-8">
              {inviteText}
            </p>
            <p className="text-xs tracking-[0.25em] text-muted-foreground mt-4 px-6 sm:px-8">
              {formattedDate} · {event?.city ?? 'KAMPALA'}
            </p>
            <div className="ornament mt-6 text-xs">✦</div>
          </div>
        </Section>

        <Section delay={100}>
          <SectionTitle icon="♡">The Couple</SectionTitle>
          <div className="relative rounded overflow-hidden group">
            {event?.couple_photo_url ? (
              <img
                src={event.couple_photo_url}
                alt={(groomName || brideName) ? `${groomName} & ${brideName}` : 'Couple'}
                className="w-full h-auto object-cover transition-transform duration-700 group-hover:scale-105"
                width={1024}
                height={1024}
              />
            ) : (
              <div className="w-full h-80 bg-muted-foreground flex items-center justify-center text-muted-foreground">
                Couple image not available
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            <p className="absolute bottom-4 left-0 right-0 text-center font-script text-3xl text-white drop-shadow-lg">
              {groomName} & {brideName}
            </p>
          </div>
          <p className="text-center font-serif italic text-sm text-muted-foreground mt-4">
            A love story worth celebrating with you.
          </p>
        </Section>

        <Section delay={150}>
          <SectionTitle icon="🗓">Countdown to the Big Day</SectionTitle>
          {days === 0 && hours === 0 && minutes === 0 ? (
            <div className="text-center py-8 space-y-4">
              <div className="text-6xl md:text-7xl font-script shimmer-title" style={{ color: 'rgb(246, 114, 43)' }}>
                TODAY IS THE DAY!
              </div>
              <p className="text-lg text-stone-600 font-serif italic">
                The big day has arrived. Enjoy every moment! 💕
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2 bg-gradient-to-br from-secondary to-accent rounded-lg p-4 shadow-inner">
              {[
                { v: days, l: 'DAYS' },
                { v: hours, l: 'HOURS' },
                { v: minutes, l: 'MINS' },
                { v: seconds, l: 'SEC' },
              ].map((x) => (
                <div key={x.l} className="text-center float" style={{ animationDelay: `${Math.random()}s` }}>
                  <div className="font-serif text-3xl text-primary tabular-nums">{String(x.v).padStart(2, '0')}</div>
                  <div className="text-[10px] tracking-widest text-muted-foreground mt-1">{x.l}</div>
                </div>
              ))}
            </div>
          )}
        </Section>

        <div className="grid md:grid-cols-2 gap-5">
          <Section delay={100}>
            <SectionTitle icon="♡">Ceremony</SectionTitle>
            <p className="font-serif text-lg">{ceremonyLocation}</p>
            <p className="text-sm text-muted-foreground mt-2">📍 {ceremonyAddress}</p>
            <p className="text-sm text-muted-foreground mt-1">🕐 {ceremonyTime}</p>
            {ceremonyMapSrc ? (
              <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card">
                <iframe
                  title="Carte de la cérémonie"
                  src={ceremonyMapSrc}
                  className="w-full h-56"
                  style={{ minHeight: 200 }}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  allowFullScreen
                />
              </div>
            ) : (
              <a href="#" className="inline-block mt-4 text-xs tracking-widest text-primary font-medium hover:translate-x-1 transition-transform">DIRECTIONS →</a>
            )}
          </Section>
          <Section delay={200}>
            <SectionTitle icon="✿">Reception</SectionTitle>
            <p className="font-serif text-lg">{receptionLocation}</p>
            <p className="text-sm text-muted-foreground mt-2">📍 {receptionAddress}</p>
            <p className="text-sm text-muted-foreground mt-1">🕐 {receptionTime}</p>
            {receptionMapSrc ? (
              <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card">
                <iframe
                  title="Carte de la réception"
                  src={receptionMapSrc}
                  className="w-full h-56"
                  style={{ minHeight: 200 }}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  allowFullScreen
                />
              </div>
            ) : (
              <a href="#" className="inline-block mt-4 text-xs tracking-widest text-primary font-medium hover:translate-x-1 transition-transform">DIRECTIONS →</a>
            )}
          </Section>
        </div>

        <Section>
          <SectionTitle icon="✿">Photo Memories</SectionTitle>
          <div className="rounded overflow-hidden group">
            {event?.couple_photo_url || event?.gallery_photos?.[0] ? (
              <img
                src={event.couple_photo_url || event.gallery_photos[0]}
                alt="Souvenir"
                className="w-full h-64 object-cover transition-transform duration-[1500ms] group-hover:scale-110"
                loading="lazy"
                width={1024}
                height={1024}
              />
            ) : (
              <div className="w-full h-64 bg-muted-foreground flex items-center justify-center text-muted-foreground">
                No photos available
              </div>
            )}
          </div>
          <div className="flex justify-center gap-1.5 mt-4">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <span key={i} className={`h-1.5 rounded-full transition-all duration-500 ${i === 0 ? 'w-6 bg-primary' : 'w-1.5 bg-border'}`} />
            ))}
          </div>
        </Section>

        <Section>
          <SectionTitle icon="♡">Your Seat</SectionTitle>
          <div className="space-y-2 text-sm">
            <p><span className="text-muted-foreground">Table:</span> <span className="font-serif font-medium">{tableName}</span></p>
            <p><span className="text-muted-foreground">Seats:</span> {seats}</p>
            <p><span className="text-muted-foreground">Dress code:</span> <span className="font-serif font-medium">{dressCode}</span></p>
          </div>
        </Section>

        <Section>
          <SectionTitle icon="🍷">Drink Preferences</SectionTitle>
            <p className="text-sm text-muted-foreground mb-4">Select your preferred drinks for the big day.</p>

            <p className="text-xs tracking-widest text-primary mb-2">🍺 ALCOHOLIC</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
            {alcoholDrinks.map((d) => (
              <DrinkChip key={d} name={d} active={drinks[d]} onClick={() => toggleDrink(d)} />
            ))}
          </div>

          <p className="text-xs tracking-widest text-primary mb-2">🥤 NON-ALCOHOLIC</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
            {nonAlcoholicDrinks.map((d) => (
              <DrinkChip key={d} name={d} active={drinks[d]} onClick={() => toggleDrink(d)} />
            ))}
          </div>

          <button 
            onClick={saveDrinks}
            disabled={savingDrinks}
            className="glow-btn bg-gradient-to-r from-primary to-[oklch(0.7_0.18_45)] text-primary-foreground text-xs tracking-widest font-medium px-6 py-3 rounded hover:scale-105 transition-transform disabled:opacity-50"
          >
            {savingDrinks ? 'SAVING...' : 'SAVE'}
          </button>
        </Section>

        <Section>
          <SectionTitle icon="♡">RSVP</SectionTitle>
            <p className="text-sm text-muted-foreground mb-4">
              Please confirm your attendance {rsvpDeadline ? (
                <>by <strong className="text-foreground">{rsvpDeadline}</strong>.</>
              ) : (
                'at least 1 day before the wedding.'
              )}
            </p>
          {feedbackMsg && (
            <div className={`mb-4 px-4 py-2 rounded text-xs font-medium ${
              feedbackMsg.type === 'success'
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-red-50 text-red-700'
            }`}>
              {feedbackMsg.text}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => savePresence('present')}
              disabled={savingPresence}
              className={`py-3 text-xs tracking-widest font-medium rounded border-2 transition-all duration-300 hover:scale-[1.02] disabled:opacity-50 ${
                presence === 'present'
                  ? 'bg-gradient-to-r from-primary to-[oklch(0.7_0.18_45)] text-primary-foreground border-primary shadow-lg'
                  : 'border-primary text-primary'
              }`}
            >
              {savingPresence ? 'SAVING...' : 'I WILL ATTEND'}
            </button>
            <button
              onClick={() => savePresence('absent')}
              disabled={savingPresence}
              className={`py-3 text-xs tracking-widest font-medium rounded border-2 transition-all duration-300 hover:scale-[1.02] disabled:opacity-50 ${
                presence === 'absent'
                  ? 'bg-foreground text-background border-foreground shadow-lg'
                  : 'border-foreground text-foreground'
              }`}
            >
              {savingPresence ? 'SAVING...' : 'NOT ATTENDING'}
            </button>
          </div>
        </Section>

        <Section>
          <SectionTitle icon="✈">Guestbook</SectionTitle>
          <div className="space-y-3 max-h-72 overflow-y-auto pr-2 mb-4">
            {displayedGuestbook.map((g, i) => (
              <div key={i} className="bg-gradient-to-br from-secondary/60 to-accent/40 rounded-lg p-3 border border-border/50 hover:border-primary/40 transition-colors">
                <div className="flex justify-between items-start">
                  <p className="font-serif font-medium text-sm">{g.name}</p>
                  <p className="text-xs text-muted-foreground">{g.date}</p>
                </div>
                {g.title && <p className="text-sm mt-1">{g.title}</p>}
                <p className="text-[10px] tracking-widest text-primary mt-1.5">↳ {g.tag}</p>
                <p className="text-sm font-serif italic mt-1">{g.msg}</p>
              </div>
            ))}
          </div>
          {feedbackMsg && (
            <div className={`mb-4 px-4 py-2 rounded text-xs font-medium ${
              feedbackMsg.type === 'success'
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-red-50 text-red-700'
            }`}>
              {feedbackMsg.text}
            </div>
          )}
          <form onSubmit={submitGbDb} className="space-y-3">
            <input
              value={gbName}
              onChange={(e) => setGbName(e.target.value)}
              className="w-full border border-border rounded px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
              placeholder="Your name"
            />
            <textarea
              value={gbMsg}
              onChange={(e) => setGbMsg(e.target.value)}
              rows={3}
              placeholder="Write a message for the couple..."
              className="w-full border border-border rounded px-3 py-2 text-sm bg-card resize-none focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
            />
            <button
              type="submit"
              disabled={savingGb}
              className="bg-gradient-to-r from-primary to-[oklch(0.7_0.18_45)] text-primary-foreground text-xs tracking-widest font-medium px-6 py-3 rounded hover:scale-105 transition-transform shadow-md disabled:opacity-50"
            >
              {savingGb ? '✈ SENDING...' : '✈ SEND'}
            </button>
          </form>
        </Section>

        <Section>
          <SectionTitle icon="🔳">QR Code</SectionTitle>
          <div className="rounded-lg border border-border bg-card p-4 flex flex-col items-center gap-4">
            <QRCodeDisplay value={inviteUrl} size={220} />

            <p className="text-xs text-muted-foreground break-all text-center">{inviteUrl}</p>
          </div>
        </Section>

        <footer className="text-center text-xs text-muted-foreground py-8 font-serif italic space-y-1">
          <div className="ornament mb-3 text-xs">✦</div>
          <p>{groomName} & {brideName}</p>
          <p>{formattedDate} · {event?.city ?? 'Kampala'}</p>
        </footer>
      </main>
    </div>
  );
}
