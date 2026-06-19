import { Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface NotFound404Props {
  title?: string;
  message?: string;
  showHomeButton?: boolean;
  icon?: 'heart' | 'error' | 'invitation';
}

export default function NotFound404({ 
  title = 'Invitation introuvable',
  message = 'Désolé, l\'invitation que vous cherchez n\'existe pas ou a expiré.',
  showHomeButton = true,
  icon = 'invitation'
}: NotFound404Props) {
  const navigate = useNavigate();

  const getIcon = () => {
    switch(icon) {
      case 'heart':
        return '💔';
      case 'error':
        return '⚠️';
      case 'invitation':
        return '📧';
      default:
        return '✦';
    }
  };

  return (
    <div className="min-h-screen py-6 px-4 relative bg-background flex items-center justify-center">
      <div className="relative z-10 max-w-lg w-full">
        <div className="bg-card border border-border rounded-md p-8 md:p-12 text-center space-y-6">
          {/* Icon */}
          <div className="flex justify-center mb-4">
            <div className="text-7xl">
              {getIcon()}
            </div>
          </div>

          {/* Error Code */}
          <div>
            <h1 className="font-script text-6xl md:text-7xl text-primary mb-2">
              404
            </h1>
            <p className="text-xs tracking-widest text-muted-foreground uppercase font-medium">
              Page non trouvée
            </p>
          </div>

          {/* Message */}
          <div className="space-y-4">
            <h2 className="font-serif text-2xl md:text-3xl text-foreground leading-relaxed">
              {title}
            </h2>
            <p className="font-serif italic text-muted-foreground text-sm max-w-sm mx-auto">
              {message}
            </p>
          </div>

          {/* Suggestions */}
          <div className="bg-primary/5 border border-primary/20 rounded-md p-4 text-left my-6">
            <p className="text-xs text-muted-foreground font-medium mb-3 text-center">
              Conseil :
            </p>
            <ul className="text-sm text-foreground space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5 flex-shrink-0">✓</span>
                <span>Vérifiez que le lien d'invitation est correct</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5 flex-shrink-0">✓</span>
                <span>L'invitation peut avoir expiré ou être supprimée</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5 flex-shrink-0">✓</span>
                <span>Contactez l'organisateur de l'événement</span>
              </li>
            </ul>
          </div>

          {/* Buttons */}
          {showHomeButton && (
            <div className="flex flex-col gap-2 pt-4 space-y-3">
              <button
                onClick={() => navigate('/')}
                className="glow-btn bg-gradient-to-r from-primary to-accent text-primary-foreground font-medium px-6 py-3 rounded hover:scale-105 transition-transform inline-flex items-center justify-center gap-2 w-full"
              >
                <Home className="w-4 h-4" />
                Retour à l'accueil
              </button>
              <button
                onClick={() => window.history.back()}
                className="text-primary font-medium px-6 py-2 rounded hover:bg-primary/10 transition-colors border border-primary/20"
              >
                ← Retour
              </button>
            </div>
          )}

          {/* Divider */}
          <div className="flex justify-center gap-3 pt-4">
            <span className="text-primary text-xs">✦</span>
            <span className="text-primary text-xs">✦</span>
            <span className="text-primary text-xs">✦</span>
          </div>
        </div>
      </div>
    </div>
  );
}
