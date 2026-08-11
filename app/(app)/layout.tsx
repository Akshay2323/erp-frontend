"use client";

import { useEffect, useMemo, useState } from "react";
import Cookies from "js-cookie";

import { AuthSessionRefresh } from "@/components/auth/AuthSessionRefresh";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { NotificationManager } from "@/components/notifications/NotificationManager";
import {
  AdminPunchPermissionPrompt,
  PushPermissionPrompt,
} from "@/components/notifications/AdminPunchPermissionPrompt";
import { DevicePermissionBootstrap } from "@/components/pwa/DevicePermissionBootstrap";
import { menuData } from "@/lib/menu-data";
import type { MenuItem } from "@/lib/menu-data";
import { fetchAuthMeCached } from "@/lib/auth-me-cache";
import { setHomeDashboardCookie } from "@/lib/auth-cookie";
import { resolveRoleString, type AuthUser } from "@/lib/auth-session";

const filterMenu = (items: MenuItem[], query: string): MenuItem[] => {
  if (!query.trim()) return items;

  const normalized = query.toLowerCase();

  return items
    .map((item) => {
      const ownMatch = item.label.toLowerCase().includes(normalized);
      const filteredChildren = item.children?.filter((child) =>
        child.label.toLowerCase().includes(normalized),
      );

      if (ownMatch) {
        return item;
      }

      if (filteredChildren?.length) {
        return { ...item, children: filteredChildren };
      }

      return null;
    })
    .filter((item): item is MenuItem => item !== null);
};

const filterMenuByRole = (items: MenuItem[], role: string | null): MenuItem[] => {
  if (!role) return items;

  const normalizedRole = role.toLowerCase().trim();
  const isEmployee = normalizedRole === "employee";
  const isHod = normalizedRole === "hod";
  const isDirector = normalizedRole === "director";

  return items
    .map((item) => {
      if (item.id === "dashboard" && item.children) {
        const filteredChildren = isEmployee
          ? item.children.filter(
              (child) =>
                child.label.toLowerCase() === "employee dashboard" ||
                child.id === "dashboard-employee-dashboard",
            )
          : isHod
            ? item.children.filter(
                (child) =>
                  child.label.toLowerCase() === "hod dashboard" ||
                  child.href === "/hod-dashboard",
              )
            : isDirector
              ? item.children.filter(
                  (child) =>
                    child.label.toLowerCase() === "director dashboard" ||
                    child.href === "/director-dashboard",
                )
              : item.children;
        return { ...item, children: filteredChildren };
      }

      if (item.id === "employee-management" && item.children) {
        const filteredChildren = isEmployee
          ? item.children.filter(
              (child) =>
                child.label.toLowerCase() === "employee profile" ||
                child.label.toLowerCase() === "documents",
            )
          : item.children;
        return { ...item, children: filteredChildren };
      }

      if (item.id === "leave-management" && item.children) {
        const filteredChildren = isEmployee
          ? item.children.filter(
              (child) =>
                child.href === "/leave-requests" ||
                child.href === "/apply-leave",
            )
          : item.children;
        return { ...item, children: filteredChildren };
      }

      if (item.id === "attendance" && item.children) {
        const filteredChildren = isEmployee
          ? item.children.filter(
              (child) => child.href !== "/live-attendance" && child.href !== "/attendance-board",
            )
          : item.children;
        return { ...item, children: filteredChildren };
      }

      if (item.id === "payroll" && item.children) {
        const filteredChildren = isEmployee
          ? item.children.filter(
              (child) => child.id === "payroll-my-salary",
            )
          : item.children;
        // If no children remain visible for this role, exclude the group
        if (filteredChildren.length === 0) return null;
        return { ...item, children: filteredChildren };
      }

      return item;
    })
    .filter((item): item is MenuItem => item !== null)
    .filter((item) => {
      if (isEmployee) {
        if (
          item.id === "organization" ||
          item.id === "geo-location" ||
          item.id === "shift-management" ||
          item.id === "holiday-management"
        ) {
          return false;
        }
      }
      return true;
    });
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    // Read from localStorage inside useEffect (client-only) to avoid hydration mismatch
    try {
      const authUser = localStorage.getItem("auth_user");
      if (authUser) {
        const parsed = JSON.parse(authUser) as AuthUser;
        const role = resolveRoleString(parsed);
        if (role) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setUserRole(role);
        }
        setHomeDashboardCookie(parsed);
      }
    } catch (e) {
      console.error("Failed to read user role from localStorage", e);
    }

    const refreshUserRole = async () => {
      const token = Cookies.get("auth_token");
      if (!token) return;
      try {
        const me = await fetchAuthMeCached(token);
        if (me?.role) {
          setUserRole(me.role);
          const authUserStr = localStorage.getItem("auth_user");
          if (authUserStr) {
            try {
              const authUser = JSON.parse(authUserStr) as AuthUser;
              authUser.role = me.role;
              if (typeof me.is_admin === "boolean") authUser.is_admin = me.is_admin;
              if (typeof me.is_super_admin === "boolean") {
                authUser.is_super_admin = me.is_super_admin;
              }
              localStorage.setItem("auth_user", JSON.stringify(authUser));
              setHomeDashboardCookie(authUser);
            } catch {}
          } else {
            setHomeDashboardCookie({ role: me.role } as AuthUser);
          }
        }
      } catch (err) {
        console.error("Failed to fetch user role from API", err);
      }
    };

    refreshUserRole();
  }, []);

  const roleFilteredMenu = useMemo(
    () => filterMenuByRole(menuData, userRole),
    [userRole],
  );

  const filteredMenu = useMemo(
    () => filterMenu(roleFilteredMenu, searchQuery),
    [roleFilteredMenu, searchQuery],
  );

  const handleToggleMenu = (id: string) => {
    setOpenMenuId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="min-h-screen bg-background">
      <AuthSessionRefresh />
      <NotificationManager />
      <AdminPunchPermissionPrompt />
      <PushPermissionPrompt />
      <DevicePermissionBootstrap />
      <div className="flex">
        <Sidebar
          isCollapsed={collapsed}
          isMobileOpen={mobileOpen}
          items={filteredMenu}
          onCloseMobile={() => setMobileOpen(false)}
          onToggleMenu={handleToggleMenu}
          openMenuId={openMenuId}
        />
        <div className="flex min-h-screen min-w-0 w-full flex-col">
          <Header
            isSidebarCollapsed={collapsed}
            onOpenMobileSidebar={() => setMobileOpen(true)}
            onSearchChange={setSearchQuery}
            onToggleSidebar={() => setCollapsed((prev) => !prev)}
            searchValue={searchQuery}
            menuItems={roleFilteredMenu}
          />
          <main className="mx-auto w-full min-w-0 max-w-[1600px] flex-1 overflow-x-hidden p-4 transition-all duration-300 sm:p-6 lg:p-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
