/** Same rules as the server's password policy, so most mistakes show before sending. */
export const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

/**
 * Turkish phone number, mobile or landline — the server's rule (TurkishPhoneNumber): "+90", "0090", "90"
 * or "0" prefix or none, then 10 digits starting with 2, 3, 4, 5 or 8; spaces, dashes, dots, parentheses allowed.
 */
export function isTurkishPhone(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed || /[^\d\s\-.()+]/.test(trimmed) || trimmed.lastIndexOf("+") > 0) return false;
  const digits = trimmed.replace(/\D/g, "");
  let national: string;
  if (trimmed.startsWith("+")) {
    if (!digits.startsWith("90")) return false;
    national = digits.slice(2);
  } else if (digits.startsWith("0090")) national = digits.slice(4);
  else if (digits.length === 12 && digits.startsWith("90")) national = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) national = digits.slice(1);
  else national = digits;
  return /^[23458]\d{9}$/.test(national);
}
