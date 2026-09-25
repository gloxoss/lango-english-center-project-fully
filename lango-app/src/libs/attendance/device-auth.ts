import { and, eq } from 'drizzle-orm';
import { computeHmacHash } from '@/libs/api/badge-crypto';
import { ApiError } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { scannerDevices } from '@/models/Schema';

/**
 * DEVICE IDENTITY (phase 7).
 *
 * A paired terminal proves it is itself with the secret it was issued at
 * pairing. Only the hash is stored, so a database read cannot impersonate one.
 *
 * The device's branch is the AUTHORITATIVE branch for anything it scans. A kiosk
 * cannot widen its own scope by sending a different branch id — it has no way to
 * express one, and the caller is expected to use what this returns rather than
 * what the request claimed.
 */
export type AuthenticatedDevice = {
  id: string;
  label: string;
  branchId: string | null;
  roomLabel: string | null;
};

export async function authenticateDevice(
  tenantId: string,
  rawSecret: string,
): Promise<AuthenticatedDevice> {
  const [device] = await db
    .select({
      id: scannerDevices.id,
      label: scannerDevices.deviceLabel,
      branchId: scannerDevices.branchId,
      roomLabel: scannerDevices.roomLabel,
      status: scannerDevices.status,
      isDisabled: scannerDevices.isDisabled,
    })
    .from(scannerDevices)
    .where(and(
      eq(scannerDevices.tenantId, tenantId),
      eq(scannerDevices.secretHash, computeHmacHash(rawSecret)),
    ))
    .limit(1);

  // A secret that matches nothing is not a hint about which device it nearly
  // was. One refusal for every failure mode keeps the response from confirming
  // whether a guessed secret exists.
  if (!device) {
    throw new ApiError(401, 'DEVICE_NOT_RECOGNISED', 'Terminal non reconnu.');
  }

  if (device.status === 'revoked') {
    throw new ApiError(403, 'DEVICE_REVOKED', 'Ce terminal a été révoqué.');
  }

  if (device.status !== 'active' || device.isDisabled) {
    throw new ApiError(403, 'DEVICE_DISABLED', 'Ce terminal est désactivé.');
  }

  // Heartbeat: last_seen_at was decorative because nothing ever reported in.
  // Written after the checks, so a refused device does not look alive.
  await db
    .update(scannerDevices)
    .set({ lastSeenAt: new Date().toISOString() })
    .where(and(eq(scannerDevices.id, device.id), eq(scannerDevices.tenantId, tenantId)));

  return {
    id: device.id,
    label: device.label,
    branchId: device.branchId,
    roomLabel: device.roomLabel,
  };
}
