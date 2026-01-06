import React, { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOXGL_ACCESS_TOKEN || (typeof window !== 'undefined' ? (window as any).__MAPBOX_TOKEN__ : undefined) || (typeof window !== 'undefined' ? localStorage.getItem('MAPBOX_TOKEN') : undefined);

if (!MAPBOX_TOKEN) {
  console.error("Mapbox token is not set. Set VITE_MAPBOXGL_ACCESS_TOKEN in your env file or Vite config, or set localStorage.setItem('MAPBOX_TOKEN', '<token>') to test in the browser");
}

mapboxgl.accessToken = MAPBOX_TOKEN || "";

interface MapComponentProps {
  onLocationSelect: (lat: number, lng: number, address: string) => void;
}

const MapComponent: React.FC<MapComponentProps> = ({ onLocationSelect }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (!mapContainer.current) return;

    // If token missing, skip initializing map to avoid runtime errors
    if (!MAPBOX_TOKEN) {
      return;
    }

    // Initialize map
    try {
      mapRef.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center: [77.757218, 20.932185], // Default: Bangalore (lng, lat)
        zoom: 12,
      });
    } catch (err) {
      console.error("Failed to initialize Mapbox map:", err);
      return;
    }

    // Change cursor on hover over map
    mapRef.current.on("mouseenter", () => {
      mapRef.current!.getCanvas().style.cursor = "crosshair"; // Change cursor on map hover
    });
    mapRef.current.on("mouseleave", () => {
      mapRef.current!.getCanvas().style.cursor = "";
    });

    mapRef.current.on("click", async (e) => {
      const { lng, lat } = e.lngLat;

      // Update or create the marker - make it draggable
      if (markerRef.current) {
        markerRef.current.setLngLat([lng, lat]);
      } else {
        markerRef.current = new mapboxgl.Marker({ draggable: true })
          .setLngLat([lng, lat])
          .addTo(mapRef.current!);

        // Change cursor while dragging marker
        markerRef.current.on("dragstart", () => {
          if (mapRef.current)
            mapRef.current.getCanvas().style.cursor = "grabbing";
        });

        markerRef.current.on("dragend", async () => {
          if (mapRef.current)
            mapRef.current.getCanvas().style.cursor = "crosshair";

          const lngLat = markerRef.current!.getLngLat();
          const address = await reverseGeocode(lngLat.lng, lngLat.lat);
          onLocationSelect(lngLat.lat, lngLat.lng, address);
        });
      }

      // Reverse geocode for address:
      const resp = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${mapboxgl.accessToken}`
      );
      const data = await resp.json();
      const address =
        data.features && data.features[0]
          ? data.features[0].place_name
          : `Lat: ${lat}, Lng: ${lng}`;

      onLocationSelect(lat, lng, address);
    });

    // Cleanup on unmount
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, [onLocationSelect]);

  async function reverseGeocode(lng: number, lat: number) {
    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${mapboxgl.accessToken}`
      );
      const data = await res.json();
      return data.features && data.features[0]
        ? data.features[0].place_name
        : `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    } catch {
      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    }
  }

  if (!MAPBOX_TOKEN) {
    return (
      <div className="flex items-center justify-center h-full p-6 bg-gray-100 rounded">
        <div className="text-center">
          <p className="font-semibold">Map not available</p>
          <p className="text-sm text-muted-foreground">
            Location selection is disabled because the Mapbox token is not configured.
          </p>
        </div>
      </div>
    );
  }

  return <div ref={mapContainer} style={{ width: "100%", height: "100%" }} />;
};

export default MapComponent;
