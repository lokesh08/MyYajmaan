import { formatCmsUpdatedAt, useCmsContent } from "../hooks/use-cms-content";
import { optimizedImage } from "../utils/image";

const sections = [
  { title: "1. Cancellations", items: ["You may cancel a service or appointment at least 24 hours before the scheduled date or time for a full refund, subject to the payment provider's processing time.", "Cancellations made within 24 hours may be eligible for a partial refund of up to 50% of the total service cost.", "MyYajmaan reserves the right to cancel or reschedule a service when unforeseen circumstances, such as medical emergencies or technical issues, affect delivery. We will inform you as soon as possible."] },
  { title: "2. Refunds", items: ["Eligible refunds are processed to the original payment method within 7-10 business days.", "If a service is cancelled by MyYajmaan or the assigned Pandit Ji, you will receive a full refund or an alternative booking option.", "Services involving specialised equipment, custom arrangements, or consumables may be marked non-refundable before booking."] },
  { title: "3. How to Request a Cancellation or Refund", items: ["To cancel a service, contact us through the Contact Us page or email support@myyajmaan.com with your booking details.", "To request a refund, include your booking ID, the reason for the request, and any relevant details. Our team will review the request promptly."] },
  { title: "4. Important Notes", items: ["No-show bookings may be charged and may not qualify for a refund.", "Changes to the service, timing, or address should be requested at least 24 hours in advance and are subject to availability.", "Refund timelines may vary depending on your bank, UPI provider, or payment method."] },
];

export default function CancellationRefundPage() {
  const { content, updatedAt } = useCmsContent("cancellation-refund", null);
  const title = content?.title || "Cancellation & Refund Policy";
  const description = content?.description || "Clear, simple guidance for changing or cancelling your puja booking.";

  return (
    <section className="min-h-screen bg-cream pb-14">
      <div className="mx-auto max-w-7xl px-4 pt-5 sm:px-6 lg:px-8 lg:pt-8">
        <div className="relative isolate min-h-[220px] overflow-hidden rounded-[2rem] bg-maroon px-6 py-10 text-white shadow-divine-lg sm:min-h-[260px] sm:px-10 sm:py-14 lg:min-h-[280px] lg:px-16">
          <img src={optimizedImage("/images/panditJoin.png")} alt="A Pandit Ji offering a respectful namaste" className="absolute inset-0 h-full w-full object-cover object-center" />
          <div className="absolute inset-0 bg-gradient-to-r from-maroon-deep via-maroon/90 to-marigold-deep/65" />
          <div className="pointer-events-none absolute -bottom-24 right-0 h-72 w-72 rounded-full bg-saffron/20 blur-3xl" />
          <div className="relative max-w-3xl"><p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-200">MyYajmaan policies</p><h1 className="mt-3 font-serif text-3xl font-semibold sm:text-5xl">{title}</h1><p className="mt-4 text-sm leading-7 text-amber-50 sm:text-base">{description}</p></div>
        </div>

        <article className="mx-auto mt-6 max-w-4xl rounded-[1.8rem] border border-amber-100 bg-parchment-50 p-5 shadow-card sm:p-8 lg:p-12">
          {content?.body ? <div className="cms-rich-text text-sm leading-7 text-slate-600" dangerouslySetInnerHTML={{ __html: content.body }} /> : <><p className="text-sm leading-7 text-slate-600">We want your booking experience to feel clear and fair. Please review the following terms before cancelling or requesting a refund.</p><div className="mt-7 space-y-7">
            {sections.map((section) => <section key={section.title} className="border-b border-amber-100 pb-6 last:border-b-0"><h2 className="font-serif text-xl font-semibold text-maroon sm:text-2xl">{section.title}</h2><ul className="mt-3 space-y-3 text-sm leading-7 text-slate-600">{section.items.map((item) => <li key={item} className="flex gap-2"><span className="text-saffron">•</span><span>{item}</span></li>)}</ul></section>)}
          </div></>}
          <div className="mt-4 rounded-2xl border border-saffron/30 bg-amber-50 p-5"><h2 className="font-serif text-xl font-semibold text-maroon">Need help with a cancellation?</h2><p className="mt-2 text-sm leading-6 text-slate-600">Our support team can help you understand your options for a specific booking.</p></div>
          <p className="mt-6 text-xs text-slate-500">Last updated: {formatCmsUpdatedAt(updatedAt, "18 August 2026")}</p>
        </article>
      </div>
    </section>
  );
}
