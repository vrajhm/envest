import { useEffect, useState, useRef } from "react";
import "mapbox-gl/dist/mapbox-gl.css";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

export default function AirQualityPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const mapRef = useRef(null);
  const mapContainerRef = useRef(null);

  // Fetch backend data
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
        if (ok) setData(data);
        else setError(data?.detail || `Backend error ${status}`);
      })
      .catch((err) => {
        console.error("Failed to fetch:", err);
        setError(err.message);
      });
  }, []);

  // Initialize map
  useEffect(() => {
    if (!data || !mapContainerRef.current || !MAPBOX_TOKEN) return;

    const initMap = async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      mapboxgl.accessToken = MAPBOX_TOKEN;

      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: "mapbox://styles/mapbox/light-v11",
        center: [-98.5795, 39.8283], // USA center
        zoom: 3,
      });

      mapRef.current = map;

      map.once("load", () => {
        map.addSource("issues", {
          type: "geojson",
          data,
        });

        // 🔵 AIR POLLUTION CIRCLE LAYER
        map.addLayer({
          id: "air-circles",
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
        map.on("mouseenter", "air-circles", () => {
          map.getCanvas().style.cursor = "pointer";
        });

        map.on("mouseleave", "air-circles", () => {
          map.getCanvas().style.cursor = "";
        });

        // Click popup
        map.on("click", "air-circles", (e) => {
          const feature = e.features[0];
          const props = feature.properties;

          new mapboxgl.Popup()
            .setLngLat(feature.geometry.coordinates)
            .setHTML(`
              <div style="font-family: sans-serif;">
                <h3>Pollution Index</h3>
                <p><strong>Severity:</strong> ${(props.severity * 100).toFixed(
                  1
                )}%</p>
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

  if (!MAPBOX_TOKEN) {
    return (
      <div style={{ padding: "2rem" }}>
        <h2>Missing Mapbox token</h2>
        <p>
          Add <code>NEXT_PUBLIC_MAPBOX_TOKEN</code> to <code>.env.local</code>
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "2rem" }}>
        <h2>Failed to load data</h2>
        <p>
          Make sure backend is running:
          <code> cd be && uvicorn main:app --reload --port 8000</code>
        </p>
        <p style={{ color: "red" }}>{error}</p>
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
