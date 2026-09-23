/**
 * NeonDB (PostgreSQL) connection and all database queries.
 * Replaces the previous SQLite server/db.ts.
 */
import { neon } from '@neondatabase/serverless';
import type { BankAccount, BankInstitution, DailyYieldRecord, UserSettings } from '../src/types/finance';
import { INITIAL_ACCOUNTS, INITIAL_INSTITUTIONS, INITIAL_YIELD_HISTORY } from '../src/data/mockData';
import { SAT_ISR_DEFAULT, SOFIPO_EXEMPTION_LIMIT, INFLATION_ESTIMATE } from '../src/utils/calculator';

function getSQL() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING;
  if (!url) {
    throw new Error('Database connection is not configured. Set DATABASE_URL in Vercel.');
  }
  return neon(url);
}

// ---------------------------------------------------------------------------
// Schema initialization (idempotent — called on first API request)
// ---------------------------------------------------------------------------
export async function initDB(): Promise<void> {
  const sql = getSQL();
  await sql`
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
      color TEXT NOT NULL,
      "badgeBg" TEXT NOT NULL,
      "badgeText" TEXT NOT NULL,
      category TEXT NOT NULL,
      "gatNominal" REAL NOT NULL,
      "gatReal" REAL NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      "institutionId" TEXT NOT NULL,
      "institutionName" TEXT NOT NULL,
      "accountNickname" TEXT NOT NULL,
      balance REAL NOT NULL,
      "nominalRate" REAL NOT NULL,
      "rateType" TEXT NOT NULL,
      "rateExpiryDate" TEXT,
      "baseDivisor" INTEGER NOT NULL,
      "paymentFrequency" TEXT NOT NULL,
      "isCompound" INTEGER NOT NULL DEFAULT 1,
      "deductISR" INTEGER NOT NULL DEFAULT 1,
      "isDualTier" INTEGER NOT NULL DEFAULT 0,
      "dualThreshold" REAL,
      "dualRate2" REAL,
      color TEXT NOT NULL,
      "badgeBg" TEXT NOT NULL,
      "badgeText" TEXT NOT NULL,
      "shortCode" TEXT NOT NULL,
      "createdAt" TEXT NOT NULL,
      "daysRemaining" INTEGER
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS yield_history (
      id TEXT PRIMARY KEY,
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
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS user_settings (
      id TEXT PRIMARY KEY,
      "satIsrRate" REAL NOT NULL,
      "applySofipoExemption" INTEGER NOT NULL DEFAULT 1,
      "umaValueAnnual" REAL NOT NULL,
      "expectedInflation" REAL NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      avatar TEXT,
      created_at TEXT NOT NULL
    )
  `;

  await seedIfEmpty();
}

