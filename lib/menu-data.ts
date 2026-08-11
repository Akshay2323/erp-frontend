import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CircleHelp,
  Clock3,
  LayoutDashboard,
  MapPin,
  Settings,
  WalletCards,
} from "lucide-react";

export type MenuItem = {
  id: string;
  label: string;
  href?: string;
  icon?: LucideIcon;
  children?: MenuItem[];
};

type ChildMenuInput =
  | string
  | {
      label: string;
      href: string;
      id?: string;
    };

const slug = (value: string) =>
  value.toLowerCase().replace(/&/g, "and").replace(/\s+/g, "-");

const toChildMenuItem = (parentId: string, child: ChildMenuInput): MenuItem => {
  if (typeof child === "string") {
    return {
      id: `${parentId}-${slug(child)}`,
      label: child,
      href: `/${slug(child)}`,
    };
  }

  return {
    id: child.id ?? `${parentId}-${slug(child.label)}`,
    label: child.label,
    href: child.href,
  };
};

const withChildren = (
  id: string,
  label: string,
  icon: LucideIcon,
  items: ChildMenuInput[],
): MenuItem => ({
  id,
  label,
  icon,
  children: items.map((child) => toChildMenuItem(id, child)),
});

export const menuData: MenuItem[] = [
  withChildren("dashboard", "Dashboard", LayoutDashboard, [
    { label: "Employee Dashboard", href: "/employee-dashboard" },
    { label: "HR Dashboard", href: "/hr-dashboard" },
    { label: "HOD Dashboard", href: "/hod-dashboard" },
    { label: "Director Dashboard", href: "/director-dashboard" },
  ]),
  withChildren("organization", "Organization", Building2, [
    { label: "Company", href: "/company" },
    { label: "Branch", href: "/branch" },
    { label: "Department", href: "/department" },
    { label: "Designation", href: "/designation" },
  ]),
  withChildren("employee-management", "Employee ", BriefcaseBusiness, [
    { label: "Employee List", href: "/employee-list" },
    { label: "Add Employee", href: "/add-employee" },
    { label: "Employee Profile", href: "/employee-profile" },
    { label: "Documents", href: "/documents" },
  ]),

  withChildren("attendance", "Attendance", Clock3, [
    { label: "Daily Attendance", href: "/attendance" },
    { label: "Monthly Attendance", href: "/monthly-attendance" },
    { label: "Live Attendance", href: "/live-attendance" },
    { label: "Attendance Board", href: "/attendance-board" },
  ]),
  withChildren("geo-location", "Geo Location", MapPin, [
    { label: "Location List", href: "/location-list" },
    { label: "Add Location", href: "/add-location" },
  ]),
  withChildren("shift-management", "Shift Management", CalendarDays, [
    { label: "Shift List", href: "/shift-list" },
    { label: "Shift Rules", href: "/shift-rules" },
  ]),
  withChildren("holiday-management", "Holiday Management", CalendarDays, [
    { label: "Holiday List", href: "/holiday-list" },
    { label: "Add Holiday", href: "/add-holiday" },
  ]),
  withChildren("leave-management", "Leave Management", WalletCards, [
    { label: "Leave Requests", href: "/leave-requests" },
    { label: "Apply Leave", href: "/apply-leave" },
    { label: "Leave Policies List", href: "/leave-policies" },
    { label: "Leave Policies Add", href: "/leave-policies/new" },
  ]),
  withChildren("payroll", "Payroll", BarChart3, [
    { label: "Salary Structure", href: "/salary-structure" },
    { label: "Payroll Summary", href: "/payroll-summary" },
    { label: "Run Payroll", href: "/run-payroll" },
    { label: "Payment History", href: "/payment-history" },
    { id: "payroll-my-salary", label: "My Salary", href: "/my-salary" },
  ]),
  {
    id: "user-guidance",
    label: "User Guide",
    href: "/user-guidance",
    icon: CircleHelp,
  },
  {
    id: "settings",
    label: "Settings",
    href: "/settings",
    icon: Settings,
  },
];
