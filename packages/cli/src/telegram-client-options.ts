export const CLI_TELEGRAM_CLIENT_OPTIONS = {
  connectionRetries: 3,
  floodSleepThreshold: 0,
  // GramJS consumes the first invoke attempt while handling PHONE_MIGRATE,
  // then needs one more attempt to resend auth.SendCode to the new DC.
  requestRetries: 2,
} as const
