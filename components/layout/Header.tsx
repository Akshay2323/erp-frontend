"use client";

import { Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { MenuSearch } from "./MenuSearch";
import { AnnouncementsDropdown } from "./AnnouncementsDropdown";
import { NotificationDropdown } from "./NotificationDropdown";
import { ProfileDropdown } from "./ProfileDropdown";
import { InstallButton } from "./InstallButton";
import { AppUpdateButton } from "./AppUpdateButton";
import type { MenuItem } from "@/lib/menu-data";

type HeaderProps = {
  isSidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  onOpenMobileSidebar: () => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
  menuItems: MenuItem[];
};

export function Header({
  isSidebarCollapsed,
  onToggleSidebar,
  onOpenMobileSidebar,
  searchValue,
  onSearchChange,
  menuItems,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-border bg-background/90 px-3 backdrop-blur sm:gap-3 sm:px-4">
      <Button
        aria-label="Open sidebar"
        className="lg:hidden"
        onClick={onOpenMobileSidebar}
        size="icon"
        variant="ghost"
      >
        <Menu className="h-4 w-4" />
      </Button>

      <Button
        aria-label="Toggle sidebar width"
        className="hidden lg:inline-flex"
        onClick={onToggleSidebar}
        size="icon"
        variant="ghost"
      >
        {isSidebarCollapsed ? (
          <PanelLeftOpen className="h-4 w-4" />
        ) : (
          <PanelLeftClose className="h-4 w-4" />
        )}
      </Button>

      <div className="min-w-0 flex-1">
        <MenuSearch onChange={onSearchChange} value={searchValue} menuItems={menuItems} />
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
        <InstallButton />
        <AppUpdateButton />
        <ThemeToggle />
        <AnnouncementsDropdown />
        <NotificationDropdown />
        <ProfileDropdown />
      </div>
    </header>
  );
}
