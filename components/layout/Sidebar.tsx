"use client";

import { X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useMemo, useRef, useState, useEffect } from "react";
import type { KeyboardEventHandler } from "react";
import Cookies from "js-cookie";

import { Button } from "@/components/ui/button";
import type { MenuItem } from "@/lib/menu-data";
import { fetchAuthMeCached } from "@/lib/auth-me-cache";
import { resolveApiAssetUrl } from "@/lib/api/employees/http";
import { cn } from "@/lib/utils";
import { SidebarItem } from "./SidebarItem";

type SidebarProps = {
  items: MenuItem[];
  isMobileOpen: boolean;
  isCollapsed: boolean;
  openMenuId: string | null;
  onToggleMenu: (id: string) => void;
  onCloseMobile: () => void;
};

const hasActiveChild = (item: MenuItem, pathname: string): boolean =>
  !!item.children?.some((child) => child.href === pathname);

export function Sidebar({
  items,
  isMobileOpen,
  isCollapsed,
  openMenuId,
  onToggleMenu,
  onCloseMobile,
}: SidebarProps) {
  const pathname = usePathname();
  const menuRef = useRef<HTMLElement>(null);
  
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string>("Smart HRMS");

  useEffect(() => {
    async function loadLogo() {
      try {
        const rawUser = localStorage.getItem("auth_user");
        if (!rawUser) return;

        const user = JSON.parse(rawUser);
        if (user.company?.name) {
          setCompanyName(user.company.name);
        }

        const token = Cookies.get("auth_token");
        if (!token) return;

        const me = await fetchAuthMeCached(token);
        if (me?.companyName) setCompanyName(me.companyName);
        else if (me?.tenantName) setCompanyName(me.tenantName);

        const resolved = resolveApiAssetUrl(me?.logoUrl) ?? me?.logoUrl ?? null;
        setLogoUrl(resolved);
      } catch (err) {
        console.warn("Failed to load company logo", err);
      }
    }

    void loadLogo();
  }, []);

  const autoOpenMenuId = useMemo(
    () => items.find((item) => hasActiveChild(item, pathname))?.id ?? null,
    [items, pathname],
  );

  const resolvedOpenMenuId = openMenuId ?? autoOpenMenuId;

  const moveFocus = (direction: 1 | -1) => {
    const container = menuRef.current;
    if (!container) return;

    const elements = Array.from(
      container.querySelectorAll<HTMLElement>("[data-focusable='true']"),
    );
    const activeIndex = elements.findIndex((element) => element === document.activeElement);
    if (activeIndex === -1) return;

    const nextIndex = (activeIndex + direction + elements.length) % elements.length;
    elements[nextIndex]?.focus();
  };

  const onMenuKeyDown: KeyboardEventHandler<HTMLElement> = (event) => {
    const current = event.target as HTMLElement;
    const hasChildren = current.dataset.hasChildren === "true";
    const itemId = current.dataset.itemId;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveFocus(1);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveFocus(-1);
      return;
    }

    if (event.key === "ArrowRight" && hasChildren && itemId && resolvedOpenMenuId !== itemId) {
      event.preventDefault();
      onToggleMenu(itemId);
      return;
    }

    if (event.key === "ArrowLeft" && hasChildren && itemId && resolvedOpenMenuId === itemId) {
      event.preventDefault();
      onToggleMenu(itemId);
    }
  };

  return (
    <>
      <div
        aria-hidden={!isMobileOpen}
        className={cn(
          "fixed inset-0 z-30 bg-black/40 transition-opacity lg:hidden",
          isMobileOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onCloseMobile}
      />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 border-r border-border bg-card transition-all duration-300 lg:sticky lg:top-0 lg:h-screen",
          isCollapsed ? "w-[88px]" : "w-[280px]",
          isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-border px-4">
          <div className={cn("flex items-center gap-2", isCollapsed && "justify-center w-full")}>
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt={companyName}
                className="h-8 w-8 rounded-lg object-contain bg-white"
                onError={() => setLogoUrl(null)}
              />
            ) : (
              <div className="h-8 w-8 rounded-lg bg-primary/15" />
            )}
            {!isCollapsed ? <span className="font-semibold truncate max-w-[180px]">{companyName}</span> : null}
          </div>
          <Button
            className="lg:hidden"
            onClick={onCloseMobile}
            size="icon"
            variant="ghost"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <nav
          className="h-[calc(100vh-4rem)] overflow-y-auto px-3 py-4"
          onKeyDown={onMenuKeyDown}
          ref={menuRef}
          role="menu"
        >
          <ul className="space-y-1">
            {items.map((item) => (
              <SidebarItem
                isCollapsed={isCollapsed}
                isOpen={resolvedOpenMenuId === item.id}
                item={item}
                key={item.id}
                onLeafClick={onCloseMobile}
                onToggle={onToggleMenu}
                pathname={pathname}
              />
            ))}
          </ul>
        </nav>
      </aside>
    </>
  );
}
