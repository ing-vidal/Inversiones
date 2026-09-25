import React, { useState } from 'react';

type AdminUser = {
  id: string;
  name: string;
  email: string;
  created_at: string;
};

const adminHeaders = (username: string, password: string): HeadersInit => ({
  'X-Admin-User': username,
  'X-Admin-Password': password,
});

export const AdminView: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadUsers = async (currentUsername = username, currentPassword = password) => {
    const response = await fetch('/api/admin', {
      headers: adminHeaders(currentUsername, currentPassword),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'No se pudieron cargar los usuarios');
    setUsers(data.users);
  };

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', username, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Credenciales incorrectas');
      await loadUsers();
      setAuthenticated(true);
    } catch (loginError: any) {
      setError(loginError.message || 'No se pudo iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (user: AdminUser) => {
    if (!window.confirm(`¿Eliminar a ${user.email}? También se eliminarán sus cuentas y su historial.`)) return;
    setLoading(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/admin', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...adminHeaders(username, password) },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo eliminar el usuario');
      setUsers((currentUsers) => currentUsers.filter((currentUser) => currentUser.id !== user.id));
      setNotice(`Usuario ${user.email} eliminado.`);
    } catch (deleteError: any) {
      setError(deleteError.message || 'No se pudo eliminar el usuario');
    } finally {
      setLoading(false);
    }
  };

  if (!authenticated) {
    return (
      <main className="dark-ui min-h-screen flex items-center justify-center px-4 font-hanken">
        <form onSubmit={handleLogin} className="w-full max-w-sm rounded-2xl border border-[#29435d] bg-[#101d31] p-7 shadow-2xl">
          <div className="mb-7">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#68ffc0]">Rendimax</p>
            <h1 className="mt-2 font-space text-2xl font-bold text-[#f5fbff]">Administración</h1>
            <p className="mt-2 text-sm text-[#91a5bc]">Acceso privado</p>
          </div>
          <label className="mb-4 block text-sm font-semibold text-[#f5fbff]">
            Usuario
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              className="mt-2 w-full rounded-xl border border-[#29435d] bg-[#091625] px-4 py-3 font-normal text-[#f5fbff] outline-none focus:border-[#68ffc0]"
            />
          </label>
          <label className="mb-5 block text-sm font-semibold text-[#f5fbff]">
            Contraseña
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              className="mt-2 w-full rounded-xl border border-[#29435d] bg-[#091625] px-4 py-3 font-normal text-[#f5fbff] outline-none focus:border-[#68ffc0]"
            />
          </label>
          {error && <p className="mb-4 rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-200">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-[#00c98b] to-[#45d9ff] px-4 py-3 font-semibold text-[#04131c] disabled:opacity-60"
          >
            {loading ? 'Validando...' : 'Entrar'}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="dark-ui min-h-screen px-4 py-8 font-hanken sm:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex flex-col justify-between gap-4 border-b border-[#29435d] pb-6 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#68ffc0]">Rendimax / Admin</p>
            <h1 className="mt-2 font-space text-3xl font-bold text-[#f5fbff]">Usuarios registrados</h1>
            <p className="mt-2 text-sm text-[#91a5bc]">{users.length} usuario{users.length === 1 ? '' : 's'}</p>
          </div>
          <button
            type="button"
            onClick={() => { setAuthenticated(false); setUsers([]); setPassword(''); }}
            className="rounded-lg border border-[#29435d] px-4 py-2 text-sm text-[#91a5bc] hover:border-[#68ffc0] hover:text-[#f5fbff]"
          >
            Cerrar sesión
          </button>
        </header>

        {error && <p className="mb-4 rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-200">{error}</p>}
        {notice && <p className="mb-4 rounded-lg bg-emerald-950/50 px-3 py-2 text-sm text-emerald-200">{notice}</p>}

        <section className="overflow-hidden rounded-2xl border border-[#29435d] bg-[#101d31]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="border-b border-[#29435d] bg-[#152943] text-xs uppercase tracking-wide text-[#91a5bc]">
                <tr>
                  <th className="px-5 py-4">Nombre</th>
                  <th className="px-5 py-4">Correo</th>
                  <th className="px-5 py-4">Contraseña</th>
                  <th className="px-5 py-4">Registro</th>
                  <th className="px-5 py-4 text-right">Acción</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-[#29435d]/70 last:border-0">
                    <td className="px-5 py-4 font-semibold text-[#f5fbff]">{user.name}</td>
                    <td className="px-5 py-4 text-[#68ffc0]">{user.email}</td>
                    <td className="px-5 py-4 text-[#91a5bc]">Protegida</td>
                    <td className="px-5 py-4 text-[#91a5bc]">
                      {new Date(user.created_at).toLocaleDateString('es-MX')}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => handleDelete(user)}
                        className="rounded-lg border border-red-400/40 px-3 py-2 text-xs font-semibold text-red-300 hover:bg-red-400/10 disabled:opacity-50"
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center text-[#91a5bc]">No hay usuarios registrados.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
        <p className="mt-4 text-xs text-[#64788a]">Las contraseñas se almacenan como hashes y no pueden recuperarse ni mostrarse.</p>
      </div>
    </main>
  );
};
