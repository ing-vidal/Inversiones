import { BankAccount, DivisorBase } from '../types/finance.js';

export const SAT_ISR_DEFAULT = 0.0050; // 0.50% SAT 2026/2025
export const SOFIPO_EXEMPTION_LIMIT = 206367.60; // 5 UMAs anuales 2026 (~$206k)
export const INFLATION_ESTIMATE = 0.045; // 4.5%
export const SOFIPO_INSTITUTION_IDS = new Set(['didi', 'klar', 'plata']);

export function isNuInstitution(id: string, name = '', shortName = ''): boolean {
  const values = [id, name, shortName].map((value) => value.trim().toLowerCase());
  return values.includes('nu') || values.some((value) => value.includes('cajita turbo'));
}

export function isOpenBankInstitution(id: string, name = '', shortName = ''): boolean {
  const values = [id, name, shortName].map((value) => value.trim().toLowerCase().replace(/\s/g, ''));
  return values.some((value) => value.includes('openbank'));
}

export function isDidiInstitution(id: string, name = '', shortName = ''): boolean {
  const values = [id, name, shortName].map((value) => value.trim().toLowerCase().replace(/\s/g, ''));
  return values.some((value) => value.includes('didi'));
}

export function isMifelInstitution(id: string, name = '', shortName = ''): boolean {
  const values = [id, name, shortName].map((value) => value.trim().toLowerCase().replace(/\s/g, ''));
  return values.some((value) => value.includes('mifel'));
}

export function isMercadoPagoInstitution(id: string, name = '', shortName = ''): boolean {
  const values = [id, name, shortName].map((value) => value.trim().toLowerCase().replace(/\s/g, ''));
  return values.some((value) => value.includes('mercadopago') || value === 'mp');
}

export function isKuboInstitution(id: string, name = '', shortName = ''): boolean {
  const values = [id, name, shortName].map((value) => value.trim().toLowerCase().replace(/\s/g, ''));
  return values.some((value) => value.includes('kubo'));
}

export function isCetesInstitution(id: string, name = '', shortName = ''): boolean {
  const values = [id, name, shortName].map((value) => value.trim().toLowerCase().replace(/\s/g, ''));
  return values.some((value) => value.includes('cetes'));
}

export function getInstitutionSatRate(
  id: string,
  name: string,
  shortName: string,
  defaultRate: number,
): number {
  if (isMifelInstitution(id, name, shortName)) return 0.009;
  if (isKuboInstitution(id, name, shortName)) return 0.009;
  if (isMercadoPagoInstitution(id, name, shortName)) return 0.0095;
  return defaultRate;
}

export function isSofipoInstitution(institutionId: string): boolean {
  return SOFIPO_INSTITUTION_IDS.has(institutionId);
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
  isSofipoExempt?: boolean;
  sofipoExemptionLimit?: number;
  roundDailyDown?: boolean;
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
    isSofipoExempt = false,
    sofipoExemptionLimit = SOFIPO_EXEMPTION_LIMIT,
    roundDailyDown = false,
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

  // 1. Gross Daily Yield
  let grossDaily = 0;
  if (isDualTier && monto > dualThreshold) {
    const tramo1 = dualThreshold;
    const tramo2 = monto - dualThreshold;
    const tramo1Daily = (tramo1 * rate1) / base;
    const tramo2Daily = (tramo2 * rate2) / base;
    grossDaily = roundDailyDown
      ? truncateCents(tramo1Daily) + truncateCents(tramo2Daily)
      : tramo1Daily + tramo2Daily;
  } else {
    grossDaily = (monto * rate1) / base;
  }

  // 2. ISR Withholding (calculated over capital base, official SAT rate)
  let isrDaily = 0;
  if (deductISR && (!isSofipoExempt || monto > SOFIPO_EXEMPTION_LIMIT)) {
    // If sofipo exempt and exceeds limit, only excess is subject to ISR
    const taxableCapital = isSofipoExempt ? Math.max(0, monto - sofipoExemptionLimit) : monto;
    isrDaily = (taxableCapital * satRate) / base;
  }

  // 3. Net Daily Yield
  const normalizeDailyYield = (value: number) =>
    roundDailyDown ? Math.floor(Math.max(0, value) * 100) / 100 : Math.max(0, value);
  const netDaily = normalizeDailyYield(grossDaily - isrDaily);

  const calculateNetForBalance = (balance: number): number => {
    const tierOneBalance = isDualTier ? Math.min(balance, dualThreshold) : balance;
    const tierTwoBalance = isDualTier ? Math.max(0, balance - dualThreshold) : 0;
    const tierOneDaily = (tierOneBalance * rate1) / base;
    const tierTwoDaily = (tierTwoBalance * rate2) / base;
    const dailyGross = roundDailyDown
      ? truncateCents(tierOneDaily) + truncateCents(tierTwoDaily)
      : tierOneDaily + tierTwoDaily;
    const taxableCapital = isSofipoExempt ? Math.max(0, balance - sofipoExemptionLimit) : balance;
    const dailyIsr = deductISR ? (taxableCapital * satRate) / base : 0;
    return roundDailyDown
      ? Math.floor(Math.max(0, dailyGross - dailyIsr) * 100) / 100
      : Math.round(Math.max(0, dailyGross - dailyIsr) * 100) / 100;
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

  const isrStr = deductISR
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
    deductISR: acc.deductISR,
    isDualTier: acc.isDualTier,
    dualThreshold: acc.dualThreshold,
    dualRate2: acc.dualRate2,
    satRate,
  });
}
