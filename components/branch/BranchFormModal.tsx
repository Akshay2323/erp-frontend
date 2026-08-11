"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import dynamic from "next/dynamic";
import { Crosshair, MapPin, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import type {
  Branch,
  BranchApiError,
  CreateBranchPayload,
  UpdateBranchPayload,
  BranchStatus,
} from "@/lib/api/branch";
import type { Company } from "@/lib/api/company";
import { parseIndiaAddress, searchLocationsInIndia, type GeocodeResult } from "@/lib/geocoding";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

const MapPicker = dynamic(() => import("@/components/MapPicker"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[280px] w-full items-center justify-center rounded-xl border border-dashed border-border bg-muted/30">
      <p className="animate-pulse text-sm text-muted-foreground">Loading map...</p>
    </div>
  ),
});

const DEFAULT_LAT = 21.180982;
const DEFAULT_LNG = 72.819082;

type BranchFormModalProps = {
  open: boolean;
  mode: "create" | "edit";
  loading: boolean;
  initialData?: Branch | null;
  companies: Company[];
  serverError?: BranchApiError | null;
  onClose: () => void;
  onSubmit: (payload: CreateBranchPayload | UpdateBranchPayload) => Promise<void>;
};

const schema = z.object({
  company_id: z.string().min(1, "Company is required"),
  name: z.string().trim().min(1, "Branch name is required"),
  code: z.string().trim().min(1, "Code is required"),
  address: z.string().trim().min(1, "Address is required"),
  city: z.string().trim().min(1, "City is required"),
  state: z.string().trim().min(1, "State is required"),
  pincode: z.string().trim().min(1, "Pincode is required").regex(/^\d+$/, "Pincode must be numeric"),
  phone: z.string().trim().min(1, "Phone is required").regex(/^\d+$/, "Phone must be numeric"),
  email: z.string().trim().email("Enter valid email"),
  contact_person_name: z.string().trim().min(1, "Contact person name is required"),
  latitude: z
    .number()
    .refine((value) => value !== 0, "Please select a branch location on the map"),
  longitude: z
    .number()
    .refine((value) => value !== 0, "Please select a branch location on the map"),
  status: z.enum(["active", "inactive"]),
});

type FormValues = z.infer<typeof schema>;

const inputStyles =
  "mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-primary";

