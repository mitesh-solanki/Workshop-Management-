import type { Locale } from "@/i18n/config";
import { defaultLocale, isLocale } from "@/i18n/config";

export type OtpEmailCopy = {
  subject: string;
  heading: string;
  intro: string;
  codeLabel: string;
  expiry: string;
  ignore: string;
  plainIntro: string;
  plainExpiry: string;
  plainIgnore: string;
};

export type InviteEmailCopy = {
  subject: string;
  heading: string;
  intro: string;
  roleLabel: string;
  cta: string;
  expiry: string;
  ignore: string;
  plainIntro: string;
  plainCta: string;
  plainExpiry: string;
  plainIgnore: string;
};

const otpCopy: Record<Locale, OtpEmailCopy> = {
  en: {
    subject: "Your sign-in code",
    heading: "Sign-in code",
    intro: "Use this one-time code to continue. Do not share it with anyone.",
    codeLabel: "Your code",
    expiry: "This code expires in 10 minutes.",
    ignore: "If you did not request this, you can ignore this email.",
    plainIntro: "Your one-time sign-in code is:",
    plainExpiry: "This code expires in 10 minutes.",
    plainIgnore: "If you did not request this, ignore this email.",
  },
  hi: {
    subject: "आपका साइन-इन कोड",
    heading: "साइन-इन कोड",
    intro: "जारी रखने के लिए यह एक-बार का कोड उपयोग करें। इसे किसी के साथ साझा न करें।",
    codeLabel: "आपका कोड",
    expiry: "यह कोड 10 मिनट में समाप्त हो जाएगा।",
    ignore: "अगर आपने यह अनुरोध नहीं किया, तो इस ईमेल को अनदेखा करें।",
    plainIntro: "आपका एक-बार का साइन-इन कोड है:",
    plainExpiry: "यह कोड 10 मिनट में समाप्त हो जाएगा।",
    plainIgnore: "अगर आपने यह अनुरोध नहीं किया, तो इस ईमेल को अनदेखा करें।",
  },
  gu: {
    subject: "તમારો સાઇન-ઇન કોડ",
    heading: "સાઇન-ઇન કોડ",
    intro: "ચાલુ રાખવા માટે આ એક-વારનો કોડ વાપરો. કોઈની સાથે શેર ન કરો.",
    codeLabel: "તમારો કોડ",
    expiry: "આ કોડ 10 મિનિટમાં સમાપ્ત થશે.",
    ignore: "જો તમે આ વિનંતી નથી કરી, તો આ ઈમેઇલ અવગણો.",
    plainIntro: "તમારો એક-વારનો સાઇન-ઇન કોડ છે:",
    plainExpiry: "આ કોડ 10 મિનિટમાં સમાપ્ત થશે.",
    plainIgnore: "જો તમે આ વિનંતી નથી કરી, તો આ ઈમેઇલ અવગણો.",
  },
};

const inviteCopy: Record<Locale, InviteEmailCopy> = {
  en: {
    subject: "You are invited to join {garage}",
    heading: "Team invitation",
    intro: "You have been invited to join {garage} as {role}.",
    roleLabel: "Role",
    cta: "Accept invitation",
    expiry: "This link expires on {date}.",
    ignore: "If you were not expecting this, you can ignore this email.",
    plainIntro: "You have been invited to join {garage} as {role}.",
    plainCta: "Accept your invitation:",
    plainExpiry: "This link expires on {date}.",
    plainIgnore: "If you were not expecting this, ignore this email.",
  },
  hi: {
    subject: "आपको {garage} में शामिल होने का आमंत्रण है",
    heading: "टीम आमंत्रण",
    intro: "आपको {garage} में {role} के रूप में शामिल होने का आमंत्रण मिला है।",
    roleLabel: "भूमिका",
    cta: "आमंत्रण स्वीकार करें",
    expiry: "यह लिंक {date} को समाप्त होगा।",
    ignore: "अगर आप इसकी प्रतीक्षा नहीं कर रहे थे, तो इस ईमेल को अनदेखा करें।",
    plainIntro: "आपको {garage} में {role} के रूप में शामिल होने का आमंत्रण मिला है।",
    plainCta: "आमंत्रण स्वीकार करें:",
    plainExpiry: "यह लिंक {date} को समाप्त होगा।",
    plainIgnore: "अगर आप इसकी प्रतीक्षा नहीं कर रहे थे, तो इस ईमेल को अनदेखा करें।",
  },
  gu: {
    subject: "તમને {garage} માં જોડાવાનું આમંત્રણ છે",
    heading: "ટીમ આમંત્રણ",
    intro: "તમને {garage} માં {role} તરીકે જોડાવાનું આમંત્રણ મળ્યું છે.",
    roleLabel: "ભૂમિકા",
    cta: "આમંત્રણ સ્વીકારો",
    expiry: "આ લિંક {date} ના રોજ સમાપ્ત થશે.",
    ignore: "જો તમે આની અપેક્ષા નહોતા રાખી, તો આ ઈમેઇલ અવગણો.",
    plainIntro: "તમને {garage} માં {role} તરીકે જોડાવાનું આમંત્રણ મળ્યું છે.",
    plainCta: "આમંત્રણ સ્વીકારો:",
    plainExpiry: "આ લિંક {date} ના રોજ સમાપ્ત થશે.",
    plainIgnore: "જો તમે આની અપેક્ષા નહોતા રાખી, તો આ ઈમેઇલ અવગણો.",
  },
};

const roleLabels: Record<Locale, Record<string, string>> = {
  en: {
    OWNER: "Owner",
    MANAGER: "Manager",
    TECHNICIAN: "Technician",
    ACCOUNTANT: "Accountant",
  },
  hi: {
    OWNER: "मालिक",
    MANAGER: "मैनेजर",
    TECHNICIAN: "तकनीशियन",
    ACCOUNTANT: "अकाउंटेंट",
  },
  gu: {
    OWNER: "માલિક",
    MANAGER: "મેનેજર",
    TECHNICIAN: "ટેકનિશિયન",
    ACCOUNTANT: "એકાઉન્ટન્ટ",
  },
};

export function resolveEmailLocale(value?: string | null): Locale {
  if (value && isLocale(value)) return value;
  return defaultLocale;
}

export function getOtpCopy(locale?: string | null): OtpEmailCopy {
  return otpCopy[resolveEmailLocale(locale)];
}

export function getInviteCopy(locale?: string | null): InviteEmailCopy {
  return inviteCopy[resolveEmailLocale(locale)];
}

export function getRoleLabel(role: string, locale?: string | null) {
  const loc = resolveEmailLocale(locale);
  return roleLabels[loc][role] ?? role;
}

export function fillTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? "");
}
