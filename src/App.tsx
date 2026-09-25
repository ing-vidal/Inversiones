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
import { AdminView } from './components/views/AdminView';
import { SAT_ISR_DEFAULT, SOFIPO_EXEMPTION_LIMIT, INFLATION_ESTIMATE, calculateYield } from './utils/calculator';
import {
  fetchHealth,
  fetchInstitutions,
  apiCreateInstitution,
  apiUpdateInstitution,
  apiDeleteInstitution,
  fetchAccounts,
  apiCreateAccount,
  apiUpdateAccount,
  apiUpdateBalance,
  apiAccrueAccount,
  apiFreezeTermAccount,
  apiDeleteAccount,
  fetchYieldHistory,
  apiCreateYieldRecord,
  apiUpdateYieldRecordBalance,
  fetchSettings,
  apiUpdateSettings,
  apiResetDatabase,
  AuthUser,
  setActiveUserId,
} from './services/api';

const calculateAccountYield = (account: BankAccount, balance: number, settings: UserSettings) => calculateYield({
  monto: balance,
  tasaNominal: account.nominalRate,
  base: account.baseDivisor,
  isCompound: account.isCompound,
  deductISR: account.isrMode ? account.isrMode === 'deduct' : account.deductISR,
  isDualTier: account.isDualTier,
  dualThreshold: account.dualThreshold,
  dualRate2: account.dualRate2,
  isrRate: account.isrRate ?? settings.satIsrRate,
  isrMode: account.isrMode,
  isSofipoExempt: settings.applySofipoExemption && account.isrExempt === true,
  sofipoExemptionLimit: settings.umaValueAnnual,
  roundingMode: account.roundingMode,
});

function MainApp() {
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
      const getLocalDayNumber = (timestamp: number) => {
        const date = new Date(timestamp);
        return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
      };
      const accruedRecords: DailyYieldRecord[] = [];
      const updatedAccounts = dbAccounts || [];

      for (const account of updatedAccounts) {
        if (account.paymentFrequency === 'vencimiento') {
          const updated = await apiFreezeTermAccount(account.id);
          const accountIndex = updatedAccounts.findIndex((item) => item.id === account.id);
          if (accountIndex >= 0) updatedAccounts[accountIndex] = updated;
          for (let index = dbHistory.length - 1; index >= 0; index -= 1) {
            if (dbHistory[index].accountId === account.id) dbHistory.splice(index, 1);
          }
          continue;
        }

        const accountRecords = (dbHistory || [])
          .filter((record) => record.accountId === account.id && record.createdAt)
          .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        const lastTimestamp = accountRecords[0]?.createdAt || new Date(account.createdAt).getTime();
        const elapsedDays = Math.floor(
          (getLocalDayNumber(currentTime) - getLocalDayNumber(lastTimestamp)) / dayInMilliseconds,
        );
        const latestRecord = accountRecords[0];
        if (elapsedDays <= 0) {
          const expectedBalance = latestRecord
            ? latestRecord.balanceAtTime + latestRecord.netYield
            : account.balance;
          const isStaleBalance = latestRecord
            && Math.abs(expectedBalance - account.balance) < 0.01
            && Math.abs(latestRecord.balanceAtTime - account.balance) >= 0.01;

          if (isStaleBalance) {
            const correctedRecord = await apiUpdateYieldRecordBalance(latestRecord.id, account.balance);
            const historyIndex = dbHistory.findIndex((record) => record.id === correctedRecord.id);
            if (historyIndex >= 0) dbHistory[historyIndex] = correctedRecord;
          }
          continue;
        }

        let runningBalance = account.balance;
        const pendingRecords: DailyYieldRecord[] = [];
        for (let day = 1; day <= elapsedDays; day += 1) {
          const recordDate = new Date(lastTimestamp);
          recordDate.setDate(recordDate.getDate() + day);
          const recordTimestamp = recordDate.getTime();
          const yieldCalc = calculateAccountYield(account, runningBalance, activeSettings);
          const balanceAfterYield = runningBalance + yieldCalc.netDaily;
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
            balanceAtTime: balanceAfterYield,
            createdAt: recordTimestamp,
          };
          pendingRecords.push(pendingRecord);
          runningBalance = balanceAfterYield;
        }

        const updated = await apiAccrueAccount(
          account.id,
          pendingRecords,
          runningBalance - account.balance,
        );
        const accountIndex = updatedAccounts.findIndex((item) => item.id === account.id);
        if (accountIndex >= 0) updatedAccounts[accountIndex] = updated;
        accruedRecords.push(...pendingRecords);
      }

      if (dbInstitutions && dbInstitutions.length > 0) {
        setInstitutions(dbInstitutions);
      }
      if (dbAccounts) {
        setAccounts(updatedAccounts);
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
      deductISR: newAcc.isrMode ? newAcc.isrMode === 'deduct' : newAcc.deductISR,
      isDualTier: newAcc.isDualTier,
      dualThreshold: newAcc.dualThreshold,
      dualRate2: newAcc.dualRate2,
      isrRate: newAcc.isrRate ?? settings.satIsrRate,
      isrMode: newAcc.isrMode,
      isSofipoExempt: settings.applySofipoExemption && newAcc.isrExempt === true,
      sofipoExemptionLimit: settings.umaValueAnnual,
      roundingMode: newAcc.roundingMode,
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

    if (newAcc.paymentFrequency !== 'vencimiento') {
      setHistory((prev) => [newRecord, ...prev]);
    }

    // Persist to SQLite database
    try {
      setDbStatus('syncing');
      await apiCreateAccount(newAcc);
      if (newAcc.paymentFrequency !== 'vencimiento') {
        await apiCreateYieldRecord(newRecord);
      }
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

  const handleUpdateAccount = async (id: string, changes: Partial<BankAccount>) => {
    const current = accounts.find((account) => account.id === id);
    if (!current) return;
    const optimistic = { ...current, ...changes };
    setAccounts((prev) => prev.map((account) => account.id === id ? optimistic : account));
    try {
      setDbStatus('syncing');
      const updated = await apiUpdateAccount(id, changes);
      setAccounts((prev) => prev.map((account) => account.id === id ? updated : account));
      setDbStatus('connected');
    } catch (error) {
      setAccounts((prev) => prev.map((account) => account.id === id ? current : account));
      console.error('Error al actualizar cuenta:', error);
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
      setAccounts(res.accounts);
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
    setActiveUserId(null);
  };

  const handleLogin = (user: AuthUser) => {
    setCurrentUser(user);
    setActiveUserId(user.id);
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
    <div className="dark-ui min-h-screen bg-[#080d12] text-[#eef4f1] flex flex-col font-hanken">
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
                history={history}
                settings={settings}
                institutions={institutions}
                onSaveAccount={handleSaveAccount}
                onUpdateAccount={handleUpdateAccount}
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
              <HistorialView records={history} accounts={accounts} institutions={institutions} />
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

export default function App() {
  if (window.location.pathname === '/admin') {
    return <AdminView />;
  }

  return <MainApp />;
}
