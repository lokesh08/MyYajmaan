import { formatCmsUpdatedAt, useCmsContent } from "../hooks/use-cms-content";
import { optimizedImage } from "../utils/image";

const sections = [
  { title: "1. Information We Collect", body: "We collect information you share when you create an account, book a puja, contact support, or use our services. This may include your name, email address, phone number, billing details, booking information, and messages sent to our support team." },
  { title: "2. How We Use Your Information", body: "We use your information to provide and improve our services, confirm and manage bookings, process payments, communicate important updates, provide customer support, prevent misuse, and comply with legal obligations." },
  { title: "3. How We Protect Your Data", body: "We use access controls, secure connections, and appropriate technical and organisational measures to protect personal information. No online service can guarantee absolute security, so please protect your account credentials and contact us if you notice unusual activity." },
  { title: "4. Sharing Your Information", body: "We share information only when needed to provide the service, such as with the selected Pandit Ji, payment providers, technology partners, or authorities where legally required. We do not sell your personal information." },
  { title: "5. Cookies and Tracking Technologies", body: "We may use cookies or similar technologies to keep you signed in, remember preferences, understand service usage, and improve the experience. You can manage cookies through your browser settings." },
  { title: "6. Your Data Protection Rights", body: "Depending on applicable law, you may request access, correction, deletion, restriction, or a copy of your personal information. Contact our support team to make a request and we will respond within a reasonable period." },
  { title: "7. Third-Party Links", body: "Our service may contain links to third-party websites or services. We are not responsible for their privacy practices, so please review their policies before sharing information." },
  { title: "8. Children's Privacy", body: "Our services are not intended for children under the age of 13, and we do not knowingly collect personal information from children." },
  { title: "9. Changes to This Privacy Policy", body: "We may update this policy from time to time. The updated version will be posted on this page with its effective date. Continued use of the service after an update means you accept the revised policy." },
];

export default function PrivacyPolicyPage() {
  const { content, updatedAt } = useCmsContent("privacy-policy", null);
  const title = content?.title || "Privacy Policy";
  const description = content?.description || "How we collect, use, protect, and respect your personal information.";

  return (
    <section className="min-h-screen bg-cream pb-14">
      <div className="mx-auto max-w-7xl px-4 pt-5 sm:px-6 lg:px-8 lg:pt-8">
        <div className="relative isolate min-h-[220px] overflow-hidden rounded-[2rem] bg-maroon px-6 py-10 text-white shadow-divine-lg sm:min-h-[260px] sm:px-10 sm:py-14 lg:min-h-[280px] lg:px-16">
          <img src={optimizedImage("/images/banners/banner1.png")} alt="A serene temple shrine at dawn" className="absolute inset-0 h-full w-full object-cover object-center" />
          <div className="absolute inset-0 bg-gradient-to-r from-maroon-deep via-maroon/90 to-marigold-deep/65" />
          <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-saffron/20 blur-3xl" />
          <div className="relative max-w-3xl"><p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-200">MyYajmaan policies</p><h1 className="mt-3 font-serif text-3xl font-semibold sm:text-5xl">{title}</h1><p className="mt-4 text-sm leading-7 text-amber-50 sm:text-base">{description}</p></div>
        </div>

        <article className="mx-auto mt-6 max-w-4xl rounded-[1.8rem] border border-amber-100 bg-parchment-50 p-5 shadow-card sm:p-8 lg:p-12">
          {content?.body ? <div className="cms-rich-text text-sm leading-7 text-slate-600" dangerouslySetInnerHTML={{ __html: content.body }} /> : <><p className="text-sm leading-7 text-slate-600">At MyYajmaan, privacy is important to us. This policy explains how we handle information when you browse our services, create an account, book a puja, or contact our team.</p><div className="mt-7 space-y-7">
            {sections.map((section) => <section key={section.title} className="border-b border-amber-100 pb-6 last:border-b-0"><h2 className="font-serif text-xl font-semibold text-maroon sm:text-2xl">{section.title}</h2><p className="mt-3 text-sm leading-7 text-slate-600">{section.body}</p></section>)}
          </div></>}
          <p className="mt-2 text-xs text-slate-500">Last updated: {formatCmsUpdatedAt(updatedAt, "18 August 2026")}</p>
        </article>
      </div>
    </section>
  );
}
