CREATE TABLE IF NOT EXISTS institutions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  "shortName" TEXT NOT NULL,
  rate REAL NOT NULL,
  "defaultBase" INTEGER NOT NULL,
  "defaultFreq" TEXT NOT NULL,
  "hasDualTier" INTEGER NOT NULL DEFAULT 0,
  "dualThreshold" REAL,
  "dualRate2" REAL,
  "defaultIsCompound" INTEGER NOT NULL DEFAULT 1,
  "calculationMethod" TEXT NOT NULL DEFAULT 'annual-nominal',
  "defaultNominalValue" REAL NOT NULL DEFAULT 10,
  "defaultTermDays" INTEGER NOT NULL DEFAULT 28,
  "isrRate" REAL NOT NULL DEFAULT 0.005,
  "isrMode" TEXT NOT NULL DEFAULT 'deduct',
  "isrExempt" INTEGER NOT NULL DEFAULT 0,
  "roundingMode" TEXT NOT NULL DEFAULT 'normal',
  color TEXT NOT NULL,
  "badgeBg" TEXT NOT NULL,
  "badgeText" TEXT NOT NULL,
  category TEXT NOT NULL,
  "gatNominal" REAL NOT NULL,
  "gatReal" REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  "ownerId" TEXT,
  "institutionId" TEXT NOT NULL,
  "institutionName" TEXT NOT NULL,
  "accountNickname" TEXT NOT NULL,
  balance REAL NOT NULL,
  "nominalRate" REAL NOT NULL,
  "rateType" TEXT NOT NULL,
  "rateExpiryDate" TEXT,
  "baseDivisor" INTEGER NOT NULL,
  "paymentFrequency" TEXT NOT NULL,
  "calculationMethod" TEXT NOT NULL DEFAULT 'annual-nominal',
  "isCompound" INTEGER NOT NULL DEFAULT 1,
  "deductISR" INTEGER NOT NULL DEFAULT 1,
  "isDualTier" INTEGER NOT NULL DEFAULT 0,
  "dualThreshold" REAL,
  "dualRate2" REAL,
  "isrRate" REAL NOT NULL DEFAULT 0.005,
  "isrMode" TEXT NOT NULL DEFAULT 'deduct',
  "isrExempt" INTEGER NOT NULL DEFAULT 0,
  "roundingMode" TEXT NOT NULL DEFAULT 'normal',
  color TEXT NOT NULL,
  "badgeBg" TEXT NOT NULL,
  "badgeText" TEXT NOT NULL,
  "shortCode" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL,
  "startDate" TEXT,
  "endDate" TEXT,
  "titleCount" INTEGER,
  "nominalValue" REAL,
  "daysRemaining" INTEGER
);

CREATE TABLE IF NOT EXISTS yield_history (
  id TEXT PRIMARY KEY,
  "ownerId" TEXT,
  "accountId" TEXT NOT NULL,
  "bankName" TEXT NOT NULL,
  "shortCode" TEXT NOT NULL,
  "badgeBg" TEXT NOT NULL,
  "badgeText" TEXT NOT NULL,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  "grossYield" REAL NOT NULL,
  "isrWithheld" REAL NOT NULL,
  "netYield" REAL NOT NULL,
  "balanceAtTime" REAL NOT NULL,
  "createdAt" BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_settings (
  id TEXT PRIMARY KEY,
  "satIsrRate" REAL NOT NULL,
  "applySofipoExemption" INTEGER NOT NULL DEFAULT 1,
  "umaValueAnnual" REAL NOT NULL,
  "expectedInflation" REAL NOT NULL,
  "projectionMonthDays" INTEGER NOT NULL DEFAULT 30,
  "projectionYearDays" INTEGER NOT NULL DEFAULT 365
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  avatar TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS accounts_institution_id_idx
  ON accounts ("institutionId");

CREATE INDEX IF NOT EXISTS accounts_owner_id_idx
  ON accounts ("ownerId");

CREATE INDEX IF NOT EXISTS yield_history_account_id_idx
  ON yield_history ("accountId");

CREATE INDEX IF NOT EXISTS yield_history_owner_id_idx
  ON yield_history ("ownerId");
