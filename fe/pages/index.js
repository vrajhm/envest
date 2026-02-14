import { useEffect, useState, useRef } from "react";
import "mapbox-gl/dist/mapbox-gl.css";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

export default function HeatmapPage() {
  const [data, setData] = useState(null);
  const [hoverInfo, setHoverInfo] = useState(null);
  const [error, setError] = useState(null);
  const mapRef = useRef(null);
  const mapContainerRef = useRef(null);

  useEffect(() => {
    fetch("http://localhost:8000/issues")
      .then((res) => res.json().then((d) => ({ ok: res.ok, status: res.status, data: d })))
      .then(({ ok, status, data }) => {
        if (ok) setData(data);
        else setError(data?.detail || `Backend error ${status}`);
      })
      .catch((err) => {
        console.error("Failed to fetch:", err);
        setError(err.message);
      });
  }, []);

  useEffect(() => {
    if (!data || !mapContainerRef.current || !MAPBOX_TOKEN) return;

    const initMap = async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      mapboxgl.accessToken = MAPBOX_TOKEN;

      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: "mapbox://styles/mapbox/streets-v11",
        center: [-122.4194, 37.7749],
        zoom: 2,
      });

      mapRef.current = map;

      map.once("load", () => {
        map.addSource("issues", { type: "geojson", data });
        map.addLayer({
          id: "heatmap",
          type: "heatmap",
          source: "issues",
          paint: {
            "heatmap-weight": ["get", "severity"],
            "heatmap-intensity": 1,
            "heatmap-radius": 25,
            "heatmap-opacity": 0.8,
            "heatmap-color": [
              "interpolate",
              ["linear"],
              ["heatmap-density"],
              0,
              "rgba(0, 255, 0, 0)",
              0.2,
              "rgba(0, 255, 127, 0.5)",
              0.4,
              "rgba(255, 255, 0, 0.6)",
              0.6,
              "rgba(255, 165, 0, 0.7)",
              1,
              "rgba(255, 0, 0, 0.9)",
            ],
          },
        });

        map.on("mousemove", "heatmap", (e) => {
          const features = map.queryRenderedFeatures(e.point, {
            layers: ["heatmap"],
          });
          if (features.length) {
            map.getCanvas().style.cursor = "pointer";
            const feature = features[0];
            const props = feature.properties || {};
            setHoverInfo({
              category: props.category || "air_pollution",
              severity: props.severity != null
                ? (props.severity * 100).toFixed(1)
                : "—",
              coordinates: feature.geometry?.coordinates
                ? feature.geometry.coordinates
                : [],
            });
          }
        });

        map.on("mouseleave", "heatmap", () => {
          map.getCanvas().style.cursor = "";
          setHoverInfo(null);
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
      <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
        <h2>Missing Mapbox token</h2>
        <p>
          Add <code>NEXT_PUBLIC_MAPBOX_TOKEN</code> to <code>.env.local</code>
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
        <h2>Failed to load data</h2>
        <p>Make sure the backend is running: <code>cd be && uvicorn main:app --reload --port 8000</code></p>
        <p style={{ color: "#c00" }}>{error}</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "100vh", width: "100%" }}>
      <div
        ref={mapContainerRef}
        style={{ flex: 1, minHeight: 0, minWidth: 0 }}
      />
      <div
        style={{
          flex: "0 0 280px",
          padding: "1rem",
          borderLeft: "1px solid #ccc",
          background: "#f7f7f7",
          overflow: "auto",
        }}
      >
        <h3 style={{ marginTop: 0 }}>Air quality (OpenAQ)</h3>
        {!data && <p>Loading…</p>}
        {data && hoverInfo ? (
          <>
            <p><strong>Category:</strong> {hoverInfo.category}</p>
            <p><strong>Severity:</strong> {hoverInfo.severity}%</p>
            <p><strong>Coordinates:</strong> {hoverInfo.coordinates.join(", ")}</p>
          </>
        ) : data ? (
          <p>Hover over the heatmap to see details</p>
        ) : null}
      </div>
    </div>
  );
}
