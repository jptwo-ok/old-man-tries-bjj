import { cookies } from "next/headers";
import crypto from "crypto";

const COOKIE_NAME = "omtb_admin";

// Signs a simple token so the cookie can't be forged without knowing ADMIN_PASSWORD.
function sign(value) {
  const h = crypto
    .createHmac("sha256", process.env.ADMIN_PASSWORD || "dev-secret")
    .update(value)
    .digest("hex");
  return `${value}.${h}`;
}

function verify(signed) {
  if (!signed) return false;
  const [value, sig] = signed.split(".");
  if (!value || !sig) return false;
  return sign(value) === signed;
}

export function checkPassword(password) {
  return password === process.env.ADMIN_PASSWORD;
}

export function setAdminCookie() {
  const token = sign("admin");
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
}

export function clearAdminCookie() {
  cookies().delete(COOKIE_NAME);
}

export function isAdmin() {
  const token = cookies().get(COOKIE_NAME)?.value;
  return verify(token);
}
