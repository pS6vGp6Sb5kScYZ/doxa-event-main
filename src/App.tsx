import { Suspense, lazy, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { EventProvider } from './contexts/EventContext';
import InvitationPage from './pages/InvitationPage';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const Dashboard = lazy(() => import('./pages/admin/Dashboard'));
const GuestManagement = lazy(() => import('./pages/admin/GuestManagement'));
const QRScannerPage = lazy(() => import('./pages/admin/QRScannerPage'));
const GuestbookPage = lazy(() => import('./pages/admin/GuestbookPage'));
const SettingsPage = lazy(() => import('./pages/admin/SettingsPage'));
const OnboardingPage = lazy(() => import('./pages/admin/OnboardingPage'));
const AdminLayout = lazy(() => import('./components/AdminLayout'));

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center">Chargement...</div>;
  return user ? <>{children}</> : <Navigate to="/admin/login" />;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={
          <div className="min-h-screen flex items-center justify-center bg-cream-100">
            <div className="w-64 h-64 rounded-3xl bg-white shadow-xl border border-stone-100 flex items-center justify-center text-stone-500">Chargement...</div>
          </div>
        }>
          <Routes>
          <Route path="/admin/login" element={<LoginPage />} />

          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <EventProvider>
                  <AdminLayout />
                </EventProvider>
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="onboarding" element={<OnboardingPage />} />
            <Route path="guests" element={<GuestManagement />} />
            <Route path="scan" element={<QRScannerPage />} />
            <Route path="messages" element={<GuestbookPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>

          <Route path="/invite/:token" element={<InvitationPage />} />
          <Route path="/invitation" element={<InvitationPage />} />
          <Route path="/invitation-page" element={<InvitationPage />} />
          <Route path="/invitationPage" element={<InvitationPage />} />
          <Route path="/" element={<Navigate to="/admin/login" replace />} />
          <Route path="*" element={<Navigate to="/admin/login" replace />} />
        </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
