import { useState } from 'react';
import '../css/mainlayout.css';
import { 
  House,
  TrendingUp, 
  Settings as SettingsIcon,
  LogOut
} from 'lucide-react';

const MainLayout = ({ activeTab, onTabSelect, onSignOut, isLoading, children }) => {
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);

  const navItems = [
    { id: 'dashboard', label: 'Prehľad', icon: House },
    { id: 'investments', label: 'Investície', icon: TrendingUp },
    { id: 'settings', label: 'Nastavenia', icon: SettingsIcon },
  ];

  return (
    <div className="finova-app-shell">
      {/* Hlavný obsahový kontajner */}
      <main className="finova-main-content" aria-busy={isLoading}>
        <div className="finova-container">
          {children}
        </div>
        {isLoading && (
          <div className="page-loading-overlay" role="status" aria-live="polite">
            <div className="page-loading-indicator">
              <span className="busy-spinner" aria-hidden="true" />
              <span>Načítavam obsah</span>
            </div>
          </div>
        )}
      </main>

      {/* Pravý bočný panel pre Desktop (>= 1024px) */}
      <aside className="finova-desktop-sidebar">
        <div className="sidebar-brand">
        <img className="sidebar-logo-icon" src="/brand-icon.svg" alt="" />
          <span className="sidebar-brand-title">F.I.R.E</span>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onTabSelect(item.id)}
                className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <button type="button" className="sidebar-nav-item sidebar-logout" onClick={() => setConfirmingSignOut(true)}>
          <LogOut size={20} />
          <span>Odhlásiť sa</span>
        </button>

      </aside>

      {/* Spodná fixačná lišta pre Mobil / Tablet (< 1024px) */}
      <nav className="finova-mobile-bottom-bar">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabSelect(item.id)}
              className={`mobile-nav-item ${isActive ? 'active' : ''}`}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon size={20} />
              <span>{item.label}</span>
            </button>
          );
        })}
        <button type="button" className="mobile-nav-item mobile-logout" onClick={() => setConfirmingSignOut(true)}>
          <LogOut size={20} />
          <span>Odhlásiť</span>
        </button>
      </nav>
      {confirmingSignOut && (
        <div className="finova-modal-overlay" role="presentation">
          <section className="finova-modal" role="dialog" aria-modal="true" aria-labelledby="sign-out-title">
            <div className="finova-modal-header">
              <h2 className="finova-modal-title" id="sign-out-title">Odhlásiť sa?</h2>
            </div>
            <div className="finova-modal-body">
              <p>Naozaj sa chcete odhlásiť zo svojho účtu?</p>
            </div>
            <div className="finova-modal-footer">
              <button
                type="button"
                className="btn-finova-secondary"
                onClick={() => setConfirmingSignOut(false)}
              >
                Zostať prihlásený
              </button>
              <button
                type="button"
                className="btn-finova-primary-sm"
                onClick={() => {
                  setConfirmingSignOut(false);
                  onSignOut();
                }}
              >
                Odhlásiť sa
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

export default MainLayout;