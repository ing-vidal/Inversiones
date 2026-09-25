import { BankAccount, CalculationMethod, DivisorBase, IsrMode, RoundingMode } from '../types/finance.js';

export const SAT_ISR_DEFAULT = 0.0050; // 0.50% SAT 2026/2025
export const SOFIPO_EXEMPTION_LIMIT = 206367.60; // 5 UMAs anuales 2026 (~$206k)
export const INFLATION_ESTIMATE = 0.045; // 4.5%
export const DEFAULT_PROJECTION_MONTH_DAYS = 30;
export const DEFAULT_PROJECTION_YEAR_DAYS = 365;

export function calculateTermProgress(params: {
  balance: number;
  nominalRate: number;
  base: DivisorBase;
  startDate?: string;
  endDate?: string;
  calculationMethod?: CalculationMethod;
  titleCount?: number;
  nominalValue?: number;
  isCompound?: boolean;
  deductISR?: boolean;
  isDualTier?: boolean;
  dualThreshold?: number;
  dualRate2?: number;
  isrRate?: number;
  isrMode?: IsrMode;
  isSofipoExempt?: boolean;
  sofipoExemptionLimit?: number;
  roundingMode?: RoundingMode;
  now?: number;
}) {
  const {
    balance,
    nominalRate,
    base,
    startDate,
    endDate,
    calculationMethod = 'annual-nominal',
    titleCount = 0,
    nominalValue = 0,
    isCompound = false,
    deductISR = false,
    isDualTier = false,
    dualThreshold,
    dualRate2,
    isrRate,
    isrMode,
    isSofipoExempt = false,
    sofipoExemptionLimit = SOFIPO_EXEMPTION_LIMIT,
    roundingMode,
    now = Date.now(),
  } = params;
  if (!startDate || !endDate) {
    return { accruedInterest: 0, totalInterest: 0, maturityAmount: balance, elapsedDays: 0, totalDays: 0 };
  }

  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const today = new Date(now);
  const day = 24 * 60 * 60 * 1000;
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
    return { accruedInterest: 0, totalInterest: 0, maturityAmount: balance, elapsedDays: 0, totalDays: 0 };
  }
  const totalDays = Math.max(0, Math.round((end.getTime() - start.getTime()) / day));
  const elapsedDays = Math.min(totalDays, Math.max(0, Math.floor((today.getTime() - start.getTime()) / day)));

  if (calculationMethod === 'cetes-titles') {
    if (totalDays === 0) {
      return { accruedInterest: 0, totalInterest: 0, maturityAmount: balance, elapsedDays, totalDays };
    }
    const grossInterest = titleCount * nominalValue - balance;
    const activeIsrMode = isrMode ?? (deductISR ? 'deduct' : 'none');
    const taxableCapital = isSofipoExempt ? Math.max(0, balance - sofipoExemptionLimit) : balance;
    const isrWithheld = activeIsrMode === 'none'
      ? 0
      : taxableCapital * (isrRate ?? SAT_ISR_DEFAULT) * (totalDays / base);
    const rawTotalInterest = grossInterest - (activeIsrMode === 'deduct' ? isrWithheld : 0);
    const totalInterest = roundingMode === 'truncate-total'
      ? Math.trunc(rawTotalInterest * 100) / 100
      : rawTotalInterest;
    const maturityAmount = balance + totalInterest;
    const accruedInterest = totalDays > 0 ? totalInterest * (elapsedDays / totalDays) : 0;
    return { accruedInterest, totalInterest, maturityAmount, elapsedDays, totalDays };
  }

  const getDailyNetYield = (amount: number) => calculateYield({
    monto: amount,
    tasaNominal: nominalRate,
    base,
    isCompound,
    deductISR,
    isDualTier,
    dualThreshold,
    dualRate2,
    isrRate,
    isrMode,
    isSofipoExempt,
    sofipoExemptionLimit,
    roundingMode,
    projectionMonthDays: 0,
    projectionYearDays: 0,
  }).netDaily;

  if (!isCompound) {
    const dailyYield = getDailyNetYield(balance);
    const totalInterest = dailyYield * totalDays;
    return {
      accruedInterest: dailyYield * elapsedDays,
      totalInterest,
      maturityAmount: balance + totalInterest,
      elapsedDays,
      totalDays,
    };
  }

  let projectedBalance = balance;
  let accruedInterest = 0;
  for (let accruedDay = 1; accruedDay <= totalDays; accruedDay += 1) {
    projectedBalance += getDailyNetYield(projectedBalance);
    if (accruedDay === elapsedDays) accruedInterest = projectedBalance - balance;
  }
  const totalInterest = projectedBalance - balance;

  return {
    accruedInterest,
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
  netMonthly: number;
  netYearly: number;
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
  projectionMonthDays?: number;
  projectionYearDays?: number;
}): CalculationResult {
  const {
    monto,
    tasaNominal,
    base,
    isCompound,
    deductISR,
    isDualTier = false,
    dualThreshold = 0,
    dualRate2 = 0,
    satRate = SAT_ISR_DEFAULT,
    isrRate = satRate,
    isrMode = deductISR ? 'deduct' : 'none',
    isSofipoExempt = false,
    sofipoExemptionLimit = SOFIPO_EXEMPTION_LIMIT,
    roundingMode = 'normal',
    projectionMonthDays = DEFAULT_PROJECTION_MONTH_DAYS,
    projectionYearDays = DEFAULT_PROJECTION_YEAR_DAYS,
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
  const rate2 = dualRate2 / 100;
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

  const projectNetYield = (days: number): number => {
    const projectionDays = Math.max(0, Math.floor(days));
    if (!isCompound) return netDaily * projectionDays;

    let projectedBalance = monto;
    for (let day = 0; day < projectionDays; day += 1) {
      projectedBalance += calculateNetForBalance(projectedBalance);
    }
    return projectedBalance - monto;
  };

  const netMonthly = projectNetYield(projectionMonthDays);
  const netYearly = projectNetYield(projectionYearDays);

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

export function calculateCetesProjection(params: {
  principal: number;
  nominalRate: number;
  base: DivisorBase;
  productTermDays: number;
  projectionDays: number;
  nominalValue: number;
  isCompound: boolean;
  isrRate: number;
  isrMode: IsrMode;
  isSofipoExempt: boolean;
  sofipoExemptionLimit: number;
  roundingMode?: RoundingMode;
}) {
  const {
    principal,
    nominalRate,
    base,
    productTermDays,
    projectionDays,
    nominalValue,
    isCompound,
    isrRate,
    isrMode,
    isSofipoExempt,
    sofipoExemptionLimit,
    roundingMode = 'normal',
  } = params;
  if (principal <= 0 || productTermDays <= 0 || projectionDays <= 0 || nominalValue <= 0) {
    return { grossYield: 0, isrWithheld: 0, netYield: 0, maturityAmount: principal, titleCount: 0 };
  }

  const pricePerTitle = nominalValue / (1 + (nominalRate / 100) * (productTermDays / base));
  let balance = principal;
  let totalGrossYield = 0;
  let totalIsrWithheld = 0;
  let remainingDays = Math.floor(projectionDays);
  let lastTitleCount = 0;

  while (remainingDays > 0) {
    const cycleDays = Math.min(productTermDays, remainingDays);
    const cyclePrincipal = isCompound ? balance : principal;
    const titleCount = Math.floor(cyclePrincipal / pricePerTitle);
    const invested = titleCount * pricePerTitle;
    const uninvested = cyclePrincipal - invested;
    const cycleGrossYield = titleCount * (nominalValue - pricePerTitle) * (cycleDays / productTermDays);
    const taxableCapital = isSofipoExempt
      ? Math.max(0, cyclePrincipal - sofipoExemptionLimit)
      : cyclePrincipal;
    const cycleIsr = isrMode === 'none' ? 0 : taxableCapital * isrRate * (cycleDays / base);

    totalGrossYield += cycleGrossYield;
    totalIsrWithheld += cycleIsr;
    lastTitleCount = titleCount;
    if (isCompound) {
      balance = uninvested + titleCount * nominalValue - (isrMode === 'deduct' ? cycleIsr : 0);
    } else {
      balance = principal + totalGrossYield - (isrMode === 'deduct' ? totalIsrWithheld : 0);
    }
    remainingDays -= cycleDays;
  }

  const normalize = (value: number) => roundingMode === 'truncate-total'
    ? Math.floor(Math.max(0, value) * 100) / 100
    : value;
  const grossYield = normalize(totalGrossYield);
  const isrWithheld = normalize(totalIsrWithheld);
  const netYield = normalize(totalGrossYield - (isrMode === 'deduct' ? totalIsrWithheld : 0));
  return { grossYield, isrWithheld, netYield, maturityAmount: principal + netYield, titleCount: lastTitleCount };
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
