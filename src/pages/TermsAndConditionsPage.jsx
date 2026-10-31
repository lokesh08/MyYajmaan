import { formatCmsUpdatedAt, useCmsContent } from "../hooks/use-cms-content";
import { optimizedImage } from "../utils/image";
import { t } from "../i18n";

const sections = [
  { title: "1. Acceptance of Terms", body: "By creating an account or using MyYajmaan, you agree to be bound by these Terms and Conditions and our Privacy Policy. If you do not agree, please do not use our services." },
  { title: "2. Who Can Use MyYajmaan", body: "You must be at least 18 years old and able to enter into a binding agreement to register as a customer or a Pandit Ji. Information you provide during registration must be accurate and kept up to date." },
  { title: "3. Bookings and Payments", body: "When you book a puja, you agree to pay the listed amount (plus any applicable coupon adjustments or fees). Bookings are subject to Pandit Ji availability and confirmation. Reschedule and cancellation fees, where applicable, are shown before you confirm the action." },
  { title: "4. Pandit Ji Registration and Conduct", body: "Pandit Ji accounts are subject to admin review and approval before becoming visible for booking. Pandits are expected to conduct services professionally, arrive as scheduled, and keep their profile, pricing, and documents accurate." },
  { title: "5. Wallet and Referral Rewards", body: "Wallet balances, signup bonuses, and referral rewards are provided at MyYajmaan's discretion and may be adjusted, capped, or withdrawn in cases of misuse, fraud, or abuse of the referral program." },
  { title: "6. Cancellations and Refunds", body: "Cancellation and refund terms are shown at the time of cancellation and may vary based on how close to the scheduled puja the request is made. See our Cancellation & Refund Policy for full details." },
  { title: "7. User Conduct", body: "You agree not to misuse the platform, submit false information, impersonate another person, or interfere with the normal operation of the service. We may suspend or terminate accounts that violate these terms." },
  { title: "8. Limitation of Liability", body: "MyYajmaan facilitates connections between customers and Pandit Jis but is not responsible for the religious, ritual, or personal outcomes of a puja. Our liability is limited to the amount paid for the specific booking in question." },
  { title: "9. Changes to These Terms", body: "We may update these Terms and Conditions from time to time. The updated version will be posted on this page with its effective date. Continued use of the service after an update means you accept the revised terms." },
  { title: "10. Contact Us", body: "If you have questions about these Terms and Conditions, please reach out to our support team via the Contact Us page." },
];

export default function TermsAndConditionsPage() {
  const { content, updatedAt } = useCmsContent("terms-and-conditions", null);
  const title = content?.title || "Terms and Conditions";
  const description = content?.description || "The rules and agreements that govern your use of MyYajmaan.";

  return (
    <section className="min-h-screen bg-cream pb-14">
      <div className="mx-auto max-w-7xl px-4 pt-5 sm:px-6 lg:px-8 lg:pt-8">
        <div className="relative isolate min-h-[220px] overflow-hidden rounded-[2rem] bg-maroon px-6 py-10 text-white shadow-divine-lg sm:min-h-[260px] sm:px-10 sm:py-14 lg:min-h-[280px] lg:px-16">
          <img src={optimizedImage("/images/banners/banner2.png")} alt={t("A traditional wedding puja ceremony")} className="absolute inset-0 h-full w-full object-cover object-center" />
          <div className="absolute inset-0 bg-gradient-to-r from-maroon-deep via-maroon/90 to-marigold-deep/65" />
          <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-saffron/20 blur-3xl" />
          <div className="relative max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-200">{t("MyYajmaan policies")}</p>
            <h1 className="mt-3 font-serif text-3xl font-semibold sm:text-5xl">{title}</h1>
            <p className="mt-4 text-sm leading-7 text-amber-50 sm:text-base">{description}</p>
          </div>
        </div>

        <article className="mx-auto mt-6 max-w-4xl rounded-[1.8rem] border border-amber-100 bg-parchment-50 p-5 shadow-card sm:p-8 lg:p-12">
          {content?.body ? <div className="cms-rich-text text-sm leading-7 text-slate-600" dangerouslySetInnerHTML={{ __html: content.body }} /> : <><p className="text-sm leading-7 text-slate-600">
            {t("These Terms and Conditions govern your access to and use of MyYajmaan's website and services, whether as a customer booking a puja or as a Pandit Ji offering your services.")}
          </p>
          <div className="mt-7 space-y-7">
            {sections.map((section) => (
              <section key={section.title} className="border-b border-amber-100 pb-6 last:border-b-0">
                <h2 className="font-serif text-xl font-semibold text-maroon sm:text-2xl">{t(section.title)}</h2>
                <p className="mt-3 text-sm leading-7 text-slate-600">{section.body}</p>
              </section>
            ))}
          </div></>}
          <p className="mt-2 text-xs text-slate-500">{t("Last updated:")}{' '}{formatCmsUpdatedAt(updatedAt, "29 August 2026")}</p>
        </article>
      </div>
    </section>
  );
}
