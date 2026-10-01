import { createHmac } from "node:crypto";

export const testToken = "123456:offline-fixture";
export const testNow = 1_780_000_000_000;
export function signedData(fields: Record<string, string> = {}): string {
  const values = { auth_date: String(testNow / 1000), user: JSON.stringify({ id: 100, username: "valid_name" }), ...fields };
  const check = Object.entries(values).sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`).join("\n");
  const secret = createHmac("sha256", "WebAppData").update(testToken).digest();
  const hash = createHmac("sha256", secret).update(check).digest("hex");
  return new URLSearchParams({ ...values, hash }).toString();
}
