// Privacy radar: attribute NAMES that suggest personal data on a public chain. Values are never
// read here, so a flag means "worth a look", not "contains personal data".
import type { SchemaField } from "@arkiv-agent/catalogue";
import { words } from "./purpose.ts";
import type { PrivacyCategory, PrivacyFlag } from "./types.ts";

const RULES: { category: PrivacyCategory; words: string[] }[] = [
  { category: "contact", words: ["email", "phone", "mobile", "tel", "whatsapp", "telegram", "msisdn"] },
  { category: "person", words: ["pname", "patient", "fullname", "firstname", "lastname", "surname", "resident", "citizen", "employee", "tenant", "student", "candidate"] },
  { category: "health", words: ["hospital", "diagnosis", "insurer", "blood", "prescription", "medical", "clinic", "disease", "symptom"] },
  { category: "government id", words: ["aadhaar", "aadhar", "ssn", "passport", "pan", "voter", "nationalid", "license", "licence"] },
  { category: "location", words: ["lat", "lng", "lon", "latitude", "longitude", "geohash", "gh7", "gh6", "gh8", "address", "pincode", "postcode", "zip"] },
  { category: "financial", words: ["salary", "income", "iban", "upi", "bank", "wage", "payslip", "creditscore"] },
  { category: "birth date", words: ["dob", "birth", "birthday", "birthdate"] },
];
/** Wallet attributes that name a person's role. */
const PERSON_ROLES = new Set(["rider", "user", "member", "resident", "patient", "employee", "tenant", "student", "voter", "customer", "follower", "author"]);

const SEALED = /encrypt|sealed|cipher/i;

/** True when the dataset has content types and all of them look encrypted. */
export const isSealed = (contentTypes: readonly string[]) => contentTypes.length > 0 && contentTypes.every((c) => SEALED.test(c));

export function privacyFlags(schema: readonly Pick<SchemaField, "name" | "type">[]): PrivacyFlag[] {
  const found = new Map<PrivacyCategory, Set<string>>();
  const add = (c: PrivacyCategory, field: string) => (found.get(c) ?? found.set(c, new Set()).get(c)!).add(field);
  for (const f of schema) {
    const parts = words(f.name);
    const joined = parts.join("");
    for (const rule of RULES) {
      if (rule.words.some((w) => parts.includes(w) || joined === w)) add(rule.category, f.name);
    }
    if (f.type === "addr" && parts.some((p) => PERSON_ROLES.has(p))) add("personal wallet", f.name);
  }
  return [...found].map(([category, fields]) => ({ category, fields: [...fields].sort() }));
}
