import { createHmac, timingSafeEqual } from "node:crypto";
import { normalizeUserInfo, type UserInfo } from "./mini-app/user-info.js";

export function verifyInitData(raw: string, token: string, now = Date.now()): UserInfo | null {
  if (!raw || raw.length > 8192 || !token || /%(?![0-9a-fA-F]{2})/.test(raw)) return null;
  try {
    const fields = new Map<string, string>();
    for (const part of raw.split("&")) {
      if (!part || !part.includes("=")) return null;
      const [key, ...value] = part.split("=");
      if (!key || fields.has(decodeURIComponent(key.replaceAll("+", " ")))) return null;
      const decodedKey = decodeURIComponent(key.replaceAll("+", " "));
      if (!/^[a-zA-Z_]+$/.test(decodedKey)) return null;
      fields.set(decodedKey, decodeURIComponent(value.join("=").replaceAll("+", " ")));
    }
    const hash = fields.get("hash");
    const authDate = fields.get("auth_date");
    if (!hash || !/^[a-fA-F0-9]{64}$/.test(hash) || !authDate ||
        !/^[1-9]\d*$/.test(authDate)) return null;
    const age = now - Number(authDate) * 1000;
    if (!Number.isFinite(age) || age > 600_000 || age < -60_000) return null;
    const checkString = [...fields.entries()].filter(([key]) => key !== "hash")
      .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      .map(([key, value]) => `${key}=${value}`).join("\n");
    const secret = createHmac("sha256", "WebAppData").update(token).digest();
    const expected = createHmac("sha256", secret).update(checkString).digest();
    if (!timingSafeEqual(expected, Buffer.from(hash, "hex"))) return null;
    const user = JSON.parse(fields.get("user") ?? "null") as unknown;
    return normalizeUserInfo(user);
  } catch {
    return null;
  }
}
