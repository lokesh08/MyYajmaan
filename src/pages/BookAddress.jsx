import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import BookingStepper, { PACKAGE_STEPS } from '../components/BookingStepper';
import BookingFrame from '../components/BookingFrame';
import Modal from '../components/Modal';
import ThemeDialog from '../components/ThemeDialog';
import ThemeNotice from '../components/ThemeNotice';
import { getBookingDraft, saveBookingDraft } from '../utils/bookingFlowStorage';
import { useAuth } from '../context/AuthContext';
import { addMyAddress, listCities, listMyAddresses } from '../services/clientApi';
import { showError, showSuccess } from '../utils/toaster';

const emptyNewAddress = { label: '', address_line: '', state: '', city: '', pincode: '' };

export default function BookAddress() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const draft = getBookingDraft();
  const preserved = state?.date ? state : draft;

  const [contact, setContact] = useState(() => ({
    name: preserved?.address?.name || profile?.full_name || '',
    phone: preserved?.address?.phone || profile?.phone || '',
  }));
  const [note, setNote] = useState(() => preserved?.address?.note || '');
  const [dialog, setDialog] = useState({ open: false, title: '', message: '' });
  const [notice, setNotice] = useState('');

  const [savedAddresses, setSavedAddresses] = useState([]);
  const [loadingAddresses, setLoadingAddresses] = useState(true);
  const [addressesFailed, setAddressesFailed] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState(() => preserved?.address?.savedAddressId || null);

  // Fallback free-text form -- only used if the address book couldn't
  // be loaded at all, since this step is reached exclusively by a
  // logged-in customer (see RoleRoute's booking-flow login gate).
  const [fallbackForm, setFallbackForm] = useState(() => ({
    address: preserved?.address?.address || '',
    city: preserved?.address?.city || '',
    pin: preserved?.address?.pin || '',
  }));

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newAddress, setNewAddress] = useState(emptyNewAddress);
  const [cities, setCities] = useState([]);
  const [savingAddress, setSavingAddress] = useState(false);

  function loadAddresses() {
    setLoadingAddresses(true);
    setAddressesFailed(false);
    return listMyAddresses()
      .then((data) => {
        const addresses = data?.items || [];
        setSavedAddresses(addresses);
        return addresses;
      })
      .catch(() => {
        setAddressesFailed(true);
        return [];
      })
      .finally(() => setLoadingAddresses(false));
  }

  useEffect(() => {
    loadAddresses().then((addresses) => {
      const preselected = addresses.find((a) => a.id === selectedAddressId);
      const defaultAddress = preselected || addresses.find((a) => a.is_default) || addresses[0];
      if (defaultAddress) setSelectedAddressId(defaultAddress.id);
    });
    listCities()
      .then((data) => setCities(Array.isArray(data) ? data : []))
      .catch(() => setCities([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const states = useMemo(() => [...new Set(cities.map((c) => c.state))].sort(), [cities]);
  const citiesForState = useMemo(
    () => cities.filter((c) => c.state === newAddress.state).sort((a, b) => a.name.localeCompare(b.name)),
    [cities, newAddress.state],
  );

  const { date, slot, puja, pandit } = preserved || {};

  if (!date || !slot) {
    return (
      <section className="mx-auto max-w-3xl px-6 py-10">
        <p className="text-slate-600">Incomplete booking data. Please complete the earlier steps first.</p>
      </section>
    );
  }

  function updateContact(key, value) {
    setContact((prev) => ({ ...prev, [key]: value }));
    setNotice('');
  }

  async function handleAddAddress(event) {
    event.preventDefault();
    if (!newAddress.label || !newAddress.address_line || !newAddress.state || !newAddress.city || !newAddress.pincode) {
      showError('Please fill in every field to save this address.');
      return;
    }

    setSavingAddress(true);
    try {
      const result = await addMyAddress(newAddress);
      showSuccess('Address saved.');
      setAddModalOpen(false);
      setNewAddress(emptyNewAddress);
      const addresses = await loadAddresses();
      const created = result?.address;
      if (created) {
        setSelectedAddressId(created.id);
      } else {
        const latest = addresses[0];
        if (latest) setSelectedAddressId(latest.id);
      }
    } catch (error) {
      showError(error?.data?.detail?.message || error?.message || 'Could not save this address. Please try again.');
    } finally {
      setSavingAddress(false);
    }
  }

  function handleNext() {
    if (!contact.name || !contact.phone) {
      setNotice('Please enter your name and mobile number before continuing.');
      return;
    }

    let bookingAddress;
    if (savedAddresses.length > 0) {
      const selected = savedAddresses.find((a) => a.id === selectedAddressId);
      if (!selected) {
        setNotice('Please select an address to continue.');
        return;
      }
      bookingAddress = {
        ...contact,
        note,
        address: selected.address_line,
        city: selected.city,
        state: selected.state,
        pin: selected.pincode,
        savedAddressId: selected.id,
      };
    } else {
      if (!fallbackForm.address || !fallbackForm.city || !fallbackForm.pin) {
        setNotice('Please fill in your address, city, and pin code before continuing.');
        return;
      }
      bookingAddress = { ...contact, note, ...fallbackForm };
    }

    saveBookingDraft({ date, slot, puja, pandit, address: bookingAddress });

    if (puja?.pujaType === 'package') {
      navigate('/book/package/details', {
        state: { date, slot, puja, address: bookingAddress },
      });
      return;
    }

    navigate('/book/select-pandit', {
      state: { date, slot, puja, address: bookingAddress },
    });
  }

  return (
    <BookingFrame
      title="Address & Contact"
      description="Enter the address and contact details for your puja."
      accentImage={puja?.image || undefined}
      asideTitle="Service summary"
      asideItems={[
        { label: `Ritual: ${puja?.title || 'Selected puja'}` },
        { label: `Date: ${date}` },
        { label: `Time: ${slot?.time || ''}` },
      ]}
    >
      <BookingStepper currentStep={3} steps={puja?.pujaType === 'package' ? PACKAGE_STEPS : undefined} />
      <p className="mt-2 text-sm text-slate-600">Ritual: <strong>{puja?.title || 'Selected puja'}</strong></p>

      <div className="mt-6">
        <div className="grid gap-4 md:grid-cols-2">
          <input value={contact.name} onChange={(e) => updateContact('name', e.target.value)} placeholder="Full name" className="rounded-[1.1rem] border border-amber-100 bg-gradient-to-r from-amber-50/70 to-white px-3 py-2 shadow-sm transition focus:border-maroon focus:outline-none" />
          <input value={contact.phone} onChange={(e) => updateContact('phone', e.target.value)} placeholder="Mobile number" className="rounded-[1.1rem] border border-amber-100 bg-gradient-to-r from-amber-50/70 to-white px-3 py-2 shadow-sm transition focus:border-maroon focus:outline-none" />
        </div>

        <div className="mt-6">
          <p className="mb-2 text-sm font-semibold text-slate-700">Delivery Address</p>

          {loadingAddresses && <p className="text-sm text-slate-500">Loading your saved addresses…</p>}

          {!loadingAddresses && savedAddresses.length > 0 && (
            <div role="radiogroup" aria-label="Choose an address" className="grid gap-3 sm:grid-cols-2">
              {savedAddresses.map((addr) => (
                <label
                  key={addr.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-[1.1rem] border p-3 text-left text-sm transition ${
                    selectedAddressId === addr.id
                      ? 'border-maroon bg-amber-50/60 shadow-sm'
                      : 'border-amber-100 bg-white hover:border-amber-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="booking-address"
                    value={addr.id}
                    checked={selectedAddressId === addr.id}
                    onChange={() => setSelectedAddressId(addr.id)}
                    className="mt-1 h-4 w-4 shrink-0 text-maroon focus:ring-amber-200"
                  />
                  <span>
                    <span className="block font-semibold text-maroon">{addr.label}{addr.is_default ? ' (Default)' : ''}</span>
                    <span className="mt-1 block text-slate-600">{addr.address_line}</span>
                    <span className="block text-slate-500">{addr.city}, {addr.state} - {addr.pincode}</span>
                  </span>
                </label>
              ))}
            </div>
          )}

          {!loadingAddresses && savedAddresses.length === 0 && !addressesFailed && (
            <p className="mb-3 text-sm text-slate-500">You don't have any saved addresses yet -- add one below.</p>
          )}

          {!loadingAddresses && (
            <button
              type="button"
              onClick={() => setAddModalOpen(true)}
              className="interactive-button mt-3 rounded-[1.1rem] border border-dashed border-amber-200 bg-white px-4 py-3 text-left text-sm font-semibold text-maroon hover:border-maroon"
            >
              + Add new address
            </button>
          )}

          {!loadingAddresses && addressesFailed && savedAddresses.length === 0 && (
            <div className="mt-4 grid gap-4">
              <p className="text-sm text-slate-500">We couldn't load your saved addresses -- enter one below for this booking.</p>
              <textarea
                value={fallbackForm.address}
                onChange={(e) => setFallbackForm((prev) => ({ ...prev, address: e.target.value }))}
                placeholder="House/Flat number, street, locality"
                className="min-h-28 w-full rounded-[1.1rem] border border-amber-100 bg-gradient-to-r from-amber-50/70 to-white px-3 py-2 shadow-sm transition focus:border-maroon focus:outline-none"
              />
              <div className="grid gap-4 md:grid-cols-2">
                <input value={fallbackForm.city} onChange={(e) => setFallbackForm((prev) => ({ ...prev, city: e.target.value }))} placeholder="City" className="rounded-[1.1rem] border border-amber-100 bg-gradient-to-r from-amber-50/70 to-white px-3 py-2 shadow-sm transition focus:border-maroon focus:outline-none" />
                <input value={fallbackForm.pin} onChange={(e) => setFallbackForm((prev) => ({ ...prev, pin: e.target.value }))} placeholder="Pin code" className="rounded-[1.1rem] border border-amber-100 bg-gradient-to-r from-amber-50/70 to-white px-3 py-2 shadow-sm transition focus:border-maroon focus:outline-none" />
              </div>
            </div>
          )}
        </div>

        <textarea
          value={note}
          onChange={(e) => { setNote(e.target.value); setNotice(''); }}
          placeholder="Special instructions for the priest / puja timing"
          className="mt-4 min-h-24 w-full rounded-[1.1rem] border border-amber-100 bg-gradient-to-r from-amber-50/70 to-white px-3 py-2 shadow-sm transition focus:border-maroon focus:outline-none"
        />

        {notice && <ThemeNotice type="error" title="Need a quick check" message={notice} />}

        <div className="mt-6 flex gap-3">
          <button onClick={handleNext} className="min-h-[44px] interactive-button rounded-full bg-saffron px-5 py-2 font-semibold text-white shadow-sm transition hover:bg-amber-500">
            {puja?.pujaType === 'package' ? 'Next: Requirements' : 'Next: Select Pandit'}
          </button>
          <button onClick={() => navigate(-1)} className="min-h-[44px] interactive-button rounded-full border border-amber-200 bg-white px-5 py-2 text-slate-700 hover:border-maroon hover:text-maroon">Back</button>
        </div>
      </div>

      <Modal open={addModalOpen} onClose={() => setAddModalOpen(false)} title="Add a new address">
        <form onSubmit={handleAddAddress} className="grid gap-3">
          <input
            value={newAddress.label}
            onChange={(e) => setNewAddress((prev) => ({ ...prev, label: e.target.value }))}
            placeholder="Label (e.g. Home, Office)"
            className="rounded-xl border border-amber-100 px-3 py-2 text-sm outline-none focus:border-maroon"
          />
          <textarea
            value={newAddress.address_line}
            onChange={(e) => setNewAddress((prev) => ({ ...prev, address_line: e.target.value }))}
            placeholder="House/Flat number, street, locality"
            className="min-h-20 rounded-xl border border-amber-100 px-3 py-2 text-sm outline-none focus:border-maroon"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <select
              value={newAddress.state}
              onChange={(e) => setNewAddress((prev) => ({ ...prev, state: e.target.value, city: '' }))}
              title="Select state"
              className="rounded-xl border border-amber-100 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-maroon"
            >
              <option value="">Select State</option>
              {states.map((st) => <option key={st} value={st}>{st}</option>)}
            </select>
            <select
              value={newAddress.city}
              onChange={(e) => setNewAddress((prev) => ({ ...prev, city: e.target.value }))}
              disabled={!newAddress.state}
              title={newAddress.state ? 'Select city' : 'Select a state first'}
              className="rounded-xl border border-amber-100 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-maroon disabled:bg-slate-50"
            >
              <option value="">{newAddress.state ? 'Select City' : 'Select a state first'}</option>
              {citiesForState.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>
          <input
            value={newAddress.pincode}
            onChange={(e) => setNewAddress((prev) => ({ ...prev, pincode: e.target.value }))}
            placeholder="Pin code"
            className="rounded-xl border border-amber-100 px-3 py-2 text-sm outline-none focus:border-maroon"
          />

          <div className="mt-2 flex gap-3">
            <button
              type="submit"
              disabled={savingAddress}
              className="min-h-[44px] interactive-button rounded-full bg-maroon px-5 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingAddress ? 'Saving...' : 'Save address'}
            </button>
            <button
              type="button"
              onClick={() => setAddModalOpen(false)}
              className="min-h-[44px] rounded-full border border-amber-200 bg-white px-5 py-2 text-sm font-semibold text-slate-700"
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>

      <ThemeDialog
        open={dialog.open}
        title={dialog.title}
        message={dialog.message}
        onClose={() => setDialog((prev) => ({ ...prev, open: false }))}
      />
    </BookingFrame>
  );
}
