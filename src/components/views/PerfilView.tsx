import React, { useState, useRef } from 'react';
import { BankInstitution, CalculationMethod, IsrMode, RoundingMode, UserSettings } from '../../types/finance';
import { AuthUser, apiUpdateAvatar } from '../../services/api';

export type PerfilSection = 'alta' | 'administrar' | 'preferencias';

interface PerfilViewProps {
  activeSection: PerfilSection;
  onSectionChange: (section: PerfilSection) => void;
  settings: UserSettings;
  institutions: BankInstitution[];
  onUpdateSettings: (newSettings: UserSettings) => void;
  onResetData: () => void;
  onLogout: () => void;
  currentUser?: AuthUser | null;
  onAvatarUpdate?: (updatedUser: AuthUser) => void;
  onCreateInstitution: (institution: BankInstitution) => void;
  onUpdateInstitution: (id: string, institution: Partial<BankInstitution>) => void;
  onDeleteInstitution: (id: string) => void;
}

export const PerfilView: React.FC<PerfilViewProps> = ({
  activeSection,
  onSectionChange,
  settings,
  institutions,
  onUpdateSettings,
  onResetData,
  onLogout,
  currentUser,
  onAvatarUpdate,
  onCreateInstitution,
  onUpdateInstitution,
  onDeleteInstitution,
}) => {
  const [satRatePercent, setSatRatePercent] = useState<number>(settings.satIsrRate * 100);
  const [inflationPercent, setInflationPercent] = useState<number>(settings.expectedInflation * 100);
  const [applyExemption, setApplyExemption] = useState<boolean>(settings.applySofipoExemption);
  const [umaLimit, setUmaLimit] = useState<number>(settings.umaValueAnnual);
  const [projectionMonthDays, setProjectionMonthDays] = useState<number>(settings.projectionMonthDays);
  const [projectionYearDays, setProjectionYearDays] = useState<number>(settings.projectionYearDays);
  const [savedNotice, setSavedNotice] = useState<boolean>(false);
  const [pendingConfirmation, setPendingConfirmation] = useState<
    { action: 'save-preferences' } | { action: 'delete-institution'; institution: BankInstitution } | null
  >(null);
  const [institutionError, setInstitutionError] = useState('');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const [localAvatar, setLocalAvatar] = useState<string | null>(currentUser?.avatar ?? null);
  const [institutionForm, setInstitutionForm] = useState({
    id: '',
    name: '',
    shortName: '',
    rate: '12',
    defaultBase: 365 as 360 | 365,
    defaultFreq: 'diario' as 'diario' | 'semanal' | 'vencimiento',
    hasDualTier: false,
    dualThreshold: '',
    dualRate2: '',
    defaultIsCompound: true,
    calculationMethod: 'annual-nominal' as CalculationMethod,
    defaultNominalValue: '10',
    defaultTermDays: '28',
    isrRate: '0.50',
    isrMode: 'deduct' as IsrMode,
    isrExempt: false,
    roundingMode: 'normal' as RoundingMode,
    color: '#006c49',
    badgeBg: 'bg-[#006c49]/15',
    badgeText: 'text-[#006c49]',
    category: 'sofipo' as 'sofipo' | 'banco' | 'fondo' | 'cetes',
    gatNominal: '12.5',
    gatReal: '7.5',
  });
  const [editingInstitutionId, setEditingInstitutionId] = useState<string | null>(null);
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
    setPendingConfirmation({ action: 'save-preferences' });
  };

  const confirmPendingAction = () => {
    if (!pendingConfirmation) return;

    if (pendingConfirmation.action === 'delete-institution') {
      onDeleteInstitution(pendingConfirmation.institution.id);
    } else {
      onUpdateSettings({
        ...settings,
        satIsrRate: satRatePercent / 100,
        expectedInflation: inflationPercent / 100,
        applySofipoExemption: applyExemption,
        umaValueAnnual: umaLimit,
        projectionMonthDays,
        projectionYearDays,
      });
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 2000);
    }

    setPendingConfirmation(null);
  };

  const resetInstitutionForm = () => {
    setEditingInstitutionId(null);
    setInstitutionForm({
      id: '',
      name: '',
      shortName: '',
      rate: '12',
      defaultBase: 365,
      defaultFreq: 'diario',
      hasDualTier: false,
      dualThreshold: '',
      dualRate2: '',
      defaultIsCompound: true,
      calculationMethod: 'annual-nominal',
      defaultNominalValue: '10',
      defaultTermDays: '28',
      isrRate: '0.50',
      isrMode: 'deduct',
      isrExempt: false,
      roundingMode: 'normal',
      color: '#006c49',
      badgeBg: 'bg-[#006c49]/15',
      badgeText: 'text-[#006c49]',
      category: 'sofipo',
      gatNominal: '12.5',
      gatReal: '7.5',
    });
  };

  const handleInstitutionSubmit = () => {
    if (!institutionForm.name.trim()) {
      setInstitutionError('Escribe el nombre de la institución.');
      return;
    }
    if (institutionForm.hasDualTier && (
      !institutionForm.dualThreshold.trim()
      || Number(institutionForm.dualThreshold) <= 0
      || !institutionForm.dualRate2.trim()
      || Number(institutionForm.dualRate2) < 0
    )) {
      setInstitutionError('Completa el límite y la tasa del tramo excedente.');
      return;
    }
    if (institutionForm.calculationMethod === 'cetes-titles' && (
      Number(institutionForm.defaultNominalValue) <= 0
      || Number(institutionForm.defaultTermDays) <= 0
    )) {
      setInstitutionError('El valor nominal y el plazo deben ser mayores que cero.');
      return;
    }

    setInstitutionError('');
    const payload: BankInstitution = {
      id: editingInstitutionId || `inst-${Date.now()}`,
      name: institutionForm.name.trim(),
      shortName: institutionForm.shortName.trim() || institutionForm.name.trim(),
      rate: Number(institutionForm.rate),
      defaultBase: institutionForm.defaultBase,
      defaultFreq: institutionForm.defaultFreq,
      hasDualTier: institutionForm.hasDualTier,
      dualThreshold: institutionForm.hasDualTier ? Number(institutionForm.dualThreshold) : undefined,
      dualRate2: institutionForm.hasDualTier ? Number(institutionForm.dualRate2) : undefined,
      defaultIsCompound: institutionForm.defaultIsCompound,
      calculationMethod: institutionForm.calculationMethod,
      defaultNominalValue: institutionForm.calculationMethod === 'cetes-titles' ? Number(institutionForm.defaultNominalValue) : undefined,
      defaultTermDays: institutionForm.calculationMethod === 'cetes-titles' ? Number(institutionForm.defaultTermDays) : undefined,
      isrRate: Number(institutionForm.isrRate) / 100,
      isrMode: institutionForm.isrMode,
      isrExempt: institutionForm.isrExempt,
      roundingMode: institutionForm.roundingMode,
      color: institutionForm.color,
      badgeBg: institutionForm.badgeBg,
      badgeText: institutionForm.badgeText,
      category: institutionForm.category,
      gatNominal: Number(institutionForm.gatNominal),
      gatReal: Number(institutionForm.gatReal),
    };

    if (!payload.name) return;

    if (editingInstitutionId) {
      onUpdateInstitution(editingInstitutionId, payload);
    } else {
      onCreateInstitution(payload);
    }

    resetInstitutionForm();
  };

  const handleInstitutionNameChange = (name: string) => {
    setInstitutionForm((current) => ({ ...current, name }));
  };

  const startEditInstitution = (inst: BankInstitution) => {
    setEditingInstitutionId(inst.id);
    setInstitutionForm({
      id: inst.id,
      name: inst.name,
      shortName: inst.shortName,
      rate: String(inst.rate),
      defaultBase: inst.defaultBase,
      defaultFreq: inst.defaultFreq,
      hasDualTier: inst.hasDualTier,
      dualThreshold: String(inst.dualThreshold ?? ''),
      dualRate2: String(inst.dualRate2 ?? ''),
      defaultIsCompound: inst.defaultIsCompound ?? true,
      calculationMethod: inst.calculationMethod ?? (inst.category === 'cetes' ? 'cetes-titles' : 'annual-nominal'),
      defaultNominalValue: String(inst.defaultNominalValue ?? 10),
      defaultTermDays: String(inst.defaultTermDays ?? 28),
      isrRate: String((inst.isrRate ?? settings.satIsrRate) * 100),
      isrMode: inst.isrMode ?? 'deduct',
      isrExempt: inst.isrExempt ?? false,
      roundingMode: inst.roundingMode ?? 'normal',
      color: inst.color,
      badgeBg: inst.badgeBg,
      badgeText: inst.badgeText,
      category: inst.category,
      gatNominal: String(inst.gatNominal),
      gatReal: String(inst.gatReal),
    });
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

      </div>

      {/* Columna Derecha: Parámetros Fiscales y SAT México */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-xs border border-[#e2e8f0]/80 flex flex-col gap-4">
        <h4 className="font-space font-semibold text-[16px] text-[#0b1c30] flex items-center gap-2 pb-2 border-b border-slate-100">
          <span className="material-symbols-outlined text-[#006c49] text-[22px]">
            account_balance
          </span>
          Parámetros Fiscales y SAT México
        </h4>

        <div role="tablist" aria-label="Secciones de Configuración SAT" className="bg-[#0b1218]/80 p-1 rounded-xl flex items-center gap-1 shadow-xs border border-[#29435d]">
          {([
            { id: 'alta', label: 'Alta' },
            { id: 'administrar', label: `Admin (${institutions.length})` },
            { id: 'preferencias', label: 'Preferencias' },
          ] as const).map((section) => (
            <button
              key={section.id}
              type="button"
              role="tab"
              aria-selected={activeSection === section.id}
              onClick={() => onSectionChange(section.id)}
              className={`flex-1 min-w-0 min-h-11 px-1 py-2 rounded-lg text-center font-hanken text-[11px] sm:text-[12px] transition-all select-none ${
                activeSection === section.id
                  ? 'neon-rate-badge font-semibold'
                  : 'text-[#a9b7ca] hover:bg-white/5 hover:text-[#45d9ff]'
              }`}
            >
              {section.label}
            </button>
          ))}
        </div>

        {activeSection === 'alta' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#006c49]/10 text-[#006c49]">
                <span className="material-symbols-outlined text-[20px]">account_balance</span>
              </div>
              <div>
                <div className="font-hanken text-[12px] font-bold uppercase tracking-[0.08em] text-[#45464d]">
                  Instituciones / SOFIPOs
                </div>
                <div className="font-hanken text-[10px] text-[#6b7280]">Gestión rápida</div>
              </div>
            </div>
            <button
              type="button"
              onClick={resetInstitutionForm}
              className="rounded-full border border-[#45d9ff]/50 bg-[#45d9ff]/10 px-4 py-2 font-hanken text-[13px] font-semibold text-[#45d9ff] hover:bg-[#45d9ff]/20"
            >
              {editingInstitutionId ? 'Cancelar edición' : 'Nueva'}
            </button>
          </div>

          <div className="border-t border-[#29435d]/70 pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 [&_input]:min-h-12 [&_input]:px-4 [&_input]:py-3 [&_input]:text-sm [&_select]:min-h-12 [&_select]:px-4 [&_select]:py-3 [&_select]:text-sm">
              <label className="flex flex-col gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[#45464d]">
                Nombre
                <input
                  type="text"
                  value={institutionForm.name}
                  onChange={(e) => handleInstitutionNameChange(e.target.value)}
                  placeholder="Ej. Banco de México"
                  className="rounded-lg border border-[#dfe8ff] bg-[#f9fbff] px-3 py-2 text-[12px] font-hanken text-[#0b1c30] outline-none ring-0 transition focus:border-[#006c49] focus:bg-white"
                />
              </label>

              <label className="flex flex-col gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[#45464d]">
                Alias
                <input
                  type="text"
                  value={institutionForm.shortName}
                  onChange={(e) => setInstitutionForm({ ...institutionForm, shortName: e.target.value })}
                  placeholder="Ej. BBVA"
                  className="rounded-lg border border-[#dfe8ff] bg-[#f9fbff] px-3 py-2 text-[12px] font-hanken text-[#0b1c30] outline-none transition focus:border-[#006c49] focus:bg-white"
                />
              </label>

              <label className="flex flex-col gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[#45464d]">
                Tasa %
                <input
                  type="number"
                  step="0.01"
                  value={institutionForm.rate}
                  onChange={(e) => setInstitutionForm({ ...institutionForm, rate: e.target.value })}
                  placeholder="12.5"
                  className="rounded-lg border border-[#dfe8ff] bg-[#f9fbff] px-3 py-2 text-[12px] font-hanken text-[#0b1c30] outline-none transition focus:border-[#006c49] focus:bg-white"
                />
              </label>

              <label className="flex flex-col gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[#45464d]">
                Tipo
                <select
                  value={institutionForm.category}
                  onChange={(e) => setInstitutionForm({ ...institutionForm, category: e.target.value as 'sofipo' | 'banco' | 'fondo' | 'cetes' })}
                  className="rounded-lg border border-[#dfe8ff] bg-[#f9fbff] px-3 py-2 text-[12px] font-hanken text-[#0b1c30] outline-none transition focus:border-[#006c49] focus:bg-white"
                >
                  <option value="sofipo">SOFIPO</option>
                  <option value="banco">Banco</option>
                  <option value="fondo">Fondo</option>
                  <option value="cetes">Cetes</option>
                </select>
              </label>

              <label className="sm:col-span-2 flex flex-col gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[#45464d]">
                Método de cálculo
                <select
                  value={institutionForm.calculationMethod}
                  onChange={(e) => {
                    const calculationMethod = e.target.value as CalculationMethod;
                    setInstitutionForm({
                      ...institutionForm,
                      calculationMethod,
                      defaultFreq: calculationMethod === 'cetes-titles' ? 'vencimiento' : institutionForm.defaultFreq,
                    });
                  }}
                  className="rounded-lg border border-[#dfe8ff] bg-[#f9fbff] px-3 py-2 text-[12px] font-hanken text-[#0b1c30] outline-none transition focus:border-[#006c49] focus:bg-white"
                >
                  <option value="annual-nominal">Tasa anual sobre saldo</option>
                  <option value="cetes-titles">Valor nominal por títulos al vencimiento</option>
                </select>
                <span className="font-normal normal-case text-[#76777d]">
                  Determina cómo se estima el rendimiento; cada cuenta conserva una copia de estas reglas.
                </span>
              </label>

              {institutionForm.calculationMethod === 'cetes-titles' && (
                <>
                  <label className="flex flex-col gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[#45464d]">
                    Valor nominal por título (MXN)
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={institutionForm.defaultNominalValue}
                      onChange={(e) => setInstitutionForm({ ...institutionForm, defaultNominalValue: e.target.value })}
                      className="rounded-lg border border-[#dfe8ff] bg-[#f9fbff] px-3 py-2 text-[12px] font-hanken text-[#0b1c30] outline-none transition focus:border-[#006c49] focus:bg-white"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[#45464d]">
                    Plazo predeterminado (días)
                    <input
                      type="number"
                      min="1"
                      max="3660"
                      step="1"
                      value={institutionForm.defaultTermDays}
                      onChange={(e) => setInstitutionForm({ ...institutionForm, defaultTermDays: e.target.value })}
                      className="rounded-lg border border-[#dfe8ff] bg-[#f9fbff] px-3 py-2 text-[12px] font-hanken text-[#0b1c30] outline-none transition focus:border-[#006c49] focus:bg-white"
                    />
                  </label>
                </>
              )}

              <label className="flex flex-col gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[#45464d]">
                Base
                <select
                  value={institutionForm.defaultBase}
                  onChange={(e) => setInstitutionForm({ ...institutionForm, defaultBase: Number(e.target.value) as 360 | 365 })}
                  className="rounded-lg border border-[#dfe8ff] bg-[#f9fbff] px-3 py-2 text-[12px] font-hanken text-[#0b1c30] outline-none transition focus:border-[#006c49] focus:bg-white"
                >
                  <option value={365}>365 días</option>
                  <option value={360}>360 días</option>
                </select>
              </label>

              <label className="flex flex-col gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[#45464d]">
                Frecuencia
                <select
                  value={institutionForm.defaultFreq}
                  onChange={(e) => setInstitutionForm({ ...institutionForm, defaultFreq: e.target.value as 'diario' | 'semanal' | 'vencimiento' })}
                  className="rounded-lg border border-[#dfe8ff] bg-[#f9fbff] px-3 py-2 text-[12px] font-hanken text-[#0b1c30] outline-none transition focus:border-[#006c49] focus:bg-white"
                >
                  <option value="diario">Diario</option>
                  <option value="semanal">Semanal</option>
                  <option value="vencimiento">Vencimiento</option>
                </select>
              </label>

              <label className="sm:col-span-2 flex items-center justify-between gap-3 rounded-xl border border-[#e6f6ee] bg-[#f2faf6] px-3 py-2 text-[12px] font-hanken text-[#0b1c30]">
                <span>Reinvertir rendimientos por defecto</span>
                <input
                  type="checkbox"
                  checked={institutionForm.defaultIsCompound}
                  onChange={(e) => setInstitutionForm({ ...institutionForm, defaultIsCompound: e.target.checked })}
                  className="h-4 w-4 accent-[#006c49]"
                />
              </label>

              <label className="sm:col-span-2 flex items-center justify-between gap-3 rounded-xl border border-[#e6f6ee] bg-[#f2faf6] px-3 py-2 text-[12px] font-hanken text-[#0b1c30]">
                <span>Tasa escalonada</span>
                <input
                  type="checkbox"
                  checked={institutionForm.hasDualTier}
                  onChange={(e) => setInstitutionForm({ ...institutionForm, hasDualTier: e.target.checked })}
                  className="h-4 w-4 accent-[#006c49]"
                />
              </label>

              {institutionForm.hasDualTier && (
                <>
                  <label className="flex flex-col gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[#45464d]">
                    Tramo 1 (límite MXN)
                    <input
                      type="number"
                      value={institutionForm.dualThreshold}
                      onChange={(e) => setInstitutionForm({ ...institutionForm, dualThreshold: e.target.value })}
                      placeholder="30000"
                      className="rounded-lg border border-[#dfe8ff] bg-[#f9fbff] px-3 py-2 text-[12px] font-hanken text-[#0b1c30] outline-none transition focus:border-[#006c49] focus:bg-white"
                    />
                  </label>

                  <label className="flex flex-col gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[#45464d]">
                    Tramo 2 (tasa %)
                    <input
                      type="number"
                      step="0.01"
                      value={institutionForm.dualRate2}
                      onChange={(e) => setInstitutionForm({ ...institutionForm, dualRate2: e.target.value })}
                      placeholder="7"
                      className="rounded-lg border border-[#dfe8ff] bg-[#f9fbff] px-3 py-2 text-[12px] font-hanken text-[#0b1c30] outline-none transition focus:border-[#006c49] focus:bg-white"
                    />
                  </label>
                </>
              )}

              <div className="sm:col-span-2 mt-1 border-t border-[#e6edf8] pt-3">
                <div className="mb-2 font-hanken text-[11px] font-bold uppercase tracking-[0.08em] text-[#45464d]">
                  Reglas de cálculo
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 [&_input]:min-h-12 [&_input]:px-4 [&_input]:py-3 [&_input]:text-sm [&_select]:min-h-12 [&_select]:px-4 [&_select]:py-3 [&_select]:text-sm">
                  <label className="flex flex-col gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[#45464d]">
                    ISR anual %
                    <input
                      type="number"
                      step="0.01"
                      value={institutionForm.isrRate}
                      onChange={(e) => setInstitutionForm({ ...institutionForm, isrRate: e.target.value })}
                      className="rounded-lg border border-[#dfe8ff] bg-[#f9fbff] px-3 py-2 text-[12px] font-hanken text-[#0b1c30] outline-none focus:border-[#006c49] focus:bg-white"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[#45464d]">
                    Aplicación del ISR
                    <select
                      value={institutionForm.isrMode}
                      onChange={(e) => setInstitutionForm({ ...institutionForm, isrMode: e.target.value as IsrMode })}
                      className="rounded-lg border border-[#dfe8ff] bg-[#f9fbff] px-3 py-2 text-[12px] font-hanken text-[#0b1c30] outline-none focus:border-[#006c49] focus:bg-white"
                    >
                      <option value="none">No aplicar</option>
                      <option value="deduct">Descontar del rendimiento</option>
                      <option value="separate">Mostrar por separado</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[#45464d]">
                    Redondeo
                    <select
                      value={institutionForm.roundingMode}
                      onChange={(e) => setInstitutionForm({ ...institutionForm, roundingMode: e.target.value as RoundingMode })}
                      className="rounded-lg border border-[#dfe8ff] bg-[#f9fbff] px-3 py-2 text-[12px] font-hanken text-[#0b1c30] outline-none focus:border-[#006c49] focus:bg-white"
                    >
                      <option value="normal">Normal</option>
                      <option value="truncate-total">Truncar total</option>
                      <option value="truncate-tier">Truncar cada tramo</option>
                    </select>
                  </label>
                  <label className="flex items-center gap-2 rounded-lg border border-[#dfe8ff] bg-[#f9fbff] px-3 py-2 text-[11px] font-hanken text-[#0b1c30]">
                    <input
                      type="checkbox"
                      checked={institutionForm.isrExempt}
                      onChange={(e) => setInstitutionForm({ ...institutionForm, isrExempt: e.target.checked })}
                      className="h-4 w-4 accent-[#006c49]"
                    />
                    Exento hasta límite SOFIPO
                  </label>
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleInstitutionSubmit}
                className="neon-rate-badge w-full rounded-xl px-4 py-3 font-hanken text-[14px] font-bold shadow-sm transition"
              >
                {editingInstitutionId ? 'Guardar institución' : 'Agregar institución'}
              </button>
            </div>
            {institutionError && (
              <p role="alert" className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 font-hanken text-[11px] text-red-700">
                {institutionError}
              </p>
            )}
          </div>

          </div>
        )}

        {activeSection === 'administrar' && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <h5 className="font-space font-semibold text-[15px] text-[#0b1c30]">Instituciones registradas</h5>
              <span className="font-hanken text-[12px] text-[#45d9ff]">{institutions.length} en total</span>
            </div>
            <div className="flex flex-col gap-3 max-h-[60vh] overflow-auto pr-1">
            {institutions.length === 0 && (
              <div className="rounded-xl border border-dashed border-[#cfe0ff] bg-white/80 px-3 py-3 text-center text-[12px] text-[#45464d]">
                No hay instituciones agregadas.
              </div>
            )}
            {institutions.map((inst) => (
              <div
                key={inst.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-[#45d9ff]/20 bg-[#0d1726] p-3 sm:p-4 shadow-[0_8px_24px_rgba(0,0,0,0.16)]"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#45d9ff]/30 bg-[#45d9ff]/10 font-space text-[12px] font-bold text-[#45d9ff]"
                  >
                    {inst.shortName.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-space text-[14px] font-semibold text-[#eef4f1]">{inst.name}</div>
                    <div className="truncate font-hanken text-[12px] text-[#91a5bc]">{inst.shortName} · {inst.rate}%</div>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => startEditInstitution(inst)}
                    className="rounded-lg border border-[#45d9ff]/35 bg-[#45d9ff]/10 px-3 py-2 font-space text-[12px] font-semibold text-[#45d9ff] transition hover:bg-[#45d9ff]/20"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingConfirmation({ action: 'delete-institution', institution: inst })}
                    className="rounded-lg border border-[#ff6b8a]/35 bg-[#ff6b8a]/10 px-3 py-2 font-space text-[12px] font-semibold text-[#ff8da5] transition hover:bg-[#ff6b8a]/20"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
            </div>
          </div>
        )}

        {activeSection === 'preferencias' && (
        <div className="flex flex-col gap-6">
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

        {/* SOFIPO exemption settings */}
        <div className="flex flex-col gap-4 pt-5 border-t border-[#29435d]/70">
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col pr-2">
              <span className="font-hanken text-[13px] font-semibold text-[#0b1c30]">
                Exención fiscal SOFIPO
              </span>
              <span className="font-hanken text-[11px] text-[#45464d]">
                Aplicar el límite anual de capital exento de ISR a instituciones marcadas como SOFIPO.
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={applyExemption}
                onChange={(e) => setApplyExemption(e.target.checked)}
                className="sr-only peer"
                aria-label="Aplicar exención fiscal SOFIPO"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#006c49]"></div>
            </label>
          </div>
          <label className="flex flex-col gap-1.5 font-hanken text-[11px] font-semibold text-[#45464d]">
            Límite anual de capital exento
            <div className="relative flex items-center">
              <span className="absolute left-3 font-space text-[14px] text-[#45464d]">$</span>
              <input
                type="number"
                min="0"
                step="1000"
                value={umaLimit}
                onChange={(e) => setUmaLimit(Math.max(0, Number(e.target.value) || 0))}
                className="w-full rounded-lg border border-[#dfe8ff] bg-[#f9fbff] py-2 pl-7 pr-14 font-space text-[14px] font-bold text-[#0b1c30] outline-none focus:border-[#006c49]"
                aria-label="Límite anual de capital exento de ISR en MXN"
              />
              <span className="absolute right-3 font-hanken text-[11px] text-[#45464d]">MXN</span>
            </div>
            <span className="font-normal text-[#76777d]">Se guarda junto con tus preferencias fiscales.</span>
          </label>
        </div>

        {/* Inflation rate for GAT Real */}
        <div className="flex flex-col gap-2.5 pt-5 border-t border-[#29435d]/70">
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

        <div className="flex flex-col gap-4 pt-5 border-t border-[#29435d]/70">
          <div>
            <div className="font-hanken text-[12px] font-semibold text-[#0b1c30]">
              Horizontes de proyección
            </div>
            <p className="mt-1 font-hanken text-[11px] text-[#45464d]">
              Define cuántos días usar para comparar periodos cortos y anuales. No cambia las condiciones de tus instituciones.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="flex flex-col gap-1 font-hanken text-[11px] font-semibold text-[#45464d]">
              Proyección corta (días)
              <input
                type="number"
                min="1"
                max="3660"
                step="1"
                value={projectionMonthDays}
                onChange={(e) => setProjectionMonthDays(Math.max(1, Math.min(3660, Math.floor(Number(e.target.value) || 1))))}
                className="w-full rounded-lg border border-[#dfe8ff] bg-[#f9fbff] px-3 py-2 font-space text-[14px] font-bold text-[#0b1c30] outline-none focus:border-[#006c49]"
              />
            </label>
            <label className="flex flex-col gap-1 font-hanken text-[11px] font-semibold text-[#45464d]">
              Proyección larga (días)
              <input
                type="number"
                min="1"
                max="3660"
                step="1"
                value={projectionYearDays}
                onChange={(e) => setProjectionYearDays(Math.max(1, Math.min(3660, Math.floor(Number(e.target.value) || 1))))}
                className="w-full rounded-lg border border-[#dfe8ff] bg-[#f9fbff] px-3 py-2 font-space text-[14px] font-bold text-[#0b1c30] outline-none focus:border-[#006c49]"
              />
            </label>
          </div>
        </div>

        <button
          onClick={handleSave}
          type="button"
          className="neon-rate-badge w-full mt-2 min-h-14 rounded-xl px-4 py-4 font-space text-[15px] font-bold transition"
        >
          {savedNotice ? '¡Preferencias guardadas!' : 'Guardar preferencias'}
        </button>
        </div>
        )}
      </div>

      {pendingConfirmation && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div role="alertdialog" aria-modal="true" aria-labelledby="profile-confirmation-title" className="w-full max-w-md rounded-2xl border border-[#45d9ff]/40 bg-[#101d31] p-5 shadow-[0_0_36px_rgba(69,217,255,0.18)] sm:p-6">
            <div className="mb-4 flex items-start gap-3">
              <span className="material-symbols-outlined text-[26px] text-[#45d9ff]" aria-hidden="true">
                {pendingConfirmation.action === 'delete-institution' ? 'delete' : 'save'}
              </span>
              <div>
                <h3 id="profile-confirmation-title" className="font-space text-[18px] font-semibold text-white">
                  {pendingConfirmation.action === 'delete-institution' ? '¿Eliminar institución?' : '¿Guardar preferencias?'}
                </h3>
                <p className="mt-2 font-hanken text-[14px] leading-relaxed text-[#a9b7ca]">
                  {pendingConfirmation.action === 'delete-institution'
                    ? `Se eliminará ${pendingConfirmation.institution.name}. Esta acción no se puede deshacer.`
                    : 'Se guardarán tus preferencias fiscales y horizontes de proyección en la base de datos.'}
                </p>
              </div>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setPendingConfirmation(null)}
                className="min-h-11 rounded-xl border border-[#29435d] px-4 py-2 font-space text-[13px] font-semibold text-[#bec6e0] transition hover:bg-white/5"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmPendingAction}
                className={pendingConfirmation.action === 'delete-institution'
                  ? 'min-h-11 rounded-xl border border-[#ff6b8a]/60 bg-[#ff6b8a]/15 px-4 py-2 font-space text-[13px] font-bold text-[#ff8da5] transition hover:bg-[#ff6b8a]/25'
                  : 'neon-rate-badge min-h-11 rounded-xl px-4 py-2 font-space text-[13px] font-bold transition'}
              >
                {pendingConfirmation.action === 'delete-institution' ? 'Sí, eliminar' : 'Sí, guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
