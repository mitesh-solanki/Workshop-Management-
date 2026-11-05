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
  welcome: string;
  welcomeNamed: string;
  intro: string;
  roleLabel: string;
  activateHint: string;
  cta: string;
  expiryTitle: string;
  expiry: string;
  expiryHelp: string;
  ignore: string;
  plainIntro: string;
  plainCta: string;
  plainExpiry: string;
  plainIgnore: string;
};

export type PasswordResetEmailCopy = {
  subject: string;
  eyebrow: string;
  heading: string;
  greeting: string;
  fallbackName: string;
  selfIntro: string;
  adminIntro: string;
  ctaHint: string;
  cta: string;
  securityTitle: string;
  securityBody: string;
  keepPrivate: string;
  ignore: string;
  plainCta: string;
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
    heading: "Team Invitation",
    welcome: "Welcome to the team",
    welcomeNamed: "Welcome to the team, {name}",
    intro: "You have been invited to join {garage} as {role}.",
    roleLabel: "Role",
    activateHint:
      "Your account is ready. Set your password to get started in the workshop app.",
    cta: "Accept Invitation & Set Password",
    expiryTitle: "Your invitation expires soon",
    expiry: "This link expires on {date}.",
    expiryHelp:
      "If it expires, ask your garage owner to send a new invitation.",
    ignore: "If you were not expecting this, you can ignore this email.",
    plainIntro: "You have been invited to join {garage} as {role}.",
    plainCta: "Accept your invitation:",
    plainExpiry: "This link expires on {date}.",
    plainIgnore: "If you were not expecting this, ignore this email.",
  },
  hi: {
    subject: "आपको {garage} में शामिल होने का आमंत्रण है",
    heading: "टीम आमंत्रण",
    welcome: "टीम में आपका स्वागत है",
    welcomeNamed: "टीम में आपका स्वागत है, {name}",
    intro: "आपको {garage} में {role} के रूप में शामिल होने का आमंत्रण मिला है।",
    roleLabel: "भूमिका",
    activateHint:
      "आपका खाता तैयार है। वर्कशॉप ऐप शुरू करने के लिए पासवर्ड सेट करें।",
    cta: "आमंत्रण स्वीकार करें और पासवर्ड सेट करें",
    expiryTitle: "आपका आमंत्रण जल्द समाप्त होगा",
    expiry: "यह लिंक {date} को समाप्त होगा।",
    expiryHelp: "समाप्त होने पर गैरेज मालिक से नया आमंत्रण माँगें।",
    ignore: "अगर आप इसकी प्रतीक्षा नहीं कर रहे थे, तो इस ईमेल को अनदेखा करें।",
    plainIntro: "आपको {garage} में {role} के रूप में शामिल होने का आमंत्रण मिला है।",
    plainCta: "आमंत्रण स्वीकार करें:",
    plainExpiry: "यह लिंक {date} को समाप्त होगा।",
    plainIgnore: "अगर आप इसकी प्रतीक्षा नहीं कर रहे थे, तो इस ईमेल को अनदेखा करें।",
  },
  gu: {
    subject: "તમને {garage} માં જોડાવાનું આમંત્રણ છે",
    heading: "ટીમ આમંત્રણ",
    welcome: "ટીમમાં આપનું સ્વાગત છે",
    welcomeNamed: "ટીમમાં આપનું સ્વાગત છે, {name}",
    intro: "તમને {garage} માં {role} તરીકે જોડાવાનું આમંત્રણ મળ્યું છે.",
    roleLabel: "ભૂમિકા",
    activateHint:
      "તમારું એકાઉન્ટ તૈયાર છે. વર્કશોપ એપ શરૂ કરવા માટે પાસવર્ડ સેટ કરો.",
    cta: "આમંત્રણ સ્વીકારો અને પાસવર્ડ સેટ કરો",
    expiryTitle: "તમારું આમંત્રણ જલ્દી સમાપ્ત થશે",
    expiry: "આ લિંક {date} ના રોજ સમાપ્ત થશે.",
    expiryHelp: "સમાપ્ત થાય તો ગેરેજ માલિકને નવું આમંત્રણ મોકલવા કહો.",
    ignore: "જો તમે આની અપેક્ષા નહોતા રાખી, તો આ ઈમેઇલ અવગણો.",
    plainIntro: "તમને {garage} માં {role} તરીકે જોડાવાનું આમંત્રણ મળ્યું છે.",
    plainCta: "આમંત્રણ સ્વીકારો:",
    plainExpiry: "આ લિંક {date} ના રોજ સમાપ્ત થશે.",
    plainIgnore: "જો તમે આની અપેક્ષા નહોતા રાખી, તો આ ઈમેઇલ અવગણો.",
  },
};