export function BranchFormModal({
  open,
  mode,
  loading,
  initialData,
  companies,
  serverError,
  onClose,
  onSubmit,
}: BranchFormModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GeocodeResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setFocus,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      company_id: "",
      name: "",
      code: "",
      address: "",
      city: "",
      state: "",
      pincode: "",
      phone: "",
      email: "",
      contact_person_name: "",
      latitude: 0,
      longitude: 0,
      status: "active",
    },
  });

  const latitude = watch("latitude");
  const longitude = watch("longitude");

  const applyCurrentLocation = (lat: number, lng: number) => {
    setValue("latitude", lat, { shouldValidate: true });
    setValue("longitude", lng, { shouldValidate: true });
  };

  const requestCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => applyCurrentLocation(pos.coords.latitude, pos.coords.longitude),
      () => toast.error("Unable to access current location. Please search or pick on the map."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const results = await searchLocationsInIndia(searchQuery, 5);
      setSearchResults(results);
      if (results.length === 0) {
        toast.error("No locations found in India. Try city, area, or landmark name.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Search failed.");
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const selectSearchResult = (result: GeocodeResult) => {
    applyCurrentLocation(Number(result.lat), Number(result.lon));
    const parsed = parseIndiaAddress(result);
    if (parsed.address) setValue("address", parsed.address);
    if (parsed.city) setValue("city", parsed.city);
    if (parsed.state) setValue("state", parsed.state);
    if (parsed.pincode) setValue("pincode", parsed.pincode);
    setSearchResults([]);
    setSearchQuery(result.display_name);
  };

  useEffect(() => {
    if (!open) return;

    const hasCoords =
      initialData?.latitude != null &&
      initialData?.longitude != null &&
      initialData.latitude !== 0 &&
      initialData.longitude !== 0;

    reset({
      company_id: String(initialData?.company_id ?? ""),
      name: initialData?.name ?? "",
      code: initialData?.code ?? "",
      address: initialData?.address ?? "",
      city: initialData?.city ?? "",
      state: initialData?.state ?? "",
      pincode: initialData?.pincode ?? "",
      phone: initialData?.phone ?? "",
      email: initialData?.email ?? "",
      contact_person_name: initialData?.contact_person_name ?? "",
      latitude: hasCoords ? Number(initialData.latitude) : 0,
      longitude: hasCoords ? Number(initialData.longitude) : 0,
      status: (initialData?.status as BranchStatus | undefined) ?? "active",
    });

    setSearchQuery("");
    setSearchResults([]);

    if (mode === "create" && !hasCoords) {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => applyCurrentLocation(pos.coords.latitude, pos.coords.longitude),
          () => applyCurrentLocation(DEFAULT_LAT, DEFAULT_LNG),
          { enableHighAccuracy: true, timeout: 10000 },
        );
      } else {
        applyCurrentLocation(DEFAULT_LAT, DEFAULT_LNG);
      }
    }

    window.setTimeout(() => setFocus("name"), 0);
  }, [open, initialData, mode, reset, setFocus]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab") return;
      const focusables = modalRef.current?.querySelectorAll<HTMLElement>(
        "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])",
      );
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const fieldError = (name: keyof FormValues) =>
    errors[name]?.message || serverError?.fieldErrors?.[name]?.[0];

  const submit = async (values: FormValues) => {
    const commonPayload: UpdateBranchPayload = {
      name: values.name,
      code: values.code,
      address: values.address,
      city: values.city,
      state: values.state,
      pincode: values.pincode,
      phone: values.phone,
      email: values.email,
      contact_person_name: values.contact_person_name,
      latitude: values.latitude,
      longitude: values.longitude,
      allowed_radius_meters: 1,
      location_required: true,
      strict_punch_mode: true,
      allow_hr_manual_edit: true,
      allow_outside_punch_out: true,
      status: values.status,
    };

    if (mode === "create") {
      await onSubmit({
        ...commonPayload,
        company_id: values.company_id,
      });
      return;
    }

    await onSubmit(commonPayload);
  };

  const hasMapCoords = latitude !== 0 && longitude !== 0;

  return (
    <div className="modal-overlay">
      <div
        aria-modal="true"
        className="modal-content max-w-5xl"
        ref={modalRef}
        role="dialog"
      >
        <div className="modal-header">
          <h2 className="text-lg font-semibold">
            {mode === "create" ? "Add Branch" : "Edit Branch"}
          </h2>
          <Button aria-label="Close modal" onClick={onClose} size="icon" variant="ghost">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit(submit)}>
          <div className="modal-body space-y-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium">Company</label>
                <select
                  className={inputStyles}
                  disabled={mode === "edit"}
                  {...register("company_id")}
                >
                  <option value="">Select company</option>
                  {companies.map((company) => (
                    <option key={company.id} value={String(company.id)}>
                      {company.company_name}
                    </option>
                  ))}
                </select>
                {fieldError("company_id") ? (
                  <p className="mt-1 text-xs text-destructive">{fieldError("company_id")}</p>
                ) : null}
              </div>
              <div>
                <label className="text-sm font-medium">Branch Name</label>
                <Input className={inputStyles} {...register("name")} />
                {fieldError("name") ? (
                  <p className="mt-1 text-xs text-destructive">{fieldError("name")}</p>
                ) : null}
              </div>
              <div>
                <label className="text-sm font-medium">Code</label>
                <Input className={inputStyles} {...register("code")} />
              </div>
              <div>
                <label className="text-sm font-medium">Address</label>
                <Input className={inputStyles} {...register("address")} />
              </div>
              <div>
                <label className="text-sm font-medium">City</label>
                <Input className={inputStyles} {...register("city")} />
              </div>
              <div>
                <label className="text-sm font-medium">State</label>
                <Input className={inputStyles} {...register("state")} />
              </div>
              <div>
                <label className="text-sm font-medium">Pincode</label>
                <Input className={inputStyles} {...register("pincode")} />
              </div>
              <div>
                <label className="text-sm font-medium">Phone</label>
                <Input className={inputStyles} {...register("phone")} />
              </div>
              <div>
                <label className="text-sm font-medium">Email</label>
                <Input className={inputStyles} type="email" {...register("email")} />
              </div>
              <div>
                <label className="text-sm font-medium">Contact Person Name</label>
                <Input className={inputStyles} {...register("contact_person_name")} />
              </div>
              <div>
                <label className="text-sm font-medium">Status</label>
                <select className={inputStyles} {...register("status")}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-muted/20 p-4">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold">Branch Location on Map</h3>
                </div>
                <Button onClick={requestCurrentLocation} size="sm" type="button" variant="outline">
                  <Crosshair className="mr-2 h-4 w-4" />
                  Use Current Location
                </Button>
              </div>

              <div className="grid gap-4 lg:grid-cols-5">
                <div className="lg:col-span-3">
                  <div className="h-[280px] overflow-hidden rounded-xl border border-border">
                    <MapPicker
                      lat={hasMapCoords ? latitude : null}
                      lng={hasMapCoords ? longitude : null}
                      radius={0}
                      onChange={(lat, lng) => applyCurrentLocation(lat, lng)}
                    />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Click on the map or drag the marker to set the branch coordinates.
                  </p>
                  {hasMapCoords ? (
                    <p className="mt-1 text-xs font-medium text-primary">
                      Selected: {latitude.toFixed(6)}, {longitude.toFixed(6)}
                    </p>
                  ) : null}
                  {fieldError("latitude") || fieldError("longitude") ? (
                    <p className="mt-1 text-xs text-destructive">
                      {fieldError("latitude") || fieldError("longitude")}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-3 lg:col-span-2">
                  <div>
                    <label className="text-sm font-medium">Search Location (India)</label>
                    <div className="mt-1 flex gap-2">
                      <Input
                        placeholder="e.g. Surat, Andheri Mumbai, Connaught Place Delhi"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void handleSearch();
                          }
                        }}
                      />
                      <Button disabled={isSearching} onClick={() => void handleSearch()} type="button" variant="outline">
                        <Search className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      India-only search powered by OpenStreetMap
                    </p>
                  </div>

                  {searchResults.length > 0 ? (
                    <ul className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-border bg-background p-2">
                      {searchResults.map((result) => (
                        <li key={`${result.lat}-${result.lon}-${result.display_name}`}>
                          <button
                            className="w-full rounded-lg px-2 py-2 text-left text-xs hover:bg-muted"
                            onClick={() => selectSearchResult(result)}
                            type="button"
                          >
                            {result.display_name}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>
            </div>

            {serverError?.message ? <p className="text-sm text-destructive">{serverError.message}</p> : null}
          </div>
          <div className="modal-footer">
            <Button onClick={onClose} type="button" variant="outline">
              Cancel
            </Button>
            <Button disabled={loading} type="submit">
              {loading ? "Saving..." : mode === "create" ? "Create Branch" : "Update Branch"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
