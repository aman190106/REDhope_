import { useEffect, useRef, useState } from "react";

interface LocationPickerProps {
  latitude: number | null | undefined;
  longitude: number | null | undefined;
  onChange: (coords: { latitude: number; longitude: number; city?: string; state?: string; pincode?: string }) => void;
  height?: string | number;
  label?: string;
  helperText?: string;
}

export function LocationPickerMap({
  latitude,
  longitude,
  onChange,
  height = 320,
  label = "Select Location on Map",
  helperText = "Click anywhere on the map or drag the pin to set exact coordinates.",
}: LocationPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [loadingGeocode, setLoadingGeocode] = useState(false);
  const [locatingUser, setLocatingUser] = useState(false);

  // Default center if no coordinates: Vadodara / Central India
  const defaultLat = 22.3072;
  const defaultLng = 73.1812;

  const currentLat = typeof latitude === "number" && !isNaN(latitude) ? latitude : null;
  const currentLng = typeof longitude === "number" && !isNaN(longitude) ? longitude : null;

  // Reverse geocode via OpenStreetMap Nominatim
  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      setLoadingGeocode(true);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        {
          headers: {
            "Accept-Language": "en",
          },
        }
      );
      if (res.ok) {
        const data = await res.json();
        const addr = data.address || {};
        const city = addr.city || addr.town || addr.village || addr.suburb || addr.county || "";
        const state = addr.state || "";
        const pincode = addr.postcode || "";
        return { city, state, pincode };
      }
    } catch (err) {
      console.warn("Reverse geocode warning:", err);
    } finally {
      setLoadingGeocode(false);
    }
    return {};
  };

  useEffect(() => {
    if (typeof window === "undefined" || !containerRef.current) return;

    let isMounted = true;

    // Dynamically import Leaflet so SSR doesn't fail
    import("leaflet").then((L) => {
      if (!isMounted || !containerRef.current) return;

      // Ensure leaflet styles are present
      if (!document.getElementById("leaflet-core-css")) {
        const link = document.createElement("link");
        link.id = "leaflet-core-css";
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }

      const initialLat = currentLat !== null ? currentLat : defaultLat;
      const initialLng = currentLng !== null ? currentLng : defaultLng;
      const initialZoom = currentLat !== null ? 14 : 6;

      if (!mapInstanceRef.current) {
        const map = L.map(containerRef.current, {
          center: [initialLat, initialLng],
          zoom: initialZoom,
          scrollWheelZoom: true,
        });

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        }).addTo(map);

        // Custom red pin icon for REDhope
        const redIcon = L.divIcon({
          className: "custom-redhope-pin",
          html: `<div style="
            width: 32px;
            height: 32px;
            background: #e63946;
            border: 3px solid white;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            box-shadow: 0 4px 10px rgba(0,0,0,0.35);
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <div style="width: 10px; height: 10px; background: white; border-radius: 50%;"></div>
          </div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 32],
          popupAnchor: [0, -32],
        });

        // Initialize marker if coordinates exist
        if (currentLat !== null && currentLng !== null) {
          const marker = L.marker([currentLat, currentLng], {
            icon: redIcon,
            draggable: true,
          }).addTo(map);

          marker.on("dragend", async () => {
            const pos = marker.getLatLng();
            const geo = await reverseGeocode(pos.lat, pos.lng);
            onChange({
              latitude: Number(pos.lat.toFixed(6)),
              longitude: Number(pos.lng.toFixed(6)),
              ...geo,
            });
          });

          markerRef.current = marker;
        }

        // Click handler to drop or move marker
        map.on("click", async (e: any) => {
          const { lat, lng } = e.latlng;
          const cleanLat = Number(lat.toFixed(6));
          const cleanLng = Number(lng.toFixed(6));

          if (markerRef.current) {
            markerRef.current.setLatLng([cleanLat, cleanLng]);
          } else {
            const marker = L.marker([cleanLat, cleanLng], {
              icon: redIcon,
              draggable: true,
            }).addTo(map);

            marker.on("dragend", async () => {
              const pos = marker.getLatLng();
              const geo = await reverseGeocode(pos.lat, pos.lng);
              onChange({
                latitude: Number(pos.lat.toFixed(6)),
                longitude: Number(pos.lng.toFixed(6)),
                ...geo,
              });
            });

            markerRef.current = marker;
          }

          const geo = await reverseGeocode(cleanLat, cleanLng);
          onChange({
            latitude: cleanLat,
            longitude: cleanLng,
            ...geo,
          });
        });

        mapInstanceRef.current = map;
      } else {
        // Map already exists, update view or marker
        const map = mapInstanceRef.current;
        if (currentLat !== null && currentLng !== null) {
          if (markerRef.current) {
            markerRef.current.setLatLng([currentLat, currentLng]);
          } else {
            const redIcon = L.divIcon({
              className: "custom-redhope-pin",
              html: `<div style="
                width: 32px;
                height: 32px;
                background: #e63946;
                border: 3px solid white;
                border-radius: 50% 50% 50% 0;
                transform: rotate(-45deg);
                box-shadow: 0 4px 10px rgba(0,0,0,0.35);
                display: flex;
                align-items: center;
                justify-content: center;
              ">
                <div style="width: 10px; height: 10px; background: white; border-radius: 50%;"></div>
              </div>`,
              iconSize: [32, 32],
              iconAnchor: [16, 32],
            });

            const marker = L.marker([currentLat, currentLng], {
              icon: redIcon,
              draggable: true,
            }).addTo(map);

            marker.on("dragend", async () => {
              const pos = marker.getLatLng();
              const geo = await reverseGeocode(pos.lat, pos.lng);
              onChange({
                latitude: Number(pos.lat.toFixed(6)),
                longitude: Number(pos.lng.toFixed(6)),
                ...geo,
              });
            });

            markerRef.current = marker;
          }
        }
      }
    });

    return () => {
      isMounted = false;
    };
  }, [currentLat, currentLng]);

  // Clean up map on unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
      }
    };
  }, []);

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }

    setLocatingUser(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));

        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo([lat, lng], 15);
        }

        const geo = await reverseGeocode(lat, lng);
        onChange({
          latitude: lat,
          longitude: lng,
          ...geo,
        });

        setLocatingUser(false);
      },
      (err) => {
        console.warn("Geolocation error:", err);
        alert("Could not retrieve your location. Please check location permissions or click on the map.");
        setLocatingUser(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div>
          <label style={{ fontWeight: 600, fontSize: 14, color: "#1d3557", display: "block" }}>
            {label}
          </label>
          <span style={{ fontSize: 12, color: "#6c757d" }}>{helperText}</span>
        </div>
        <button
          type="button"
          onClick={handleUseCurrentLocation}
          disabled={locatingUser}
          style={{
            background: "#f1f5f9",
            border: "1px solid #cbd5e1",
            borderRadius: 6,
            padding: "6px 12px",
            fontSize: 12,
            fontWeight: 600,
            color: "#1e293b",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <i className={locatingUser ? "fas fa-spinner fa-spin" : "fas fa-crosshairs"} style={{ color: "#e63946" }} />
          {locatingUser ? "Locating..." : "Use My Current Location"}
        </button>
      </div>

      <div
        ref={containerRef}
        style={{
          height: typeof height === "number" ? `${height}px` : height,
          width: "100%",
          borderRadius: 8,
          border: "2px solid #e2e8f0",
          overflow: "hidden",
          position: "relative",
          zIndex: 1,
        }}
      />

      <div
        style={{
          marginTop: 8,
          padding: "8px 12px",
          backgroundColor: "#f8fafc",
          borderRadius: 6,
          border: "1px solid #e2e8f0",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 12,
        }}
      >
        <div>
          {currentLat !== null && currentLng !== null ? (
            <span style={{ color: "#0f172a" }}>
              <strong style={{ color: "#e63946" }}>Pinned Location:</strong> {currentLat}° N, {currentLng}° E
              {loadingGeocode && <span style={{ marginLeft: 8, color: "#64748b" }}>(fetching address details...)</span>}
            </span>
          ) : (
            <span style={{ color: "#94a3b8" }}>No location selected yet. Click anywhere on the map to set pin.</span>
          )}
        </div>
        {currentLat !== null && currentLng !== null && (
          <span
            style={{
              background: "#dcfce7",
              color: "#15803d",
              padding: "2px 8px",
              borderRadius: 4,
              fontWeight: 600,
              fontSize: 11,
            }}
          >
            Coordinates Active
          </span>
        )}
      </div>
    </div>
  );
}

