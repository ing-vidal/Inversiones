import React, { useState, useEffect } from 'react';
import { BankAccount, BankInstitution, CalculationMethod, DailyYieldRecord, DivisorBase, PaymentFrequency } from '../../types/finance';
import { calculateCetesProjection, calculateTermProgress, calculateYield, formatMXN } from '../../utils/calculator';
import { IsrMode, UserSettings } from '../../types/finance';

interface CuentasViewProps {
  accounts: BankAccount[];
  history: DailyYieldRecord[];
  settings: UserSettings;
  institutions: BankInstitution[];
  onSaveAccount: (newAccount: BankAccount) => void;
  onUpdateAccount: (id: string, changes: Partial<BankAccount>) => void;
  onDeleteAccount: (id: string) => void;
  onDepositWithdraw: (accountId: string, amountDelta: number) => void;
  onOpenProfile?: () => void;
  initialSubTab?: 'cuentas' | 'registrar' | 'simulador';
}

const toDateInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const addDaysToDateInput = (dateValue: string, days: number) => {
  const date = new Date(`${dateValue}T00:00:00`);
  date.setDate(date.getDate() + days);
  return toDateInputValue(date);
};

export const CuentasView: React.FC<CuentasViewProps> = ({
  accounts,
  history,
  settings,
  institutions,
  onSaveAccount,
  onUpdateAccount,
  onDeleteAccount,
  onDepositWithdraw,
  onOpenProfile,
  initialSubTab = 'registrar',
}) => {
  const [subTab, setSubTab] = useState<'cuentas' | 'registrar' | 'simulador'>(initialSubTab);
  const activeInstitution = institutions.find((i) => i.id === 'nu') || institutions[0] || null;

  // Form State matching the screenshot
  const [selectedInst, setSelectedInst] = useState<BankInstitution | null>(activeInstitution);

  useEffect(() => {
    if (institutions.length === 0) {
      setSelectedInst(null);
      return;
    }

    setSelectedInst((prev) => {
      return institutions.find((inst) => inst.id === prev?.id) ?? activeInstitution;
    });
  }, [institutions, activeInstitution]);

  const [accountNickname, setAccountNickname] = useState('');
  const [monto, setMonto] = useState<number>(50000);
  const [tasa, setTasa] = useState<number>(activeInstitution?.rate ?? 0);
  const [isTasaFija, setIsTasaFija] = useState<boolean>(true);
  const [rateExpiryDate, setRateExpiryDate] = useState('');
  const [baseDivisor, setBaseDivisor] = useState<DivisorBase>(activeInstitution?.defaultBase ?? 365);
  const [frecuencia, setFrecuencia] = useState<PaymentFrequency>(activeInstitution?.defaultFreq ?? 'diario');
  const [isCompound, setIsCompound] = useState<boolean>(activeInstitution?.defaultIsCompound ?? true);
  const [isrMode, setIsrMode] = useState<IsrMode>(activeInstitution?.isrMode ?? 'deduct');
  const [startDate, setStartDate] = useState<string>(() => toDateInputValue(new Date()));
  const [endDate, setEndDate] = useState<string>(() => activeInstitution?.defaultFreq === 'vencimiento'
    ? addDaysToDateInput(toDateInputValue(new Date()), activeInstitution.defaultTermDays ?? 28)
    : toDateInputValue(new Date()));
  const [titleCount, setTitleCount] = useState<number>(0);
  const [nominalValue, setNominalValue] = useState<number>(activeInstitution?.defaultNominalValue ?? 10);

  // Dual-tier specifics (for DiDi / customized accounts)
  const [isDualTier, setIsDualTier] = useState<boolean>(activeInstitution?.hasDualTier ?? false);
  const [dualThreshold, setDualThreshold] = useState<number>(activeInstitution?.dualThreshold ?? 0);
  const [dualRate2, setDualRate2] = useState<number>(activeInstitution?.dualRate2 ?? 0);

  // Toast state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modal for deposit / withdraw in "Mis Cuentas"
  const [adjustingAccount, setAdjustingAccount] = useState<BankAccount | null>(null);
  const [adjustAmount, setAdjustAmount] = useState<string>('5000');
  const [adjustType, setAdjustType] = useState<'deposit' | 'withdraw'>('deposit');
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
  const [editForm, setEditForm] = useState<Partial<BankAccount>>({});

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  };

  const openAccountEditor = (account: BankAccount) => {
    setEditingAccount(account);
    setEditForm({ ...account });
  };

  const editPreview = editingAccount
    ? calculateYield({
      monto: Number(editForm.balance ?? editingAccount.balance),
      tasaNominal: Number(editForm.nominalRate ?? editingAccount.nominalRate),
      base: (editForm.baseDivisor ?? editingAccount.baseDivisor) as DivisorBase,
      isCompound: Boolean(editForm.isCompound ?? editingAccount.isCompound),
      deductISR: editForm.isrMode === 'deduct' || (!editForm.isrMode && editingAccount.deductISR),
      isDualTier: Boolean(editForm.isDualTier ?? editingAccount.isDualTier),
      dualThreshold: Number(editForm.dualThreshold ?? editingAccount.dualThreshold ?? 0),
      dualRate2: Number(editForm.dualRate2 ?? editingAccount.dualRate2 ?? 0),
      isrRate: Number(editForm.isrRate ?? editingAccount.isrRate ?? settings.satIsrRate),
      isrMode: editForm.isrMode ?? editingAccount.isrMode,
      isSofipoExempt: settings.applySofipoExemption && editForm.isrExempt === true,
      roundingMode: editForm.roundingMode ?? editingAccount.roundingMode,
      projectionMonthDays: settings.projectionMonthDays,
      projectionYearDays: settings.projectionYearDays,
    })
    : null;

  const editTermPreview = editingAccount
    ? calculateTermProgress({
      balance: Number(editForm.balance ?? editingAccount.balance),
      nominalRate: Number(editForm.nominalRate ?? editingAccount.nominalRate),
      base: (editForm.baseDivisor ?? editingAccount.baseDivisor) as DivisorBase,
      startDate: editForm.startDate ?? editingAccount.startDate,
      endDate: editForm.endDate ?? editingAccount.endDate,
      calculationMethod: editForm.calculationMethod ?? editingAccount.calculationMethod,
      titleCount: Number(editForm.titleCount ?? editingAccount.titleCount ?? 0),
      nominalValue: Number(editForm.nominalValue ?? editingAccount.nominalValue ?? 0),
      isCompound: Boolean(editForm.isCompound ?? editingAccount.isCompound),
      deductISR: editForm.isrMode === 'deduct' || (!editForm.isrMode && editingAccount.deductISR),
      isDualTier: Boolean(editForm.isDualTier ?? editingAccount.isDualTier),
      dualThreshold: Number(editForm.dualThreshold ?? editingAccount.dualThreshold ?? 0),
      dualRate2: Number(editForm.dualRate2 ?? editingAccount.dualRate2 ?? 0),
      isrRate: Number(editForm.isrRate ?? editingAccount.isrRate ?? settings.satIsrRate),
      isrMode: editForm.isrMode ?? editingAccount.isrMode,
      isSofipoExempt: settings.applySofipoExemption && editForm.isrExempt === true,
      sofipoExemptionLimit: settings.umaValueAnnual,
      roundingMode: editForm.roundingMode ?? editingAccount.roundingMode,
    })
    : null;

  const handleSaveAccountEdit = () => {
    if (!editingAccount) return;
    const calculationMethod = editForm.calculationMethod ?? editingAccount.calculationMethod ?? 'annual-nominal';
    if (calculationMethod === 'cetes-titles' && (
      Number(editForm.titleCount ?? editingAccount.titleCount ?? 0) <= 0
      || Number(editForm.nominalValue ?? editingAccount.nominalValue ?? 0) <= 0
    )) {
      showToast('Captura la cantidad y el valor nominal de los títulos.');
      return;
    }
    if (editForm.rateType === 'promo' && !editForm.rateExpiryDate) {
      showToast('Indica cuándo termina la tasa promocional.');
      return;
    }
    if (editForm.isDualTier && Number(editForm.dualThreshold ?? 0) <= 0) {
      showToast('El límite del primer tramo debe ser mayor que cero.');
      return;
    }
    if (editForm.paymentFrequency === 'vencimiento'
      && (!editForm.startDate || !editForm.endDate || editForm.endDate <= editForm.startDate)) {
      showToast('El vencimiento debe ser posterior a la fecha de inicio.');
      return;
    }

    onUpdateAccount(editingAccount.id, {
      ...editForm,
      calculationMethod,
      deductISR: editForm.isrMode === 'deduct',
    });
    setEditingAccount(null);
    showToast('Cuenta actualizada');
  };

  const handleSelectBank = (inst: BankInstitution) => {
    setSelectedInst(inst);
    setTasa(inst.rate);
    setBaseDivisor(inst.defaultBase);
    setFrecuencia(inst.defaultFreq);
    setIsCompound(inst.defaultIsCompound ?? true);
    setNominalValue(inst.defaultNominalValue ?? 10);
    setRateExpiryDate('');
    const today = toDateInputValue(new Date());
    setStartDate(today);
    setEndDate(inst.defaultFreq === 'vencimiento'
      ? addDaysToDateInput(today, inst.defaultTermDays ?? 28)
      : today);
    setIsDualTier(inst.hasDualTier);
    setDualThreshold(inst.dualThreshold ?? 0);
    setDualRate2(inst.dualRate2 ?? 0);
    setIsrMode(inst.isrMode ?? 'deduct');
  };

  const deductISR = isrMode === 'deduct';
  const selectedIsrMode = isrMode;

  // Live calculation
  const liveResult = calculateYield({
    monto,
    tasaNominal: tasa,
    base: baseDivisor,
    isCompound,
    deductISR,
    isDualTier,
    dualThreshold,
    dualRate2,
    isrRate: selectedInst?.isrRate ?? settings.satIsrRate,
    isrMode: selectedIsrMode,
    isSofipoExempt: settings.applySofipoExemption && selectedInst?.isrExempt === true,
    sofipoExemptionLimit: settings.umaValueAnnual,
    roundingMode: selectedInst?.roundingMode,
    projectionMonthDays: settings.projectionMonthDays,
    projectionYearDays: settings.projectionYearDays,
  });
  const hasValidTermDates = /^\d{4}-\d{2}-\d{2}$/.test(startDate) && /^\d{4}-\d{2}-\d{2}$/.test(endDate)
    && Number(startDate.slice(0, 4)) >= 2000 && Number(endDate.slice(0, 4)) >= 2000;
  const calculationMethod: CalculationMethod = selectedInst?.calculationMethod
    ?? (selectedInst?.category === 'cetes' ? 'cetes-titles' : 'annual-nominal');
  const termProgressPreview = calculateTermProgress({
    balance: monto,
    nominalRate: tasa,
    base: baseDivisor,
    startDate: hasValidTermDates ? startDate : undefined,
    endDate: hasValidTermDates ? endDate : undefined,
    calculationMethod,
    titleCount,
    nominalValue,
    isCompound,
    deductISR,
    isDualTier,
    dualThreshold,
    dualRate2,
    isrRate: selectedInst?.isrRate ?? settings.satIsrRate,
    isrMode: selectedIsrMode,
    isSofipoExempt: settings.applySofipoExemption && selectedInst?.isrExempt === true,
    sofipoExemptionLimit: settings.umaValueAnnual,
    roundingMode: selectedInst?.roundingMode,
  });
  const termDays = frecuencia === 'vencimiento' ? termProgressPreview.totalDays : 0;
  const termInterest = termProgressPreview.totalInterest;
  const termAmount = termProgressPreview.maturityAmount;
  const isCetes = calculationMethod === 'cetes-titles';
  const cetesMaturityAmount = termAmount;
  const cetesInterest = termInterest;

  const handleGuardarCuenta = () => {
    if (!selectedInst) {
      showToast('Primero agrega una institución en el perfil');
      return;
    }

    const finalNickname = accountNickname.trim() || `${selectedInst.name} Cajita`;
    if (frecuencia === 'vencimiento' && endDate <= startDate) {
      showToast('La fecha final debe ser posterior a la fecha inicial');
      return;
    }
    if (frecuencia === 'vencimiento' && !hasValidTermDates) {
      showToast('Captura fechas válidas con año de cuatro dígitos');
      return;
    }
    if (!isTasaFija && !rateExpiryDate) {
      showToast('Indica cuándo termina la tasa promocional');
      return;
    }
    if (isDualTier && dualThreshold <= 0) {
      showToast('El límite del primer tramo debe ser mayor que cero');
      return;
    }
    if (isCetes && titleCount <= 0) {
      showToast('Captura el número de títulos de CETES');
      return;
    }
    const newAccount: BankAccount = {
      id: `acc-${Date.now()}`,
      institutionId: selectedInst.id,
      institutionName: selectedInst.name,
      accountNickname: finalNickname,
      balance: monto,
      nominalRate: tasa,
      rateType: isDualTier ? 'escalonada' : isTasaFija ? 'fija' : 'promo',
      rateExpiryDate: !isTasaFija ? rateExpiryDate : undefined,
      calculationMethod,
      baseDivisor,
      paymentFrequency: frecuencia,
      isCompound,
      deductISR,
      isrRate: selectedInst.isrRate ?? settings.satIsrRate,
      isrMode: selectedIsrMode,
      isrExempt: selectedInst.isrExempt,
      roundingMode: selectedInst.roundingMode,
      isDualTier,
      dualThreshold: isDualTier ? dualThreshold : undefined,
      dualRate2: isDualTier ? dualRate2 : undefined,
      color: selectedInst.color,
      badgeBg: selectedInst.badgeBg,
      badgeText: selectedInst.badgeText,
      shortCode: selectedInst.shortName.split(' ')[0] || 'MX',
      createdAt: new Date().toISOString(),
      startDate: frecuencia === 'vencimiento' ? startDate : undefined,
      endDate: frecuencia === 'vencimiento' ? endDate : undefined,
      titleCount: isCetes ? titleCount : undefined,
      nominalValue: isCetes ? nominalValue : undefined,
    };

    onSaveAccount(newAccount);
    showToast(`${selectedInst.name} guardada e historial activado`);
    setTimeout(() => {
      setSubTab('cuentas');
    }, 800);
  };

  // Totals for "Mis Cuentas"
  const totalBalance = accounts.reduce((acc, curr) => acc + curr.balance, 0);
  const totalDailyYield = accounts.reduce((acc, curr) => {
    const res = calculateYield({
      monto: curr.balance,
      tasaNominal: curr.nominalRate,
      base: curr.baseDivisor,
      isCompound: curr.isCompound,
      deductISR: curr.isrMode ? curr.isrMode === 'deduct' : curr.deductISR,
      isDualTier: curr.isDualTier,
      dualThreshold: curr.dualThreshold,
      dualRate2: curr.dualRate2,
      isrRate: curr.isrRate ?? settings.satIsrRate,
      isrMode: curr.isrMode,
      isSofipoExempt: settings.applySofipoExemption && curr.isrExempt === true,
      sofipoExemptionLimit: settings.umaValueAnnual,
      roundingMode: curr.roundingMode,
      projectionMonthDays: settings.projectionMonthDays,
      projectionYearDays: settings.projectionYearDays,
    });
    return acc + res.netDaily;
  }, 0);

  const handleApplyAdjustment = () => {
    if (!adjustingAccount) return;
    const num = parseFloat(adjustAmount) || 0;
    if (num <= 0) return;
    const delta = adjustType === 'deposit' ? num : -num;
    onDepositWithdraw(adjustingAccount.id, delta);
    showToast(
      adjustType === 'deposit'
        ? `Depósito de ${formatMXN(num)} aplicado con éxito`
        : `Retiro de ${formatMXN(num)} procesado`
    );
    setAdjustingAccount(null);
  };

  return (
    <div className="flex flex-col w-full pb-10">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-[#0b1c30] text-[#f8f9ff] px-4 py-2.5 rounded-full shadow-2xl flex items-center gap-2 z-50 animate-bounce text-sm font-medium border border-white/20">
          <span className="material-symbols-outlined text-[#6cf8bb] text-[18px]">
            check_circle
          </span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Segmented Sub-Tabs */}
      <div className="bg-[#dce9ff]/60 p-1 rounded-xl flex items-center justify-between shadow-xs mb-6 max-w-md mx-auto w-full">
        <button
          onClick={() => setSubTab('cuentas')}
          className={`flex-1 py-2 rounded-lg text-center font-hanken text-[12px] transition-all select-none ${
            subTab === 'cuentas'
              ? 'bg-white text-[#0b1c30] shadow-sm font-semibold'
              : 'text-[#45464d] hover:text-[#0b1c30]'
          }`}
          type="button"
        >
          Mis Cuentas ({accounts.length})
        </button>
        <button
          onClick={() => setSubTab('registrar')}
          className={`flex-1 py-2 rounded-lg text-center font-hanken text-[12px] transition-all select-none ${
            subTab === 'registrar'
              ? 'bg-white text-[#0b1c30] shadow-sm font-semibold'
              : 'text-[#45464d] hover:text-[#0b1c30]'
          }`}
          type="button"
        >
          + Registrar
        </button>
        <button
          onClick={() => setSubTab('simulador')}
          className={`flex-1 py-2 rounded-lg text-center font-hanken text-[12px] transition-all select-none ${
            subTab === 'simulador'
              ? 'bg-white text-[#0b1c30] shadow-sm font-semibold'
              : 'text-[#45464d] hover:text-[#0b1c30]'
          }`}
          type="button"
        >
          Simulador Pro
        </button>
      </div>

      {/* SUB-TAB 1: + REGISTRAR (EXACT SCREENSHOT MATCH) */}
      {subTab === 'registrar' && (
        institutions.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#cfe0ff] bg-white p-8 text-center shadow-sm">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#e8f5ee] text-[#006c49]">
              <span className="material-symbols-outlined text-[28px]">account_balance</span>
            </div>
            <h3 className="font-hanken text-[20px] font-semibold text-[#0b1c30]">No hay instituciones disponibles</h3>
            <p className="mt-2 max-w-md font-hanken text-[13px] text-[#45464d]">
              Agrega al menos una institución o SOFIPO en la sección de perfil para poder registrar cuentas.
            </p>
            <button
              type="button"
              onClick={() => onOpenProfile?.()}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#006c49] px-4 py-2.5 font-hanken text-[12px] font-semibold text-white shadow-sm hover:bg-[#005a3c]"
            >
              <span className="material-symbols-outlined text-[16px]">settings</span>
              Ir a Perfil e ingresar institución
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Columna Izquierda: Configuración de la Cuenta (7 cols en desktop) */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            {/* Header Banner / Context */}
            <div className="bg-white p-4 rounded-xl shadow-xs border border-[#e2e8f0]/60 flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[#006c49]/10 flex items-center justify-center text-[#006c49] shrink-0">
                <span className="material-symbols-outlined text-[26px]">tune</span>
              </div>
              <div className="flex flex-col min-w-0">
                <h2 className="font-hanken font-semibold text-[16px] text-[#0b1c30]">
                  Configurar Fórmula Bancaria
                </h2>
                <p className="font-hanken text-[12px] text-[#45464d] truncate">
                  Rendimiento diario exacto y retención de ISR oficial SAT
                </p>
              </div>
            </div>

          {/* 1. Institución o SOFIPO */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="font-hanken text-[11px] font-bold text-[#45464d] uppercase tracking-wider">
                1. Institución o SOFIPO
              </span>
              <span className="font-hanken text-[12px] text-[#006c49] font-semibold">
                {selectedInst?.name ?? 'Sin institución'} ({selectedInst?.rate ?? 0}%)
              </span>
            </div>

            {/* Chips Carousel on Mobile / Grid on Desktop */}
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap no-scrollbar">
              {institutions.map((inst) => {
                const isSelected = selectedInst?.id === inst.id;
                return (
                  <button
                    key={inst.id}
                    onClick={() => handleSelectBank(inst)}
                    type="button"
                    className={`shrink-0 px-4 py-3 rounded-xl bg-white shadow-sm flex flex-col items-center gap-1 active:scale-95 transition-all text-left w-32 border ${
                      isSelected
                        ? 'border-2 border-[#0b1c30] shadow-md'
                        : 'border-[#e2e8f0]/80 hover:border-slate-300'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full ${inst.badgeBg} ${inst.badgeText} flex items-center justify-center font-space text-[13px] font-bold`}
                    >
                      {inst.shortName.includes(' ')
                        ? inst.shortName.split(' ')[0]
                        : inst.shortName.substring(0, 2)}
                    </div>
                    <span className="font-hanken text-[12px] font-semibold text-[#0b1c30] text-center truncate w-full">
                      {inst.shortName}
                    </span>
                    <span className="font-hanken text-[11px] text-[#006c49] font-medium">
                      {inst.hasDualTier ? `${inst.rate}% dual` : `${inst.rate}% fija`}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Inputs Principales: Saldo & Tasa */}
          <div className="bg-white rounded-xl p-4 shadow-sm border border-[#e2e8f0]/60 flex flex-col gap-3.5">
            {/* Saldo Base Invertido */}
            <div className="flex flex-col gap-1">
              <label className="font-hanken text-[11px] font-bold text-[#45464d] uppercase tracking-wider">
                Monto Invertido / Saldo Base
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3.5 font-space text-[20px] font-semibold text-[#45464d]">
                  $
                </span>
                <input
                  type="number"
                  min="0"
                  step="500"
                  value={monto || ''}
                  onChange={(e) => setMonto(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="w-full bg-[#eff4ff] pl-9 pr-14 py-2.5 rounded-lg font-space text-[28px] font-bold text-[#0b1c30] outline-none focus:bg-[#e5eeff] transition-colors"
                />
                <span className="absolute right-3.5 font-hanken text-[12px] font-semibold text-[#45464d]">
                  MXN
                </span>
              </div>

              {/* Quick Amount Chips */}
              <div className="flex gap-1.5 mt-1 flex-wrap">
                {[10000, 28095, 50000, 100000].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setMonto(val)}
                    className={`px-3 py-1 rounded-full font-hanken text-[11px] transition-colors ${
                      monto === val
                        ? 'bg-[#0b1c30] text-white font-semibold'
                        : 'bg-[#e5eeff] text-[#0b1c30] hover:bg-[#dce9ff]'
                    }`}
                  >
                    ${val.toLocaleString('es-MX')}
                  </button>
                ))}
              </div>
            </div>

            {/* Tasa Anual Nominal & Vigencia Tasa */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="font-hanken text-[11px] font-bold text-[#45464d] uppercase tracking-wider truncate">
                  Tasa Anual Nominal
                </label>
                <div className="relative flex items-center">
                  <input
                    type="number"
                    step="0.05"
                    value={tasa || ''}
                    onChange={(e) => setTasa(parseFloat(e.target.value) || 0)}
                    className="w-full bg-[#eff4ff] px-3.5 py-2 rounded-lg font-space text-[20px] font-semibold text-[#0b1c30] outline-none focus:bg-[#e5eeff] transition-colors"
                  />
                  <span className="absolute right-3.5 font-space text-[20px] font-semibold text-[#45464d]">
                    %
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-hanken text-[11px] font-bold text-[#45464d] uppercase tracking-wider truncate">
                  Vigencia Tasa
                </label>
                <button
                  type="button"
                  onClick={() => setIsTasaFija(!isTasaFija)}
                  className="w-full h-full bg-[#eff4ff] px-3 py-2 rounded-lg flex items-center justify-between text-left transition-colors hover:bg-[#e5eeff]"
                >
                  <div className="flex flex-col min-w-0 pr-1">
                    <span className="font-hanken text-[12px] font-semibold text-[#0b1c30] truncate">
                      {isTasaFija ? 'Fija Ordinaria' : 'Promocional'}
                    </span>
                    <span className="font-hanken text-[11px] text-[#45464d] truncate">
                      {isTasaFija
                        ? 'Sin vencimiento'
                        : rateExpiryDate
                        ? new Date(`${rateExpiryDate}T00:00:00`).toLocaleDateString('es-MX')
                        : 'Indica la fecha de término'}
                    </span>
                  </div>
                  <span className="material-symbols-outlined text-[18px] text-[#006c49] shrink-0">
                    verified
                  </span>
                </button>
              </div>
            </div>

            {!isTasaFija && (
              <label className="flex flex-col gap-1 pt-1 font-hanken text-[11px] font-bold text-[#45464d] uppercase tracking-wider">
                La tasa promocional termina el
                <input
                  type="date"
                  min={toDateInputValue(new Date())}
                  value={rateExpiryDate}
                  onChange={(e) => setRateExpiryDate(e.target.value)}
                  className="w-full rounded-lg bg-[#eff4ff] px-3 py-2 font-space text-[13px] font-semibold normal-case text-[#0b1c30] outline-none focus:bg-[#e5eeff]"
                />
              </label>
            )}

            {/* Optional Nickname */}
            <div className="flex flex-col gap-1 pt-1 border-t border-[#e2e8f0]/40">
              <label className="font-hanken text-[11px] font-bold text-[#45464d] uppercase tracking-wider">
                Nombre o Apodo de la Cuenta (Opcional)
              </label>
              <input
                type="text"
                value={accountNickname}
                onChange={(e) => setAccountNickname(e.target.value)}
                placeholder={`Ej. ${selectedInst?.name ?? 'Institución'} Ahorro Meta`}
                className="w-full bg-[#eff4ff] px-3 py-2 rounded-lg font-hanken text-[13px] text-[#0b1c30] outline-none focus:bg-[#e5eeff]"
              />
            </div>

            {/* Esquema de Tasa Escalonada (Always configurable & matches screenshot) */}
            <div
              className={`p-3.5 rounded-xl flex flex-col gap-1 transition-all ${
                isDualTier
                  ? 'bg-[#6cf8bb]/20 border border-[#6cf8bb]/40'
                  : 'bg-[#eff4ff] border border-dashed border-[#dce9ff]'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[#006c49] font-hanken font-semibold text-[14px]">
                  <span className="material-symbols-outlined text-[18px]">
                    split_scene
                  </span>
                  <span>Esquema de Tasa Escalonada</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDualTier(!isDualTier)}
                  className={`font-hanken text-[11px] font-bold px-2 py-0.5 rounded-full transition-colors ${
                    isDualTier
                      ? 'bg-[#006c49] text-white'
                      : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                  }`}
                >
                  {isDualTier ? 'Activo' : 'Inactivo'}
                </button>
              </div>

              {isDualTier ? (
                <>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <label className="flex flex-col gap-1 font-hanken text-[10px] font-bold text-[#45464d] uppercase">
                      Tramo 1 hasta (MXN)
                      <input
                        type="number"
                        min="1"
                        step="100"
                        value={dualThreshold || ''}
                        onChange={(e) => setDualThreshold(Number(e.target.value) || 0)}
                        className="rounded-lg border border-[#dce9ff] bg-[#eff4ff] px-2.5 py-2 font-space text-[13px] font-semibold text-[#0b1c30] outline-none focus:border-[#006c49]"
                      />
                    </label>
                    <label className="flex flex-col gap-1 font-hanken text-[10px] font-bold text-[#45464d] uppercase">
                      Tasa excedente (%)
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={dualRate2 || ''}
                        onChange={(e) => setDualRate2(Number(e.target.value) || 0)}
                        className="rounded-lg border border-[#dce9ff] bg-[#eff4ff] px-2.5 py-2 font-space text-[13px] font-semibold text-[#0b1c30] outline-none focus:border-[#006c49]"
                      />
                    </label>
                  </div>
                  <p className="font-hanken text-[11px] text-[#45464d] mt-1">
                    Valores heredados de {selectedInst?.name ?? 'la institución'}. Los cambios solo aplican a esta cuenta.
                  </p>
                </>
              ) : (
                <p className="font-hanken text-[11px] text-[#76777d] mt-0.5">
                  Toca "Inactivo" para activar tasa escalonada por tramos de saldo (ej. DiDi 15% hasta $10k y 7% en excedente).
                </p>
              )}
            </div>
          </div>

          {/* Reglas del Contrato Bancario */}
          <div className="bg-white rounded-xl p-4 shadow-sm border border-[#e2e8f0]/60 flex flex-col gap-3.5">
            <h3 className="font-space font-semibold text-[16px] text-[#0b1c30] flex items-center gap-1.5">
              <span className="font-space text-[18px] font-bold text-[#45464d]">Σ</span>
              Reglas del Contrato Bancario
            </h3>

            {/* Base Divisoria del Año: 365 vs 360 */}
            <div className="flex flex-col gap-1.5">
              <span className="font-hanken text-[11px] font-bold text-[#45464d] uppercase tracking-wider">
                Base Divisoria del Año
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setBaseDivisor(365)}
                  className={`py-2 px-3 rounded-lg font-hanken text-[12px] flex items-center justify-between transition-all border ${
                    baseDivisor === 365
                      ? 'bg-[#e5eeff] text-[#0b1c30] border-[#006c49]/40 font-medium'
                      : 'bg-[#eff4ff] text-[#0b1c30] border-transparent hover:bg-[#e5eeff]'
                  }`}
                >
                  <div className="flex flex-col text-left">
                    <span className="font-semibold">365 Días</span>
                    <span className="text-[11px] text-[#45464d]">
                      Año natural (Nu, MP)
                    </span>
                  </div>
                  <span
                    className={`material-symbols-outlined text-[18px] ${
                      baseDivisor === 365 ? 'text-[#006c49]' : 'text-slate-300'
                    }`}
                  >
                    {baseDivisor === 365 ? 'check_circle' : 'circle'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setBaseDivisor(360)}
                  className={`py-2 px-3 rounded-lg font-hanken text-[12px] flex items-center justify-between transition-all border ${
                    baseDivisor === 360
                      ? 'bg-[#e5eeff] text-[#0b1c30] border-[#006c49]/40 font-medium'
                      : 'bg-[#eff4ff] text-[#0b1c30] border-transparent hover:bg-[#e5eeff]'
                  }`}
                >
                  <div className="flex flex-col text-left">
                    <span className="font-semibold">360 Días</span>
                    <span className="text-[11px] text-[#45464d]">
                      Comercial (Klar, Bancos)
                    </span>
                  </div>
                  <span
                    className={`material-symbols-outlined text-[18px] ${
                      baseDivisor === 360 ? 'text-[#006c49]' : 'text-slate-300'
                    }`}
                  >
                    {baseDivisor === 360 ? 'check_circle' : 'circle'}
                  </span>
                </button>
              </div>
            </div>

            {/* Frecuencia de Abono */}
            <div className="flex flex-col gap-1.5">
              <span className="font-hanken text-[11px] font-bold text-[#45464d] uppercase tracking-wider">
                Frecuencia de Abono
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: 'diario', label: 'Diario (a la vista)' },
                  { id: 'semanal', label: 'Semanal (7d)' },
                  { id: 'vencimiento', label: 'Al plazo fijo' },
                ].map((item) => {
                  const isActive = frecuencia === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setFrecuencia(item.id as PaymentFrequency)}
                      className={`py-2 rounded-lg font-hanken text-[12px] text-center transition-all ${
                        isActive
                          ? 'bg-[#e5eeff] font-semibold text-[#0b1c30] ring-1 ring-[#006c49]/40'
                          : 'bg-[#eff4ff] text-[#45464d] hover:text-[#0b1c30]'
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Toggles de Reinversión e ISR */}
            {frecuencia === 'vencimiento' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#e2e8f0]/40">
                <label className="flex flex-col gap-1.5 font-hanken text-[11px] font-bold text-[#45464d] uppercase tracking-wider">
                  Fecha inicial
                  <input
                    type="date"
                    min="2000-01-01"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="rounded-lg bg-[#eff4ff] px-3 py-2 font-space text-[13px] font-semibold text-[#0b1c30] outline-none focus:bg-[#e5eeff]"
                  />
                </label>
                <label className="flex flex-col gap-1.5 font-hanken text-[11px] font-bold text-[#45464d] uppercase tracking-wider">
                  Fecha final
                  <input
                    type="date"
                    min={addDaysToDateInput(startDate, 1)}
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="rounded-lg bg-[#eff4ff] px-3 py-2 font-space text-[13px] font-semibold text-[#0b1c30] outline-none focus:bg-[#e5eeff]"
                  />
                </label>
              </div>
            )}

            {isCetes && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#e2e8f0]/40">
                <label className="flex flex-col gap-1.5 font-hanken text-[11px] font-bold text-[#45464d] uppercase tracking-wider">
                  Títulos CETES
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={titleCount || ''}
                    onChange={(e) => setTitleCount(Number(e.target.value) || 0)}
                    placeholder="1609"
                    className="rounded-lg bg-[#eff4ff] px-3 py-2 font-space text-[13px] font-semibold text-[#0b1c30] outline-none focus:bg-[#e5eeff]"
                  />
                </label>
                <label className="flex flex-col gap-1.5 font-hanken text-[11px] font-bold text-[#45464d] uppercase tracking-wider">
                  Valor nominal por título
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={nominalValue}
                    onChange={(e) => setNominalValue(Number(e.target.value) || 0)}
                    className="rounded-lg bg-[#eff4ff] px-3 py-2 font-space text-[13px] font-semibold text-[#0b1c30] outline-none focus:bg-[#e5eeff]"
                  />
                </label>
              </div>
            )}

            {/* Toggles de Reinversión e ISR */}
            <div className="flex flex-col gap-3.5 pt-2 border-t border-[#e2e8f0]/40">
              {/* Interés Compuesto Switch */}
              <div className="flex items-center justify-between">
                <div className="flex flex-col pr-3">
                  <span className="font-hanken text-[14px] text-[#0b1c30] font-semibold">
                    Interés Compuesto Automático
                  </span>
                  <span className="font-hanken text-[12px] text-[#45464d]">
                    Reinvertir capital + rendimientos generados cada día
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={isCompound}
                    onChange={(e) => setIsCompound(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#006c49]"></div>
                </label>
              </div>

              {/* ISR Switch Oficial SAT */}
              <div className="flex items-center justify-between">
                <div className="flex flex-col pr-3">
                  <div className="flex items-center gap-1.5">
                    <span className="font-hanken text-[14px] text-[#0b1c30] font-semibold">
                      Descontar Retención ISR
                    </span>
                    <span className="bg-[#dce9ff] px-2 py-0.5 rounded-full font-hanken text-[10px] text-[#0b1c30] font-bold">
                      {selectedInst?.name ?? 'ISR'}: {((selectedInst?.isrRate ?? settings.satIsrRate) * 100).toFixed(2)}%
                    </span>
                  </div>
                  <span className="font-hanken text-[12px] text-[#45464d]">
                    Cálculo neto después de retención obligatoria sobre capital
                  </span>
                </div>
                <div className="shrink-0">
                  <select
                    value={isrMode}
                    onChange={(e) => setIsrMode(e.target.value as IsrMode)}
                    aria-label="Tratamiento del ISR para esta cuenta"
                    className="max-w-40 rounded-lg border border-[#dce9ff] bg-[#eff4ff] px-2 py-2 font-hanken text-[11px] font-semibold text-[#0b1c30] outline-none focus:border-[#006c49]"
                  >
                    <option value="none">Sin retención</option>
                    <option value="deduct">Descontar ISR</option>
                    <option value="separate">Mostrar ISR aparte</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
          </div>

          {/* Columna Derecha: Proyección en Tiempo Real & Guardado (5 cols en desktop, sticky) */}
          <div className="lg:col-span-5 flex flex-col gap-4 lg:sticky lg:top-20">
            {/* LIVE CALCULATION RESULT CARD (Matches exact screenshot styling) */}
            <div className="bg-gradient-to-br from-[#131b2e] to-[#0b1c30] text-white rounded-2xl p-5 shadow-xl relative overflow-hidden border border-white/10">
            {/* Subtle Glow Effect */}
            <div className="absolute -right-8 -top-8 w-40 h-40 bg-[#6cf8bb]/15 rounded-full blur-3xl pointer-events-none"></div>

            <div className="flex items-center justify-between mb-2 relative z-10">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#6ffbbe] text-[20px]">
                  bolt
                </span>
                <span className="font-hanken text-[11px] text-[#6ffbbe] uppercase tracking-wider font-bold">
                  Proyección en Tiempo Real
                </span>
              </div>
              <span className="font-hanken text-[12px] bg-white/15 px-2.5 py-0.5 rounded-full text-white backdrop-blur-sm font-medium">
                {selectedInst?.name ?? 'Sin institución'}
              </span>
            </div>

            {/* Rendimiento diario o importe al vencimiento */}
            <div className="flex flex-col relative z-10 mt-1">
              <span className="font-hanken text-[12px] text-[#7c839b]">
                {frecuencia === 'vencimiento' ? 'Interés neto al vencimiento' : 'Ganancia neta estimada por día'}
              </span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="font-space text-[36px] font-bold text-[#6ffbbe] tracking-tight">
                  {formatMXN(frecuencia === 'vencimiento' ? (isCetes ? cetesInterest : termInterest) : liveResult.netDaily, { showSign: true })}
                </span>
                <span className="font-space text-[16px] text-white font-semibold">
                  {frecuencia === 'vencimiento' ? 'MXN' : 'MXN / día'}
                </span>
              </div>
            </div>

            {/* Grid de Proyecciones a Plazos */}
            <div className="grid grid-cols-2 gap-4 pt-3.5 mt-3.5 border-t border-white/10 relative z-10">
              <div className="flex flex-col">
                <span className="font-hanken text-[12px] text-[#7c839b]">
                  {frecuencia === 'vencimiento' ? 'Plazo contratado' : `En ${settings.projectionMonthDays} días`}
                </span>
                <span className="font-space text-[22px] font-bold text-white">
                  {frecuencia === 'vencimiento' ? `${termDays} días` : formatMXN(liveResult.netMonthly, { showSign: true })}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="font-hanken text-[12px] text-[#7c839b]">
                  {frecuencia === 'vencimiento' ? 'Monto a recibir' : `En ${settings.projectionYearDays} días`}
                </span>
                <span className="font-space text-[22px] font-bold text-[#6ffbbe]">
                  {frecuencia === 'vencimiento' ? formatMXN(isCetes ? cetesMaturityAmount : termAmount) : formatMXN(liveResult.netYearly, { showSign: true })}
                </span>
              </div>
            </div>

            {/* Resumen de Fórmulas y Retenciones */}
            <div className="mt-3.5 pt-2 border-t border-white/5 flex items-center justify-between text-[11px] font-hanken text-[#7c839b] relative z-10">
              <span>{liveResult.formulaStr}</span>
              <span>{liveResult.isrStr}</span>
            </div>
          </div>

          {/* Action Button */}
          <div className="flex flex-col gap-2 pt-1">
            <button
              type="button"
              onClick={handleGuardarCuenta}
              className="w-full h-14 bg-[#0b1c30] text-white font-space text-[16px] font-semibold rounded-xl shadow-lg active:scale-98 hover:bg-[#131b2e] transition-all flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-[20px]">save</span>
              <span>Guardar Cuenta y Activar Historial</span>
            </button>
            <p className="font-hanken text-[11px] text-center text-[#45464d] flex items-center justify-center gap-1">
              <span className="material-symbols-outlined text-[14px] text-[#006c49]">
                verified_user
              </span>
              Tus datos se procesan localmente sin exponer credenciales bancarias.
            </p>
            </div>
          </div>
        </div>
        )
      )}

      {/* SUB-TAB 2: MIS CUENTAS ACTIVAS */}
      {subTab === 'cuentas' && (
        <div className="flex flex-col gap-4">
          {/* Resumen Consolidado */}
          <div className="bg-[#e5eeff] p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs border border-[#dce9ff]">
            <div className="flex flex-col">
              <span className="font-hanken text-[11px] font-bold text-[#45464d] uppercase tracking-wider">
                Patrimonio Total en Cuentas
              </span>
              <span className="font-space text-[26px] font-bold text-[#0b1c30]">
                {formatMXN(totalBalance)}
              </span>
            </div>
            <div className="flex flex-col sm:text-right">
              <span className="font-hanken text-[11px] font-bold text-[#45464d] uppercase tracking-wider">
                Rendimiento Diario Consolidado
              </span>
              <span className="font-space text-[26px] font-bold text-[#006c49]">
                {formatMXN(totalDailyYield, { showSign: true })} MXN
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="font-hanken text-[12px] font-bold text-[#45464d] uppercase tracking-wider">
              Cuentas Monitoreadas ({accounts.length})
            </span>
            <button
              type="button"
              onClick={() => setSubTab('registrar')}
              className="font-hanken text-[13px] text-[#006c49] font-semibold flex items-center gap-1 hover:underline"
            >
              <span className="material-symbols-outlined text-[18px]">add_circle</span>
              Nueva cuenta
            </button>
          </div>

          {/* Grid de cuentas en desktop */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* List of active accounts */}
            {accounts.map((acc) => {
            const isMifelAccount = acc.institutionName.toLowerCase().includes('mifel');
              const latestRecord = isMifelAccount
                ? history
                  .filter((record) => record.accountId === acc.id)
                  .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0]
                : undefined;
              const termProgress = acc.paymentFrequency === 'vencimiento'
                ? calculateTermProgress({
                  balance: acc.balance,
                  nominalRate: acc.nominalRate,
                  base: acc.baseDivisor,
                  startDate: acc.startDate,
                  endDate: acc.endDate,
                  calculationMethod: acc.calculationMethod,
                  titleCount: acc.titleCount,
                  nominalValue: acc.nominalValue,
                  isCompound: acc.isCompound,
                  deductISR: acc.isrMode ? acc.isrMode === 'deduct' : acc.deductISR,
                  isDualTier: acc.isDualTier,
                  dualThreshold: acc.dualThreshold,
                  dualRate2: acc.dualRate2,
                  isrRate: acc.isrRate ?? settings.satIsrRate,
                  isrMode: acc.isrMode,
                  isSofipoExempt: settings.applySofipoExemption && acc.isrExempt === true,
                  sofipoExemptionLimit: settings.umaValueAnnual,
                  roundingMode: acc.roundingMode,
                })
                : undefined;
              const maturityDate = acc.endDate
                ? new Date(`${acc.endDate}T00:00:00`).toLocaleDateString('es-MX', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })
                : undefined;
            const res = calculateYield({
              monto: acc.balance,
              tasaNominal: acc.nominalRate,
              base: acc.baseDivisor,
              isCompound: acc.isCompound,
              deductISR: acc.isrMode ? acc.isrMode === 'deduct' : acc.deductISR,
              isDualTier: acc.isDualTier,
              dualThreshold: acc.dualThreshold,
              dualRate2: acc.dualRate2,
              isrRate: acc.isrRate ?? settings.satIsrRate,
              isrMode: acc.isrMode,
              isSofipoExempt: settings.applySofipoExemption && acc.isrExempt === true,
              sofipoExemptionLimit: settings.umaValueAnnual,
              roundingMode: acc.roundingMode,
              projectionMonthDays: settings.projectionMonthDays,
              projectionYearDays: settings.projectionYearDays,
            });

            return (
              <div
                key={acc.id}
                className="bg-white rounded-xl p-4 shadow-sm border border-[#e2e8f0]/60 flex flex-col gap-2.5 transition-all hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-10 h-10 rounded-full ${acc.badgeBg} ${acc.badgeText} flex items-center justify-center font-space text-[14px] font-bold shrink-0`}
                    >
                      {acc.shortCode}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-hanken font-semibold text-[15px] text-[#0b1c30] truncate">
                        {acc.accountNickname}
                      </span>
                      <span className="font-hanken text-[12px] text-[#45464d]">
                        {acc.paymentFrequency === 'diario'
                          ? 'A la vista'
                          : acc.paymentFrequency === 'vencimiento'
                          ? `Plazo fijo${acc.daysRemaining ? ` (${acc.daysRemaining}d)` : ''}`
                          : 'Semanal'}{' '}
                        • Base {acc.baseDivisor}
                      </span>
                    </div>
                  </div>

                  <span className="neon-rate-badge font-hanken text-[12px] font-bold px-2.5 py-1 rounded-full shrink-0">
                    {acc.isDualTier
                      ? `${acc.nominalRate}% + ${acc.dualRate2}%`
                      : `${acc.nominalRate}% APY`}
                  </span>
                </div>

                <div className="flex items-baseline justify-between pt-2 border-t border-[#eff4ff]">
                  <div className="flex flex-col">
                    <span className="font-hanken text-[11px] text-[#45464d]">
                      Saldo actual
                    </span>
                    <span className="font-space text-[19px] font-bold text-[#0b1c30]">
                      {formatMXN(acc.balance)}
                    </span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="font-hanken text-[11px] text-[#45464d]">
                      {acc.paymentFrequency === 'vencimiento'
                        ? 'Recibirás al finalizar'
                        : isMifelAccount
                        ? 'Intereses'
                        : 'Abono de hoy'}
                    </span>
                    <span className="font-space text-[19px] font-bold text-[#006c49]">
                      {formatMXN(
                        isMifelAccount
                          ? latestRecord?.grossYield ?? res.grossDaily
                          : acc.paymentFrequency === 'vencimiento'
                          ? termProgress?.maturityAmount ?? acc.balance
                          : res.netDaily,
                        { showSign: acc.paymentFrequency !== 'vencimiento' }
                      )}{' '}
                      MXN
                    </span>
                    {acc.paymentFrequency === 'vencimiento' && maturityDate && (
                      <>
                        <span className="font-hanken text-[10px] text-[#006c49] whitespace-nowrap">
                          Ganado a la fecha: {formatMXN(termProgress?.accruedInterest ?? 0)}
                        </span>
                        <span className="font-hanken text-[10px] text-[#45464d] whitespace-nowrap">
                          Al finalizar: {maturityDate}
                        </span>
                      </>
                    )}
                    {isMifelAccount && (
                      <span className="font-hanken text-[10px] text-[#b4534b] whitespace-nowrap">
                        ISR retenido: -${(latestRecord?.isrWithheld ?? res.isrDaily).toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Account Action Buttons */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] font-hanken text-[#45464d]">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => openAccountEditor(acc)}
                      className="px-2.5 py-1 bg-[#eff4ff] hover:bg-[#e5eeff] text-[#0b1c30] rounded-md font-medium flex items-center gap-1 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[14px] text-[#006c49]">edit</span>
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAdjustingAccount(acc);
                        setAdjustType('deposit');
                      }}
                      className="px-2.5 py-1 bg-[#eff4ff] hover:bg-[#e5eeff] text-[#0b1c30] rounded-md font-medium flex items-center gap-1 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[14px] text-[#006c49]">
                        add_circle
                      </span>
                      Abonar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAdjustingAccount(acc);
                        setAdjustType('withdraw');
                      }}
                      className="px-2.5 py-1 bg-[#eff4ff] hover:bg-[#e5eeff] text-[#0b1c30] rounded-md font-medium flex items-center gap-1 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[14px] text-slate-500">
                        remove_circle
                      </span>
                      Retirar
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`¿Eliminar la cuenta "${acc.accountNickname}"?`)) {
                        onDeleteAccount(acc.id);
                        showToast(`Cuenta eliminada`);
                      }
                    }}
                    className="text-red-500 hover:text-red-700 p-1 rounded-md transition-colors"
                    title="Eliminar cuenta"
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      delete
                    </span>
                  </button>
                </div>
              </div>
            );
          })}
          </div>
        </div>
      )}

      {/* SUB-TAB 3: SIMULADOR PRO */}
      {subTab === 'simulador' && (
        <div className="flex flex-col gap-3.5">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-[#e2e8f0]/60 flex flex-col gap-2">
            <span className="font-space font-semibold text-[17px] text-[#0b1c30]">
              Comparador de Rendimientos en México
            </span>
            <p className="font-hanken text-[13px] text-[#45464d]">
              Compara el rendimiento neto en {settings.projectionYearDays} días considerando las reglas de cada institución.
            </p>

            {/* Interactive Amount Slider */}
            <div className="bg-[#eff4ff] p-3 rounded-lg flex flex-col gap-2 mt-1">
              <div className="flex justify-between items-center">
                <span className="font-hanken text-[12px] font-semibold text-[#45464d]">
                  Monto a Simular:
                </span>
                <span className="font-space text-[18px] font-bold text-[#0b1c30]">
                  ${monto.toLocaleString('es-MX')} MXN
                </span>
              </div>
              <input
                type="range"
                min="5000"
                max="250000"
                step="5000"
                value={monto}
                onChange={(e) => setMonto(parseFloat(e.target.value))}
                className="w-full accent-[#006c49] cursor-pointer"
              />
              <div className="flex justify-between text-[11px] font-hanken text-[#76777d]">
                <span>$5,000</span>
                <span>$100,000</span>
                <span>$250,000</span>
              </div>
            </div>

            {/* Ranking List */}
            <div className="flex flex-col gap-2 mt-2">
              {institutions
                .map((institution) => {
                  const calculationMethod = institution.calculationMethod
                    ?? (institution.category === 'cetes' ? 'cetes-titles' : 'annual-nominal');
                  const isCetesMethod = calculationMethod === 'cetes-titles';
                  const isrRate = institution.isrRate ?? settings.satIsrRate;
                  const isSofipoExempt = settings.applySofipoExemption && institution.isrExempt === true;
                  const simNetYield = isCetesMethod
                    ? calculateCetesProjection({
                      principal: monto,
                      nominalRate: institution.rate,
                      base: institution.defaultBase,
                      productTermDays: institution.defaultTermDays ?? settings.projectionYearDays,
                      projectionDays: settings.projectionYearDays,
                      nominalValue: institution.defaultNominalValue ?? 10,
                      isCompound: institution.defaultIsCompound ?? true,
                      isrRate,
                      isrMode: institution.isrMode ?? 'none',
                      isSofipoExempt,
                      sofipoExemptionLimit: settings.umaValueAnnual,
                      roundingMode: institution.roundingMode,
                    }).netYield
                    : calculateYield({
                      monto,
                      tasaNominal: institution.rate,
                      base: institution.defaultBase,
                      isCompound: institution.defaultIsCompound ?? true,
                      deductISR: institution.isrMode === 'deduct',
                      isDualTier: institution.hasDualTier,
                      dualThreshold: institution.dualThreshold,
                      dualRate2: institution.dualRate2,
                      isrRate,
                      isrMode: institution.isrMode,
                      isSofipoExempt,
                      sofipoExemptionLimit: settings.umaValueAnnual,
                      roundingMode: institution.roundingMode,
                      projectionMonthDays: settings.projectionMonthDays,
                      projectionYearDays: settings.projectionYearDays,
                    }).netYearly;

                  return { institution, simNetYield, isCetesMethod };
                })
                .sort((a, b) => b.simNetYield - a.simNetYield)
                .map(({ institution, simNetYield, isCetesMethod }, index) => {
                  const rateLabel = institution.hasDualTier
                    ? `${institution.rate}% + ${institution.dualRate2 ?? 0}%`
                    : `${institution.rate}%`;

                return (
                  <div
                    key={institution.id}
                    className="p-3 rounded-xl bg-[#eff4ff] flex items-center justify-between border border-[#e2e8f0]/40 transition-all hover:bg-[#e5eeff]"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[12px] ${institution.badgeBg} ${institution.badgeText}`}
                      >
                        {index + 1}
                      </span>
                      <div className="flex flex-col">
                        <span className="font-hanken text-[13px] font-semibold text-[#0b1c30]">
                          {institution.name} ({rateLabel})
                        </span>
                        <span className="font-hanken text-[11px] text-[#45464d]">
                          Base {institution.defaultBase} d. • {institution.defaultFreq}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col text-right">
                      <span className="font-space text-[16px] font-bold text-[#006c49]">
                        {formatMXN(simNetYield, { showSign: true })}
                      </span>
                      <span className="font-hanken text-[10px] text-[#76777d]">
                        {isCetesMethod
                          ? `en ${settings.projectionYearDays} días, reinvirtiendo cada ${institution.defaultTermDays ?? settings.projectionYearDays} días`
                          : `en ${settings.projectionYearDays} días netos`}
                      </span>
                    </div>
                  </div>
                );
                })}
              {institutions.length === 0 && (
                <div className="rounded-xl border border-dashed border-[#cbd5e1] p-6 text-center font-hanken text-[13px] text-[#76777d]">
                  Agrega una institución en Perfil para usar el Simulador Pro.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Account Configuration Modal */}
      {editingAccount && editPreview && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-3xl max-h-[calc(100dvh-2rem)] overflow-auto rounded-2xl p-5 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-space font-semibold text-[18px] text-[#0b1c30]">Editar cuenta</h3>
                <p className="font-hanken text-[12px] text-[#76777d]">Los cambios se aplican solo al guardar.</p>
              </div>
              <button type="button" onClick={() => setEditingAccount(null)} className="text-slate-400 hover:text-slate-700">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-3">
                <label className="flex flex-col gap-1 font-hanken text-[11px] font-bold text-[#45464d] uppercase">
                  Nombre de la cuenta
                  <input value={String(editForm.accountNickname ?? '')} onChange={(e) => setEditForm({ ...editForm, accountNickname: e.target.value })} className="rounded-lg border border-[#dfe8ff] bg-[#f9fbff] px-3 py-2 text-sm font-normal normal-case text-[#0b1c30]" />
                </label>
                <label className="flex flex-col gap-1 font-hanken text-[11px] font-bold text-[#45464d] uppercase">
                  Saldo
                  <input type="number" min="0" value={Number(editForm.balance ?? 0)} onChange={(e) => setEditForm({ ...editForm, balance: Number(e.target.value) })} className="rounded-lg border border-[#dfe8ff] bg-[#f9fbff] px-3 py-2 text-sm font-normal normal-case text-[#0b1c30]" />
                </label>
                <label className="flex flex-col gap-1 font-hanken text-[11px] font-bold text-[#45464d] uppercase">
                  Tasa anual %
                  <input type="number" step="0.01" value={Number(editForm.nominalRate ?? 0)} onChange={(e) => setEditForm({ ...editForm, nominalRate: Number(e.target.value) })} className="rounded-lg border border-[#dfe8ff] bg-[#f9fbff] px-3 py-2 text-sm font-normal normal-case text-[#0b1c30]" />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex flex-col gap-1 font-hanken text-[11px] font-bold text-[#45464d] uppercase">
                    Vigencia
                    <select value={editForm.rateType ?? 'fija'} onChange={(e) => setEditForm({ ...editForm, rateType: e.target.value as BankAccount['rateType'] })} className="rounded-lg border border-[#dfe8ff] bg-[#f9fbff] px-2 py-2 text-xs font-normal normal-case text-[#0b1c30]">
                      <option value="fija">Fija</option><option value="promo">Promocional</option><option value="escalonada">Escalonada</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 font-hanken text-[11px] font-bold text-[#45464d] uppercase">
                    Método
                    <select value={editForm.calculationMethod ?? 'annual-nominal'} onChange={(e) => {
                      const method = e.target.value as CalculationMethod;
                      setEditForm({
                        ...editForm,
                        calculationMethod: method,
                        paymentFrequency: method === 'cetes-titles' ? 'vencimiento' : editForm.paymentFrequency,
                      });
                    }} className="rounded-lg border border-[#dfe8ff] bg-[#f9fbff] px-2 py-2 text-xs font-normal normal-case text-[#0b1c30]">
                      <option value="annual-nominal">Tasa sobre saldo</option><option value="cetes-titles">Títulos al vencimiento</option>
                    </select>
                  </label>
                </div>
                {editForm.rateType === 'promo' && (
                  <label className="flex flex-col gap-1 font-hanken text-[11px] font-bold text-[#45464d] uppercase">
                    Fin de promoción
                    <input type="date" value={editForm.rateExpiryDate ?? ''} onChange={(e) => setEditForm({ ...editForm, rateExpiryDate: e.target.value })} className="rounded-lg border border-[#dfe8ff] bg-[#f9fbff] px-3 py-2 text-xs font-normal normal-case text-[#0b1c30]" />
                  </label>
                )}
                <label className="flex flex-col gap-1 font-hanken text-[11px] font-bold text-[#45464d] uppercase">
                  Frecuencia de abono
                  <select value={editForm.paymentFrequency ?? 'diario'} onChange={(e) => setEditForm({ ...editForm, paymentFrequency: e.target.value as PaymentFrequency })} className="rounded-lg border border-[#dfe8ff] bg-[#f9fbff] px-2 py-2 text-xs font-normal normal-case text-[#0b1c30]">
                    <option value="diario">Diario</option><option value="semanal">Semanal</option><option value="vencimiento">Al vencimiento</option>
                  </select>
                </label>
                {editForm.paymentFrequency === 'vencimiento' && (
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex flex-col gap-1 font-hanken text-[11px] font-bold text-[#45464d] uppercase">Inicio<input type="date" value={editForm.startDate ?? ''} onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })} className="rounded-lg border border-[#dfe8ff] bg-[#f9fbff] px-2 py-2 text-xs font-normal normal-case text-[#0b1c30]" /></label>
                    <label className="flex flex-col gap-1 font-hanken text-[11px] font-bold text-[#45464d] uppercase">Vencimiento<input type="date" min={String(editForm.startDate ?? '')} value={editForm.endDate ?? ''} onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })} className="rounded-lg border border-[#dfe8ff] bg-[#f9fbff] px-2 py-2 text-xs font-normal normal-case text-[#0b1c30]" /></label>
                  </div>
                )}
                {editForm.calculationMethod === 'cetes-titles' && (
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex flex-col gap-1 font-hanken text-[11px] font-bold text-[#45464d] uppercase">Títulos<input type="number" min="1" step="1" value={Number(editForm.titleCount ?? 0)} onChange={(e) => setEditForm({ ...editForm, titleCount: Number(e.target.value) })} className="rounded-lg border border-[#dfe8ff] bg-[#f9fbff] px-2 py-2 text-xs font-normal normal-case text-[#0b1c30]" /></label>
                    <label className="flex flex-col gap-1 font-hanken text-[11px] font-bold text-[#45464d] uppercase">Nominal por título<input type="number" min="0.01" step="0.01" value={Number(editForm.nominalValue ?? 0)} onChange={(e) => setEditForm({ ...editForm, nominalValue: Number(e.target.value) })} className="rounded-lg border border-[#dfe8ff] bg-[#f9fbff] px-2 py-2 text-xs font-normal normal-case text-[#0b1c30]" /></label>
                  </div>
                )}
                <label className="flex items-center gap-2 font-hanken text-xs text-[#0b1c30]"><input type="checkbox" checked={Boolean(editForm.isDualTier)} onChange={(e) => setEditForm({ ...editForm, isDualTier: e.target.checked, rateType: e.target.checked ? 'escalonada' : 'fija' })} className="accent-[#006c49]" /> Tasa por tramos</label>
                {editForm.isDualTier && (
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex flex-col gap-1 font-hanken text-[11px] font-bold text-[#45464d] uppercase">Límite tramo 1<input type="number" min="1" value={Number(editForm.dualThreshold ?? 0)} onChange={(e) => setEditForm({ ...editForm, dualThreshold: Number(e.target.value) })} className="rounded-lg border border-[#dfe8ff] bg-[#f9fbff] px-2 py-2 text-xs font-normal normal-case text-[#0b1c30]" /></label>
                    <label className="flex flex-col gap-1 font-hanken text-[11px] font-bold text-[#45464d] uppercase">Tasa excedente %<input type="number" min="0" step="0.01" value={Number(editForm.dualRate2 ?? 0)} onChange={(e) => setEditForm({ ...editForm, dualRate2: Number(e.target.value) })} className="rounded-lg border border-[#dfe8ff] bg-[#f9fbff] px-2 py-2 text-xs font-normal normal-case text-[#0b1c30]" /></label>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex flex-col gap-1 font-hanken text-[11px] font-bold text-[#45464d] uppercase">
                    Base
                    <select value={editForm.baseDivisor} onChange={(e) => setEditForm({ ...editForm, baseDivisor: Number(e.target.value) as DivisorBase })} className="rounded-lg border border-[#dfe8ff] bg-[#f9fbff] px-2 py-2 text-xs font-normal normal-case text-[#0b1c30]"><option value={360}>360 días</option><option value={365}>365 días</option></select>
                  </label>
                  <label className="flex flex-col gap-1 font-hanken text-[11px] font-bold text-[#45464d] uppercase">
                    ISR
                    <select value={editForm.isrMode ?? 'none'} onChange={(e) => setEditForm({ ...editForm, isrMode: e.target.value as IsrMode })} className="rounded-lg border border-[#dfe8ff] bg-[#f9fbff] px-2 py-2 text-xs font-normal normal-case text-[#0b1c30]"><option value="none">No aplicar</option><option value="deduct">Descontar</option><option value="separate">Mostrar aparte</option></select>
                  </label>
                </div>
                <label className="flex flex-col gap-1 font-hanken text-[11px] font-bold text-[#45464d] uppercase">
                  ISR anual %
                  <input type="number" min="0" step="0.01" value={Number(editForm.isrRate ?? settings.satIsrRate) * 100} onChange={(e) => setEditForm({ ...editForm, isrRate: Number(e.target.value) / 100 })} className="rounded-lg border border-[#dfe8ff] bg-[#f9fbff] px-3 py-2 text-xs font-normal normal-case text-[#0b1c30]" />
                </label>
                <label className="flex flex-col gap-1 font-hanken text-[11px] font-bold text-[#45464d] uppercase">
                  Redondeo
                  <select value={editForm.roundingMode ?? 'normal'} onChange={(e) => setEditForm({ ...editForm, roundingMode: e.target.value as BankAccount['roundingMode'] })} className="rounded-lg border border-[#dfe8ff] bg-[#f9fbff] px-2 py-2 text-xs font-normal normal-case text-[#0b1c30]"><option value="normal">Normal</option><option value="truncate-total">Truncar total</option><option value="truncate-tier">Truncar por tramo</option></select>
                </label>
                <label className="flex items-center gap-2 font-hanken text-xs text-[#0b1c30]"><input type="checkbox" checked={Boolean(editForm.isCompound)} onChange={(e) => setEditForm({ ...editForm, isCompound: e.target.checked })} className="accent-[#006c49]" /> Interés compuesto</label>
                <label className="flex items-center gap-2 font-hanken text-xs text-[#0b1c30]"><input type="checkbox" checked={Boolean(editForm.isrExempt)} onChange={(e) => setEditForm({ ...editForm, isrExempt: e.target.checked })} className="accent-[#006c49]" /> Exento hasta límite SOFIPO</label>
              </div>
              <div className="rounded-xl bg-gradient-to-br from-[#131b2e] to-[#0b1c30] p-4 text-white flex flex-col justify-between">
                <div>
                  <div className="font-hanken text-[11px] uppercase tracking-wider font-bold text-[#6ffbbe]">Preview en tiempo real</div>
                  {editForm.calculationMethod === 'cetes-titles' ? (
                    <>
                      <div className="font-hanken text-xs text-[#9aa5bd] mt-4">Ganancia estimada al vencimiento</div>
                      <div className="font-space text-3xl font-bold text-[#6ffbbe]">{formatMXN(editTermPreview?.totalInterest ?? 0, { showSign: true })}</div>
                      <div className="font-hanken text-[11px] text-[#9aa5bd] mt-5">Monto estimado: {formatMXN(editTermPreview?.maturityAmount ?? 0)}</div>
                    </>
                  ) : (
                    <>
                      <div className="font-hanken text-xs text-[#9aa5bd] mt-4">Ganancia estimada por día</div>
                      <div className="font-space text-3xl font-bold text-[#6ffbbe]">{formatMXN(editPreview.netDaily, { showSign: true })}</div>
                      <div className="grid grid-cols-2 gap-3 mt-5 border-t border-white/10 pt-3">
                        <div><div className="font-hanken text-[11px] text-[#9aa5bd]">Bruto</div><div className="font-space text-lg font-bold">{formatMXN(editPreview.grossDaily)}</div></div>
                        <div><div className="font-hanken text-[11px] text-[#9aa5bd]">ISR</div><div className="font-space text-lg font-bold text-[#6ffbbe]">{formatMXN(editPreview.isrDaily)}</div></div>
                      </div>
                      <div className="font-hanken text-[11px] text-[#9aa5bd] mt-5">{settings.projectionMonthDays} días: {formatMXN(editPreview.netMonthly, { showSign: true })} · {settings.projectionYearDays} días: {formatMXN(editPreview.netYearly, { showSign: true })}</div>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button type="button" onClick={() => setEditingAccount(null)} className="rounded-lg px-4 py-2 text-sm font-semibold text-[#45464d] bg-[#eff4ff]">Cancelar</button>
              <button type="button" onClick={handleSaveAccountEdit} className="rounded-lg px-4 py-2 text-sm font-semibold text-white bg-[#006c49]">Guardar cambios</button>
            </div>
          </div>
        </div>
      )}

      {/* Adjust Balance Modal */}
      {adjustingAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-sm rounded-2xl p-5 shadow-2xl flex flex-col gap-4 border border-slate-100">
            <div className="flex items-center justify-between">
              <h3 className="font-space font-semibold text-[17px] text-[#0b1c30]">
                {adjustType === 'deposit' ? 'Abonar Saldo' : 'Retirar Saldo'}
              </h3>
              <button
                type="button"
                onClick={() => setAdjustingAccount(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <p className="font-hanken text-[12px] text-[#45464d]">
              Cuenta: <strong>{adjustingAccount.accountNickname}</strong>
              <br />
              Saldo actual: {formatMXN(adjustingAccount.balance)}
            </p>

            <div className="flex flex-col gap-1">
              <label className="font-hanken text-[11px] font-bold text-[#45464d] uppercase">
                Monto ({adjustType === 'deposit' ? 'a sumar' : 'a restar'})
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3 font-space text-[18px] text-[#45464d]">
                  $
                </span>
                <input
                  type="number"
                  min="1"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  className="w-full bg-[#eff4ff] pl-8 pr-12 py-2 rounded-lg font-space text-[20px] font-bold text-[#0b1c30] outline-none"
                />
                <span className="absolute right-3 font-hanken text-[12px] text-[#45464d] font-semibold">
                  MXN
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAdjustingAccount(null)}
                className="py-2.5 rounded-lg border border-slate-200 text-[#45464d] font-hanken text-[13px] font-medium"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleApplyAdjustment}
                className="py-2.5 rounded-lg bg-[#006c49] text-white font-space text-[14px] font-semibold hover:bg-[#005236]"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
