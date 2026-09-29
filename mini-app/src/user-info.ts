export interface UserInfo {
  id: number;
  username: string | null;
  photoUrl: string | null;
}

const USERNAME_PATTERN = /^[A-Za-z0-9_]{5,32}$/;
const MAX_PHOTO_URL_LENGTH = 2_048;
const ALLOWED_PHOTO_HOSTS = ["t.me", "telegram.org", "telesco.pe"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeUsername(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  const name = trimmed.startsWith("@") ? trimmed.slice(1) : trimmed;

  return USERNAME_PATTERN.test(name) ? `@${name}` : null;
}

function isAllowedPhotoHost(hostname: string): boolean {
  return ALLOWED_PHOTO_HOSTS.some(
    (host) => hostname === host || hostname.endsWith(`.${host}`),
  );
}

function normalizePhotoUrl(value: unknown): string | null {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > MAX_PHOTO_URL_LENGTH
  ) {
    return null;
  }

  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.username !== "" ||
      url.password !== "" ||
      url.port !== "" ||
      url.hash !== "" ||
      !isAllowedPhotoHost(url.hostname)
    ) {
      return null;
    }

    return url.href;
  } catch {
    return null;
  }
}

export function normalizeUserInfo(value: unknown): UserInfo | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = value.id;
  if (
    typeof id !== "number" ||
    !Number.isSafeInteger(id) ||
    id <= 0
  ) {
    return null;
  }

  return {
    id,
    username: normalizeUsername(value.username),
    photoUrl: normalizePhotoUrl(value.photo_url),
  };
}
