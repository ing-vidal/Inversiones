import React from 'react';
import { MainTab } from './BottomNav';
import { AuthUser } from '../services/api';

interface HeaderProps {
  onProfileClick: () => void;
  activeScreenTitle?: string;
  dbStatus?: 'connected' | 'syncing' | 'offline';
  activeTab?: MainTab;
  onTabChange?: (tab: MainTab) => void;
  currentUser?: AuthUser | null;
}

export const Header: React.FC<HeaderProps> = ({
  onProfileClick,
  activeScreenTitle = 'Cuentas Bancos',
  dbStatus = 'connected',
  activeTab = 'cuentas',
  onTabChange,
  currentUser,
}) => {
  const userInitials = (currentUser?.name || 'U')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const navTabs: { id: MainTab; label: string; icon: string }[] = [
    { id: 'inicio', label: 'Inicio', icon: 'home' },
    { id: 'cuentas', label: 'Cuentas', icon: 'account_balance' },
    { id: 'historial', label: 'Historial', icon: 'trending_up' },
    { id: 'perfil', label: 'Configuración SAT', icon: 'shield_person' },
  ];

  return (
    <header className="fixed top-0 w-full z-50 bg-[#0b1218]/90 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.28)] border-b border-[#26353b]/80">
      <div className="max-w-6xl mx-auto h-16 px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-2.5 shrink-0">
          <img
            alt="Rendimax Logo"
            className="h-8 w-auto object-contain"
            src="https://lh3.googleusercontent.com/aida/AEtjO1V0p4zzxO9n_2O-GDXEIcWz4KRo-DZzPem0ZXZKdDZAUMfbQPURqtgFr3Hsqaz1opSCAxIiQGHing9XJvn8dn08xhGeAzq9KB7kvclf4vpbkjFptjuK7zdiQ_TfwhN2-cT6F7QiM8I15JKRqeEFX1-GwYkziHF11WUGDPlYWUPqI_u8ujwmPrCBo43jvIQqOa7dGu9tC7fi1AgvE1b0A5TmjkFztnrCpouae46dp_r6_FhwEHyLE2KsjNCk"
          />
          <div className="flex flex-col">
            <span className="font-space font-semibold text-[19px] sm:text-[21px] tracking-tight text-[#0b1c30] leading-none">
              Rendimax
            </span>
            <span className="font-hanken text-[10px] sm:text-[11px] uppercase text-[#006c49] font-bold tracking-wider mt-0.5">
              {activeScreenTitle}
            </span>
          </div>
        </div>

        {/* Desktop Navigation Bar (visible on md screens and up) */}
        {onTabChange && (
          <nav className="hidden md:flex items-center gap-1 bg-[#111a20]/90 p-1 rounded-xl border border-[#26353b]">
            {navTabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  data-tab={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-hanken text-[13px] font-medium transition-all ${
                    isActive
                      ? 'bg-[#55e6a5]/15 text-[#55e6a5] font-semibold shadow-xs'
                      : 'text-[#8d9b9b] hover:text-[#eef4f1] hover:bg-white/5'
                  }`}
                  type="button"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {tab.icon}
                  </span>
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        )}

        {/* Status Pill & User Avatar */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button
            aria-label="Perfil de usuario"
            onClick={onProfileClick}
            className="min-w-[40px] min-h-[40px] flex items-center justify-center p-0.5 rounded-full active:scale-95 transition-transform hover:ring-2 hover:ring-[#006c49]/30 overflow-hidden"
            type="button"
          >
            {currentUser?.avatar ? (
              <img
                alt="Foto de perfil"
                className="w-9 h-9 rounded-full object-cover border border-white shadow-xs"
                src={currentUser.avatar}
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#006c49] to-[#004a33] flex items-center justify-center border border-white shadow-xs">
                <span className="font-space font-bold text-white text-[13px] leading-none select-none">
                  {userInitials}
                </span>
              </div>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
