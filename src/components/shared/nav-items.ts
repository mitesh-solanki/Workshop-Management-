import {
  Car,
  ClipboardList,
  Columns3,
  Contact,
  FileText,
  Kanban,
  LayoutDashboard,
  Package,
  PackageMinus,
  PackagePlus,
  Settings,
  ShoppingCart,
  Truck,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type AppRole = "OWNER" | "MANAGER" | "TECHNICIAN" | "ACCOUNTANT";

export type NavKey =
  | "dashboard"
  | "workshop"
  | "bays"
  | "customers"
  | "vehicles"
  | "invoices"
  | "inventory"
  | "counterSales"
  | "vendors"
  | "partsRequests"
  | "purchaseOrders"
  | "vendorBills"
  | "purchaseReturns"
  | "team"
  | "orders"
  | "settings";

export type NavGroupKey = "workshop" | "business" | "admin";

export type NavChildItem = {
  href: string;
  key: NavKey;
  /** Roles that may see this child. Omit = inherit parent / all roles. */
  roles?: readonly AppRole[];
};

export type NavItem = {
  href: string;
  key: NavKey;
  icon: LucideIcon;
  group: NavGroupKey;
  /** Roles that may see this item. Omit = all roles. */
  roles?: readonly AppRole[];
  children?: readonly NavChildItem[];
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
    href: "/bays",
    key: "bays",
    icon: Columns3,
    group: "workshop",
    roles: ["OWNER", "MANAGER"],
  },
  {
    href: "/customers",
    key: "customers",
    icon: Contact,
    group: "business",
  },
  {
    href: "/vehicles",
    key: "vehicles",
    icon: Car,
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
    roles: ["OWNER", "MANAGER", "ACCOUNTANT"],
    children: [
      {
        href: "/inventory/sales",
        key: "counterSales",
        roles: ["OWNER", "MANAGER", "ACCOUNTANT"],
      },
    ],
  },
  {
    href: "/vendors",
    key: "vendors",
    icon: Truck,
    group: "business",
    roles: ["OWNER", "MANAGER", "ACCOUNTANT"],
  },
  {
    href: "/parts-requests",
    key: "partsRequests",
    icon: PackagePlus,
    group: "business",
    roles: ["OWNER", "MANAGER"],
  },
  {
    href: "/purchase-orders",
    key: "purchaseOrders",
    icon: ShoppingCart,
    group: "business",
    roles: ["OWNER", "MANAGER"],
  },
  {
    href: "/vendor-bills",
    key: "vendorBills",
    icon: Wallet,
    group: "business",
    roles: ["OWNER", "MANAGER", "ACCOUNTANT"],
  },
  {
    href: "/purchase-returns",
    key: "purchaseReturns",
    icon: PackageMinus,
    group: "business",
    roles: ["OWNER", "MANAGER", "ACCOUNTANT"],
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
    roles: ["OWNER", "MANAGER"],
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
  ).map((item) => {
    if (!item.children?.length) return item;
    const children = item.children.filter(
      (child) => !child.roles || child.roles.includes(role),
    );
    return children.length > 0 ? { ...item, children } : { ...item, children: undefined };
  });
}

/** True when pathname is under Inventory parts (not counter sales). */
export function isInventoryPartsPath(pathname: string): boolean {
  if (pathname === "/inventory") return true;
  if (!pathname.startsWith("/inventory/")) return false;
  return !pathname.startsWith("/inventory/sales");
}

export function isCounterSalesPath(pathname: string): boolean {
  return (
    pathname === "/inventory/sales" || pathname.startsWith("/inventory/sales/")
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