export async function initAuthDB(): Promise<void> {
  const sql = getSQL();
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      avatar TEXT,
      created_at TEXT NOT NULL
    )
  `;
}

async function seedIfEmpty(): Promise<void> {
  const sql = getSQL();

  // Institutions
  const instCount = await sql`SELECT COUNT(*) as count FROM institutions`;
  if (Number(instCount[0].count) === 0) {
    for (const inst of INITIAL_INSTITUTIONS) {
      await sql`
        INSERT INTO institutions (id, name, "shortName", rate, "defaultBase", "defaultFreq",
          "hasDualTier", "dualThreshold", "dualRate2", color, "badgeBg", "badgeText",
          category, "gatNominal", "gatReal")
        VALUES (
          ${inst.id}, ${inst.name}, ${inst.shortName}, ${inst.rate},
          ${inst.defaultBase}, ${inst.defaultFreq}, ${inst.hasDualTier ? 1 : 0},
          ${inst.dualThreshold ?? null}, ${inst.dualRate2 ?? null},
          ${inst.color}, ${inst.badgeBg}, ${inst.badgeText},
          ${inst.category}, ${inst.gatNominal}, ${inst.gatReal}
        )
        ON CONFLICT (id) DO NOTHING
      `;
    }
  }

  // Accounts
  const accCount = await sql`SELECT COUNT(*) as count FROM accounts`;
  if (Number(accCount[0].count) === 0) {
    for (const acc of INITIAL_ACCOUNTS) {
      await sql`
        INSERT INTO accounts (
          id, "institutionId", "institutionName", "accountNickname", balance,
          "nominalRate", "rateType", "rateExpiryDate", "baseDivisor", "paymentFrequency",
          "isCompound", "deductISR", "isDualTier", "dualThreshold", "dualRate2",
          color, "badgeBg", "badgeText", "shortCode", "createdAt", "daysRemaining"
        ) VALUES (
          ${acc.id}, ${acc.institutionId}, ${acc.institutionName}, ${acc.accountNickname},
          ${acc.balance}, ${acc.nominalRate}, ${acc.rateType}, ${acc.rateExpiryDate ?? null},
          ${acc.baseDivisor}, ${acc.paymentFrequency},
          ${acc.isCompound ? 1 : 0}, ${acc.deductISR ? 1 : 0}, ${acc.isDualTier ? 1 : 0},
          ${acc.dualThreshold ?? null}, ${acc.dualRate2 ?? null},
          ${acc.color}, ${acc.badgeBg}, ${acc.badgeText},
          ${acc.shortCode}, ${acc.createdAt}, ${acc.daysRemaining ?? null}
        )
        ON CONFLICT (id) DO NOTHING
      `;
    }
  }

  // Yield History
  const histCount = await sql`SELECT COUNT(*) as count FROM yield_history`;
  if (Number(histCount[0].count) === 0) {
    let index = INITIAL_YIELD_HISTORY.length;
    for (const hist of INITIAL_YIELD_HISTORY) {
      const ts = Date.now() - (index-- * 60000);
      await sql`
        INSERT INTO yield_history (
          id, "accountId", "bankName", "shortCode", "badgeBg", "badgeText",
          date, time, "grossYield", "isrWithheld", "netYield", "balanceAtTime", "createdAt"
        ) VALUES (
          ${hist.id}, ${hist.accountId}, ${hist.bankName}, ${hist.shortCode},
          ${hist.badgeBg}, ${hist.badgeText}, ${hist.date}, ${hist.time},
          ${hist.grossYield}, ${hist.isrWithheld}, ${hist.netYield}, ${hist.balanceAtTime}, ${ts}
        )
        ON CONFLICT (id) DO NOTHING
      `;
    }
  }

  // User Settings
  const settingsCount = await sql`SELECT COUNT(*) as count FROM user_settings`;
  if (Number(settingsCount[0].count) === 0) {
    await sql`
      INSERT INTO user_settings (id, "satIsrRate", "applySofipoExemption", "umaValueAnnual", "expectedInflation")
      VALUES ('default', ${SAT_ISR_DEFAULT}, 1, ${SOFIPO_EXEMPTION_LIMIT}, ${INFLATION_ESTIMATE})
      ON CONFLICT (id) DO NOTHING
    `;
  }
}

// ---------------------------------------------------------------------------
// Row mappers
// ---------------------------------------------------------------------------
function mapInstitution(r: any): BankInstitution {
  return {
    id: r.id,
    name: r.name,
    shortName: r.shortName,
    rate: Number(r.rate),
    defaultBase: Number(r.defaultBase) as 360 | 365,
    defaultFreq: r.defaultFreq,
    hasDualTier: Boolean(Number(r.hasDualTier)),
    dualThreshold: r.dualThreshold != null ? Number(r.dualThreshold) : undefined,
    dualRate2: r.dualRate2 != null ? Number(r.dualRate2) : undefined,
    color: r.color,
    badgeBg: r.badgeBg,
    badgeText: r.badgeText,
    category: r.category,
    gatNominal: Number(r.gatNominal),
    gatReal: Number(r.gatReal),
  };
}

function mapAccount(r: any): BankAccount {
  return {
    id: r.id,
    institutionId: r.institutionId,
    institutionName: r.institutionName,
    accountNickname: r.accountNickname,
    balance: Number(r.balance),
    nominalRate: Number(r.nominalRate),
    rateType: r.rateType,
    rateExpiryDate: r.rateExpiryDate ?? undefined,
    baseDivisor: Number(r.baseDivisor) as 360 | 365,
    paymentFrequency: r.paymentFrequency,
    isCompound: Boolean(Number(r.isCompound)),
    deductISR: Boolean(Number(r.deductISR)),
    isDualTier: Boolean(Number(r.isDualTier)),
    dualThreshold: r.dualThreshold != null ? Number(r.dualThreshold) : undefined,
    dualRate2: r.dualRate2 != null ? Number(r.dualRate2) : undefined,
    color: r.color,
    badgeBg: r.badgeBg,
    badgeText: r.badgeText,
    shortCode: r.shortCode,
    createdAt: r.createdAt,
    daysRemaining: r.daysRemaining != null ? Number(r.daysRemaining) : undefined,
  };
}

function mapHistory(r: any): DailyYieldRecord {
  return {
    id: r.id,
    accountId: r.accountId,
    bankName: r.bankName,
    shortCode: r.shortCode,
    badgeBg: r.badgeBg,
    badgeText: r.badgeText,
    date: r.date,
    time: r.time,
    grossYield: Number(r.grossYield),
    isrWithheld: Number(r.isrWithheld),
    netYield: Number(r.netYield),
    balanceAtTime: Number(r.balanceAtTime),
  };
}

// ---------------------------------------------------------------------------
// CRUD: Institutions
// ---------------------------------------------------------------------------
export async function getInstitutions(): Promise<BankInstitution[]> {
  const sql = getSQL();
  const rows = await sql`SELECT * FROM institutions`;
  return rows.map(mapInstitution);
}

// ---------------------------------------------------------------------------
// CRUD: Accounts
// ---------------------------------------------------------------------------
export async function getAccounts(): Promise<BankAccount[]> {
  const sql = getSQL();
  const rows = await sql`SELECT * FROM accounts ORDER BY "createdAt" DESC`;
  return rows.map(mapAccount);
}

export async function createAccount(acc: BankAccount): Promise<BankAccount> {
  const sql = getSQL();
  await sql`
    INSERT INTO accounts (
      id, "institutionId", "institutionName", "accountNickname", balance,
      "nominalRate", "rateType", "rateExpiryDate", "baseDivisor", "paymentFrequency",
      "isCompound", "deductISR", "isDualTier", "dualThreshold", "dualRate2",
      color, "badgeBg", "badgeText", "shortCode", "createdAt", "daysRemaining"
    ) VALUES (
      ${acc.id}, ${acc.institutionId}, ${acc.institutionName}, ${acc.accountNickname},
      ${acc.balance}, ${acc.nominalRate}, ${acc.rateType}, ${acc.rateExpiryDate ?? null},
      ${acc.baseDivisor}, ${acc.paymentFrequency},
      ${acc.isCompound ? 1 : 0}, ${acc.deductISR ? 1 : 0}, ${acc.isDualTier ? 1 : 0},
      ${acc.dualThreshold ?? null}, ${acc.dualRate2 ?? null},
      ${acc.color}, ${acc.badgeBg}, ${acc.badgeText},
      ${acc.shortCode}, ${acc.createdAt}, ${acc.daysRemaining ?? null}
    )
  `;
  return acc;
}

export async function updateAccountBalance(id: string, amountDelta: number): Promise<BankAccount | null> {
  const sql = getSQL();
  const rows = await sql`SELECT * FROM accounts WHERE id = ${id}`;
  if (rows.length === 0) return null;
  const current = mapAccount(rows[0]);
  const newBalance = Math.max(0, current.balance + amountDelta);
  await sql`UPDATE accounts SET balance = ${newBalance} WHERE id = ${id}`;
  return { ...current, balance: newBalance };
}

export async function updateAccount(id: string, acc: Partial<BankAccount>): Promise<BankAccount | null> {
  const sql = getSQL();
  const rows = await sql`SELECT * FROM accounts WHERE id = ${id}`;
  if (rows.length === 0) return null;
  const current = mapAccount(rows[0]);
  const updated = { ...current, ...acc };
  await sql`
    UPDATE accounts SET
      "institutionId" = ${updated.institutionId},
      "institutionName" = ${updated.institutionName},
      "accountNickname" = ${updated.accountNickname},
      balance = ${updated.balance},
      "nominalRate" = ${updated.nominalRate},
      "rateType" = ${updated.rateType},
      "rateExpiryDate" = ${updated.rateExpiryDate ?? null},
      "baseDivisor" = ${updated.baseDivisor},
      "paymentFrequency" = ${updated.paymentFrequency},
      "isCompound" = ${updated.isCompound ? 1 : 0},
      "deductISR" = ${updated.deductISR ? 1 : 0},
      "isDualTier" = ${updated.isDualTier ? 1 : 0},
      "dualThreshold" = ${updated.dualThreshold ?? null},
      "dualRate2" = ${updated.dualRate2 ?? null},
      color = ${updated.color},
      "badgeBg" = ${updated.badgeBg},
      "badgeText" = ${updated.badgeText},
      "shortCode" = ${updated.shortCode},
      "daysRemaining" = ${updated.daysRemaining ?? null}
    WHERE id = ${id}
  `;
  return updated;
}

export async function deleteAccount(id: string): Promise<boolean> {
  const sql = getSQL();
  await sql`DELETE FROM accounts WHERE id = ${id}`;
  return true;
}

// ---------------------------------------------------------------------------
// CRUD: Yield History
// ---------------------------------------------------------------------------
export async function getYieldHistory(): Promise<DailyYieldRecord[]> {
  const sql = getSQL();
  const rows = await sql`SELECT * FROM yield_history ORDER BY "createdAt" DESC LIMIT 100`;
  return rows.map(mapHistory);
}

export async function createYieldRecord(record: DailyYieldRecord): Promise<DailyYieldRecord> {
  const sql = getSQL();
  await sql`
    INSERT INTO yield_history (
      id, "accountId", "bankName", "shortCode", "badgeBg", "badgeText",
      date, time, "grossYield", "isrWithheld", "netYield", "balanceAtTime", "createdAt"
    ) VALUES (
      ${record.id}, ${record.accountId}, ${record.bankName}, ${record.shortCode},
      ${record.badgeBg}, ${record.badgeText}, ${record.date}, ${record.time},
      ${record.grossYield}, ${record.isrWithheld}, ${record.netYield},
      ${record.balanceAtTime}, ${Date.now()}
    )
  `;
  return record;
}

// ---------------------------------------------------------------------------
// CRUD: Settings
// ---------------------------------------------------------------------------
export async function getUserSettings(): Promise<UserSettings> {
  const sql = getSQL();
  const rows = await sql`SELECT * FROM user_settings WHERE id = 'default'`;
  if (rows.length === 0) {
    return {
      satIsrRate: SAT_ISR_DEFAULT,
      applySofipoExemption: true,
      umaValueAnnual: SOFIPO_EXEMPTION_LIMIT,
      expectedInflation: INFLATION_ESTIMATE,
    };
  }
  const r = rows[0];
  return {
    satIsrRate: Number(r.satIsrRate),
    applySofipoExemption: Boolean(Number(r.applySofipoExemption)),
    umaValueAnnual: Number(r.umaValueAnnual),
    expectedInflation: Number(r.expectedInflation),
  };
}

export async function updateUserSettings(settings: Partial<UserSettings>): Promise<UserSettings> {
  const sql = getSQL();
  const current = await getUserSettings();
  const updated = { ...current, ...settings };
  await sql`
    INSERT INTO user_settings (id, "satIsrRate", "applySofipoExemption", "umaValueAnnual", "expectedInflation")
    VALUES ('default', ${updated.satIsrRate}, ${updated.applySofipoExemption ? 1 : 0},
            ${updated.umaValueAnnual}, ${updated.expectedInflation})
    ON CONFLICT (id) DO UPDATE SET
      "satIsrRate" = EXCLUDED."satIsrRate",
      "applySofipoExemption" = EXCLUDED."applySofipoExemption",
      "umaValueAnnual" = EXCLUDED."umaValueAnnual",
      "expectedInflation" = EXCLUDED."expectedInflation"
  `;
  return updated;
}

// ---------------------------------------------------------------------------
// Reset database (keeps users)
// ---------------------------------------------------------------------------
export async function resetDatabase(): Promise<void> {
  const sql = getSQL();
  await sql`DELETE FROM accounts`;
  await sql`DELETE FROM yield_history`;
  await sql`DELETE FROM institutions`;
  await sql`DELETE FROM user_settings`;
  await seedIfEmpty();
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
export interface UserRow {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
  created_at: string;
}

export async function registerUser(
  name: string,
  email: string,
  passwordHash: string
): Promise<{ user: UserRow } | { error: string }> {
  const sql = getSQL();
  const existing = await sql`SELECT id FROM users WHERE email = ${email.toLowerCase()}`;
  if (existing.length > 0) {
    return { error: 'Este correo ya está registrado. Inicia sesión.' };
  }
  const id = `user-${Date.now()}`;
  const now = new Date().toISOString();
  await sql`
    INSERT INTO users (id, name, email, password_hash, avatar, created_at)
    VALUES (${id}, ${name.trim()}, ${email.toLowerCase()}, ${passwordHash}, NULL, ${now})
  `;
  return { user: { id, name: name.trim(), email: email.toLowerCase(), avatar: null, created_at: now } };
}

export async function loginUser(
  email: string,
  passwordHash: string
): Promise<{ user: UserRow } | { error: string }> {
  const sql = getSQL();
  const rows = await sql`SELECT * FROM users WHERE email = ${email.toLowerCase()}`;
  if (rows.length === 0) return { error: 'Correo o contraseña incorrectos.' };
  const row = rows[0];
  if (passwordHash !== row.password_hash) return { error: 'Correo o contraseña incorrectos.' };
  return {
    user: {
      id: row.id,
      name: row.name,
      email: row.email,
      avatar: row.avatar ?? null,
      created_at: row.created_at,
    },
  };
}

export async function updateUserAvatar(userId: string, avatarBase64: string): Promise<UserRow | null> {
  const sql = getSQL();
  const rows = await sql`SELECT * FROM users WHERE id = ${userId}`;
  if (rows.length === 0) return null;
  await sql`UPDATE users SET avatar = ${avatarBase64} WHERE id = ${userId}`;
  const r = rows[0];
  return { id: r.id, name: r.name, email: r.email, avatar: avatarBase64, created_at: r.created_at };
}
