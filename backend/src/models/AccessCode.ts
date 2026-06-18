export type AccessCodeRecord = {
  email: string;
  code_hash: string;
  expires_at: Date;
  attempts: number;
  last_sent_at: Date;
};

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

export const CODE_TTL_MINUTES = parsePositiveInt(
  process.env.CODE_TTL_MINUTES,
  30,
);

export const MAX_CODE_ATTEMPTS = parsePositiveInt(
  process.env.MAX_CODE_ATTEMPTS,
  5,
);

export const RESEND_COOLDOWN_SECONDS = parsePositiveInt(
  process.env.RESEND_COOLDOWN_SECONDS,
  60,
);
