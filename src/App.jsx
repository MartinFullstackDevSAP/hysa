import React, { useEffect, useState } from 'react';
import MainLayout from './main/MainLayout';
import Dashboard from './dashboard/Dashboard';
import Settings from './settings/Settings';
import { supabase } from './supabaseClient';
import { DEFAULT_GLOBAL_SETTINGS } from './globalSettings';
import './index.css';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [globalSettings, setGlobalSettings] = useState(DEFAULT_GLOBAL_SETTINGS);
  
  // Ukážkové dáta pre HYSA účty (neskôr ich môžeš nahradiť načítaním zo Supabase)
  const [accounts] = useState([
    { bank: 'VÚB', accountName: 'Flexi účet', balance: 15000, rate: 3.0 },
    { bank: 'Tatra banka', accountName: 'Sporenie', balance: 25000, rate: 2.5 },
    { bank: 'J&T Banka', accountName: 'Termínovaný vklad', balance: 50000, rate: 4.1 },
  ]);

  useEffect(() => {
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
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = globalSettings.dark_mode ? 'dark' : 'light';
  }, [globalSettings.dark_mode]);

  return (
    <MainLayout activeTab={activeTab} setActiveTab={setActiveTab}>
      {activeTab === 'dashboard' && <Dashboard accounts={accounts} currency={globalSettings.dashboard_currency} />}
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