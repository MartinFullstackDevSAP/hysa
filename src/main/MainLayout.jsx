import { useRef, useState } from 'react';
import '../css/mainlayout.css';
import { 
  House,
  TrendingUp, 
  Settings as SettingsIcon,
  LogOut
} from 'lucide-react';

const MainLayout = ({ activeTab, onTabSelect, onSignOut, onRefresh, isLoading, children }) => {
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  const pullStart = useRef(null);

  const navItems = [
    { id: 'dashboard', label: 'Prehľad', icon: House },
    { id: 'investments', label: 'Investície', icon: TrendingUp },
    { id: 'settings', label: 'Nastavenia', icon: SettingsIcon },
  ];

  const handleTouchStart = (event) => {
    const touch = event.touches[0];
    if (event.touches.length !== 1 || event.currentTarget.scrollTop > 1 || isLoading) {
      pullStart.current = null;
      return;
    }

    if (!touch) return;
    pullStart.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (event) => {
    if (!pullStart.current) return;

    const start = pullStart.current;
    pullStart.current = null;
    const touch = event.changedTouches[0];
    if (!touch) return;
    const deltaY = touch.clientY - start.y;
    const deltaX = touch.clientX - start.x;

    if (deltaY >= 80 && deltaY > Math.abs(deltaX) * 1.2) {
      onRefresh?.();
    }
  };

  return (
    <>
      <div className="finova-app-shell">
        {/* Hlavný obsahový kontajner */}
        <main
          className="finova-main-content"
          aria-busy={isLoading}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={() => { pullStart.current = null; }}
        >
          <div className="finova-container">
            {children}
          </div>
          {isLoading && (
            <div className="page-loading-overlay" role="status" aria-label="Načítavam" aria-live="polite">
              <span className="busy-spinner" aria-hidden="true" />
            </div>
          )}
        </main>

        {/* Pravý bočný panel pre Desktop (>= 1024px) */}
        <aside className="finova-desktop-sidebar">
          <div className="sidebar-brand">
            <img className="sidebar-logo-icon" src="/brand-icon.png" alt="" />
            <span className="sidebar-brand-title">Freedom Vault</span>
            <p className="sidebar-brand-quote">
              Ak nenájdeš spôsob, ako zarábať peniaze, kým spíš, budeš pracovať až do smrti.
            </p>
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
      </div>

      {/* Spodná fixačná lišta pre Mobil / Tablet (< 1024px) */}
      <nav className="finova-mobile-bottom-bar">
        <div className="mobile-bottom-bar-content">
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
                aria-label={item.label}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </button>
            );
          })}
          <button
            type="button"
            className="mobile-nav-item mobile-logout"
            onClick={() => setConfirmingSignOut(true)}
            aria-label="Odhlásiť"
          >
            <LogOut size={20} />
            <span>Odhlásiť</span>
          </button>
        </div>
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
    </>
  );
};

export default MainLayout;