"use client";

import { Crosshair, Map as MapIcon, MapPin, Save, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthToken } from "@/lib/use-auth-token";
import { toast } from "sonner";

import { createLocation } from "@/lib/api/location";
import { getCompanies, Company } from "@/lib/api/company";
import { getBranches, Branch } from "@/lib/api/branch";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import dynamic from "next/dynamic";

const MapPicker = dynamic(() => import("@/components/MapPicker"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[350px] w-full items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/30">
      <p className="animate-pulse text-sm font-medium text-muted-foreground">Loading map...</p>
    </div>
  ),
});

export default function AddLocationPage() {
  const token = useAuthToken();
  const [isActive, setIsActive] = useState(true);
  const [radius, setRadius] = useState(50);
  const [lat, setLat] = useState("21.180982");
  const [lng, setLng] = useState("72.819082");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [companyId, setCompanyId] = useState<number>(0);
  const [branchId, setBranchId] = useState<number>(0);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!token) return;
    getCompanies(token, 1, 100).then((res) => {
      if (res.success && res.data) setCompanies(res.data);
    }).catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!token) return;
    if (companyId > 0) {
      getBranches(token, { company_id: String(companyId), per_page: 100 }).then((res) => {
        if (res.success && res.data) setBranches(res.data);
      }).catch(() => {});
    } else {
      setBranches([]);
      setBranchId(0);
    }
  }, [companyId, token]);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLat(pos.coords.latitude.toFixed(6));
          setLng(pos.coords.longitude.toFixed(6));
        },
        () => {
          // Keep default if location access is denied or fails
        }
      );
    }
  }, []);

  const handleCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
      });
    } else {
      alert("Geolocation is not supported by your browser.");
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(searchQuery)}`
      );
      const data = await res.json();
      if (data && data.length > 0) {
        setLat(data[0].lat);
        setLng(data[0].lon);
      } else {
        alert("Location not found. Try a different search.");
      }
    } catch (e) {
      alert("Search failed. Please try again later.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleMapChange = (newLat: number, newLng: number) => {
    setLat(newLat.toFixed(6));
    setLng(newLng.toFixed(6));
  };

  const handleSave = async () => {
    if (!code.trim() || !name.trim() || !lat || !lng || !radius) {
      toast.error("Please fill in all required fields before saving.");
      return;
    }

    const payload = {
      company_id: companyId > 0 ? companyId : undefined,
      branch_id: branchId > 0 ? branchId : undefined,
      code: code.trim(),
      name: name.trim(),
      lat: Number(lat),
      lng: Number(lng),
      radius: Number(radius),
      active: isActive,
    };

    setSubmitting(true);
    try {
      if (!token) {
        toast.error("Please sign in to save a location.");
        setSubmitting(false);
        return;
      }
      await createLocation(token, payload);
      toast.success("Location created successfully.");
      router.push("/location-list");
    } catch (error: any) {
      toast.error(error.message || "Failed to create location.");
      console.error("Save Location Error:", error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mx-auto max-w-5xl space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Add Geo Location</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure punch-in/out zones by selecting coordinates and setting a radius.
          </p>
        </div>
        <Link
          className={cn(buttonVariants({ variant: "outline" }), "w-full sm:w-auto")}
          href="/location-list"
        >
          <X className="mr-2 h-4 w-4" />
          Cancel
        </Link>
      </div>

      <div className="grid gap-6">
        {/* Basic Information */}
        <div className="rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border p-5">
            <h2 className="text-lg font-semibold">Basic Information</h2>
            <div className="flex items-center gap-2">
              <Label className="cursor-pointer text-sm font-medium" htmlFor="statusActive">
                {isActive ? "Active" : "Inactive"}
              </Label>
              <Switch checked={isActive} id="statusActive" onCheckedChange={setIsActive} />
            </div>
          </div>
          <div className="grid gap-5 p-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="companySelect">Company</Label>
              <select
                id="companySelect"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={companyId}
                onChange={(e) => setCompanyId(Number(e.target.value))}
              >
                <option value={0}>Select Company</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="branchSelect">Branch</Label>
              <select
                id="branchSelect"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={branchId}
                onChange={(e) => setBranchId(Number(e.target.value))}
                disabled={!companyId}
              >
                <option value={0}>Select Branch</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="geoCode">
                Geo Location Code <span className="text-destructive">*</span>
              </Label>
              <Input 
                id="geoCode" 
                placeholder="e.g. ZONE-101" 
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="geoName">
                Location Name / Address <span className="text-destructive">*</span>
              </Label>
              <Input 
                id="geoName" 
                placeholder="e.g. Main Office / Head Branch" 
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Map Selection */}
        <div className="rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold">Map Selection</h2>
            <Button
              className="w-full sm:w-auto"
              onClick={handleCurrentLocation}
              size="sm"
              variant="outline"
            >
              <Crosshair className="mr-2 h-4 w-4" />
              Use Current Location
            </Button>
          </div>

          <div className="p-5">
            <div className="grid gap-6 lg:grid-cols-5">
              {/* Map Placeholder Area */}
              <div className="lg:col-span-3">
                <div className="relative flex h-[350px] w-full flex-col overflow-hidden rounded-xl border border-border">
                  <MapPicker
                    lat={lat ? Number(lat) : null}
                    lng={lng ? Number(lng) : null}
                    radius={radius}
                    onChange={handleMapChange}
                  />
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">
                    Tip: Click anywhere on the map or drag the marker to set coordinates.
                  </p>
                  <p className="text-xs font-medium text-primary">
                    Selected: {lat && lng ? `${lat}, ${lng}` : "--"}
                  </p>
                </div>
              </div>

              {/* Coordinates and Controls */}
              <div className="space-y-5 lg:col-span-2">
                <div className="space-y-2">
                  <Label htmlFor="mapSearch">Search Location</Label>
                  <div className="flex gap-2">
                    <Input
                      id="mapSearch"
                      placeholder="Search address or place name..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    />
                    <Button type="button" variant="outline" onClick={handleSearch} disabled={isSearching}>
                      {isSearching ? "Searching..." : "Search"}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Powered by OpenStreetMap</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="latitude">
                      Latitude <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="latitude"
                      onChange={(e) => setLat(e.target.value)}
                      placeholder="e.g. 21.180982"
                      step="0.000001"
                      type="number"
                      value={lat}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="longitude">
                      Longitude <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="longitude"
                      onChange={(e) => setLng(e.target.value)}
                      placeholder="e.g. 72.819082"
                      step="0.000001"
                      type="number"
                      value={lng}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="radiusMeters">
                    Radius (meters) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="radiusMeters"
                    min="1"
                    onChange={(e) => setRadius(Number(e.target.value) || 0)}
                    type="number"
                    value={radius}
                  />

                  <div className="flex flex-wrap gap-2">
                    {[50, 100, 150, 200, 500].map((val) => (
                      <Button
                        className="h-8 text-xs"
                        key={val}
                        onClick={() => setRadius(val)}
                        size="sm"
                        type="button"
                        variant={radius === val ? "default" : "outline"}
                      >
                        {val}m
                      </Button>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Employees can only punch in/out if they are within this radius from the location.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
          <Link
            className={cn(buttonVariants({ variant: "outline" }), "w-full sm:w-auto")}
            href="/location-list"
          >
            Cancel
          </Link>
          <Button className="w-full sm:w-auto" onClick={handleSave} disabled={submitting}>
            <Save className="mr-2 h-4 w-4" />
            {submitting ? "Saving..." : "Save Location"}
          </Button>
        </div>
      </div>
    </section>
  );
}
