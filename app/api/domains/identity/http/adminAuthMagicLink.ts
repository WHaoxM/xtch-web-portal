/**
 * Legacy path alias for Admin email sign-in.
 * Prefer POST /api/admin/auth-otp (OTP, no magic-link redirect).
 */
import authOtpHandler from './adminAuthOtp';

type VercelRequestLike = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
};

type VercelResponseLike = {
  status: (code: number) => VercelResponseLike;
  json: (body: unknown) => void;
};

export default function handler(req: VercelRequestLike, res: VercelResponseLike) {
  return authOtpHandler(req, res);
}
