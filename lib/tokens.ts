import { randomBytes } from "node:crypto";

/** URL-safe random token, ~22 chars for 128 bits. Used for magic links and access links. */
export function newToken(bytes = 18): string {
  return randomBytes(bytes).toString("base64url");
}

export const APP_URL = (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");

export const clientLink = (token: string) => `${APP_URL}/k/${token}`;
export const creatorLink = (token: string) => `${APP_URL}/u/${token}`;
export const loginLink = (token: string) => `${APP_URL}/login/verify?token=${token}`;
