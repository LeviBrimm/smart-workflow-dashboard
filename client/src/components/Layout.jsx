import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore.js';

const navLinkClass = ({ isActive }) =>
  `rounded-md px-3 py-2 text-sm font-medium ${
    isActive ? 'bg-[#d0c1b3] text-[#1f1c1a]' : 'text-[#7a6a5d] hover:text-[#1f1c1a]'
  }`;

const Layout = () => {
  const { user, logout, loginUrl, isHydrated } = useAuthStore();

  if (!isHydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f2ebe3] text-[#7a6a5d]">
        Restoring session…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f2ebe3] text-[#1f1c1a]">
      <header className="border-b border-[#dbcbb9] bg-white/80 shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/workflows" className="text-lg font-semibold text-[#1f1c1a]">
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
          <div className="flex items-center gap-3 text-sm text-[#5c3d2e]">
            {user ? (
              <>
                <span>{user.email}</span>
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
