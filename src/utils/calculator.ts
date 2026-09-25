import { BankAccount, DivisorBase, IsrMode, RoundingMode } from '../types/finance.js';

export const SAT_ISR_DEFAULT = 0.0050; // 0.50% SAT 2026/2025
export const SOFIPO_EXEMPTION_LIMIT = 206367.60; // 5 UMAs anuales 2026 (~$206k)
export const INFLATION_ESTIMATE = 0.045; // 4.5%
export function isCetesInstitution(id: string, name = '', shortName = ''): boolean {
  const values = [id, name, shortName].map((value) => value.trim().toLowerCase().replace(/\s/g, ''));
  return values.some((value) => value.includes('cetes'));
}

export function calculateTermProgress(params: {
  balance: number;
  nominalRate: number;
  base: DivisorBase;
  startDate?: string;
  endDate?: string;
  now?: number;
}) {
  const { balance, nominalRate, base, startDate, endDate, now = Date.now() } = params;
  if (!startDate || !endDate) {
    return { accruedInterest: 0, totalInterest: 0, maturityAmount: balance, elapsedDays: 0, totalDays: 0 };
  }

  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const today = new Date(now);
  const day = 24 * 60 * 60 * 1000;
  const totalDays = Math.max(0, Math.round((end.getTime() - start.getTime()) / day));
  const elapsedDays = Math.min(totalDays, Math.max(0, Math.floor((today.getTime() - start.getTime()) / day)));
  const dailyInterest = (balance * (nominalRate / 100)) / base;
  const totalInterest = dailyInterest * totalDays;

  return {
    accruedInterest: dailyInterest * elapsedDays,
    totalInterest,
    maturityAmount: balance + totalInterest,
    elapsedDays,
    totalDays,
  };
}

export interface CalculationResult {
  monto: number;
  grossDaily: number;
  isrDaily: number;
  netDaily: number;
  netMonthly: number; // 30 days
  netYearly: number; // 365 days
  effectiveApy: number;
  formulaStr: string;
  isrStr: string;
}

