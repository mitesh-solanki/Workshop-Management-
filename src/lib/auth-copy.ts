import { createTranslator } from "next-intl";
import en from "../../messages/en.json";

/** English-only copy for auth pages (login / signup / invite). No locale switcher. */
export const authCopy = createTranslator({
  locale: "en",
  messages: en,
  namespace: "auth",
});

export const authCommonCopy = createTranslator({
  locale: "en",
  messages: en,
  namespace: "common",
});

export const authTeamRolesCopy = createTranslator({
  locale: "en",
  messages: en,
  namespace: "team.roles",
});
