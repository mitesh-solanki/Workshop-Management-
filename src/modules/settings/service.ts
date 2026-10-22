import "server-only";

import { writeAuditLog } from "@/lib/audit";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { requireRole, type RoleSession } from "@/lib/rbac";
import {
  findGarageById,
  updateGarageById,
} from "@/modules/settings/repo";
import {
  updateGarageSettingsSchema,
  type UpdateGarageSettingsInput,
} from "@/modules/settings/schema";

const SETTINGS_ROLES = ["OWNER", "MANAGER"] as const;

export async function getGarageSettings(session: RoleSession) {
  // garageId always comes from the session — never from the request.
  const garage = await findGarageById(session.garageId);
  if (!garage) {
    throw new NotFoundError();
  }
  return garage;
}

export async function updateGarageSettings(
  session: RoleSession,
  raw: UpdateGarageSettingsInput,
) {
  requireRole(session, SETTINGS_ROLES);
  const input = updateGarageSettingsSchema.parse(raw);

  // Ignore any client-supplied garage id; session is the only source of truth.
  const garage = await updateGarageById(session.garageId, {
    name: input.name,
    address: input.address,
    gstin: input.gstin,
    allowNegativeStock: input.allowNegativeStock,
  });

  if (!garage) {
    throw new NotFoundError();
  }

  await writeAuditLog({
    garageId: session.garageId,
    actorId: session.userId,
    action: "garage.settings_updated",
    entity: "Garage",
    entityId: garage.id,
    meta: {
      name: garage.name,
      address: garage.address,
      gstin: garage.gstin,
      allowNegativeStock: garage.allowNegativeStock,
    },
  });

  return garage;
}

/** Test helper: attempt to read another garage while scoped to the session. */
export async function getGarageSettingsForGarageId(
  session: RoleSession,
  requestedGarageId: string,
) {
  if (requestedGarageId !== session.garageId) {
    throw new ForbiddenError();
  }
  return getGarageSettings(session);
}

/** Test helper: attempt to update another garage while scoped to the session. */
export async function updateGarageSettingsForGarageId(
  session: RoleSession,
  requestedGarageId: string,
  raw: UpdateGarageSettingsInput,
) {
  if (requestedGarageId !== session.garageId) {
    throw new ForbiddenError();
  }
  return updateGarageSettings(session, raw);
}
