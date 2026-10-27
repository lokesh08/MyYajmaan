import { optimizedImage } from "../../utils/image";

export default function FullScreenLoader({
  open,
  message = "Please wait...",
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/35 px-6 backdrop-blur-[3px]">
      <div className="w-full max-w-sm rounded-3xl border border-white/60 bg-white/85 p-8 text-center shadow-2xl backdrop-blur-xl">
        <div className="mx-auto h-16 w-16 overflow-hidden rounded-full shadow-lg">
          <img src={optimizedImage("/images/logo-mark.png")} alt="MyYajmaan" className="h-full w-full animate-pulse object-cover" />
        </div>

        <div className="mt-5 flex justify-center gap-2">
          <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-maroon-dark" />
          <span
            className="h-2.5 w-2.5 animate-bounce rounded-full bg-marigold"
            style={{ animationDelay: "150ms" }}
          />
          <span
            className="h-2.5 w-2.5 animate-bounce rounded-full bg-maroon-dark"
            style={{ animationDelay: "300ms" }}
          />
        </div>

        <p className="mt-5 text-base font-semibold text-maroon-dark">
          {message}
        </p>

        <p className="mt-2 text-sm text-slate-500">
          Please wait while we securely complete your request.
        </p>
      </div>
    </div>
  );
}