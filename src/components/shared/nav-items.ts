import {
  ClipboardList,
  Contact,
  FileText,
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
  | "invoices"
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
};

/**
 * Modules that exist as routes today.
 * Later: reports — add when pages ship.
 */
export const APP_NAV_ITEMS: readonly NavItem[] = [
  {
    href: "/dashboard",
    key: "dashboard",
    icon: LayoutDashboard,
    group: "workshop",
  },
  {
    href: "/workshop",
    key: "workshop",
    icon: Kanban,
    group: "workshop",
  },
  {
    href: "/orders",
    key: "orders",
    icon: ClipboardList,
    group: "workshop",
  },
  {
    href: "/customers",
    key: "customers",
    icon: Contact,
    group: "business",
  },
  {
    href: "/invoices",
    key: "invoices",
    icon: FileText,
    group: "business",
    roles: ["OWNER", "MANAGER", "ACCOUNTANT"],
  },
  {
    href: "/inventory",
    key: "inventory",
    icon: Package,
    group: "business",
  },
  {
    href: "/team",
    key: "team",
    icon: Users,
    group: "admin",
    roles: ["OWNER", "MANAGER"],
  },
  {
    href: "/settings",
    key: "settings",
    icon: Settings,
    group: "admin",
    roles: ["OWNER", "MANAGER", "TECHNICIAN"],
  },
] as const;

export const NAV_GROUP_ORDER: readonly NavGroupKey[] = [
  "workshop",
  "business",
  "admin",
];

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
