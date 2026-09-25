import { BankAccount, BankInstitution, DailyYieldRecord, UserSettings } from '../types/finance.js';

const BASE_URL = '/api';
let activeUserId: string | null = null;

export function setActiveUserId(userId: string | null): void {
  activeUserId = userId;
}

function userHeaders(): HeadersInit {
  return activeUserId ? { 'X-User-Id': activeUserId } : {};
}

export async function fetchHealth(): Promise<{ status: string; database: string } | null> {
  try {
    const res = await fetch(`${BASE_URL}/health`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchInstitutions(): Promise<BankInstitution[]> {
  const res = await fetch(`${BASE_URL}/institutions`);
  if (!res.ok) throw new Error('Error al cargar instituciones financieras');
  return await res.json();
}

export async function apiCreateInstitution(institution: BankInstitution): Promise<BankInstitution> {
  const res = await fetch(`${BASE_URL}/institutions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(institution),
  });
  if (!res.ok) throw new Error('Error al guardar institución');
  return await res.json();
}

export async function apiUpdateInstitution(
  id: string,
  institution: Partial<BankInstitution>
): Promise<BankInstitution> {
  const res = await fetch(`${BASE_URL}/institutions/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(institution),
  });
  if (!res.ok) throw new Error('Error al actualizar institución');
  return await res.json();
}

export async function apiDeleteInstitution(id: string): Promise<boolean> {
  const res = await fetch(`${BASE_URL}/institutions/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Error al eliminar institución');
  const data = await res.json();
  return Boolean(data.success);
}

export async function fetchAccounts(): Promise<BankAccount[]> {
  const res = await fetch(`${BASE_URL}/accounts`, { headers: userHeaders() });
  if (!res.ok) throw new Error('Error al cargar cuentas bancarias desde la base de datos');
  return await res.json();
}

export async function apiCreateAccount(account: BankAccount): Promise<BankAccount> {
  const res = await fetch(`${BASE_URL}/accounts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...userHeaders() },
    body: JSON.stringify(account),
  });
  if (!res.ok) throw new Error('Error al guardar cuenta en la base de datos');
  return await res.json();
}

export async function apiUpdateAccount(id: string, account: Partial<BankAccount>): Promise<BankAccount> {
  const res = await fetch(`${BASE_URL}/accounts/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...userHeaders() },
    body: JSON.stringify(account),
  });
  if (!res.ok) throw new Error('Error al actualizar cuenta en la base de datos');
  return await res.json();
}

export async function apiUpdateBalance(id: string, amountDelta: number): Promise<BankAccount> {
  const res = await fetch(`${BASE_URL}/accounts/${id}/movement`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...userHeaders() },
    body: JSON.stringify({ amountDelta }),
  });
  if (!res.ok) throw new Error('Error al actualizar saldo en la base de datos');
  return await res.json();
}

export async function apiAccrueAccount(
  id: string,
  records: DailyYieldRecord[],
  totalDelta: number,
): Promise<BankAccount> {
  const res = await fetch(`${BASE_URL}/accounts/${id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...userHeaders() },
    body: JSON.stringify({ action: 'accrue', records, totalDelta }),
  });
  if (!res.ok) throw new Error('Error al calcular rendimientos pendientes');
  return await res.json();
}

export async function apiFreezeTermAccount(id: string): Promise<BankAccount> {
  const res = await fetch(`${BASE_URL}/accounts/${id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...userHeaders() },
    body: JSON.stringify({ action: 'freeze-term' }),
  });
  if (!res.ok) throw new Error('Error al congelar saldo de plazo fijo');
  return await res.json();
}

export async function apiDeleteAccount(id: string): Promise<boolean> {
  const res = await fetch(`${BASE_URL}/accounts/${id}`, {
    method: 'DELETE',
    headers: userHeaders(),
  });
  if (!res.ok) throw new Error('Error al eliminar cuenta de la base de datos');
  const data = await res.json();
  return Boolean(data.success);
}

export async function fetchYieldHistory(): Promise<DailyYieldRecord[]> {
  const res = await fetch(`${BASE_URL}/history`, { headers: userHeaders() });
  if (!res.ok) throw new Error('Error al cargar historial desde la base de datos');
  return await res.json();
}

export async function apiCreateYieldRecord(record: DailyYieldRecord): Promise<DailyYieldRecord> {
  const res = await fetch(`${BASE_URL}/history`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...userHeaders() },
    body: JSON.stringify(record),
  });
  if (!res.ok) throw new Error('Error al registrar rendimiento en la base de datos');
  return await res.json();
}

export async function apiUpdateYieldRecordBalance(
  id: string,
  balanceAtTime: number,
): Promise<DailyYieldRecord> {
  const res = await fetch(`${BASE_URL}/history?id=${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...userHeaders() },
    body: JSON.stringify({ balanceAtTime }),
  });
  if (!res.ok) throw new Error('Error al actualizar saldo del historial');
  return await res.json();
}

export async function apiUpdateYieldRecord(
  id: string,
  changes: Pick<DailyYieldRecord, 'grossYield' | 'isrWithheld' | 'netYield' | 'balanceAtTime'>,
): Promise<DailyYieldRecord> {
  const res = await fetch(`${BASE_URL}/history?id=${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...userHeaders() },
    body: JSON.stringify(changes),
  });
  if (!res.ok) throw new Error('Error al actualizar el registro del historial');
  return await res.json();
}

export async function fetchSettings(): Promise<UserSettings> {
  const res = await fetch(`${BASE_URL}/settings`);
  if (!res.ok) throw new Error('Error al cargar configuración desde la base de datos');
  return await res.json();
}

export async function apiUpdateSettings(settings: Partial<UserSettings>): Promise<UserSettings> {
  const res = await fetch(`${BASE_URL}/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  if (!res.ok) throw new Error('Error al actualizar configuración en la base de datos');
  return await res.json();
}

export async function apiResetDatabase(): Promise<{
  accounts: BankAccount[];
  history: DailyYieldRecord[];
  settings: UserSettings;
}> {
  const res = await fetch(`${BASE_URL}/reset`, {
    method: 'POST',
    headers: userHeaders(),
  });
  if (!res.ok) throw new Error('Error al reiniciar base de datos');
  return await res.json();
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
  created_at: string;
}

async function readApiResponse<T>(res: Response, fallbackError: string): Promise<T> {
  const body = await res.text();
  let data: T & { error?: string } | null = null;

  try {
    data = body ? JSON.parse(body) : null;
  } catch {
    if (!res.ok) {
      throw new Error(fallbackError);
    }
  }

  if (!res.ok) {
    throw new Error(data?.error || fallbackError);
  }
  if (!data) {
    throw new Error(fallbackError);
  }
  return data;
}

export async function apiRegister(
  name: string,
  email: string,
  password: string
): Promise<{ user: AuthUser }> {
  const res = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  });
  return readApiResponse<{ user: AuthUser }>(res, 'Error al registrarse');
}

export async function apiLogin(
  email: string,
  password: string
): Promise<{ user: AuthUser }> {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return readApiResponse<{ user: AuthUser }>(res, 'Correo o contraseña incorrectos');
}

export async function apiUpdateAvatar(
  userId: string,
  avatarBase64: string
): Promise<{ user: AuthUser }> {
  const res = await fetch(`${BASE_URL}/auth/avatar`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, avatar: avatarBase64 }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error al actualizar foto de perfil');
  return data;
}
