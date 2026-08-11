"use client";

import { useEffect } from "react";

import { bootstrapDevicePermissions } from "@/lib/permissions/device-permissions";

/**
 * Requests persistent storage and snapshots granted permissions once per
 * app load, so browsers (notably Samsung Internet) stop evicting site data
 * and re-asking for camera/notification access.
 */
export function DevicePermissionBootstrap() {
  useEffect(() => {
    void bootstrapDevicePermissions();
  }, []);

  return null;
}
