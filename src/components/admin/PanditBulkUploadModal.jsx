import { useRef, useState } from "react";

import Modal from "../Modal";
import { bulkUploadPandits, getPanditBulkTemplateUrl } from "../../services/adminApi";
import { showError, showSuccess } from "../../utils/toaster";

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    window.prompt("Copy this value", text);
    return false;
  }
}

export default function PanditBulkUploadModal({ open, onClose, onUploaded }) {
  const fileInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState(null);
  const [results, setResults] = useState(null);

  function reset() {
    setFile(null);
    setErrors(null);
    setResults(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleUpload() {
    if (!file) {
      showError("Please choose the filled spreadsheet to upload.");
      return;
    }
    setLoading(true);
    setErrors(null);
    setResults(null);
    try {
      const data = await bulkUploadPandits(file);
      setResults(data);
      if (data.created?.length) {
        showSuccess(`${data.created.length} Pandit Ji account(s) created.`);
        onUploaded?.();
      }
    } catch (error) {
      const rowErrors = error?.data?.detail?.errors;
      if (Array.isArray(rowErrors) && rowErrors.length) {
        setErrors(rowErrors);
      } else {
        showError(error?.data?.detail?.message || error?.message || "Could not upload this spreadsheet.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleCopyAllCreated() {
    const lines = (results?.created || []).map((row) => `${row.name}\t${row.email}\t${row.temporary_password}`);
    await copyText(lines.join("\n"));
    showSuccess("Copied to clipboard.");
  }

  return (
    <Modal open={open} onClose={handleClose} title="Bulk upload Pandit Ji" size="lg">
      <div className="space-y-5">
        {!results && (
          <>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-600">
              <li>
                Download the template and fill one row per Pandit Ji.{" "}
                <a
                  href={getPanditBulkTemplateUrl()}
                  title="Download the Pandit Ji upload spreadsheet template"
                  className="font-semibold text-maroon hover:text-saffron"
                >
                  Download template (.xlsx)
                </a>
              </li>
              <li>Save the file without changing any column, then upload the same file below.</li>
              <li>
                Each row is created as a pending Pandit Ji (not auto-approved) with a temporary password -- share
                that password with them directly. They'll log in with it, set their own password, complete
                Aadhaar authentication, and upload a photo and bank details -- then you review and approve them
                from the Pending tab, same as any other registration.
              </li>
            </ol>

            <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50/40 p-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx"
                onChange={(event) => setFile(event.target.files?.[0] || null)}
                className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-full file:border-0 file:bg-maroon file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-maroon"
              />
            </div>

            {errors && (
              <div className="max-h-64 overflow-y-auto rounded-xl border border-rose-200 bg-rose-50">
                <p className="px-4 pt-3 text-sm font-semibold text-rose-700">
                  This spreadsheet has {errors.length} error{errors.length === 1 ? "" : "s"}. Nothing was uploaded.
                </p>
                <table className="w-full text-left text-xs">
                  <thead className="text-rose-500">
                    <tr>
                      <th className="px-4 py-1.5 font-medium">Row</th>
                      <th className="px-4 py-1.5 font-medium">Field</th>
                      <th className="px-4 py-1.5 font-medium">Issue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {errors.map((err, index) => (
                      <tr key={index} className="border-t border-rose-100">
                        <td className="px-4 py-1.5 text-rose-700">{err.row}</td>
                        <td className="px-4 py-1.5 text-rose-700">{err.field}</td>
                        <td className="px-4 py-1.5 text-rose-700">{err.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={handleClose}
                className="interactive-button rounded-full border border-amber-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-amber-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpload}
                disabled={loading}
                className="interactive-button rounded-full bg-maroon px-4 py-2 text-sm font-semibold text-white hover:bg-maroon disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Uploading..." : "Upload"}
              </button>
            </div>
          </>
        )}

        {results && (
          <>
            {results.created?.length > 0 && (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold text-emerald-700">
                    {results.created.length} account(s) created -- share each temporary password with its Pandit Ji.
                  </p>
                  <button
                    type="button"
                    onClick={handleCopyAllCreated}
                    className="interactive-button rounded-full border border-amber-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-amber-50"
                  >
                    Copy all
                  </button>
                </div>
                <div className="max-h-72 overflow-y-auto rounded-xl border border-emerald-200">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-emerald-50 text-emerald-700">
                      <tr>
                        <th className="px-4 py-2 font-medium">Name</th>
                        <th className="px-4 py-2 font-medium">Email</th>
                        <th className="px-4 py-2 font-medium">Temporary Password</th>
                        <th className="px-4 py-2 font-medium" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-emerald-100">
                      {results.created.map((row) => (
                        <tr key={row.email}>
                          <td className="px-4 py-2 text-slate-700">{row.name}</td>
                          <td className="px-4 py-2 text-slate-700">{row.email}</td>
                          <td className="px-4 py-2 font-mono text-slate-700">{row.temporary_password}</td>
                          <td className="px-4 py-2">
                            <button
                              type="button"
                              onClick={() => copyText(`${row.email}\t${row.temporary_password}`).then(() => showSuccess("Copied."))}
                              className="text-xs font-semibold text-maroon hover:text-saffron"
                            >
                              Copy
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {results.failed?.length > 0 && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
                <p className="mb-1 text-sm font-semibold text-rose-700">
                  {results.failed.length} row(s) could not be created:
                </p>
                <ul className="list-disc space-y-0.5 pl-5 text-xs text-rose-700">
                  {results.failed.map((row) => (
                    <li key={row.row}>
                      Row {row.row} ({row.email}): {row.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={reset}
                className="interactive-button rounded-full border border-amber-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-amber-50"
              >
                Upload another sheet
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="interactive-button rounded-full bg-maroon px-4 py-2 text-sm font-semibold text-white hover:bg-maroon"
              >
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
