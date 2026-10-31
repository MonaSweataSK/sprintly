export const ACCESS_COOKIE = 'sprintly_access';
export const REFRESH_COOKIE = 'sprintly_refresh';

export const OTP_EXPIRY_SECONDS = 5 * 60;
export const OTP_RESEND_COOLDOWN_SECONDS = 60;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_MAX_REQUESTS_PER_HOUR = 5;
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

export const GENERIC_OTP_RESPONSE = {
  message: 'If this email is approved, a verification code will be sent.',
  expiresInSeconds: OTP_EXPIRY_SECONDS,
  resendAfterSeconds: OTP_RESEND_COOLDOWN_SECONDS,
} as const;
