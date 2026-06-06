import React, { useState } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import {
  LayoutDashboard, Users, BookOpen, QrCode, Settings,
  LogOut, Heart, Menu, ExternalLink, Sparkles
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useEvent } from '../contexts/EventContext';

const navItems = [
  { path: '/admin', icon: LayoutDashboard, label: 'Tableau de bord' },
  { path: '/admin/onboarding', icon: Sparkles, label: 'Guide de démarrage' },
  { path: '/admin/guests', icon: Users, label: 'Invités' },
  { path: '/admin/messages', icon: BookOpen, label: "Livre d'or" },
  { path: '/admin/scan', icon: QrCode, label: 'Scan QR' },
  { path: '/admin/settings', icon: Settings, label: 'Paramètres' },
];

export default function AdminLayout() {
  const { signOut } = useAuth();
  const { event, events, selectEvent, selectedEventId } = useEvent();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/admin/login');
  };

  const coupleLabel = event ? `${event.groom_name} & ${event.bride_name}` : 'Sélectionner un événement';

  const Sidebar = () => (
    <div className="flex flex-col h-full">
      <div className="px-5 py-6 border-b border-white/10 space-y-3">
        <div className="flex items-center gap-2.5">
          <Heart className="w-5 h-5 text-terracotta-300" strokeWidth={1.5} />
          <span className="font-serif text-lg text-white truncate">{coupleLabel}</span>
        </div>

        {events.length > 0 && (
          <select
            value={selectedEventId || ''}
            onChange={(e) => selectEvent(e.target.value)}
            className="w-full px-2.5 py-1.5 bg-white/10 border border-white/20 rounded-lg text-sm text-white placeholder-stone-300 focus:outline-none focus:border-terracotta-400"
          >
            <option value="" className="bg-bark-900 text-white">-- Sélectionner --</option>
            {events.map(e => (
              <option key={e.id} value={e.id} className="bg-bark-900 text-white">
                {e.groom_name} & {e.bride_name}
              </option>
            ))}
          </select>
        )}
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ path, icon: Icon, label }) => {
          const active = location.pathname === path;
          return (
            <Link
              key={path}
              to={path}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                active
                  ? 'bg-terracotta-600 text-white'
                  : 'text-stone-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" strokeWidth={1.75} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-white/10 space-y-1">
        {event && (
          <Link
            to={`/invite/preview?event_id=${selectedEventId || ''}`}
            target="_blank"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-stone-300 hover:bg-white/10 hover:text-white transition-all duration-150"
          >
            <ExternalLink className="w-4 h-4" />
            Voir l'invitation
          </Link>
        )}
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-stone-300 hover:bg-white/10 hover:text-white transition-all duration-150"
        >
          <LogOut className="w-4 h-4" />
          Déconnexion
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-cream-100">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-60 flex-shrink-0 bg-bark-900 flex-col fixed inset-y-0 left-0 z-30">
        <Sidebar />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside className={`lg:hidden fixed inset-y-0 left-0 w-60 bg-bark-900 z-50 transition-transform duration-300 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <Sidebar />
      </aside>

      {/* Main */}
      <div className="flex-1 lg:ml-60 flex flex-col min-h-screen">
        {/* Mobile header */}
        <header className="lg:hidden sticky top-0 z-20 bg-white border-b border-stone-100 px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-1.5 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-lg"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Heart className="w-4 h-4 text-terracotta-500" strokeWidth={1.5} />
            <span className="font-serif text-stone-800">{coupleLabel}</span>
          </div>
        </header>

        <main className="flex-1 p-5 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
