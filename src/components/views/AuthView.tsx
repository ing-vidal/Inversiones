import React, { useState } from 'react';
import { apiLogin, apiRegister, AuthUser } from '../../services/api';

interface AuthViewProps {
  onAuthenticated: (user: AuthUser) => void;
}

type AuthTab = 'login' | 'register';

export const AuthView: React.FC<AuthViewProps> = ({ onAuthenticated }) => {
  const [tab, setTab] = useState<AuthTab>('login');

  // Login fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Register fields
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirm, setRegConfirm] = useState('');
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    if (!loginEmail || !loginPassword) {
      setLoginError('Completa todos los campos.');
      return;
    }
    setLoginLoading(true);
    try {
      const { user } = await apiLogin(loginEmail.trim(), loginPassword);
      onAuthenticated(user);
    } catch (err: any) {
      setLoginError(err.message || 'Error al iniciar sesión.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');
    if (!regName || !regEmail || !regPassword || !regConfirm) {
      setRegError('Completa todos los campos.');
      return;
    }
    if (regPassword.length < 6) {
      setRegError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (regPassword !== regConfirm) {
      setRegError('Las contraseñas no coinciden.');
      return;
    }
    setRegLoading(true);
    try {
      const { user } = await apiRegister(regName.trim(), regEmail.trim(), regPassword);
      onAuthenticated(user);
    } catch (err: any) {
      setRegError(err.message || 'Error al registrarse.');
    } finally {
      setRegLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f0f4ff] via-[#f8f9ff] to-[#e8f5ee] flex flex-col items-center justify-center px-4 font-hanken">
      <div className="w-full max-w-md flex flex-col gap-6">

        {/* Branding */}
        <div className="flex flex-col items-center gap-2">
          <img
            alt="Rendimax Logo"
            className="h-12 w-auto object-contain drop-shadow-sm"
            src="https://lh3.googleusercontent.com/aida/AEtjO1V0p4zzxO9n_2O-GDXEIcWz4KRo-DZzPem0ZXZKdDZAUMfbQPURqtgFr3Hsqaz1opSCAxIiQGHing9XJvn8dn08xhGeAzq9KB7kvclf4vpbkjFptjuK7zdiQ_TfwhN2-cT6F7QiM8I15JKRqeEFX1-GwYkziHF11WUGDPlYWUPqI_u8ujwmPrCBo43jvIQqOa7dGu9tC7fi1AgvE1b0A5TmjkFztnrCpouae46dp_r6_FhwEHyLE2KsjNCk"
          />
          <span className="font-space font-bold text-[28px] tracking-tight text-[#0b1c30]">
            Rendimax
          </span>
          <span className="font-hanken text-[11px] uppercase tracking-widest text-[#006c49] font-bold">
            Cuentas &amp; Rendimientos Bancarios
          </span>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-[#e2e8f0]/80 overflow-hidden">

          {/* Tabs */}
          <div className="flex border-b border-[#e2e8f0]">
            <button
              type="button"
              onClick={() => { setTab('login'); setLoginError(''); }}
              className={`flex-1 py-3.5 font-hanken font-semibold text-[14px] transition-all border-b-2 ${
                tab === 'login'
                  ? 'border-[#006c49] text-[#006c49] bg-[#f0faf5]'
                  : 'border-transparent text-[#45464d] hover:text-[#0b1c30]'
              }`}
            >
              Iniciar Sesión
            </button>
            <button
              type="button"
              onClick={() => { setTab('register'); setRegError(''); }}
              className={`flex-1 py-3.5 font-hanken font-semibold text-[14px] transition-all border-b-2 ${
                tab === 'register'
                  ? 'border-[#006c49] text-[#006c49] bg-[#f0faf5]'
                  : 'border-transparent text-[#45464d] hover:text-[#0b1c30]'
              }`}
            >
              Crear Cuenta
            </button>
          </div>

          {/* Login Form */}
          {tab === 'login' && (
            <form onSubmit={handleLogin} className="flex flex-col gap-4 p-6 sm:p-8">
              <div className="flex flex-col gap-1.5">
                <label className="font-hanken font-semibold text-[12px] text-[#0b1c30]">
                  Correo electrónico
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8] text-[18px]">
                    mail
                  </span>
                  <input
                    id="login-email"
                    type="email"
                    autoComplete="email"
                    placeholder="correo@ejemplo.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-[#f8f9ff] border border-[#e2e8f0] rounded-xl font-hanken text-[14px] text-[#0b1c30] outline-none focus:border-[#006c49] focus:ring-2 focus:ring-[#006c49]/10 transition-all placeholder:text-[#94a3b8]"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-hanken font-semibold text-[12px] text-[#0b1c30]">
                  Contraseña
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8] text-[18px]">
                    lock
                  </span>
                  <input
                    id="login-password"
                    type={showLoginPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Tu contraseña"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full pl-10 pr-11 py-3 bg-[#f8f9ff] border border-[#e2e8f0] rounded-xl font-hanken text-[14px] text-[#0b1c30] outline-none focus:border-[#006c49] focus:ring-2 focus:ring-[#006c49]/10 transition-all placeholder:text-[#94a3b8]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#45464d] transition-colors"
                    tabIndex={-1}
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {showLoginPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              {loginError && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-2.5 text-[13px]">
                  <span className="material-symbols-outlined text-[16px] shrink-0">error</span>
                  {loginError}
                </div>
              )}

              <button
                type="submit"
                disabled={loginLoading}
                className="w-full py-3.5 bg-[#006c49] hover:bg-[#005a3c] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-xl font-hanken font-semibold text-[15px] transition-all shadow-sm flex items-center justify-center gap-2 mt-1"
              >
                {loginLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Ingresando...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[20px]">lock_open</span>
                    Ingresar
                  </>
                )}
              </button>

              <p className="text-center font-hanken text-[12px] text-[#45464d]">
                ¿Sin cuenta?{' '}
                <button
                  type="button"
                  onClick={() => setTab('register')}
                  className="text-[#006c49] font-semibold hover:underline"
                >
                  Regístrate gratis
                </button>
              </p>
            </form>
          )}

          {/* Register Form */}
          {tab === 'register' && (
            <form onSubmit={handleRegister} className="flex flex-col gap-4 p-6 sm:p-8">
              <div className="flex flex-col gap-1.5">
                <label className="font-hanken font-semibold text-[12px] text-[#0b1c30]">
                  Nombre completo
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8] text-[18px]">
                    person
                  </span>
                  <input
                    id="reg-name"
                    type="text"
                    autoComplete="name"
                    placeholder="Tu nombre"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-[#f8f9ff] border border-[#e2e8f0] rounded-xl font-hanken text-[14px] text-[#0b1c30] outline-none focus:border-[#006c49] focus:ring-2 focus:ring-[#006c49]/10 transition-all placeholder:text-[#94a3b8]"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-hanken font-semibold text-[12px] text-[#0b1c30]">
                  Correo electrónico
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8] text-[18px]">
                    mail
                  </span>
                  <input
                    id="reg-email"
                    type="email"
                    autoComplete="email"
                    placeholder="correo@ejemplo.com"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-[#f8f9ff] border border-[#e2e8f0] rounded-xl font-hanken text-[14px] text-[#0b1c30] outline-none focus:border-[#006c49] focus:ring-2 focus:ring-[#006c49]/10 transition-all placeholder:text-[#94a3b8]"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-hanken font-semibold text-[12px] text-[#0b1c30]">
                  Contraseña <span className="text-[#94a3b8] font-normal">(mín. 6 caracteres)</span>
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8] text-[18px]">
                    lock
                  </span>
                  <input
                    id="reg-password"
                    type={showRegPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Crea una contraseña"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    className="w-full pl-10 pr-11 py-3 bg-[#f8f9ff] border border-[#e2e8f0] rounded-xl font-hanken text-[14px] text-[#0b1c30] outline-none focus:border-[#006c49] focus:ring-2 focus:ring-[#006c49]/10 transition-all placeholder:text-[#94a3b8]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#45464d] transition-colors"
                    tabIndex={-1}
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {showRegPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-hanken font-semibold text-[12px] text-[#0b1c30]">
                  Confirmar contraseña
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8] text-[18px]">
                    lock_check
                  </span>
                  <input
                    id="reg-confirm"
                    type={showRegPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Repite la contraseña"
                    value={regConfirm}
                    onChange={(e) => setRegConfirm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-[#f8f9ff] border border-[#e2e8f0] rounded-xl font-hanken text-[14px] text-[#0b1c30] outline-none focus:border-[#006c49] focus:ring-2 focus:ring-[#006c49]/10 transition-all placeholder:text-[#94a3b8]"
                  />
                </div>
              </div>

              {regError && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-2.5 text-[13px]">
                  <span className="material-symbols-outlined text-[16px] shrink-0">error</span>
                  {regError}
                </div>
              )}

              <button
                type="submit"
                disabled={regLoading}
                className="w-full py-3.5 bg-[#006c49] hover:bg-[#005a3c] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-xl font-hanken font-semibold text-[15px] transition-all shadow-sm flex items-center justify-center gap-2 mt-1"
              >
                {regLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Creando cuenta...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[20px]">person_add</span>
                    Crear Cuenta
                  </>
                )}
              </button>

              <p className="text-center font-hanken text-[12px] text-[#45464d]">
                ¿Ya tienes cuenta?{' '}
                <button
                  type="button"
                  onClick={() => setTab('login')}
                  className="text-[#006c49] font-semibold hover:underline"
                >
                  Inicia sesión
                </button>
              </p>
            </form>
          )}
        </div>

        {/* Footer note */}
        <div className="flex items-center justify-center gap-2 text-[11px] font-hanken text-[#94a3b8]">
          <span className="material-symbols-outlined text-[14px]">shield_locked</span>
          <span>Datos almacenados exclusivamente en <code className="text-[10px]">rendimax.db</code> — sin servidores externos</span>
        </div>
      </div>
    </div>
  );
};
