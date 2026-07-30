/** Shared audit / actor identity types — lives in platform so domains can depend on it, not the reverse. */
export type ActorType = 'system' | 'admin' | 'stripe_webhook' | 'payoneer_webhook';
