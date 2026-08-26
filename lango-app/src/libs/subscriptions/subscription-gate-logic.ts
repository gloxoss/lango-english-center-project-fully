const BLOCKED_STATUSES: readonly string[] = ['past_due', 'unpaid', 'canceled', 'suspended', 'cancelled'];

export function isSubscriptionBlocked(status: string | null): boolean {
  return status !== null && BLOCKED_STATUSES.includes(status);
}
