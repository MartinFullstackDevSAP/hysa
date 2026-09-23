import { useEffect, useState } from 'react';
import MainLayout from './main/MainLayout';
import Dashboard from './dashboard/Dashboard';
import Settings from './settings/Settings';
import Login from './auth/Login';
import { supabase } from './supabaseClient';
import { DEFAULT_GLOBAL_SETTINGS } from './globalSettings';
import './index.css';

function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [globalSettings, setGlobalSettings] = useState(DEFAULT_GLOBAL_SETTINGS);
  
  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        console.error('Chyba pri načítaní prihlasovacej session:', error.message);
      }
      if (active) {
        setSession(data.session);
        setAuthLoading(false);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthLoading(false);
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) return;

    const fetchGlobalSettings = async () => {
      const { data, error } = await supabase
        .from('global_settings')
        .select('dark_mode, dashboard_currency')
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Chyba pri načítaní globálnych nastavení:', error.message);
        return;
      }

      if (data) {
        setGlobalSettings({
          dark_mode: Boolean(data.dark_mode),
          dashboard_currency: data.dashboard_currency || DEFAULT_GLOBAL_SETTINGS.dashboard_currency,
        });
      }
    };

    fetchGlobalSettings();
  }, [session]);

  useEffect(() => {
    document.documentElement.dataset.theme = globalSettings.dark_mode ? 'dark' : 'light';
  }, [globalSettings.dark_mode]);

  if (authLoading) {
    return <div className="auth-loading">Načítavam...</div>;
  }

  if (!session) {
    return <Login />;
  }

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Chyba pri odhlasovaní:', error.message);
    }
  };

  return (
    <MainLayout activeTab={activeTab} setActiveTab={setActiveTab} onSignOut={handleSignOut}>
      {activeTab === 'dashboard' && <Dashboard currency={globalSettings.dashboard_currency} />}
      {activeTab === 'accounts' && (
        <div className="finova-card">
          <h1 className="finova-title">Účty</h1>
          <p className="finova-subtitle">Správa všetkých bankových a úsporných kont</p>
        </div>
      )}
      {activeTab === 'investments' && (
        <div className="finova-card">
          <h1 className="finova-title">Investície</h1>
          <p className="finova-subtitle">ETF, dlhopisy a portfólio</p>
        </div>
      )}
      {activeTab === 'settings' && (
        <Settings
          globalSettings={globalSettings}
          onGlobalSettingsChange={setGlobalSettings}
        />
      )}
    </MainLayout>
  );
}

export default App;