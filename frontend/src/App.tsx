import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Sidebar from './components/Sidebar';
import Catalog from './pages/Catalog';
import Search from './pages/Search';
import Downloads from './pages/Downloads';
import Library from './pages/Library';
import Settings from './pages/Settings';
import Admin from './pages/Admin';
import Login from './pages/Login';
import ChangePassword from './pages/ChangePassword';
import Suggestions from './pages/Suggestions';
import AllSeries from './pages/AllSeries';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import Setup from './pages/Setup';
import { AuthProvider, useAuth } from './context/AuthContext';

const AppContent = () => {
  const { t } = useTranslation();
  const { user, isLoading, isAdmin, mustChangePassword, needsSetup } = useAuth();

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background text-primary">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          <div className="text-xs font-bold uppercase tracking-[0.2em] opacity-50">{t('common.authenticating')}</div>
        </div>
      </div>
    );
  }

  if (needsSetup) {
    return <Setup />;
  }

  if (!user) {
    return <Login />;
  }

  if (mustChangePassword) {
    return <ChangePassword />;
  }

  return (
    <Router>
      <div className="flex h-screen bg-background text-foreground overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-8">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/catalog" element={<Catalog />} />
            <Route path="/search" element={<Search />} />
            <Route path="/all-series" element={<AllSeries />} />
            <Route path="/downloads" element={<Downloads />} />
            <Route path="/library" element={<Library />} />
            <Route path="/suggestions" element={<Suggestions />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/settings" element={isAdmin ? <Settings /> : <Navigate to="/dashboard" />} />
            <Route path="/admin" element={isAdmin ? <Admin /> : <Navigate to="/dashboard" />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
};

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
