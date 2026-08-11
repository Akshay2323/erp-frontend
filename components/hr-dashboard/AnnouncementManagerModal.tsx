"use client";

import { Megaphone, Plus, Clock, X, FileText, CheckCircle, AlertCircle, Eye } from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuthToken } from "@/lib/use-auth-token";
import { readAuthUser } from "@/lib/auth-session";
import { getAnnouncements, createAnnouncement, type Announcement } from "@/lib/api/announcement";
import { cn } from "@/lib/utils";

type AnnouncementManagerModalProps = {
  open: boolean;
  onClose: () => void;
};

export function AnnouncementManagerModal({ open, onClose }: AnnouncementManagerModalProps) {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"list" | "create">("list");
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);

  // Form states
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [audienceScope, setAudienceScope] = useState<"company" | "all">("company");
  const [status, setStatus] = useState<"published" | "draft">("published");
  const [publishedAt, setPublishedAt] = useState(() => {
    // Current local time formatted for input type="datetime-local" (YYYY-MM-DDTHH:mm)
    const tzoffset = new Date().getTimezoneOffset() * 60000;
    return new Date(Date.now() - tzoffset).toISOString().slice(0, 16);
  });

  const { data: announcements = [], isLoading } = useQuery({
    queryKey: ["announcements", token],
    queryFn: () => getAnnouncements(token || ""),
    enabled: open && Boolean(token),
  });

  const createMutation = useMutation({
    mutationFn: async (payload: {
      company_id: number;
      title: string;
      content: string;
      audience_scope: "company" | "all";
      status: "published" | "draft";
      published_at: string;
    }) => {
      return createAnnouncement(token || "", payload);
    },
    onSuccess: () => {
      toast.success("Announcement created successfully");
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
      // Reset form
      setTitle("");
      setContent("");
      setAudienceScope("company");
      setStatus("published");
      setActiveTab("list");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to create announcement");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      toast.error("Please enter a title and content");
      return;
    }

    const user = readAuthUser();
    const companyId = Number(user?.company?.id || user?.company_id || 0);

    createMutation.mutate({
      company_id: companyId,
      title: title.trim(),
      content: content.trim(),
      audience_scope: audienceScope,
      status: status,
      published_at: new Date(publishedAt).toISOString(),
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-4xl h-[85vh] rounded-2xl border border-border bg-card shadow-xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border bg-muted/20 px-6 py-4 shrink-0">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-primary/10 p-1.5 text-primary">
              <Megaphone className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">Announcement Management</h3>
              <p className="text-xs text-muted-foreground">Manage and publish internal system communications</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="flex border-b border-border bg-muted/10 px-6 py-2 shrink-0 gap-2">
          <Button
            variant={activeTab === "list" ? "outline" : "ghost"}
            size="sm"
            onClick={() => {
              setActiveTab("list");
              setSelectedAnnouncement(null);
            }}
            className="rounded-lg text-xs"
          >
            Announcement List
          </Button>
          <Button
            variant={activeTab === "create" ? "outline" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("create")}
            className="rounded-lg text-xs gap-1"
          >
            <Plus className="h-3 w-3" />
            Create Announcement
          </Button>
        </div>

        {/* Modal Content Area */}
        <div className="flex-1 overflow-hidden flex min-h-0">
          {activeTab === "list" ? (
            <div className="flex-1 flex overflow-hidden divide-x divide-border">
              {/* Left List Pane */}
              <div className="w-full md:w-1/2 overflow-y-auto p-6 space-y-3">
                {isLoading ? (
                  <div className="py-12 text-center text-sm text-muted-foreground">
                    Loading announcements...
                  </div>
                ) : announcements.length === 0 ? (
                  <div className="border border-dashed border-border rounded-xl py-16 text-center">
                    <Megaphone className="h-8 w-8 text-muted-foreground mx-auto opacity-50 mb-2" />
                    <p className="text-sm font-semibold">No announcements</p>
                    <p className="text-xs text-muted-foreground mt-1">Publish an announcement to notify staff.</p>
                  </div>
                ) : (
                  announcements.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setSelectedAnnouncement(item)}
                      className={cn(
                        "w-full text-left rounded-xl border border-border p-4 transition-all hover:bg-muted/15 flex flex-col gap-2 relative",
                        selectedAnnouncement?.id === item.id ? "border-primary bg-primary/[0.02] shadow-sm" : ""
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-semibold text-sm text-foreground line-clamp-1">{item.title}</h4>
                        <div className="flex gap-1.5 shrink-0">
                          <span className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-medium leading-none capitalize",
                            item.status === "published" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400" : "bg-slate-100 text-slate-700 dark:bg-slate-800/40 dark:text-slate-400"
                          )}>
                            {item.status}
                          </span>
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium leading-none text-primary capitalize">
                            {item.audience_scope}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{item.content}</p>
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground/80 mt-1">
                        <Clock className="h-3.5 w-3.5" />
                        {new Date(item.published_at || item.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </div>
                    </button>
                  ))
                )}
              </div>

              {/* Right Detail Pane */}
              <div className="hidden md:flex md:w-1/2 flex-col p-6 overflow-y-auto">
                {selectedAnnouncement ? (
                  <div className="space-y-4">
                    <div className="border-b border-border pb-3">
                      <h4 className="text-base font-bold text-foreground">{selectedAnnouncement.title}</h4>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" />
                          <span>
                            {new Date(selectedAnnouncement.published_at || selectedAnnouncement.created_at).toLocaleDateString("en-US", {
                              month: "long",
                              day: "numeric",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit"
                            })}
                          </span>
                        </div>
                        <span className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-medium capitalize",
                          selectedAnnouncement.status === "published" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400" : "bg-slate-100 text-slate-700 dark:bg-slate-800/40 dark:text-slate-400"
                        )}>
                          {selectedAnnouncement.status}
                        </span>
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary capitalize">
                          Scope: {selectedAnnouncement.audience_scope}
                        </span>
                      </div>
                    </div>
                    <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed pr-1">
                      {selectedAnnouncement.content}
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center opacity-60">
                    <FileText className="h-10 w-10 text-muted-foreground mb-2" />
                    <p className="text-sm font-semibold">Select Announcement</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Click an announcement to view details.</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Creation Form */
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 max-w-xl mx-auto w-full">
              <div>
                <label className="text-sm font-semibold text-foreground">Announcement Title</label>
                <Input
                  className="mt-1"
                  placeholder="e.g. System Maintenance Notice"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-foreground">Content</label>
                <Textarea
                  className="mt-1 min-h-[160px]"
                  placeholder="Write the details of the announcement here..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-foreground">Audience Scope</label>
                  <select
                    value={audienceScope}
                    onChange={(e) => setAudienceScope(e.target.value as "company" | "all")}
                    className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
                  >
                    <option value="company">Current Company</option>
                    <option value="all">System Wide (All Companies)</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-semibold text-foreground">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as "published" | "draft")}
                    className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
                  >
                    <option value="published">Published</option>
                    <option value="draft">Draft</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-foreground">Publication Date / Time</label>
                <Input
                  className="mt-1"
                  type="datetime-local"
                  value={publishedAt}
                  onChange={(e) => setPublishedAt(e.target.value)}
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setActiveTab("list")}
                  className="rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="rounded-xl gap-1.5"
                >
                  {createMutation.isPending ? "Publishing..." : "Publish Announcement"}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
