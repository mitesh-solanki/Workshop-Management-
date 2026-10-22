import {
  ClipboardList,
  Contact,
  Kanban,
  LayoutDashboard,
  Package,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";

export type AppRole = "OWNER" | "MANAGER" | "TECHNICIAN" | "ACCOUNTANT";

export type NavKey =
  | "dashboard"
  | "workshop"
  | "customers"
  | "inventory"
  | "team"
  | "orders"
  | "settings";

export type NavGroupKey = "workshop" | "business" | "admin";

export type NavItem = {
  href: string;
  key: NavKey;
  icon: LucideIcon;
  group: NavGroupKey;
  /** Roles that may see this item. Omit = all roles. */
  roles?: readonly AppRole[];
  /** Prefer for mobile bottom bar (lower = higher priority). */
  bottomPriority?: number;
};

/**
 * Modules that exist as routes today.
 * Later: billing, reports — add when pages ship.
 */
export const APP_NAV_ITEMS: readonly NavItem[] = [
  {
    href: "/dashboard",
    key: "dashboard",
    icon: LayoutDashboard,
    group: "workshop",
    bottomPriority: 1,
  },
  {
    href: "/workshop",
    key: "workshop",
    icon: Kanban,
    group: "workshop",
    bottomPriority: 2,
  },
  {
    href: "/customers",
    key: "customers",
    icon: Contact,
    group: "workshop",
    bottomPriority: 3,
  },
  {
    href: "/orders",
    key: "orders",
    icon: ClipboardList,
    group: "workshop",
    bottomPriority: 4,
  },
  {
    href: "/inventory",
    key: "inventory",
    icon: Package,
    group: "business",
    bottomPriority: 5,
  },
  {
    href: "/team",
    key: "team",
    icon: Users,
    group: "admin",
    roles: ["OWNER", "MANAGER"],
    bottomPriority: 6,
  },
  {
    href: "/settings",
    key: "settings",
    icon: Settings,
    group: "admin",
    roles: ["OWNER", "MANAGER", "TECHNICIAN"],
    bottomPriority: 7,
  },
] as const;

export const NAV_GROUP_ORDER: readonly NavGroupKey[] = [
  "workshop",
  "business",
  "admin",
] as const;

export function navItemsForRole(role: AppRole): NavItem[] {
  return APP_NAV_ITEMS.filter(
    (item) => !item.roles || item.roles.includes(role),
  );
}

export function navGroupsForRole(
  role: AppRole,
): { group: NavGroupKey; items: NavItem[] }[] {
  const items = navItemsForRole(role);
  return NAV_GROUP_ORDER.map((group) => ({
    group,
    items: items.filter((i) => i.group === group),
  })).filter((g) => g.items.length > 0);
}

/** Up to four items for the mobile bottom bar. */
export function bottomNavItemsForRole(role: AppRole, limit = 4): NavItem[] {
  return [...navItemsForRole(role)]
    .sort((a, b) => (a.bottomPriority ?? 99) - (b.bottomPriority ?? 99))
    .slice(0, limit);
}