const passwordResetCopy: Record<Locale, PasswordResetEmailCopy> = {
  en: {
    subject: "Set a new {garage} password",
    eyebrow: "Password Reset",
    heading: "Set a New Password",
    greeting: "Hi {name},",
    fallbackName: "there",
    selfIntro:
      "We received a request to reset the password for your {garage} account.",
    adminIntro:
      "An administrator has requested a password reset for your {garage} account.",
    ctaHint: "Use the button below to set a new password and sign in again.",
    cta: "Set a New Password",
    securityTitle: "Security notice",
    securityBody:
      "This password reset link expires on {date} and can only be used once.",
    keepPrivate:
      "For your security, keep this link private and do not share it with anyone.",
    ignore:
      "If you were not expecting this, contact your garage owner or ignore this email.",
    plainCta: "Set a new password:",
  },
  hi: {
    subject: "{garage} के लिए नया पासवर्ड सेट करें",
    eyebrow: "पासवर्ड रीसेट",
    heading: "नया पासवर्ड सेट करें",
    greeting: "नमस्ते {name},",
    fallbackName: "वहाँ",
    selfIntro:
      "हमें आपके {garage} खाते का पासवर्ड रीसेट करने का अनुरोध मिला है।",
    adminIntro:
      "व्यवस्थापक ने आपके {garage} खाते के लिए पासवर्ड रीसेट का अनुरोध किया है।",
    ctaHint: "नया पासवर्ड सेट करने और फिर साइन इन करने के लिए नीचे बटन दबाएँ।",
    cta: "नया पासवर्ड सेट करें",
    securityTitle: "सुरक्षा सूचना",
    securityBody:
      "यह पासवर्ड रीसेट लिंक {date} को समाप्त होगा और केवल एक बार उपयोग हो सकता है।",
    keepPrivate:
      "सुरक्षा के लिए इस लिंक को निजी रखें और किसी के साथ साझा न करें।",
    ignore:
      "अगर आप इसकी प्रतीक्षा नहीं कर रहे थे, तो गैरेज मालिक से संपर्क करें या इस ईमेल को अनदेखा करें।",
    plainCta: "नया पासवर्ड सेट करें:",
  },
  gu: {
    subject: "{garage} માટે નવો પાસવર્ડ સેટ કરો",
    eyebrow: "પાસવર્ડ રીસેટ",
    heading: "નવો પાસવર્ડ સેટ કરો",
    greeting: "નમસ્તે {name},",
    fallbackName: "ત્યાં",
    selfIntro:
      "અમને તમારા {garage} એકાઉન્ટનો પાસવર્ડ રીસેટ કરવાની વિનંતી મળી છે.",
    adminIntro:
      "એડમિનિસ્ટ્રેટરે તમારા {garage} એકાઉન્ટ માટે પાસવર્ડ રીસેટની વિનંતી કરી છે.",
    ctaHint: "નવો પાસવર્ડ સેટ કરી ફરી સાઇન ઇન કરવા નીચેનું બટન વાપરો.",
    cta: "નવો પાસવર્ડ સેટ કરો",
    securityTitle: "સુરક્ષા નોંધ",
    securityBody:
      "આ પાસવર્ડ રીસેટ લિંક {date} ના રોજ સમાપ્ત થશે અને ફક્ત એક વાર વાપરી શકાશે.",
    keepPrivate:
      "સુરક્ષા માટે આ લિંક ખાનગી રાખો અને કોઈની સાથે શેર ન કરો.",
    ignore:
      "જો તમે આની અપેક્ષા નહોતા રાખી, તો ગેરેજ માલિકનો સંપર્ક કરો અથવા આ ઈમેઇલ અવગણો.",
    plainCta: "નવો પાસવર્ડ સેટ કરો:",
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

export function getPasswordResetCopy(
  locale?: string | null,
): PasswordResetEmailCopy {
  return passwordResetCopy[resolveEmailLocale(locale)];
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
