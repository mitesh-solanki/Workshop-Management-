import {
  Car,
  CalendarDays,
  ChartColumn,
  ClipboardCheck,
  ClipboardList,
  Columns3,
  Contact,
  FileText,
  Kanban,
  LayoutDashboard,
  Package,
  PackageMinus,
  Receipt,
  Settings,
  ShoppingCart,
  Ticket,
  Truck,
  Users,
  Wallet,
  IndianRupee,
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
  | "reports"
  | "dailySummary"
  | "inventory"
  | "counterSales"
  | "vendors"
  | "purchaseOrders"
  | "vendorBills"
  | "purchaseReturns"
  | "expenses"
  | "team"
  | "payroll"
  | "orders"
  | "jobSlips"
  | "inspections"
  | "settings";

export type NavGroupKey = "workshop" | "business" | "admin";

export type NavChildItem = {
  href: string;
  key: NavKey;
  /** Roles that may see this child. Omit = inherit parent / all roles. */
  roles?: readonly AppRole[];
};

/** Hover flyout action (Cruise-style Add / View). */
export type NavFlyoutItem = {
  href: string;
  /** i18n key under `nav.flyout.*` */
  labelKey: string;
  kind: "list" | "add";
  /** Roles that may see this action. Omit = same as parent item. */
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
  flyout?: readonly NavFlyoutItem[];
};

/** Modules that exist as routes today. */
export const APP_NAV_ITEMS: readonly NavItem[] = [
  {
    href: "/dashboard",
    key: "dashboard",
    icon: LayoutDashboard,
    group: "workshop",
    roles: ["OWNER", "MANAGER", "ACCOUNTANT"],
    flyout: [{ href: "/dashboard", labelKey: "viewDashboard", kind: "list" }],
  },
  {
    href: "/workshop",
    key: "workshop",
    icon: Kanban,
    group: "workshop",
    flyout: [{ href: "/workshop", labelKey: "viewWorkshop", kind: "list" }],
  },
  {
    href: "/inspections",
    key: "inspections",
    icon: ClipboardCheck,
    group: "workshop",
    roles: ["OWNER", "MANAGER", "ACCOUNTANT"],
    flyout: [
      {
        href: "/inspections/new",
        labelKey: "addInspection",
        kind: "add",
        roles: ["OWNER", "MANAGER"],
      },
      { href: "/inspections", labelKey: "viewInspections", kind: "list" },
    ],
  },
  {
    href: "/orders",
    key: "orders",
    icon: ClipboardList,
    group: "workshop",
    flyout: [
      {
        href: "/orders/new",
        labelKey: "addOrder",
        kind: "add",
        roles: ["OWNER", "MANAGER"],
      },
      { href: "/orders", labelKey: "viewOrders", kind: "list" },
    ],
  },
  {
    href: "/job-slips",
    key: "jobSlips",
    icon: Ticket,
    group: "workshop",
    roles: ["OWNER", "MANAGER", "ACCOUNTANT"],
    flyout: [{ href: "/job-slips", labelKey: "viewJobSlips", kind: "list" }],
  },
  {
    href: "/work-stations",
    key: "bays",
    icon: Columns3,
    group: "workshop",
    roles: ["OWNER", "MANAGER"],
    flyout: [
      {
        href: "/work-stations?create=1",
        labelKey: "addBay",
        kind: "add",
      },
      { href: "/work-stations", labelKey: "viewBays", kind: "list" },
    ],
  },
  {
    href: "/customers",
    key: "customers",
    icon: Contact,
    group: "business",
    roles: ["OWNER", "MANAGER", "ACCOUNTANT"],
    flyout: [
      {
        href: "/customers?create=1",
        labelKey: "addCustomer",
        kind: "add",
        roles: ["OWNER", "MANAGER"],
      },
      { href: "/customers", labelKey: "viewCustomers", kind: "list" },
    ],
  },
  {
    href: "/vehicles",
    key: "vehicles",
    icon: Car,
    group: "business",
    roles: ["OWNER", "MANAGER", "ACCOUNTANT"],
    flyout: [
      {
        href: "/vehicles?create=1",
        labelKey: "addVehicle",
        kind: "add",
        roles: ["OWNER", "MANAGER"],
      },
      { href: "/vehicles", labelKey: "viewVehicles", kind: "list" },
    ],
  },
  {
    href: "/invoices",
    key: "invoices",
    icon: FileText,
    group: "business",
    roles: ["OWNER", "MANAGER", "ACCOUNTANT"],
    flyout: [{ href: "/invoices", labelKey: "viewInvoices", kind: "list" }],
  },
  {
    href: "/reports",
    key: "reports",
    icon: ChartColumn,
    group: "business",
    roles: ["OWNER", "MANAGER", "ACCOUNTANT"],
    flyout: [{ href: "/reports", labelKey: "viewReports", kind: "list" }],
  },
  {
    href: "/daily-summary",
    key: "dailySummary",
    icon: CalendarDays,
    group: "business",
    roles: ["OWNER", "MANAGER", "ACCOUNTANT"],
    flyout: [
      { href: "/daily-summary", labelKey: "viewDailySummary", kind: "list" },
    ],
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
    flyout: [
      { href: "/inventory/new", labelKey: "addInventory", kind: "add" },
      { href: "/inventory", labelKey: "viewInventory", kind: "list" },
      {
        href: "/inventory/sales/new",
        labelKey: "addCounterSale",
        kind: "add",
      },
      {
        href: "/inventory/sales",
        labelKey: "viewCounterSales",
        kind: "list",
      },
    ],
  },
  {
    href: "/vendors",
    key: "vendors",
    icon: Truck,
    group: "business",
    roles: ["OWNER", "MANAGER", "ACCOUNTANT"],
    flyout: [
      {
        href: "/vendors?create=1",
        labelKey: "addVendor",
        kind: "add",
        roles: ["OWNER", "MANAGER"],
      },
      { href: "/vendors", labelKey: "viewVendors", kind: "list" },
    ],
  },
  {
    href: "/purchase-orders",
    key: "purchaseOrders",
    icon: ShoppingCart,
    group: "business",
    roles: ["OWNER", "MANAGER"],
    flyout: [
      {
        href: "/purchase-orders/new",
        labelKey: "addPurchaseOrder",
        kind: "add",
      },
      {
        href: "/purchase-orders",
        labelKey: "viewPurchaseOrders",
        kind: "list",
      },
    ],
  },
  {
    href: "/vendor-bills",
    key: "vendorBills",
    icon: Wallet,
    group: "business",
    roles: ["OWNER", "MANAGER", "ACCOUNTANT"],
    flyout: [
      { href: "/vendor-bills", labelKey: "viewVendorBills", kind: "list" },
    ],
  },
  {
    href: "/purchase-returns",
    key: "purchaseReturns",
    icon: PackageMinus,
    group: "business",
    roles: ["OWNER", "MANAGER", "ACCOUNTANT"],
    flyout: [
      {
        href: "/purchase-returns",
        labelKey: "viewPurchaseReturns",
        kind: "list",
      },
    ],
  },
  {
    href: "/expenses",
    key: "expenses",
    icon: Receipt,
    group: "business",
    roles: ["OWNER", "MANAGER", "ACCOUNTANT"],
    flyout: [
      {
        href: "/expenses?create=1",
        labelKey: "addExpense",
        kind: "add",
        roles: ["OWNER", "MANAGER", "ACCOUNTANT"],
      },
      { href: "/expenses", labelKey: "viewExpenses", kind: "list" },
    ],
  },
  {
    href: "/team",
    key: "team",
    icon: Users,
    group: "admin",
    roles: ["OWNER", "MANAGER", "ACCOUNTANT"],
    flyout: [
      {
        href: "/team?create=1",
        labelKey: "addTeamMember",
        kind: "add",
        roles: ["OWNER"],
      },
      { href: "/team", labelKey: "viewTeam", kind: "list" },
    ],
  },
  {
    href: "/payroll",
    key: "payroll",
    icon: IndianRupee,
    group: "admin",
    roles: ["OWNER", "ACCOUNTANT"],
    flyout: [
      {
        href: "/payroll/new",
        labelKey: "createPayrollRun",
        kind: "add",
      },
      { href: "/payroll", labelKey: "viewPayroll", kind: "list" },
    ],
  },
  {
    href: "/settings",
    key: "settings",
    icon: Settings,
    group: "admin",
    roles: ["OWNER", "MANAGER"],
    flyout: [{ href: "/settings", labelKey: "viewSettings", kind: "list" }],
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
    const children = item.children?.filter(
      (child) => !child.roles || child.roles.includes(role),
    );
    const flyout = item.flyout?.filter(
      (action) => !action.roles || action.roles.includes(role),
    );
    return {
      ...item,
      children: children && children.length > 0 ? children : undefined,
      flyout: flyout && flyout.length > 0 ? flyout : undefined,
    };
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
