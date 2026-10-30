export type OrderTechnicianRef = {
  id?: string;
  name: string | null;
  email: string;
};

export type OrderWithTechnicians = {
  technicianId?: string | null;
  technician?: OrderTechnicianRef | null;
  technicianAssignments?: Array<{
    technicianId: string;
    technician?: OrderTechnicianRef;
  }>;
};

export function isTechnicianAssignedToOrder(
  order: OrderWithTechnicians,
  userId: string,
): boolean {
  if (order.technicianId === userId) return true;
  return Boolean(
    order.technicianAssignments?.some((row) => row.technicianId === userId),
  );
}

export function assignedTechniciansFromOrder(
  order: OrderWithTechnicians,
): OrderTechnicianRef[] {
  if (order.technicianAssignments && order.technicianAssignments.length > 0) {
    return order.technicianAssignments.map((row) => ({
      id: row.technician?.id ?? row.technicianId,
      name: row.technician?.name ?? null,
      email: row.technician?.email ?? "",
    }));
  }
  if (order.technician) {
    return [
      {
        id: order.technician.id ?? order.technicianId ?? undefined,
        name: order.technician.name,
        email: order.technician.email,
      },
    ];
  }
  return [];
}

export function technicianDisplayName(tech: OrderTechnicianRef): string {
  const name = tech.name?.trim();
  if (name) return name;
  const email = tech.email?.trim();
  if (email) return email;
  return "";
}

export function formatTechniciansList(
  order: OrderWithTechnicians,
  unassignedLabel: string,
): string {
  const names = assignedTechniciansFromOrder(order)
    .map(technicianDisplayName)
    .filter(Boolean);
  if (names.length === 0) return unassignedLabel;
  return names.join(", ");
}

export function technicianIdsFromOrder(order: OrderWithTechnicians): string[] {
  if (order.technicianAssignments && order.technicianAssignments.length > 0) {
    return order.technicianAssignments.map((row) => row.technicianId);
  }
  if (order.technicianId) return [order.technicianId];
  return [];
}
