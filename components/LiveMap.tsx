"use client";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";

// Fix Leaflet's default icon path issues in Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

type LiveMapProps = {
  lat: number;
  lng: number;
  employeeName: string;
  locationName: string;
  radius?: number;
};

function ChangeMapView({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 16, { animate: true, duration: 1.2 });
  }, [center, map]);
  return null;
}

export default function LiveMap({ lat, lng, employeeName, locationName, radius = 80 }: LiveMapProps) {
  const center: [number, number] = [lat, lng];

  return (
    <div className="h-full w-full relative rounded-xl overflow-hidden border border-border">
      <MapContainer
        center={center}
        scrollWheelZoom={true}
        style={{ height: "100%", width: "100%", zIndex: 0 }}
        zoom={16}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.google.com/maps">Google Maps</a>'
          maxZoom={20}
          url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
        />
        <ChangeMapView center={center} />
        <Marker position={center}>
          <Popup>
            <div className="text-xs p-1 font-sans">
              <p className="font-semibold text-foreground m-0">{employeeName}</p>
              <p className="text-muted-foreground m-0 mt-0.5">{locationName}</p>
              <p className="text-[10px] text-primary m-0 mt-1">Coordinates: {lat.toFixed(5)}, {lng.toFixed(5)}</p>
            </div>
          </Popup>
        </Marker>
        {radius > 0 && (
          <Circle
            center={center}
            pathOptions={{ color: "#10b981", fillColor: "#10b981", fillOpacity: 0.1 }}
            radius={radius}
          />
        )}
      </MapContainer>
    </div>
  );
}
