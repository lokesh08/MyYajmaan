import { createContext, Fragment, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";

import { isEnglishOnlyPath, readStoredLanguage, setCurrentLanguage, storeLanguage } from "./index";

const LanguageContext = createContext({ language: "en", chosenLanguage: "en", setLanguage: () => {}, canSwitch: true });

function safeLocalStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

// Holds the visitor's language. The admin portal always gets English.
// Pages use the plain t() from ./index, so on a switch the app below is
// re-mounted (keyed by language) to pick up the new text. Login state
// lives above this (AuthProvider) and the booking draft is in
// sessionStorage, so neither is lost.
export function LanguageProvider({ children }) {
  const { pathname } = useLocation();
  const [chosenLanguage, setChosenLanguage] = useState(() => readStoredLanguage(safeLocalStorage()));
  const canSwitch = !isEnglishOnlyPath(pathname);
  const language = canSwitch ? chosenLanguage : "en";

  // Set before the children render, so every t() call in this render uses it.
  setCurrentLanguage(language);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback((lang) => {
    storeLanguage(safeLocalStorage(), lang);
    setChosenLanguage(lang);
  }, []);

  const value = useMemo(() => ({ language, chosenLanguage, setLanguage, canSwitch }), [language, chosenLanguage, setLanguage, canSwitch]);

  return (
    <LanguageContext.Provider value={value}>
      <Fragment key={language}>{children}</Fragment>
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
