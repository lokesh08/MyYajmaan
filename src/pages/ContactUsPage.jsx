import ContactUs from "../components/ContactUs";
import Seo from "../components/Seo";
import { getSiteUrl } from "../seo/seoHead";
import { contactPageSchema } from "../seo/structuredData";

export default function ContactUsPage() {
  return (
    <>
      <Seo jsonLd={contactPageSchema(getSiteUrl())} />
      <ContactUs />
    </>
  );
}
