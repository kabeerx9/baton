import enUS from "@i18n/en-US.json";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

export const LOCALE = "en-US";

// English is the only language, so every namespace ships in the main bundle
// and is ready before the first render.
void i18n.use(initReactI18next).init({
  lng: LOCALE,
  fallbackLng: LOCALE,
  defaultNS: "common",
  resources: { [LOCALE]: enUS },
  interpolation: {
    escapeValue: false,
  },
});

export { i18n };
