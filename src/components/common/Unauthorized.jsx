import { Link } from "react-router-dom";

export default function Unauthorized() {
  return (
    <section className="flex min-h-[70vh] items-center justify-center px-6 py-16">
      <div className="w-full max-w-xl rounded-[2rem] border border-amber-100 bg-white p-8 text-center shadow-card">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-amber-50 text-4xl text-maroon">
          🔒
        </div>

        <p className="mt-6 text-sm font-semibold uppercase tracking-[0.2em] text-saffron">
          Access restricted
        </p>

        <h1 className="mt-3 font-serif text-3xl font-semibold text-maroon">
          You are not authorized
        </h1>

        <p className="mt-3 text-slate-600">
          You do not have permission to access this page.
        </p>

        <Link
          to="/"
          title="Back to Home"
          className="mt-6 inline-flex rounded-full bg-maroon px-6 py-3 font-semibold text-white"
        >
          Back to Home
        </Link>
      </div>
    </section>
  );
}