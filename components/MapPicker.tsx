"use client";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import { Circle, MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";

// Fix Leaflet's default icon path issues in Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

type MapPickerProps = {
  lat: number | null;
  lng: number | null;
  radius: number;
  onChange: (lat: number, lng: number) => void;
};

function LocationMarker({
  lat,
  lng,
  radius,
  onChange,
}: {
  lat: number | null;
  lng: number | null;
  radius: number;
  onChange: (lat: number, lng: number) => void;
}) {
  const map = useMapEvents({
    click(e) {
      onChange(e.latlng.lat, e.latlng.lng);
    },
  });

  useEffect(() => {
    if (lat !== null && lng !== null) {
      map.flyTo([lat, lng], map.getZoom(), { animate: true, duration: 1 });
    }
  }, [lat, lng, map]);

  if (lat === null || lng === null) return null;

  return (
    <>
      <Marker
        draggable
        eventHandlers={{
          dragend: (e) => {
            const marker = e.target;
            const position = marker.getLatLng();
            onChange(position.lat, position.lng);
          },
        }}
        position={[lat, lng]}
      />
      {radius > 0 ? (
        <Circle
          center={[lat, lng]}
          pathOptions={{ color: "#3d74ff", fillColor: "#3d74ff", fillOpacity: 0.14 }}
          radius={radius}
        />
      ) : null}
    </>
  );
}

export default function MapPicker({ lat, lng, radius, onChange }: MapPickerProps) {
  const centerLat = lat ?? 21.180982;
  const centerLng = lng ?? 72.819082;

  return (
    <MapContainer
      center={[centerLat, centerLng]}
      scrollWheelZoom={true}
      style={{ height: "100%", width: "100%", zIndex: 0 }}
      zoom={18}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.google.com/maps">Google Maps</a>'
        maxZoom={20}
        url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
      />
      <LocationMarker lat={lat} lng={lng} onChange={onChange} radius={radius} />
    </MapContainer>
  );
}