export function calculateYield(params: {
  monto: number;
  tasaNominal: number; // e.g. 14.25
  base: DivisorBase;
  isCompound: boolean;
  deductISR: boolean;
  isDualTier?: boolean;
  dualThreshold?: number; // e.g. 10000
  dualRate2?: number; // e.g. 7.0
  satRate?: number;
  isrRate?: number;
  isrMode?: IsrMode;
  isSofipoExempt?: boolean;
  sofipoExemptionLimit?: number;
  roundingMode?: RoundingMode;
}): CalculationResult {
  const {
    monto,
    tasaNominal,
    base,
    isCompound,
    deductISR,
    isDualTier = false,
    dualThreshold = 10000,
    dualRate2 = 7.0,
    satRate = SAT_ISR_DEFAULT,
    isrRate = satRate,
    isrMode = deductISR ? 'deduct' : 'none',
    isSofipoExempt = false,
    sofipoExemptionLimit = SOFIPO_EXEMPTION_LIMIT,
    roundingMode = 'normal',
  } = params;

  if (monto <= 0) {
    return {
      monto: 0,
      grossDaily: 0,
      isrDaily: 0,
      netDaily: 0,
      netMonthly: 0,
      netYearly: 0,
      effectiveApy: 0,
      formulaStr: `Fórmula: ($0 × 0% ÷ ${base}d)`,
      isrStr: 'Sin retención ISR',
    };
  }

  const rate1 = tasaNominal / 100;
  const rate2 = (dualRate2 ?? 7.0) / 100;
  const truncateCents = (value: number) => Math.floor(Math.max(0, value) * 100) / 100;
  const normalizeCents = (value: number) => roundingMode === 'truncate-total'
    ? truncateCents(value)
    : Math.max(0, value);

  // 1. Gross Daily Yield
  let grossDaily = 0;
  if (isDualTier && monto > dualThreshold) {
    const tramo1 = dualThreshold;
    const tramo2 = monto - dualThreshold;
    const tramo1Daily = (tramo1 * rate1) / base;
    const tramo2Daily = (tramo2 * rate2) / base;
    grossDaily = roundingMode === 'truncate-tier'
      ? truncateCents(tramo1Daily) + truncateCents(tramo2Daily)
      : tramo1Daily + tramo2Daily;
  } else {
    grossDaily = (monto * rate1) / base;
  }

  // 2. ISR Withholding (calculated over capital base, official SAT rate)
  let isrDaily = 0;
  if (isrMode !== 'none' && (!isSofipoExempt || monto > sofipoExemptionLimit)) {
    // If sofipo exempt and exceeds limit, only excess is subject to ISR
    const taxableCapital = isSofipoExempt ? Math.max(0, monto - sofipoExemptionLimit) : monto;
    isrDaily = (taxableCapital * isrRate) / base;
  }

  // 3. Net Daily Yield
  const netDaily = normalizeCents(grossDaily - (isrMode === 'deduct' ? isrDaily : 0));

  const calculateNetForBalance = (balance: number): number => {
    const tierOneBalance = isDualTier ? Math.min(balance, dualThreshold) : balance;
    const tierTwoBalance = isDualTier ? Math.max(0, balance - dualThreshold) : 0;
    const tierOneDaily = (tierOneBalance * rate1) / base;
    const tierTwoDaily = (tierTwoBalance * rate2) / base;
    const dailyGross = roundingMode === 'truncate-tier'
      ? truncateCents(tierOneDaily) + truncateCents(tierTwoDaily)
      : tierOneDaily + tierTwoDaily;
    const taxableCapital = isSofipoExempt ? Math.max(0, balance - sofipoExemptionLimit) : balance;
    const dailyIsr = isrMode === 'deduct' ? (taxableCapital * isrRate) / base : 0;
    return normalizeCents(dailyGross - dailyIsr);
  };

  // 4. Projections: 30 days & 365 days
  let netMonthly = 0;
  let netYearly = 0;

  if (isCompound) {
    if (isDualTier) {
      let monthlyBalance = monto;
      let yearlyBalance = monto;

      for (let day = 0; day < 365; day += 1) {
        const dailyBalanceYield = calculateNetForBalance(yearlyBalance);
        yearlyBalance += dailyBalanceYield;

        if (day < 30) {
          monthlyBalance += calculateNetForBalance(monthlyBalance);
        }
      }

      netMonthly = monthlyBalance - monto;
      netYearly = yearlyBalance - monto;
    } else {
      const dailyFactor = 1 + (netDaily / monto);
      netMonthly = monto * (Math.pow(dailyFactor, 30) - 1);
      netYearly = monto * (Math.pow(dailyFactor, 365) - 1);
    }
  } else {
    netMonthly = netDaily * 30;
    netYearly = netDaily * 365;
  }

  const effectiveApy = (netYearly / monto) * 100;

  const formulaStr = isDualTier && monto > dualThreshold
    ? `Fórmula: (($${dualThreshold.toLocaleString('es-MX')} × ${tasaNominal}%) + ($${(monto - dualThreshold).toLocaleString('es-MX')} × ${dualRate2}%)) ÷ ${base}d`
    : `Fórmula: ($${monto.toLocaleString('es-MX')} × ${tasaNominal.toFixed(2)}% ÷ ${base}d)`;

  const isrStr = isrMode !== 'none'
    ? `ISR SAT: -$${isrDaily.toFixed(2)}/día`
    : 'Exento / Sin retención';

  return {
    monto,
    grossDaily,
    isrDaily,
    netDaily,
    netMonthly,
    netYearly,
    effectiveApy,
    formulaStr,
    isrStr,
  };
}

export function formatMXN(val: number, options?: { showSign?: boolean; showCents?: boolean }): string {
  const { showSign = false, showCents = true } = options || {};
  const sign = showSign && val > 0 ? '+' : '';
  return `${sign}$${val.toLocaleString('es-MX', {
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0,
  })}`;
}

export function calculateAccountYield(acc: BankAccount, satRate: number = SAT_ISR_DEFAULT): CalculationResult {
  return calculateYield({
    monto: acc.balance,
    tasaNominal: acc.nominalRate,
    base: acc.baseDivisor,
    isCompound: acc.isCompound,
    deductISR: acc.isrMode ? acc.isrMode === 'deduct' : acc.deductISR,
    isDualTier: acc.isDualTier,
    dualThreshold: acc.dualThreshold,
    dualRate2: acc.dualRate2,
    isrRate: acc.isrRate ?? satRate,
    isrMode: acc.isrMode,
    isSofipoExempt: acc.isrExempt === true,
    roundingMode: acc.roundingMode,
  });
}
