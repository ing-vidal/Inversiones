import React, { useState, useRef } from 'react';
import { UserSettings } from '../../types/finance';
import { AuthUser, apiUpdateAvatar } from '../../services/api';

interface PerfilViewProps {
  settings: UserSettings;
  onUpdateSettings: (newSettings: UserSettings) => void;
  onResetData: () => void;
  onLogout: () => void;
  currentUser?: AuthUser | null;
  onAvatarUpdate?: (updatedUser: AuthUser) => void;
}

export const PerfilView: React.FC<PerfilViewProps> = ({
  settings,
  onUpdateSettings,
  onResetData,
  onLogout,
  currentUser,
  onAvatarUpdate,
}) => {
  const [satRatePercent, setSatRatePercent] = useState<number>(settings.satIsrRate * 100);
  const [inflationPercent, setInflationPercent] = useState<number>(settings.expectedInflation * 100);
  const [applyExemption, setApplyExemption] = useState<boolean>(settings.applySofipoExemption);
  const [savedNotice, setSavedNotice] = useState<boolean>(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const [localAvatar, setLocalAvatar] = useState<string | null>(currentUser?.avatar ?? null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const userInitials = (currentUser?.name || 'U')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarError('');

    // Validate type
    if (!file.type.startsWith('image/')) {
      setAvatarError('Solo se permiten archivos de imagen.');
      return;
    }
    // Validate size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setAvatarError('La imagen debe ser menor a 2 MB.');
      return;
    }

    // Read as base64
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target?.result as string;
      setLocalAvatar(base64); // immediate preview

      if (!currentUser?.id) return;
      setAvatarUploading(true);
      try {
        const { user } = await apiUpdateAvatar(currentUser.id, base64);
        onAvatarUpdate?.(user);
      } catch (err: any) {
        setAvatarError(err.message || 'Error al guardar la foto.');
      } finally {
        setAvatarUploading(false);
      }
    };
    reader.readAsDataURL(file);
    // Reset input so re-selecting same file triggers onChange
    e.target.value = '';
  };

  const handleSave = () => {
    onUpdateSettings({
      ...settings,
      satIsrRate: satRatePercent / 100,
      expectedInflation: inflationPercent / 100,
      applySofipoExemption: applyExemption,
    });
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2000);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pb-8">
      {/* Columna Izquierda: Perfil & Seguridad */}
      <div className="flex flex-col gap-4">
        {/* Profile Card */}
        <div className="bg-white p-5 rounded-2xl border border-[#e2e8f0]/80 shadow-xs flex items-center gap-4">
          {/* Avatar with upload */}
          <div className="relative shrink-0 group">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-white ring-2 ring-[#006c49]/20 shadow-sm focus:outline-none focus:ring-[#006c49]/40 transition-all"
              title="Cambiar foto de perfil"
              aria-label="Cambiar foto de perfil"
            >
              {localAvatar ? (
                <img
                  src={localAvatar}
                  alt="Foto de perfil"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-[#006c49] to-[#004a33] flex items-center justify-center">
                  <span className="font-space font-bold text-white text-[20px] leading-none select-none">
                    {userInitials}
                  </span>
                </div>
              )}
              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                {avatarUploading ? (
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span className="material-symbols-outlined text-white text-[20px]">photo_camera</span>
                )}
              </div>
            </button>
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarFileChange}
              aria-label="Seleccionar foto de perfil"
            />
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="font-space font-semibold text-[17px] text-[#0b1c30] truncate">
                {currentUser?.name || 'Usuario'}
              </h3>
              <span className="material-symbols-outlined text-[#006c49] text-[18px] shrink-0">
                verified
              </span>
            </div>
            <span className="font-hanken text-[12px] text-[#45464d] truncate">
              {currentUser?.email || ''}
            </span>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="font-hanken text-[11px] text-[#006c49] font-medium mt-0.5 text-left hover:underline flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[13px]">photo_camera</span>
              {localAvatar ? 'Cambiar foto' : 'Subir foto de perfil'}
            </button>
            {avatarError && (
              <span className="font-hanken text-[11px] text-red-500 mt-0.5">{avatarError}</span>
            )}
          </div>

          {/* Logout Button */}
          <button
            type="button"
            onClick={() => {
              if (confirm('¿Cerrar sesión? Tus datos quedan seguros en la base de datos local.')) {
                onLogout();
              }
            }}
            title="Cerrar sesión"
            className="ml-auto shrink-0 flex flex-col items-center gap-1 px-3 py-2 rounded-xl text-red-500 hover:bg-red-50 hover:text-red-600 transition-all active:scale-95 border border-transparent hover:border-red-100"
          >
            <span className="material-symbols-outlined text-[22px]">logout</span>
            <span className="font-hanken text-[10px] font-semibold">Salir</span>
          </button>
        </div>

        {/* Security & Data Storage Notice */}
        <div className="bg-[#eff4ff] p-5 rounded-2xl border border-[#dce9ff] flex flex-col gap-3">
          <div className="flex items-center gap-2 text-[#006c49]">
            <span className="material-symbols-outlined text-[22px]">
              shield_locked
            </span>
            <span className="font-hanken font-semibold text-[14px]">
              Privacidad & Cero Credenciales
            </span>
          </div>
          <p className="font-hanken text-[12px] sm:text-[13px] text-[#45464d] leading-relaxed">
            Rendimax almacena toda tu información en tu base de datos local SQLite (<code>rendimax.db</code>).
            Nunca solicita contraseñas bancarias, tokens ni accesos a tu banca en línea. Todas las fórmulas
            financieras se calculan de manera autónoma y segura.
          </p>

          <div className="pt-3 border-t border-[#dce9ff] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 font-hanken text-[12px] text-[#006c49] font-semibold">
              <span className="w-2.5 h-2.5 rounded-full bg-[#006c49] inline-block animate-pulse"></span>
              Base de Datos: SQLite (rendimax.db)
            </div>
            <button
              type="button"
              onClick={() => {
                if (confirm('¿Restablecer la base de datos con las cuentas y datos iniciales de fábrica?')) {
                  onResetData();
                }
              }}
              className="font-hanken text-[11px] text-red-600 hover:underline text-left sm:text-right"
            >
              Restablecer Base de Datos
            </button>
          </div>
        </div>
      </div>

      {/* Columna Derecha: Parámetros Fiscales y SAT México */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-xs border border-[#e2e8f0]/80 flex flex-col gap-4">
        <h4 className="font-space font-semibold text-[16px] text-[#0b1c30] flex items-center gap-2 pb-2 border-b border-slate-100">
          <span className="material-symbols-outlined text-[#006c49] text-[22px]">
            account_balance
          </span>
          Parámetros Fiscales y SAT México
        </h4>

        {/* SAT ISR Rate */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="font-hanken text-[12px] font-semibold text-[#0b1c30]">
              Tasa de Retención ISR SAT (Anual)
            </label>
            <span className="font-space text-[13px] text-[#006c49] font-bold">
              {satRatePercent.toFixed(2)}%
            </span>
          </div>
          <p className="font-hanken text-[11px] text-[#45464d]">
            Ley de Ingresos de la Federación (0.50% oficial anual para 2026 sobre capital).
          </p>
          <div className="flex gap-2 items-center mt-1 flex-wrap">
            <input
              type="number"
              step="0.01"
              min="0"
              max="5"
              value={satRatePercent}
              onChange={(e) => setSatRatePercent(parseFloat(e.target.value) || 0)}
              className="bg-[#eff4ff] px-3.5 py-1.5 rounded-lg font-space text-[14px] text-[#0b1c30] w-24 outline-none font-bold"
            />
            <span className="font-hanken text-[12px] text-[#45464d]">% anual</span>
            <button
              type="button"
              onClick={() => setSatRatePercent(0.5)}
              className="text-[11px] font-hanken text-[#006c49] hover:underline ml-auto"
            >
              Restablecer oficial (0.50%)
            </button>
          </div>
        </div>

        {/* Sofipo 5 UMA Exemption Switch */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100 gap-3">
          <div className="flex flex-col pr-2">
            <span className="font-hanken text-[13px] font-semibold text-[#0b1c30]">
              Exención SOFIPO (5 UMAs anuales)
            </span>
            <span className="font-hanken text-[11px] text-[#45464d]">
              Exentar de ISR los primeros $206,367 MXN en SOFIPOs autorizadas
            </span>
          </div>
          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={applyExemption}
              onChange={(e) => setApplyExemption(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#006c49]"></div>
          </label>
        </div>

        {/* Inflation rate for GAT Real */}
        <div className="flex flex-col gap-1.5 pt-3 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <label className="font-hanken text-[12px] font-semibold text-[#0b1c30]">
              Inflación Estimada (para cálculo GAT Real)
            </label>
            <span className="font-space text-[12px] text-[#45464d] font-bold">
              {inflationPercent.toFixed(2)}%
            </span>
          </div>
          <input
            type="number"
            step="0.1"
            min="0"
            max="15"
            value={inflationPercent}
            onChange={(e) => setInflationPercent(parseFloat(e.target.value) || 0)}
            className="bg-[#eff4ff] px-3.5 py-1.5 rounded-lg font-space text-[14px] text-[#0b1c30] w-24 outline-none font-bold mt-1"
          />
        </div>

        <button
          onClick={handleSave}
          type="button"
          className="w-full mt-2 py-3 bg-[#0b1c30] text-white rounded-xl font-hanken text-[13px] font-semibold hover:bg-[#131b2e] transition-colors shadow-xs"
        >
          {savedNotice ? '¡Guardado en base de datos!' : 'Guardar Preferencias en Base de Datos'}
        </button>
      </div>
    </div>
  );
};
