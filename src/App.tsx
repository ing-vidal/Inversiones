/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { BankAccount, BankInstitution, DailyYieldRecord, UserSettings } from './types/finance';
import { Header } from './components/Header';
import { BottomNav, MainTab } from './components/BottomNav';
import { CuentasView } from './components/views/CuentasView';
import { InicioView } from './components/views/InicioView';
import { HistorialView } from './components/views/HistorialView';
import { PerfilView } from './components/views/PerfilView';
import { AuthView } from './components/views/AuthView';
import { SAT_ISR_DEFAULT, SOFIPO_EXEMPTION_LIMIT, INFLATION_ESTIMATE, calculateYield, isNuInstitution, isSofipoInstitution } from './utils/calculator';
import {
  fetchHealth,
  fetchInstitutions,
  apiCreateInstitution,
  apiUpdateInstitution,
  apiDeleteInstitution,
  fetchAccounts,
  apiCreateAccount,
  apiUpdateBalance,
  apiAccrueAccount,
  apiDeleteAccount,
  fetchYieldHistory,
  apiCreateYieldRecord,
  fetchSettings,
  apiUpdateSettings,
  apiResetDatabase,
  AuthUser,
} from './services/api';

const normalizeNuInstitution = (institution: BankInstitution): BankInstitution => {
  if (!isNuInstitution(institution.id, institution.name, institution.shortName)) return institution;

  return {
    ...institution,
    rate: 13,
    defaultBase: 360,
    hasDualTier: false,
    dualThreshold: undefined,
    dualRate2: undefined,
  };
};

const normalizeNuAccount = (account: BankAccount): BankAccount => {
  if (!isNuInstitution(account.institutionId, account.institutionName, account.shortCode)) return account;

  return {
    ...account,
    nominalRate: 13,
    baseDivisor: 360,
    isDualTier: false,
    dualThreshold: undefined,
    dualRate2: undefined,
    deductISR: false,
  };
};

