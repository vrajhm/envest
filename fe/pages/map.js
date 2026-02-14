import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import "mapbox-gl/dist/mapbox-gl.css";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

export default function MapPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const mapRef = useRef(null);
  const mapContainerRef = useRef(null);

  // Fetch backend pollution data
  useEffect(() => {
    fetch("http://localhost:8000/issues")
      .then((res) =>
        res.json().then((d) => ({
          ok: res.ok,
          status: res.status,
          data: d,
        }))
      )
      .then(({ ok, status, data }) => {
        if (ok) {
          // 🟢 Adds fake Land & Water pollution data to each feature
          const enhancedFeatures = data.features.map((f) => {
            const air = f.properties.severity || 0;
            // Random severity 0.1–0.9 for demo
            const land = Math.random() * 0.8 + 0.1;
            const water = Math.random() * 0.8 + 0.1;

            // "General Pollution" = Average of the three
            const general = (air + land + water) / 3;

            return {
              ...f,
              properties: {
                ...f.properties,
                air_pollution: air,
                land_pollution: land,
                water_pollution: water,
                general_severity: general,
                // Override main severity for the circle radius/color
                severity: general,
              },
            };
          });

          setData({ ...data, features: enhancedFeatures });
        } else {
          setError(data?.detail || `Backend error ${status}`);
        }
      })
      .catch((err) => {
        console.error("Fetch failed:", err);
        setError(err.message);
      });
  }, []);

  // Initialize Map
  useEffect(() => {
    if (!data || !mapContainerRef.current || !MAPBOX_TOKEN) return;

    const initMap = async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      mapboxgl.accessToken = MAPBOX_TOKEN;

      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: "mapbox://styles/mapbox/light-v11",
        center: [-98.5795, 39.8283], // Center of US
        zoom: 3,
      });

      mapRef.current = map;

      map.once("load", () => {
        map.addSource("issues", {
          type: "geojson",
          data,
        });

        // 🔵 General Pollution Circle Layer (User Requested Style)
        map.addLayer({
          id: "pollution-circles",
          type: "circle",
          source: "issues",
          paint: {
            "circle-radius": [
              "interpolate",
              ["linear"],
              ["get", "severity"],
              0, 5,
              0.25, 12,
              0.5, 20,
              0.75, 30,
              1, 45,
            ],

            "circle-color": [
              "interpolate",
              ["linear"],
              ["get", "severity"],
              0, "#2ecc71",
              0.25, "#f1c40f",
              0.5, "#e67e22",
              0.75, "#e74c3c",
              1, "#7f0000",
            ],

            "circle-opacity": 0.75,
            "circle-stroke-width": 1,
            "circle-stroke-color": "#ffffff",
          },
        });

        // Cursor pointer
        map.on("mouseenter", "pollution-circles", () => {
          map.getCanvas().style.cursor = "pointer";
        });

        map.on("mouseleave", "pollution-circles", () => {
          map.getCanvas().style.cursor = "";
        });

        // Click popup with Breakdown
        map.on("click", "pollution-circles", (e) => {
          const feature = e.features[0];
          const props = feature.properties;

          // Parse values for display
          const air = (props.air_pollution * 100).toFixed(1);
          const land = (props.land_pollution * 100).toFixed(1);
          const water = (props.water_pollution * 100).toFixed(1);
          const general = (props.general_severity * 100).toFixed(1);

          new mapboxgl.Popup()
            .setLngLat(feature.geometry.coordinates)
            .setHTML(`
              <div style="font-family: sans-serif; min-width: 200px;">
                <h3 style="margin: 0 0 8px 0;">Pollution Details</h3>
                <p style="margin: 4px 0;"><strong>General Severity:</strong> ${general}%</p>
                <div style="margin-top: 8px; font-size: 0.9em; border-top: 1px solid #eee; padding-top: 4px;">
                    <p style="margin: 2px 0;"><strong>Air:</strong> ${air}%</p>
                    <p style="margin: 2px 0;"><strong>Land:</strong> ${land}% (est)</p>
                    <p style="margin: 2px 0;"><strong>Water:</strong> ${water}% (est)</p>
                </div>
                <p style="margin-top: 8px; font-size: 0.8em; color: #666;">
                  <strong>Category:</strong> ${props.category || "N/A"}
                </p>
              </div>
            `)
            .addTo(map);
        });
      });
    };

    initMap();

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [data]);

  // 🛑 Token missing
  if (!MAPBOX_TOKEN) {
    return (
      <div style={{ padding: "2rem" }}>
        <h2>Missing Mapbox Token</h2>
        <p>Add NEXT_PUBLIC_MAPBOX_TOKEN to fe/.env.local</p>
        <Link href="/">← Home</Link>
      </div>
    );
  }

  // 🛑 Backend error
  if (error) {
    return (
      <div style={{ padding: "2rem" }}>
        <h2>Backend Error</h2>
        <p>{error}</p>
        <Link href="/">← Home</Link>
      </div>
    );
  }

  return (
    <div style={{ height: "100vh", width: "100%" }}>
      <div
        ref={mapContainerRef}
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}
