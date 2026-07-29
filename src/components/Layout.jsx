import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { getServiceMode, getServiceModeLabel, SERVICE_MODES, setServiceMode } from '../services/apiClient';

const navItems = [
  { label: 'Home', to: '/' },
  { label: 'Book Puja', to: '/book' },
  { label: 'Dashboard', to: '/dashboard' },
  { label: 'Pandit Ji', to: '/pandit' },
  { label: 'Admin', to: '/admin' },
];

export default function Layout({ children }) {
  const [serviceMode, setServiceModeState] = useState(getServiceMode());

  const handleServiceModeChange = (event) => {
    const nextMode = event.target.value;
    setServiceMode(nextMode);
    setServiceModeState(nextMode);
  };

  return (
    <div className="min-h-screen bg-cream text-slate-800">
      <header className="border-b border-amber-100 bg-white/90 shadow-[0_8px_30px_rgba(122,31,45,0.06)] backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-maroon to-saffron text-xl font-semibold text-white">
              ॐ
            </div>
            <div>
              <p className="font-serif text-xl font-semibold text-maroon">MyYajmaan</p>
              <p className="text-sm text-slate-500">Divine puja booking</p>
            </div>
          </Link>

          <nav className="hidden gap-4 md:flex">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `rounded-full px-4 py-2 text-sm font-medium transition ${isActive ? 'bg-maroon text-white' : 'text-slate-600 hover:bg-amber-100'}`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-4 flex items-center gap-3">
            <label className="hidden items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600 md:flex">
              <span>Mode</span>
              <select
                value={serviceMode}
                onChange={handleServiceModeChange}
                className="rounded-full border border-transparent bg-transparent text-sm font-semibold text-maroon outline-none"
                aria-label="Select service mode"
              >
                {SERVICE_MODES.map((mode) => (
                  <option key={mode} value={mode}>
                    {getServiceModeLabel(mode)}
                  </option>
                ))}
              </select>
            </label>
            <Link to="/login" className="hidden rounded-full px-4 py-2 text-sm font-medium text-maroon hover:bg-amber-50 md:inline-block">
              Login
            </Link>
            <Link to="/register" className="hidden rounded-full bg-saffron px-4 py-2 text-sm font-medium text-white shadow-sm md:inline-block">
              Register
            </Link>
          </div>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
