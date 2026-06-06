import { Heart, Sparkles, Users, QrCode, Settings2, BookOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const steps = [
  {
    icon: Settings2,
    title: 'Créer votre événement',
    description: 'Ajoutez les informations de mariage, la date, le lieu et le texte d’invitation pour commencer.',
    action: 'Créer un événement',
    href: '/admin/settings',
  },
  {
    icon: Users,
    title: 'Ajouter vos invités',
    description: 'Importez ou ajoutez chaque invité pour générer leurs QR codes et suivre les confirmations.',
    action: 'Gérer les invités',
    href: '/admin/guests',
  },
  {
    icon: QrCode,
    title: 'Scanner le jour J',
    description: 'Activez le scanner QR pour enregistrer les arrivées en temps réel et sécuriser l’accès.',
    action: 'Scanner maintenant',
    href: '/admin/scan',
  },
  {
    icon: BookOpen,
    title: 'Découvrir l’invitation',
    description: 'Prévisualisez facilement la page d’invitation publique et ajustez le contenu.',
    action: 'Voir l’invitation',
    href: '/admin/settings',
  },
];

export default function OnboardingPage() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl mx-auto">
      <div className="space-y-3">
        <p className="text-sm text-stone-400 uppercase tracking-wide font-medium">Guide de démarrage</p>
        <h1 className="font-serif text-3xl text-stone-800">Bienvenue dans votre espace organisateur</h1>
        <p className="text-stone-500 max-w-2xl">
          Suivez ces étapes pour configurer rapidement votre premier événement, inviter vos invités et activer le contrôle d’accès.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <div key={step.title} className="card p-6 border-stone-200">
              <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-terracotta-50 text-terracotta-600 mb-4">
                <Icon className="w-6 h-6" />
              </div>
              <h2 className="font-semibold text-lg text-stone-800 mb-2">{step.title}</h2>
              <p className="text-sm text-stone-500 mb-5">{step.description}</p>
              <button
                type="button"
                onClick={() => navigate(step.href)}
                className="btn-primary"
              >
                {step.action}
              </button>
            </div>
          );
        })}
      </div>

      <div className="card p-6 border-stone-200 bg-cream-50">
        <div className="flex items-start gap-3">
          <div className="mt-1 text-terracotta-600">
            <Heart className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-semibold text-xl text-stone-800">Besoin d’aide ?</h2>
            <p className="text-sm text-stone-500 mt-2">
              Si vous n’avez pas encore d’événement, commencez par la page « Paramètres ». Ensuite, ajoutez vos invités avant de lancer le scanner le jour J.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
