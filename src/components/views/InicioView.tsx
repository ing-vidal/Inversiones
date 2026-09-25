import React, { useState } from 'react';
import { BankAccount } from '../../types/finance';
import { calculateYield, formatMXN } from '../../utils/calculator';
import { UserSettings } from '../../types/finance';

interface InicioViewProps {
  accounts: BankAccount[];
  settings: UserSettings;
  onNavigateToRegister: () => void;
  onNavigateToHistory: () => void;
}

export const InicioView: React.FC<InicioViewProps> = ({
  accounts,
  settings,
  onNavigateToRegister,
  onNavigateToHistory,
}) => {
  const [selectedHorizon, setSelectedHorizon] = useState<'dia' | 'mes' | 'ano'>('dia');

  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);

  // Calculate yield for all accounts
  const accountCalculations = accounts.map((a) => {
    return {
      account: a,
      result: calculateYield({
        monto: a.balance,
        tasaNominal: a.nominalRate,
        base: a.baseDivisor,
        isCompound: a.isCompound,
        deductISR: a.isrMode ? a.isrMode === 'deduct' : a.deductISR,
        isDualTier: a.isDualTier,
        dualThreshold: a.dualThreshold,
        dualRate2: a.dualRate2,
        isrRate: a.isrRate ?? settings.satIsrRate,
        isrMode: a.isrMode,
        isSofipoExempt: settings.applySofipoExemption && a.isrExempt === true,
        sofipoExemptionLimit: settings.umaValueAnnual,
        roundingMode: a.roundingMode,
      }),
    };
  });

  const totalDailyNet = accountCalculations.reduce((sum, item) => sum + item.result.netDaily, 0);
  const totalMonthlyNet = accountCalculations.reduce((sum, item) => sum + item.result.netMonthly, 0);
  const totalYearlyNet = accountCalculations.reduce((sum, item) => sum + item.result.netYearly, 0);

  // Sofipo exemption calculation
  const sofipoBalance = accounts
    .filter((a) => a.isrExempt === true)
    .reduce((sum, a) => sum + a.balance, 0);
  const sofipoPercent = settings.umaValueAnnual > 0
    ? Math.min(100, (sofipoBalance / settings.umaValueAnnual) * 100)
    : 0;

  const currentDisplayYield =
    selectedHorizon === 'dia'
      ? totalDailyNet
      : selectedHorizon === 'mes'
      ? totalMonthlyNet
      : totalYearlyNet;

  const currentDisplayLabel =
    selectedHorizon === 'dia'
      ? 'Abono neto de hoy'
      : selectedHorizon === 'mes'
      ? 'Proyección neta en 30 días'
      : 'Proyección neta en 365 días (Compuesto)';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pb-8">
      {/* Columna Principal / Izquierda (7 cols en desktop) */}
      <div className="lg:col-span-7 flex flex-col gap-4">
        {/* Portfolio Master Hero Card */}
        <div className="bg-gradient-to-br from-[#131b2e] via-[#0b1c30] to-[#040d1a] rounded-2xl p-5 sm:p-6 text-white shadow-xl relative overflow-hidden border border-white/10">
          <div className="absolute -right-12 -top-12 w-56 h-56 bg-[#006c49]/25 rounded-full blur-3xl pointer-events-none"></div>

          <div className="flex items-center justify-between relative z-10 gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="material-symbols-outlined text-[#6ffbbe] text-[18px] shrink-0">
                account_balance_wallet
              </span>
              <span className="font-hanken text-[11px] sm:text-[12px] uppercase tracking-wider text-[#bec6e0] font-bold truncate">
                Patrimonio Total en Rendimiento
              </span>
            </div>
            <span className="font-hanken text-[11px] bg-white/10 px-2.5 py-0.5 rounded-full text-[#6ffbbe] font-medium border border-white/10 shrink-0">
              {accounts.length} Cuentas Activas
            </span>
          </div>

          <div className="mt-3 relative z-10">
            <div className="font-space text-[30px] sm:text-[38px] lg:text-[42px] font-bold tracking-tight text-white leading-tight break-words">
              {formatMXN(totalBalance)}
            </div>
          </div>

          {/* Horizon Toggle */}
          <div className="mt-5 pt-3.5 border-t border-white/10 flex flex-col gap-2 relative z-10">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="font-hanken text-[12px] sm:text-[13px] text-[#bec6e0]">
                {currentDisplayLabel}
              </span>
              <div className="bg-white/10 p-0.5 rounded-lg flex items-center gap-1 shrink-0">
                {(['dia', 'mes', 'ano'] as const).map((h) => (
                  <button
                    key={h}
                    onClick={() => setSelectedHorizon(h)}
                    className={`px-2.5 py-1 rounded-md font-hanken text-[11px] font-medium transition-all ${
                      selectedHorizon === h
                        ? 'bg-[#6ffbbe] text-[#0b1c30] font-semibold shadow-xs'
                        : 'text-white/70 hover:text-white'
                    }`}
                    type="button"
                  >
                    {h === 'dia' ? 'Hoy' : h === 'mes' ? '30 Días' : '1 Año'}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="font-space text-[26px] sm:text-[32px] font-bold text-[#6ffbbe] leading-none">
                {formatMXN(currentDisplayYield, { showSign: true })}
              </span>
              <span className="font-hanken text-[12px] text-[#bec6e0]">
                MXN netos estimados
              </span>
            </div>
          </div>
        </div>

        {/* Quick Action Shortcuts */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={onNavigateToRegister}
            className="bg-white p-3.5 sm:p-4 rounded-xl border border-[#e2e8f0]/80 shadow-xs flex items-center gap-3 active:scale-98 transition-all hover:border-[#006c49]/50 hover:shadow-sm text-left"
            type="button"
          >
            <div className="w-10 h-10 rounded-full bg-[#006c49]/10 text-[#006c49] flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[22px]">add</span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-hanken font-semibold text-[13px] sm:text-[14px] text-[#0b1c30] truncate">
                Nueva Cuenta
              </span>
              <span className="font-hanken text-[11px] text-[#45464d] truncate">
                Fórmula y tasa personalizada
              </span>
            </div>
          </button>

          <button
            onClick={onNavigateToHistory}
            className="bg-white p-3.5 sm:p-4 rounded-xl border border-[#e2e8f0]/80 shadow-xs flex items-center gap-3 active:scale-98 transition-all hover:border-[#006c49]/50 hover:shadow-sm text-left"
            type="button"
          >
            <div className="w-10 h-10 rounded-full bg-blue-50 text-[#009EE3] flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[22px]">receipt_long</span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-hanken font-semibold text-[13px] sm:text-[14px] text-[#0b1c30] truncate">
                Ver Historial
              </span>
              <span className="font-hanken text-[11px] text-[#45464d] truncate">
                Abonos y retenciones
              </span>
            </div>
          </button>
        </div>

        {/* SOFIPO Tax Exemption Shield (Ley de Ahorro y Crédito Popular) */}
        <div className="bg-white p-4 sm:p-5 rounded-xl border border-[#e2e8f0]/80 shadow-xs flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="material-symbols-outlined text-[#006c49] text-[22px] shrink-0">
                verified
              </span>
              <span className="font-hanken font-semibold text-[14px] sm:text-[15px] text-[#0b1c30] truncate">
                Escudo Fiscal SOFIPO
              </span>
            </div>
            <span className="font-hanken text-[11px] bg-[#6cf8bb]/30 text-[#006c49] font-bold px-2.5 py-0.5 rounded-full shrink-0">
              {settings.applySofipoExemption ? 'Exención activa' : 'Exención desactivada'}
            </span>
          </div>

          <p className="font-hanken text-[12px] sm:text-[13px] text-[#45464d] leading-relaxed">
            El capital elegible en SOFIPOs está exento hasta el límite anual configurado de{' '}
            <strong className="text-[#0b1c30]">{formatMXN(settings.umaValueAnnual)} MXN</strong>. La tasa ISR configurada es{' '}
            <strong className="text-[#0b1c30]">{(settings.satIsrRate * 100).toFixed(2)}% anual</strong>.
          </p>

          {/* Progress bar */}
          <div className="flex flex-col gap-1.5 mt-1">
            <div className="flex justify-between items-center font-hanken text-[11px] sm:text-[12px] text-[#45464d]">
              <span className="font-medium text-[#0b1c30]">Ahorro en SOFIPOs: {formatMXN(sofipoBalance)}</span>
              <span className="text-slate-500">Límite: {formatMXN(settings.umaValueAnnual)} MXN</span>
            </div>
            <div className="w-full bg-[#eff4ff] h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-[#006c49] h-full rounded-full transition-all duration-500"
                style={{ width: `${sofipoPercent}%` }}
              ></div>
            </div>
            <span className="font-hanken text-[11px] text-[#006c49] font-semibold self-end">
              {settings.umaValueAnnual > 0
                ? `${sofipoPercent.toFixed(1)}% del límite utilizado`
                : 'Exención sin límite disponible'}
            </span>
          </div>
        </div>
      </div>

      {/* Columna Secundaria / Derecha (5 cols en desktop) */}
      <div className="lg:col-span-5 flex flex-col gap-4">
        {/* Breakdown by Account */}
        <div className="bg-white p-4 sm:p-5 rounded-xl border border-[#e2e8f0]/80 shadow-xs flex flex-col gap-3">
          <div className="flex items-center justify-between pb-1 border-b border-[#eff4ff]">
            <span className="font-space font-semibold text-[15px] sm:text-[16px] text-[#0b1c30]">
              Distribución de Rendimientos
            </span>
            <span className="font-hanken text-[11px] text-[#45464d] font-medium bg-[#f1f5f9] px-2 py-0.5 rounded-md">
              Por día
            </span>
          </div>

          <div className="flex flex-col gap-2.5 divide-y divide-[#eff4ff]">
            {accountCalculations.map(({ account, result }) => (
              <div
                key={account.id}
                className="pt-2.5 first:pt-0 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div
                    className={`w-8 h-8 rounded-full ${account.badgeBg} ${account.badgeText} flex items-center justify-center font-space text-[11px] font-bold shrink-0`}
                  >
                    {account.shortCode}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-hanken text-[13px] font-semibold text-[#0b1c30] truncate">
                      {account.accountNickname}
                    </span>
                    <span className="font-hanken text-[11px] text-[#76777d] truncate">
                      {formatMXN(account.balance)} • {account.nominalRate}% {account.isDualTier ? 'dual' : ''}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-end shrink-0 pl-2">
                  <span className="font-space text-[14px] sm:text-[15px] font-bold text-[#006c49] whitespace-nowrap">
                    {formatMXN(result.netDaily, { showSign: true })}
                  </span>
                  <span className="font-hanken text-[10px] text-[#76777d] whitespace-nowrap">
                    / día neto
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Daily schedule ticker */}
        <div className="bg-[#eff4ff] p-4 rounded-xl border border-[#dce9ff] flex flex-col gap-2">
          <div className="flex items-center gap-1.5 text-[#0b1c30] font-hanken font-semibold text-[13px]">
            <span className="material-symbols-outlined text-[18px] text-[#006c49]">
              schedule
            </span>
            <span>Próximos Cortes de Rendimiento</span>
          </div>
          <p className="font-hanken text-[12px] text-[#45464d] leading-relaxed">
            Nu abona diariamente a las <strong>00:01 AM</strong>, Didi a las{' '}
            <strong>06:00 AM</strong> y Mercado Pago a las <strong>07:30 AM</strong> hora CDMX.
          </p>
        </div>
      </div>
    </div>
  );
};
