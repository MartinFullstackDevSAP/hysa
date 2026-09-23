import React from 'react';
import '../css/mainlayout.css';
import { 
  LayoutDashboard, 
  Wallet, 
  TrendingUp, 
  Settings as SettingsIcon, 
  Plus 
} from 'lucide-react';

const MainLayout = ({ activeTab, setActiveTab, children }) => {
  const navItems = [
    { id: 'dashboard', label: 'Prehľad', icon: LayoutDashboard },
    { id: 'accounts', label: 'Účty', icon: Wallet },
    { id: 'investments', label: 'Investície', icon: TrendingUp },
    { id: 'settings', label: 'Nastavenia', icon: SettingsIcon },
  ];

  return (
    <div className="finova-app-shell">
      {/* Hlavný obsahový kontajner */}
      <main className="finova-main-content">
        <div className="finova-container">
          {children}
        </div>
      </main>

      {/* Pravý bočný panel pre Desktop (>= 1024px) */}
      <aside className="finova-desktop-sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-logo-icon">F</div>
          <span className="sidebar-brand-title">finova</span>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <button className="btn-finova-primary sidebar-action-btn">
            <Plus size={18} />
            <span>Nová transakcia</span>
          </button>
        </div>
      </aside>

      {/* Spodná fixačná lišta pre Mobil / Tablet (< 1024px) */}
      <nav className="finova-mobile-bottom-bar">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`mobile-nav-item ${isActive ? 'active' : ''}`}
            >
              <Icon size={20} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};

export default MainLayout;