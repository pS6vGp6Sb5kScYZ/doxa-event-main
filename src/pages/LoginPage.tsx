import React, { useState } from 'react';
import { Heart, Lock, Mail, Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

type Mode = 'login' | 'register';

function mapAuthErrorMessage(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes('invalid login credentials')) return 'Email ou mot de passe incorrect.';
  if (normalized.includes('invalid password')) return 'Mot de passe invalide.';
  if (normalized.includes('user already registered')) return 'Cet email est déjà utilisé.';
  if (normalized.includes('password should be at least')) return 'Le mot de passe doit contenir au moins 6 caractères.';
  if (normalized.includes('invalid email')) return 'L’adresse email est invalide.';
  if (normalized.includes('user not found')) return 'Aucun compte ne correspond à cet email.';
  if (normalized.includes('invalid login credentials')) return 'Email ou mot de passe incorrect.';
  return message;
}

export default function LoginPage() {
  const { signIn, signUp, user, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  React.useEffect(() => {
    if (user) {
      navigate('/admin', { replace: true });
    }
  }, [user, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setBusy(true);

    const fn = mode === 'login' ? signIn : signUp;
    const { error } = await fn(email, password);

    if (error) {
      setError(mapAuthErrorMessage(error.message));
      setBusy(false);
    } else {
      if (mode === 'register') {
        setSuccess('Compte créé ! Redirection en cours...');
      } else {
        setSuccess('Connexion réussie ! Redirection en cours...');
      }
      setTimeout(() => navigate('/admin', { replace: true }), 1000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-cream-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-4 animate-pulse">
          <div className="h-16 bg-white rounded-3xl shadow-sm" />
          <div className="space-y-3 p-8 bg-white rounded-3xl shadow-sm">
            <div className="h-4 bg-stone-200 rounded-md" />
            <div className="h-4 bg-stone-200 rounded-md w-5/6" />
            <div className="h-12 bg-stone-200 rounded-2xl" />
            <div className="h-12 bg-stone-200 rounded-2xl" />
            <div className="h-12 bg-stone-200 rounded-2xl w-3/4" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="card p-8 animate-slide-up">
          <div className="text-center mb-8">
            <div className="w-14 h-14 bg-terracotta-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Heart className="w-7 h-7 text-terracotta-500" strokeWidth={1.5} />
            </div>
            <h1 className="font-serif text-2xl text-stone-800">Espace Organisateur</h1>
            <p className="text-stone-500 text-sm mt-1">
              {mode === 'login' ? 'Connexion à votre espace' : 'Créer votre compte'}
            </p>
            <p className="text-stone-400 text-xs mt-2 max-w-sm mx-auto">
              Connectez-vous pour gérer votre événement, vos invités et le contrôle d’accès. Si c’est votre première visite, créez un compte et suivez le guide de démarrage.
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-5 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-lg mb-5 text-sm">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              <span>{success}</span>
            </div>
          )}
          

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                <input
                  type="email"
                  className="input-field pl-10"
                  placeholder="votre@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  disabled={busy}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1.5">Mot de passe</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                <input
                  type={showPw ? 'text' : 'password'}
                  className="input-field pl-10 pr-10"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={6}
                  disabled={busy}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 disabled:opacity-50"
                  onClick={() => setShowPw(!showPw)}
                  disabled={busy}
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button type="submit" className="btn-primary w-full mt-2" disabled={busy}>
              {busy ? 'Chargement...' : mode === 'login' ? 'Se connecter' : 'Créer le compte'}
            </button>
          </form>

          <div className="mt-5 text-center">
            {mode === 'login' ? (
              <button
                onClick={() => { setMode('register'); setError(''); setSuccess(''); }}
                className="text-terracotta-600 hover:text-terracotta-700 text-sm font-medium disabled:opacity-50"
                disabled={busy}
              >
                Premier accès ? Créer un compte
              </button>
            ) : (
              <button
                onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
                className="text-terracotta-600 hover:text-terracotta-700 text-sm font-medium disabled:opacity-50"
                disabled={busy}
              >
                Déjà un compte ? Se connecter
              </button>
            )}
          </div>

          <p className="text-center text-xs text-stone-400 mt-4">
            Le premier compte créé devient administrateur automatiquement.
          </p>
        </div>
      </div>
    </div>
  );
}
