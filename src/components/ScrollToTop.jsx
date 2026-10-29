import { useEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

// React Router keeps the scroll position across navigations, so a link
// clicked in the footer opened the new page still scrolled to the
// bottom. This starts every newly opened page at the top.
//
// Left alone on purpose:
// - Back/Forward (POP): the browser restores where the user was.
// - Only the ?query changed on the same page (filters, pagination):
//   jumping to the top there would move the list under the user.
export default function ScrollToTop() {
  const { pathname, search, key } = useLocation();
  const navigationType = useNavigationType();
  const previous = useRef({ pathname, search });

  useEffect(() => {
    const prev = previous.current;
    previous.current = { pathname, search };

    if (navigationType === "POP") return;
    if (prev.pathname === pathname && prev.search !== search) return;

    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname, search, key, navigationType]);

  return null;
}
