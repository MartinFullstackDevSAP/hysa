import { useCallback, useEffect, useRef, useState } from 'react';
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
  const [globalSettingsReady, setGlobalSettingsReady] = useState(false);
  const [tabLoading, setTabLoading] = useState(false);
  const [navigationKey, setNavigationKey] = useState(0);
  const [globalSettings, setGlobalSettings] = useState(DEFAULT_GLOBAL_SETTINGS);
  const navigationId = useRef(0);
  const navigationStartedAt = useRef(0);
  const navigationTimeout = useRef(null);
  
  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        console.error('Chyba pri načítaní prihlasovacej session:', error.message);
      }
      if (active) {
        setSession(data.session);
        setGlobalSettingsReady(!data.session);
        setAuthLoading(false);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setGlobalSettingsReady(!nextSession);
      setAuthLoading(false);
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) return;
    let active = true;

    const fetchGlobalSettings = async () => {
      try {
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
      } catch (error) {
        console.error('Chyba pri načítaní globálnych nastavení:', error);
      } finally {
        if (active) setGlobalSettingsReady(true);
      }
    };

    fetchGlobalSettings();

    return () => {
      active = false;
    };
  }, [session]);

  useEffect(() => {
    document.documentElement.dataset.theme = globalSettings.dark_mode ? 'dark' : 'light';
  }, [globalSettings.dark_mode]);

  const handleDashboardLoadingChange = useCallback((isLoading, key) => {
    if (navigationId.current !== key) return;

    if (navigationTimeout.current) {
      window.clearTimeout(navigationTimeout.current);
    }
    if (isLoading) {
      setTabLoading(true);
      return;
    }

    const remainingBusyTime = Math.max(0, 250 - (Date.now() - navigationStartedAt.current));
    navigationTimeout.current = window.setTimeout(() => {
      if (navigationId.current === key) setTabLoading(false);
    }, remainingBusyTime);
  }, []);

  if (authLoading || (session && !globalSettingsReady)) {
    return (
      <div className="auth-loading" role="status" aria-live="polite">
        <span className="busy-spinner" aria-hidden="true" />
        <span className="auth-loading-label">Načítavam</span>
      </div>
    );
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

  const handleTabSelect = (tab) => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;

    if (tab === activeTab) return;

    navigationId.current += 1;
    const currentNavigation = navigationId.current;
    navigationStartedAt.current = Date.now();
    setNavigationKey(currentNavigation);
    setActiveTab(tab);
    setTabLoading(true);

    if (navigationTimeout.current) {
      window.clearTimeout(navigationTimeout.current);
    }
    if (tab !== 'dashboard') {
      navigationTimeout.current = window.setTimeout(() => {
        if (navigationId.current === currentNavigation) setTabLoading(false);
      }, 250);
    }
  };

  const handleRefresh = () => {
    if (activeTab !== 'dashboard' || tabLoading) return;

    navigationId.current += 1;
    const currentNavigation = navigationId.current;
    navigationStartedAt.current = Date.now();
    setNavigationKey(currentNavigation);
    setTabLoading(true);

    if (navigationTimeout.current) {
      window.clearTimeout(navigationTimeout.current);
    }
  };

  return (
    <MainLayout
      activeTab={activeTab}
      onTabSelect={handleTabSelect}
      onSignOut={handleSignOut}
      onRefresh={handleRefresh}
      isLoading={tabLoading}
    >
      {activeTab === 'dashboard' && (
        <Dashboard
          key={navigationKey}
          currency={globalSettings.dashboard_currency}
          navigationKey={navigationKey}
          onLoadingChange={handleDashboardLoadingChange}
        />
      )}
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