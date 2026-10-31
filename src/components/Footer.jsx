import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import MandalaMotif from "./common/MandalaMotif";
import { optimizedImage } from "../utils/image";
import { get } from "../api";
import { SOCIAL_ICONS } from "../constants/socialIcons";

const mainLinks = [
  { label: "Home", to: "/" },
  { label: "Book a Puja", to: "/book" },
  { label: "Contact Us", to: "/contact-us" },
  { label: "Help Center", to: "/help-center" },
  { label: "Privacy Policy", to: "/privacy-policy" },
  { label: "Terms and Conditions", to: "/terms-and-conditions" },
  { label: "Cancellation & Refund", to: "/cancellation-refund" },
  { label: "Login", to: "/login" },
];

// Real brand icons live in public/images/social-icons -- Email is
// deliberately not included here: the footer already has a working
// mailto: link in the "Need assistance?" column just below, so a second
// email icon in this row would just duplicate it.
//
// Each icon's href comes from GET /settings/social-links (admin-
// editable from Admin > Settings > Social Media Links). Until an
// admin fills in a given platform's URL, it stays "#" so the icon
// shows but doesn't link anywhere broken.
const socialLinksBase = [
  { label: "Instagram", icon: SOCIAL_ICONS.instagram, key: "instagram" },
  { label: "Facebook", icon: SOCIAL_ICONS.facebook, key: "facebook" },
  { label: "WhatsApp", icon: SOCIAL_ICONS.whatsapp, key: "whatsapp" },
  { label: "X (Twitter)", icon: SOCIAL_ICONS.x_twitter, key: "x_twitter" },
  { label: "LinkedIn", icon: SOCIAL_ICONS.linkedin, key: "linkedin" },
  { label: "YouTube", icon: SOCIAL_ICONS.youtube, key: "youtube" },
  { label: "Threads", icon: SOCIAL_ICONS.threads, key: "threads" },
];

export default function Footer() {
  const [socialLinkUrls, setSocialLinkUrls] = useState({});

  useEffect(() => {
    get("/settings/social-links")
      .then((data) => setSocialLinkUrls(data || {}))
      .catch(() => {});
  }, []);

  const socialLinks = socialLinksBase.map((social) => ({
    ...social,
    href: socialLinkUrls[social.key] || "#",
  }));

  return (
    <footer className="relative mt-12 overflow-hidden bg-gradient-to-br from-maroon-deeper via-maroon-dark to-maroon-deep text-white shadow-sheet-up">
      {/* beaded gold border, mirroring the header so the page is framed top and bottom */}
      <div
        className="pointer-events-none h-2 opacity-80"
        style={{
          backgroundImage:
            "radial-gradient(circle, var(--color-sand) 0 2px, transparent 2.6px)",
          backgroundSize: "16px 16px",
          backgroundPosition: "center",
        }}
      />
      <div className="pointer-events-none absolute inset-x-0 top-2 h-px bg-gradient-to-r from-transparent via-saffron/70 to-transparent" />

      <div className="relative mx-auto max-w-7xl px-6 py-12 lg:px-8">
        <div className="pointer-events-none absolute inset-0 bg-vignette" />

        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-saffron/20 blur-3xl" />

        <div className="pointer-events-none absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-rose-300/10 blur-3xl" />

        {/* faint sacred-geometry watermarks */}
        <MandalaMotif className="pointer-events-none absolute -bottom-16 -right-10 h-80 w-80 rotate-12 text-amber-200/[0.08]" />
        <MandalaMotif className="pointer-events-none absolute -left-16 -top-20 hidden h-56 w-56 -rotate-6 text-amber-200/[0.06] md:block" />

        <div className="relative grid gap-10 md:grid-cols-[1.25fr_0.8fr_0.95fr] lg:gap-16">
          <div>
            <Link
              to="/"
              title="MyYajmaan home"
              className="inline-flex items-center gap-3"
            >
              <span className="block h-14 w-14 overflow-hidden rounded-full shadow-lg">
                <img loading="lazy" decoding="async" src={optimizedImage("/images/logo-mark.png")} alt="MyYajmaan" className="h-full w-full object-cover" />
              </span>

              <span>
                <span className="block font-serif text-2xl font-semibold">
                  MyYajmaan
                </span>

                <span className="block text-xs uppercase tracking-[0.24em] text-amber-200">
                  Divine puja booking
                </span>
              </span>
            </Link>

            <p className="mt-6 max-w-md text-sm leading-7 text-amber-50/85">
              Bringing trusted pandits, meaningful rituals, and peaceful booking experiences closer to every family.
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target={social.href !== "#" ? "_blank" : undefined}
                  rel={social.href !== "#" ? "noopener noreferrer" : undefined}
                  aria-label={social.label}
                  title={social.label}
                  className="interactive-button flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl shadow-sm transition hover:-translate-y-1 hover:scale-105 hover:shadow-lg"
                >
                  <img
                    src={social.icon}
                    alt=""
                    aria-hidden="true"
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover"
                  />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h2 className="font-serif text-xl font-semibold text-white">
              Explore MyYajmaan
            </h2>

            <div className="mt-5 grid gap-3">
              {mainLinks.map((link) => (
                <Link
                  key={link.label}
                  to={link.to}
                  title={link.label}
                  className="group flex items-center gap-2 text-sm text-amber-50/85 transition hover:text-white"
                >
                  <span className="text-saffron transition group-hover:translate-x-1">
                    ›
                  </span>

                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <h2 className="font-serif text-xl font-semibold text-white">
              Need assistance?
            </h2>

            <p className="mt-5 text-sm leading-6 text-amber-50/85">
              Our support team is here to help you choose a puja and complete your booking.
            </p>

            <div className="mt-5 grid gap-3 text-sm">
              <a
                href="mailto:support@myyajmaan.com"
                title="Email MyYajmaan support"
                className="text-amber-100 transition hover:text-white"
              >
                support@myyajmaan.com
              </a>

              <Link
                to="/book"
                title="Start a puja booking"
                className="interactive-button inline-flex w-fit rounded-full bg-saffron px-5 py-2.5 font-semibold text-maroon hover:bg-amber-200 hover:shadow-lg"
              >
                Start a booking
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-white/15 px-6 py-5 text-center text-sm text-amber-100/80">
        © {new Date().getFullYear()} MyYajmaan. All rights reserved.
      </div>
    </footer>
  );
}