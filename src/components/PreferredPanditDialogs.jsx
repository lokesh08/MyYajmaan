import Modal from "./Modal";
import { formatFestivalDate } from "./FestivalDateWarning";
import { t } from "../i18n";

// Popups for a booking started from a Pandit Ji's own page (the
// "preferred" Pandit Ji -- see PujaSlider's toPreferredPandit).

const primaryButton =
  "interactive-button min-h-[44px] rounded-full bg-maroon px-5 py-2 text-sm font-semibold text-white";
const secondaryButton =
  "interactive-button min-h-[44px] rounded-full border border-amber-200 px-5 py-2 text-sm font-semibold text-slate-600 hover:bg-amber-50";

// Address step: the chosen address isn't in the Pandit Ji's PIN code.
//   onUseAddress(address) -> switch to one of the saved addresses that is
//   onAddAddress          -> open "Add a new address" with their PIN filled in
//   onChooseAnother       -> just close and pick another address
//   onChangePandit        -> go on with this address, pick a Pandit Ji later
export function PanditPincodeWarning({ open, pandit, address, matchingAddresses = [], onUseAddress, onAddAddress, onChooseAnother, onChangePandit }) {
  if (!pandit) return null;
  return (
    <Modal open={open} onClose={onChooseAnother} title={t("Pandit Ji not available at this address")} size="sm">
      <div className="space-y-4">
        <p className="text-sm text-slate-700">
          {address?.pincode
            ? t("{name} doesn't serve PIN code {pin}.", { name: pandit.name, pin: address.pincode })
            : t("{name} doesn't serve your selected address.", { name: pandit.name })}{" "}
          {t("Choose an address in PIN code {pin} where {name} serves, or continue with this address and select a different Pandit Ji later.", { pin: pandit.pin, name: pandit.name })}
        </p>

        {matchingAddresses.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase text-amber-700">{t("Your addresses in PIN code {pin}", { pin: pandit.pin })}</p>
            {matchingAddresses.map((addr) => (
              <button
                key={addr.id}
                type="button"
                onClick={() => onUseAddress(addr)}
                className="interactive-button block w-full rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm hover:border-maroon"
              >
                <span className="block font-semibold text-maroon">{t("Use {label}", { label: t(addr.label) })}</span>
                <span className="block text-slate-600">{addr.address_line}, {addr.city} - {addr.pincode}</span>
              </button>
            ))}
          </div>
        ) : null}

        <div className="flex flex-col gap-2">
          <button type="button" onClick={onAddAddress} className={primaryButton}>
            {t("Add a new address in PIN code {pin}", { pin: pandit.pin })}
          </button>
          <button type="button" onClick={onChooseAnother} className={secondaryButton}>
            {t("Choose another saved address")}
          </button>
          <button type="button" onClick={onChangePandit} className={secondaryButton}>
            {t("Keep this address, select a different Pandit Ji later")}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// Date & Time step: the yajmaan picked a date/time the Pandit Ji isn't
// free for.
//   onKeepPandit   -> back to `keep` (a date & time that suits them)
//   onChangePandit -> take the new date & time, pick a Pandit Ji later
export function PanditTimeWarning({ warning, pandit, keep, onKeepPandit, onChangePandit, onClose }) {
  if (!pandit) return null;
  return (
    <Modal open={Boolean(warning)} onClose={onClose} title={t("Pandit Ji not available")} size="sm">
      {warning && (
        <div className="space-y-4">
          <p className="text-sm text-slate-700">
            {t("{name} will not be available on {date} at {time}.", {
              name: pandit.name,
              date: formatFestivalDate(warning.date),
              time: warning.slot?.time || "",
            })}{" "}
            {t("To book this time you'll need to select a different Pandit Ji on the next step.")}
          </p>
          {keep ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
              <p className="text-xs font-semibold uppercase text-amber-700">{t("{name} is available on", { name: pandit.name })}</p>
              <p className="mt-1 font-semibold text-maroon">
                {formatFestivalDate(keep.date)} · {keep.slot.time}
              </p>
            </div>
          ) : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={onChangePandit} className={secondaryButton}>
              {t("Select a different Pandit Ji")}
            </button>
            {keep ? (
              <button type="button" onClick={onKeepPandit} className={primaryButton}>
                {t("Continue with {name}", { name: pandit.name })}
              </button>
            ) : null}
          </div>
        </div>
      )}
    </Modal>
  );
}
