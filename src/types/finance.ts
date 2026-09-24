export type DivisorBase = 360 | 365;
export type PaymentFrequency = 'diario' | 'semanal' | 'vencimiento';

export interface BankInstitution {
  id: string;
  name: string;
  shortName: string;
  rate: number; // e.g. 14.25
  defaultBase: DivisorBase;
  defaultFreq: PaymentFrequency;
  hasDualTier: boolean;
  dualThreshold?: number; // e.g. 10000
  dualRate2?: number; // e.g. 7.0
  color: string;
  badgeBg: string;
  badgeText: string;
  category: 'sofipo' | 'banco' | 'fondo' | 'cetes';
  gatNominal: number;
  gatReal: number;
}

export interface BankAccount {
  id: string;
  institutionId: string;
  institutionName: string;
  accountNickname: string;
  balance: number;
  nominalRate: number;
  rateType: 'fija' | 'promo' | 'escalonada';
  rateExpiryDate?: string;
  baseDivisor: DivisorBase;
  paymentFrequency: PaymentFrequency;
  isCompound: boolean;
  deductISR: boolean;
  isDualTier: boolean;
  dualThreshold?: number;
  dualRate2?: number;
  color: string;
  badgeBg: string;
  badgeText: string;
  shortCode: string;
  createdAt: string;
  daysRemaining?: number; // for term deposits like Klar
}

export interface DailyYieldRecord {
  id: string;
  accountId: string;
  bankName: string;
  shortCode: string;
  badgeBg: string;
  badgeText: string;
  date: string;
  time: string;
  grossYield: number;
  isrWithheld: number;
  netYield: number;
  balanceAtTime: number;
  createdAt?: number;
}

export interface UserSettings {
  satIsrRate: number; // e.g. 0.0050 (0.50%)
  applySofipoExemption: boolean; // 5 UMAs anuales
  umaValueAnnual: number; // 5 UMAs = ~206,000 MXN
  expectedInflation: number; // 4.5%
}
