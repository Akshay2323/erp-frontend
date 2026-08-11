"use client";

import { Megaphone, X, Clock, Check } from "lucide-react";
import { useState, useEffect, useRef, Suspense } from "react";
import { createPortal } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useAuthToken } from "@/lib/use-auth-token";
import { getAnnouncements, readAnnouncement, type Announcement } from "@/lib/api/announcement";
import { deliverNotification } from "@/lib/notifications/app-notifications";
import { cn } from "@/lib/utils";

function AnnouncementsDropdownInner() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [open, setOpen] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);
  const [persistentlyReadIds, setPersistentlyReadIds] = useState<number[]>([]);
  const [mounted, setMounted] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Set mounted on client side
  useEffect(() => {
    setMounted(true);
    try {
      const raw = localStorage.getItem("hrms_read_announcement_ids");
      if (raw) {
        setPersistentlyReadIds(JSON.parse(raw) as number[]);
      }
    } catch (e) {
      console.error("Failed to load read announcements from localStorage", e);
    }
  }, []);

  const { data: announcements = [] } = useQuery({
    queryKey: ["announcements", token],
    queryFn: () => getAnnouncements(token || ""),
    enabled: Boolean(token),
    staleTime: 60000,
  });

  const isRead = (a: Announcement) => {
    if (a.is_read === true || (a.is_read as any) === 1 || String(a.is_read) === "1") return true;
    if (persistentlyReadIds.includes(a.id)) return true;
    return false;
  };

  // Calculate unread count (only count published announcements that are not read)
  const unreadAnnouncements = announcements.filter(
    (a) => !isRead(a) && a.status === "published"
  );
  const unreadCount = unreadAnnouncements.length;

  const markAsReadLocally = (id: number) => {
    setPersistentlyReadIds((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      try {
        localStorage.setItem("hrms_read_announcement_ids", JSON.stringify(next));
      } catch (e) {
        console.error("Failed to save read announcements to localStorage", e);
      }
      return next;
    });
  };

  const markAllAsReadLocally = (ids: number[]) => {
    setPersistentlyReadIds((prev) => {
      const next = Array.from(new Set([...prev, ...ids]));
      try {
        localStorage.setItem("hrms_read_announcement_ids", JSON.stringify(next));
      } catch (e) {
        console.error("Failed to save read announcements to localStorage", e);
      }
      return next;
    });
  };

  // Handle URL Search Params for deep linking / notification clicks
  useEffect(() => {
    const paramId = searchParams?.get("announcementId");
    if (paramId && announcements.length > 0) {
      const numericId = Number(paramId);
      const found = announcements.find((a) => a.id === numericId);
      if (found) {
        setSelectedAnnouncement(found);
        
        // IMMEDIATELY remove it from the URL so it doesn't re-open on refresh!
        const params = new URLSearchParams(window.location.search);
        params.delete("announcementId");
        const newSearch = params.toString();
        router.replace(window.location.pathname + (newSearch ? `?${newSearch}` : ""));
      }
    }
  }, [searchParams, announcements, router]);

  // Handle auto-triggering notifications for new announcements
  useEffect(() => {
    if (announcements.length === 0) return;

    const notifiedKey = "hrms_notified_announcements";
    let notifiedIds: number[] = [];
    try {
      const raw = sessionStorage.getItem(notifiedKey);
      if (raw) notifiedIds = JSON.parse(raw) as number[];
    } catch {}

    const unnotified = announcements.filter(
      (a) => !isRead(a) && a.status === "published" && !notifiedIds.includes(a.id)
    );

    if (unnotified.length > 0) {
      unnotified.forEach((item) => {
        void deliverNotification({
          title: "New Announcement: " + item.title,
          body: item.content,
          href: `?announcementId=${item.id}`,
          kind: "system",
        });
        notifiedIds.push(item.id);
      });

      try {
        sessionStorage.setItem(notifiedKey, JSON.stringify(notifiedIds));
      } catch {}
    }
  }, [announcements, persistentlyReadIds]);

  // Handle clicking outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleOpenAnnouncement = (announcement: Announcement) => {
    setSelectedAnnouncement(announcement);
    setOpen(false); // Close dropdown
  };

  const handleMarkAllAsRead = async () => {
    if (unreadCount === 0) return;
    const idsToMark = unreadAnnouncements.map((a) => a.id);
    markAllAsReadLocally(idsToMark);
    try {
      const promises = idsToMark.map((id) => readAnnouncement(token || "", id));
      await Promise.all(promises);
      toast.success("All announcements marked as read");
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
    } catch (err) {
      // Rollback on error
      setPersistentlyReadIds((prev) => prev.filter((id) => !idsToMark.includes(id)));
      toast.error("Failed to mark all as read");
    }
  };

  const handleCloseDetailModal = () => {
    setSelectedAnnouncement(null);
    const params = new URLSearchParams(window.location.search);
    params.delete("announcementId");
    const newSearch = params.toString();
    router.replace(window.location.pathname + (newSearch ? `?${newSearch}` : ""));
  };

  const modalJSX = selectedAnnouncement && (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-start justify-between border-b border-border pb-3 mb-4">
          <div className="min-w-0 flex-1 pr-4">
            <h3 className="text-base font-bold text-foreground truncate" title={selectedAnnouncement.title}>
              {selectedAnnouncement.title}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Published: {new Date(selectedAnnouncement.published_at || selectedAnnouncement.created_at).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit"
              })}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full shrink-0"
            onClick={handleCloseDetailModal}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto pr-1">
          {selectedAnnouncement.content}
        </div>
        <div className="flex justify-end gap-2 border-t border-border pt-4 mt-6">
          {!isRead(selectedAnnouncement) && (
            <Button
              onClick={async () => {
                markAsReadLocally(selectedAnnouncement.id);
                try {
                  await readAnnouncement(token || "", selectedAnnouncement.id);
                  queryClient.invalidateQueries({ queryKey: ["announcements"] });
                  toast.success("Marked as read");
                } catch (err) {
                  console.error(err);
                }
                handleCloseDetailModal();
              }}
              className="rounded-xl bg-primary text-primary-foreground gap-1.5"
            >
              <Check className="h-4 w-4" />
              Mark as Read
            </Button>
          )}
          <Button onClick={handleCloseDetailModal} variant="outline" className="rounded-xl">
            Close
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        <Button
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label="Announcements"
          onClick={() => setOpen((prev) => !prev)}
          size="icon"
          variant="ghost"
          className="relative"
        >
          <Megaphone className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white ring-2 ring-background animate-in zoom-in duration-200">
              {unreadCount}
            </span>
          )}
        </Button>

        <div
          className={cn(
            "absolute right-0 z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-border bg-popover p-3 shadow-lg transition-all",
            open
              ? "pointer-events-auto translate-y-0 opacity-100"
              : "pointer-events-none -translate-y-1 opacity-0"
          )}
          role="menu"
        >
          <div className="flex items-center justify-between border-b border-border pb-2 mb-2 px-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Announcements
            </span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-[11px] text-primary hover:underline font-medium"
              >
                Mark all as read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto space-y-1">
            {announcements.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                No announcements yet.
              </div>
            ) : (
              announcements.map((item) => {
                const read = isRead(item);
                return (
                  <button
                    key={item.id}
                    onClick={() => handleOpenAnnouncement(item)}
                    className={cn(
                      "w-full text-left rounded-lg p-2.5 transition-colors hover:bg-muted/50 block border border-transparent",
                      !read && item.status === "published"
                        ? "bg-primary/[0.03] border-primary/10"
                        : ""
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className={cn(
                        "text-sm font-medium text-foreground leading-snug",
                        !read && item.status === "published" ? "font-semibold text-primary" : ""
                      )}>
                        {item.title}
                      </p>
                      {!read && item.status === "published" && (
                        <span className="h-2 w-2 shrink-0 rounded-full bg-primary mt-1.5 animate-pulse" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                      {item.content}
                    </p>
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/80 mt-2">
                      <Clock className="h-3 w-3" />
                      {new Date(item.published_at || item.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Render modal directly in document.body via Portal to prevent layout clipping */}
      {selectedAnnouncement && mounted && typeof document !== "undefined" && createPortal(modalJSX, document.body)}
    </>
  );
}

export function AnnouncementsDropdown() {
  return (
    <Suspense fallback={
      <Button size="icon" variant="ghost">
        <Megaphone className="h-4 w-4" />
      </Button>
    }>
      <AnnouncementsDropdownInner />
    </Suspense>
  );
}
