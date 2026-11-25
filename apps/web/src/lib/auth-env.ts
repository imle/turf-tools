/** Server-only env checks for which sign-in methods are configured. */

export function isKeycloakEnabled(): boolean {
  return Boolean(
    process.env.KEYCLOAK_ISSUER &&
    process.env.KEYCLOAK_CLIENT_ID &&
    process.env.KEYCLOAK_CLIENT_SECRET,
  );
}

/** Email magic-link OTP. On by default; set AUTH_OTP_DISABLED=1 to turn off. */
export function isEmailOtpEnabled(): boolean {
  return process.env.AUTH_OTP_DISABLED !== "1";
}