export default function App() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<MainTab>('cuentas');
  const [dbStatus, setDbStatus] = useState<'connected' | 'syncing' | 'offline'>('syncing');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [institutions, setInstitutions] = useState<BankInstitution[]>([]);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [history, setHistory] = useState<DailyYieldRecord[]>([]);
  const [settings, setSettings] = useState<UserSettings>({
    satIsrRate: SAT_ISR_DEFAULT,
    applySofipoExemption: true,
    umaValueAnnual: SOFIPO_EXEMPTION_LIMIT,
    expectedInflation: INFLATION_ESTIMATE,
  });

  // Purge any legacy browser localStorage on initial start
  useEffect(() => {
    try {
      localStorage.removeItem('rendimax_accounts_v1');
      localStorage.removeItem('rendimax_history_v1');
      localStorage.removeItem('rendimax_settings_v1');
    } catch {
      // ignore
    }
  }, []);

  // Exclusively load all data from the SQLite database
  const loadDatabaseData = useCallback(async () => {
    try {
      setDbStatus('syncing');
      const health = await fetchHealth();
      if (!health) {
        setDbStatus('offline');
        setIsLoading(false);
        return;
      }

      const [dbInstitutions, dbAccounts, dbHistory, dbSettings] = await Promise.all([
        fetchInstitutions().catch(() => []),
        fetchAccounts().catch(() => []),
        fetchYieldHistory().catch(() => []),
        fetchSettings().catch(() => null),
      ]);

      const activeSettings = dbSettings ?? settings;
      const currentTime = Date.now();
      const dayInMilliseconds = 24 * 60 * 60 * 1000;
      const accruedRecords: DailyYieldRecord[] = [];
      const updatedAccounts = [...(dbAccounts || [])];

      for (const account of updatedAccounts) {
        const accountRecords = (dbHistory || [])
          .filter((record) => record.accountId === account.id && record.createdAt)
          .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        const lastTimestamp = accountRecords[0]?.createdAt || new Date(account.createdAt).getTime();
        const elapsedDays = Math.floor((currentTime - lastTimestamp) / dayInMilliseconds);
        if (elapsedDays <= 0) continue;

        let runningBalance = account.balance;
        const pendingRecords: DailyYieldRecord[] = [];
        for (let day = 1; day <= elapsedDays; day += 1) {
          const recordTimestamp = lastTimestamp + day * dayInMilliseconds;
          const yieldCalc = calculateYield({
            monto: runningBalance,
            tasaNominal: account.nominalRate,
            base: account.baseDivisor,
            isCompound: account.isCompound,
            deductISR: account.deductISR,
            isDualTier: account.isDualTier,
            dualThreshold: account.dualThreshold,
            dualRate2: account.dualRate2,
            satRate: activeSettings.satIsrRate,
            isSofipoExempt: activeSettings.applySofipoExemption && isSofipoInstitution(account.institutionId),
            sofipoExemptionLimit: activeSettings.umaValueAnnual,
          });
          const recordDate = new Date(recordTimestamp);
          const pendingRecord: DailyYieldRecord = {
            id: `y-${account.id}-${recordTimestamp}`,
            accountId: account.id,
            bankName: account.institutionName,
            shortCode: account.shortCode,
            badgeBg: account.badgeBg,
            badgeText: account.badgeText,
            date: recordDate.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }),
            time: '00:01 AM',
            grossYield: yieldCalc.grossDaily,
            isrWithheld: yieldCalc.isrDaily,
            netYield: yieldCalc.netDaily,
            balanceAtTime: runningBalance,
            createdAt: recordTimestamp,
          };
          pendingRecords.push(pendingRecord);
          runningBalance += yieldCalc.netDaily;
        }

        const updated = await apiAccrueAccount(
          account.id,
          pendingRecords,
          runningBalance - account.balance,
        );
        const accountIndex = updatedAccounts.findIndex((item) => item.id === account.id);
        if (accountIndex >= 0) updatedAccounts[accountIndex] = normalizeNuAccount(updated);
        accruedRecords.push(...pendingRecords);
      }

      if (dbInstitutions && dbInstitutions.length > 0) {
        setInstitutions(dbInstitutions.map(normalizeNuInstitution));
      }
      if (dbAccounts) {
        setAccounts(updatedAccounts.map(normalizeNuAccount));
      }
      if (dbHistory) {
        setHistory([...accruedRecords.reverse(), ...dbHistory]);
      }
      if (dbSettings) {
        setSettings(dbSettings);
      }

      setDbStatus('connected');
    } catch (err) {
      console.error('[RendiMax Database Error]:', err);
      setDbStatus('offline');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDatabaseData();
  }, [loadDatabaseData]);

  // Handlers: Save directly and exclusively to the SQLite database
  const handleSaveAccount = async (newAcc: BankAccount) => {
    // Immediate UI feedback
    setAccounts((prev) => [newAcc, ...prev]);

    // Calculate initial yield entry
    const yieldCalc = calculateYield({
      monto: newAcc.balance,
      tasaNominal: newAcc.nominalRate,
      base: newAcc.baseDivisor,
      isCompound: newAcc.isCompound,
      deductISR: newAcc.deductISR,
      isDualTier: newAcc.isDualTier,
      dualThreshold: newAcc.dualThreshold,
      dualRate2: newAcc.dualRate2,
      satRate: settings.satIsrRate,
      isSofipoExempt: settings.applySofipoExemption && isSofipoInstitution(newAcc.institutionId),
      sofipoExemptionLimit: settings.umaValueAnnual,
    });

    const newRecord: DailyYieldRecord = {
      id: `y-${Date.now()}`,
      accountId: newAcc.id,
      bankName: newAcc.institutionName,
      shortCode: newAcc.shortCode,
      badgeBg: newAcc.badgeBg,
      badgeText: newAcc.badgeText,
      date: 'Hoy, ' + new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }),
      time: 'Justo ahora',
      grossYield: yieldCalc.grossDaily,
      isrWithheld: yieldCalc.isrDaily,
      netYield: yieldCalc.netDaily,
      balanceAtTime: newAcc.balance,
    };

    setHistory((prev) => [newRecord, ...prev]);

    // Persist to SQLite database
    try {
      setDbStatus('syncing');
      await apiCreateAccount(newAcc);
      await apiCreateYieldRecord(newRecord);
      setDbStatus('connected');
    } catch (error) {
      console.error('Error al insertar en la base de datos:', error);
      setDbStatus('offline');
    }
  };

  const handleDeleteAccount = async (id: string) => {
    const accountToDelete = accounts.find((a) => a.id === id);
    if (!accountToDelete) return;

    try {
      setDbStatus('syncing');
      const deleted = await apiDeleteAccount(id);

      if (!deleted) {
        throw new Error('La cuenta no pudo eliminarse en la base de datos');
      }

      setAccounts((prev) => prev.filter((a) => a.id !== id));
      setHistory((prev) => prev.filter((record) => record.accountId !== id));
      setDbStatus('connected');
    } catch (error) {
      console.error('Error al eliminar de la base de datos:', error);
      setDbStatus('offline');
    }
  };

  const handleDepositWithdraw = async (accountId: string, amountDelta: number) => {
    setAccounts((prev) =>
      prev.map((a) => {
        if (a.id !== accountId) return a;
        return {
          ...a,
          balance: Math.max(0, a.balance + amountDelta),
        };
      })
    );

    try {
      setDbStatus('syncing');
      const updated = await apiUpdateBalance(accountId, amountDelta);
      // Ensure sync with DB returned object
      setAccounts((prev) => prev.map((a) => (a.id === accountId ? { ...a, balance: updated.balance } : a)));
      setDbStatus('connected');
    } catch (error) {
      console.error('Error al actualizar saldo en la base de datos:', error);
      setDbStatus('offline');
    }
  };

  const handleUpdateSettings = async (newSettings: UserSettings) => {
    setSettings(newSettings);

    try {
      setDbStatus('syncing');
      const updated = await apiUpdateSettings(newSettings);
      setSettings(updated);
      setDbStatus('connected');
    } catch (error) {
      console.error('Error al actualizar configuración en la base de datos:', error);
      setDbStatus('offline');
    }
  };

  const handleCreateInstitution = async (institution: BankInstitution) => {
    try {
      setDbStatus('syncing');
      const created = await apiCreateInstitution(institution);
      setInstitutions((prev) => [created, ...prev]);
      setDbStatus('connected');
    } catch (error) {
      console.error('Error al guardar institución:', error);
      setDbStatus('offline');
    }
  };

  const handleUpdateInstitution = async (id: string, institution: Partial<BankInstitution>) => {
    try {
      setDbStatus('syncing');
      const updated = await apiUpdateInstitution(id, institution);
      setInstitutions((prev) => prev.map((inst) => (inst.id === id ? updated : inst)));
      setDbStatus('connected');
    } catch (error) {
      console.error('Error al actualizar institución:', error);
      setDbStatus('offline');
    }
  };

  const handleDeleteInstitution = async (id: string) => {
    try {
      setDbStatus('syncing');
      const deleted = await apiDeleteInstitution(id);
      if (!deleted) {
        throw new Error('La institución no pudo eliminarse');
      }
      setInstitutions((prev) => prev.filter((inst) => inst.id !== id));
      setDbStatus('connected');
    } catch (error) {
      console.error('Error al eliminar institución:', error);
      setDbStatus('offline');
    }
  };

  const handleResetData = async () => {
    try {
      setDbStatus('syncing');
      const res = await apiResetDatabase();
      setAccounts(res.accounts.map(normalizeNuAccount));
      setHistory(res.history);
      setSettings(res.settings);
      setDbStatus('connected');
    } catch (error) {
      console.error('Error restableciendo base de datos:', error);
      setDbStatus('offline');
    }
  };

  const handleLogout = () => {
    // Clear sensitive in-memory data and show the login screen
    setAccounts([]);
    setHistory([]);
    setCurrentUser(null);
    setIsLoggedIn(false);
    setActiveTab('cuentas');
    setDbStatus('offline');
  };

  const handleLogin = (user: AuthUser) => {
    setCurrentUser(user);
    setIsLoggedIn(true);
    setIsLoading(true);
    loadDatabaseData();
  };

  const handleAvatarUpdate = async (updatedUser: AuthUser) => {
    setCurrentUser(updatedUser);
  };

  // Screen title for header
  const screenTitles: Record<MainTab, string> = {
    cuentas: 'Cuentas Bancos',
    inicio: 'Rendimiento Inteligente',
    historial: 'Historial de Abonos',
    perfil: 'Configuración & SAT',
  };

  // Auth screen: show login/register when not authenticated
  if (!isLoggedIn) {
    return <AuthView onAuthenticated={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-[#f8f9ff] text-[#0b1c30] flex flex-col font-hanken">
      {/* Sticky Top Header with DB Connection Status & Desktop Nav */}
      <Header
        activeScreenTitle={screenTitles[activeTab]}
        onProfileClick={() => setActiveTab('perfil')}
        dbStatus={dbStatus}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        currentUser={currentUser}
      />

      {/* Main Content Area: Fluid responsive for mobile (screen-sm) and desktop (up to 6xl) */}
      <main className="flex-1 w-full max-w-6xl mx-auto pt-20 px-4 sm:px-6 lg:px-8 pb-24 md:pb-12">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-400">
            <span className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin"></span>
            <span className="text-[13px] font-medium font-space text-slate-600">
              Conectando a base de datos SQLite...
            </span>
          </div>
        ) : (
          <>
            {activeTab === 'cuentas' && (
              <CuentasView
                accounts={accounts}
                settings={settings}
                institutions={institutions}
                onSaveAccount={handleSaveAccount}
                onDeleteAccount={handleDeleteAccount}
                onDepositWithdraw={handleDepositWithdraw}
                onOpenProfile={() => setActiveTab('perfil')}
                initialSubTab="registrar"
              />
            )}

            {activeTab === 'inicio' && (
              <InicioView
                accounts={accounts}
                settings={settings}
                onNavigateToRegister={() => setActiveTab('cuentas')}
                onNavigateToHistory={() => setActiveTab('historial')}
              />
            )}

            {activeTab === 'historial' && (
              <HistorialView records={history} institutions={institutions} />
            )}

            {activeTab === 'perfil' && (
              <PerfilView
                settings={settings}
                institutions={institutions}
                onUpdateSettings={handleUpdateSettings}
                onResetData={handleResetData}
                onLogout={handleLogout}
                currentUser={currentUser}
                onAvatarUpdate={handleAvatarUpdate}
                onCreateInstitution={handleCreateInstitution}
                onUpdateInstitution={handleUpdateInstitution}
                onDeleteInstitution={handleDeleteInstitution}
              />
            )}
          </>
        )}
      </main>

      {/* Fixed Bottom Navigation */}
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}
