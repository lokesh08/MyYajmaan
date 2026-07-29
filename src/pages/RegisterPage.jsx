import { useState } from 'react';
import { Link } from 'react-router-dom';
import ThemeDialog from '../components/ThemeDialog';
import ThemeNotice from '../components/ThemeNotice';
import { authBackgrounds } from '../constants/visualAssets';

const backgroundImage = authBackgrounds.register;

export default function RegisterPage() {
  const [dialog, setDialog] = useState({ open: false, title: '', message: '' });
  const [notice, setNotice] = useState('');

  function handleRegister() {
    setNotice('Use the themed account shell here to connect your real registration API or Supabase auth flow.');
    setDialog({
      open: true,
      title: 'Registration preview',
      message: 'This is the themed app registration flow. Connect it to your auth provider or Supabase auth next.',
    });
  }

  return (
    <section className="mx-auto max-w-6xl px-6 py-10 lg:px-8">
      <div className="grid overflow-hidden rounded-[2rem] border border-amber-100 bg-white shadow-sm lg:grid-cols-[0.95fr_1.05fr]">
        <div className="relative min-h-[320px] overflow-hidden bg-maroon p-8 text-white lg:min-h-[560px]">
          <img src={backgroundImage} alt="festival background" className="absolute inset-0 h-full w-full object-cover opacity-30" />
          <div className="absolute inset-0 bg-gradient-to-br from-[#3f1e13] via-[#641c2d]/75 to-[#e1a116]/80" />
          <div className="relative flex h-full flex-col justify-between">
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 text-2xl">ॐ</div>
              <p className="mt-4 text-sm font-semibold uppercase tracking-[0.2em] text-amber-100">Join MyYajmaan</p>
              <h1 className="mt-3 max-w-md font-serif text-3xl font-semibold leading-tight">Create your spiritual booking profile</h1>
              <p className="mt-3 max-w-md text-sm leading-6 text-amber-50">Sign up to unlock puja discovery, trusted pandit matching, and festive booking rewards.</p>
            </div>

            <div className="grid gap-3 rounded-2xl bg-white/10 p-4 backdrop-blur-sm">
              <div className="rounded-xl bg-white/10 px-3 py-2 text-sm">• Find the right priest for every sacred occasion</div>
              <div className="rounded-xl bg-white/10 px-3 py-2 text-sm">• Save preferences for repeat bookings and rituals</div>
              <div className="rounded-xl bg-white/10 px-3 py-2 text-sm">• Get access to premium offers and wallet rewards</div>
            </div>
          </div>
        </div>

        <div className="p-8 lg:p-10">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-saffron">Account</p>
          <h2 className="mt-2 font-serif text-3xl font-semibold text-maroon">Register for MyYajmaan</h2>
          <p className="mt-2 text-sm text-slate-600">Create your account to book trusted pandits and unlock special rewards.</p>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <input className="rounded-xl border border-amber-100 px-4 py-3" placeholder="Full name" />
            <input className="rounded-xl border border-amber-100 px-4 py-3" placeholder="Mobile number" />
            <input className="rounded-xl border border-amber-100 px-4 py-3 md:col-span-2" placeholder="Email address" />
            <input type="password" className="rounded-xl border border-amber-100 px-4 py-3" placeholder="Password" />
            <input type="password" className="rounded-xl border border-amber-100 px-4 py-3" placeholder="Confirm password" />
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button onClick={handleRegister} className="rounded-full bg-saffron px-5 py-3 font-semibold text-white">Create account</button>
            <Link to="/login" className="rounded-full border border-amber-200 px-5 py-3 font-semibold text-slate-700">Already have an account?</Link>
          </div>

          {notice && <ThemeNotice type="info" title="Account setup" message={notice} />}
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
