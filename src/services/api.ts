import { BankAccount, BankInstitution, DailyYieldRecord, UserSettings } from '../types/finance';

const BASE_URL = '/api';

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

export async function fetchAccounts(): Promise<BankAccount[]> {
  const res = await fetch(`${BASE_URL}/accounts`);
  if (!res.ok) throw new Error('Error al cargar cuentas bancarias desde la base de datos');
  return await res.json();
}

export async function apiCreateAccount(account: BankAccount): Promise<BankAccount> {
  const res = await fetch(`${BASE_URL}/accounts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(account),
  });
  if (!res.ok) throw new Error('Error al guardar cuenta en la base de datos');
  return await res.json();
}

export async function apiUpdateAccount(id: string, account: Partial<BankAccount>): Promise<BankAccount> {
  const res = await fetch(`${BASE_URL}/accounts/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(account),
  });
  if (!res.ok) throw new Error('Error al actualizar cuenta en la base de datos');
  return await res.json();
}

export async function apiUpdateBalance(id: string, amountDelta: number): Promise<BankAccount> {
  const res = await fetch(`${BASE_URL}/accounts/${id}/movement`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amountDelta }),
  });
  if (!res.ok) throw new Error('Error al actualizar saldo en la base de datos');
  return await res.json();
}

export async function apiDeleteAccount(id: string): Promise<boolean> {
  const res = await fetch(`${BASE_URL}/accounts/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Error al eliminar cuenta de la base de datos');
  const data = await res.json();
  return Boolean(data.success);
}

export async function fetchYieldHistory(): Promise<DailyYieldRecord[]> {
  const res = await fetch(`${BASE_URL}/history`);
  if (!res.ok) throw new Error('Error al cargar historial desde la base de datos');
  return await res.json();
}

export async function apiCreateYieldRecord(record: DailyYieldRecord): Promise<DailyYieldRecord> {
  const res = await fetch(`${BASE_URL}/history`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(record),
  });
  if (!res.ok) throw new Error('Error al registrar rendimiento en la base de datos');
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
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error al registrarse');
  return data;
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
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Correo o contraseña incorrectos');
  return data;
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
