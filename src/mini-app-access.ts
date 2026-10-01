import type { HttpRequest, HttpResponseInit } from "@azure/functions";
import { verifyInitData } from "./telegram-init-data.js";
import type { UserRepository } from "./users/repository.js";

export async function handleMiniAppAccess(
  request: HttpRequest, options: { token: string; origin: string; users: UserRepository },
): Promise<HttpResponseInit> {
  const origin = request.headers.get("origin");
  if (origin !== null && origin !== options.origin) return { status: 403 };
  const headers = {
    "Access-Control-Allow-Origin": options.origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store",
    Vary: "Origin",
  };
  if (request.method === "OPTIONS") return { status: 204, headers };
  const response = (status: string, user?: unknown, httpStatus = 200): HttpResponseInit =>
    ({ status: httpStatus, headers, jsonBody: user === undefined ? { status } : { status, user } });
  const length = request.headers.get("content-length");
  if (request.method !== "POST" ||
      request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json" ||
      (length !== null && (!/^\d+$/.test(length) || Number(length) > 10_000)))
    return response("invalid", undefined, 400);
  try {
    const body = await request.text();
    if (Buffer.byteLength(body) > 10_000) return response("invalid", undefined, 400);
    const parsed: unknown = JSON.parse(body);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed) ||
      Object.keys(parsed).length !== 1 || !("initData" in parsed) ||
      typeof parsed.initData !== "string") return response("invalid");
    const user = verifyInitData(parsed.initData, options.token);
    if (!user) return response("invalid");
    const row = await options.users.find(user.id);
    if (!row) return response("unregistered");
    if (row.isActive !== true) return response("pending");
    return response("allowed", { id: user.id, username: user.username, photo_url: user.photoUrl });
  } catch (error) {
    if (error instanceof SyntaxError) return response("invalid");
    return response("unavailable");
  }
}
