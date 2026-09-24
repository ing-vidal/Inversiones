import React from 'react';

export type MainTab = 'inicio' | 'historial' | 'cuentas' | 'perfil';

interface BottomNavProps {
  activeTab: MainTab;
  onTabChange: (tab: MainTab) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onTabChange }) => {
  const tabs: { id: MainTab; label: string; icon: string }[] = [
    { id: 'inicio', label: 'Inicio', icon: 'home' },
    { id: 'historial', label: 'Historial', icon: 'trending_up' },
    { id: 'cuentas', label: 'Cuentas', icon: 'account_balance' },
    { id: 'perfil', label: 'Perfil', icon: 'shield_person' },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 w-full z-50 pb-[env(safe-area-inset-bottom,0px)] bg-[#0b1218]/95 backdrop-blur-xl border-t border-[#26353b]/90 shadow-[0_-2px_16px_rgba(0,0,0,0.35)]">
      <div className="max-w-screen-sm mx-auto flex justify-around items-center h-16 px-1">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              data-tab={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`min-w-[56px] min-h-[44px] flex flex-col items-center justify-center gap-0.5 transition-all select-none active:scale-95 ${
                isActive
                  ? 'text-[#55e6a5] font-semibold'
                  : 'text-[#8d9b9b] hover:text-[#eef4f1]'
              }`}
              type="button"
            >
              <span
                className={`material-symbols-outlined text-[24px] transition-transform ${
                  isActive ? 'scale-110' : ''
                }`}
              >
                {tab.icon}
              </span>
              <span className="font-hanken text-[12px] leading-tight">
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
