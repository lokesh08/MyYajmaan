import { useLocation } from "react-router-dom";

import Seo from "../components/Seo";
import { resolveRouteSeo } from "./routes";
import { breadcrumbSchema } from "./structuredData";
import { getSiteUrl } from "./seoHead";

/**
 * Default SEO for whichever route is showing: title, description,
 * canonical, robots, and breadcrumb data. Mounted once in App. Pages that
 * know more (a puja's name, a Pandit Ji's profile) render their own <Seo>,
 * which takes priority over this.
 */
export default function RouteSeo() {
  const { pathname } = useLocation();
  const route = resolveRouteSeo(pathname);

  const breadcrumbs =
    !route.noindex && pathname !== "/"
      ? breadcrumbSchema(getSiteUrl(), [
          { name: "Home", path: "/" },
          { name: route.heading || route.title.split(" | ")[0].split(" – ")[0], path: pathname },
        ])
      : undefined;

  return (
    <Seo
      priority={1}
      title={route.title}
      description={route.description}
      path={pathname}
      noindex={route.noindex}
      jsonLd={breadcrumbs}
    />
  );
}
