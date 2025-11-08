import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore.js';

const navLinkClass = ({ isActive }) =>
  `rounded-md px-3 py-2 text-sm font-medium ${isActive ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`;

const Layout = () => {
  const { user, logout, loginUrl, isHydrated } = useAuthStore();

  if (!isHydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">
        Restoring session…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/70">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/workflows" className="text-lg font-semibold text-white">
            Smart Workflow Dashboard
          </Link>
          <nav className="flex gap-2">
            <NavLink to="/workflows" className={navLinkClass}>
              Workflows
            </NavLink>
            <NavLink to="/settings" className={navLinkClass}>
              Settings
            </NavLink>
          </nav>
          <div className="flex items-center gap-3 text-sm">
            {user ? (
              <>
                <span className="text-slate-300">{user.email}</span>
                <button className="btn-primary" onClick={logout}>
                  Logout
                </button>
              </>
            ) : (
              <a className="btn-primary" href={loginUrl}>
                Login
              </a>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
