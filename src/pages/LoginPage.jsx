import { useState } from 'react';
import { Link } from 'react-router-dom';
import ThemeDialog from '../components/ThemeDialog';
import ThemeNotice from '../components/ThemeNotice';
import { authBackgrounds } from '../constants/visualAssets';

const backgroundImage = authBackgrounds.login;

export default function LoginPage() {
  const [dialog, setDialog] = useState({ open: false, title: '', message: '' });
  const [notice, setNotice] = useState('');

  function handleLogin() {
    setNotice('Use the themed auth shell here to connect your real sign-in API or Supabase auth flow.');
    setDialog({
      open: true,
      title: 'Login preview',
      message: 'This is the themed app login flow. Add your auth API or Supabase sign-in logic here.',
    });
  }

  return (
    <section className="mx-auto max-w-6xl px-6 py-10 lg:px-8">
      <div className="grid overflow-hidden rounded-[2rem] border border-amber-100 bg-white shadow-sm lg:grid-cols-[0.95fr_1.05fr]">
        <div className="relative min-h-[320px] overflow-hidden bg-maroon p-8 text-white lg:min-h-[520px]">
          <img src={backgroundImage} alt="festival background" className="absolute inset-0 h-full w-full object-cover opacity-30" />
          <div className="absolute inset-0 bg-gradient-to-br from-[#631425] via-[#7b1c2e]/70 to-[#dc9418]/80" />
          <div className="relative flex h-full flex-col justify-between">
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 text-2xl">ॐ</div>
              <p className="mt-4 text-sm font-semibold uppercase tracking-[0.2em] text-amber-100">MyYajmaan</p>
              <h1 className="mt-3 max-w-md font-serif text-3xl font-semibold leading-tight">Your spiritual booking account</h1>
              <p className="mt-3 max-w-md text-sm leading-6 text-amber-50">Track bookings, rewards, and priest availability in one calm, premium experience.</p>
            </div>

            <div className="grid gap-3 rounded-2xl bg-white/10 p-4 backdrop-blur-sm">
              <div className="rounded-xl bg-white/10 px-3 py-2 text-sm">• Book verified pandits with guided rituals</div>
              <div className="rounded-xl bg-white/10 px-3 py-2 text-sm">• View rewards, wallet benefits, and upcoming pujas</div>
              <div className="rounded-xl bg-white/10 px-3 py-2 text-sm">• Manage your service requests in one place</div>
            </div>
          </div>
        </div>

        <div className="p-8 lg:p-10">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-saffron">Account</p>
          <h2 className="mt-2 font-serif text-3xl font-semibold text-maroon">Welcome back</h2>
          <p className="mt-2 text-sm text-slate-600">Sign in to manage your pujas, wallet rewards, and booking history.</p>

          <div className="mt-6 grid gap-4">
            <input className="rounded-xl border border-amber-100 px-4 py-3" placeholder="Mobile number or email" />
            <input type="password" className="rounded-xl border border-amber-100 px-4 py-3" placeholder="Password" />
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button onClick={handleLogin} className="rounded-full bg-maroon px-5 py-3 font-semibold text-white">Login</button>
            <Link to="/register" className="rounded-full border border-amber-200 px-5 py-3 font-semibold text-slate-700">Create account</Link>
          </div>

          {notice && <ThemeNotice type="info" title="Auth preview" message={notice} />}
        </div>
      </div>

      <ThemeDialog
        open={dialog.open}
        title={dialog.title}
        message={dialog.message}
        onClose={() => setDialog((prev) => ({ ...prev, open: false }))}
      />
    </section>
  );
}
