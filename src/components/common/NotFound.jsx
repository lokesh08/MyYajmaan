import { Link } from "react-router-dom";

import Seo from "../Seo";

export default function NotFound({
  title = "Page not found",
  message = "The page or record you are looking for does not exist.",
}) {
  return (
    <section className="flex min-h-[70vh] items-center justify-center px-6 py-16">
      {/* A missing page or record must never be indexed. */}
      <Seo title={title} description={message} noindex priority={3} />
      <div className="w-full max-w-xl rounded-[2rem] border border-amber-100 bg-white p-8 text-center shadow-card">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-amber-50 font-serif text-4xl font-bold text-saffron">
          404
        </div>

        <p className="mt-6 text-sm font-semibold uppercase tracking-[0.2em] text-saffron">
          Not found
        </p>

        <h1 className="mt-3 font-serif text-3xl font-semibold text-maroon">
          {title}
        </h1>

        <p className="mt-3 text-slate-600">
          {message}
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