import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import "mapbox-gl/dist/mapbox-gl.css";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

export default function MapPage() {
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
        style: "mapbox://styles/mapbox/light-v11",
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
            "heatmap-radius": 30,
            "heatmap-opacity": 1,
            "heatmap-color": [
              "interpolate", ["linear"], ["heatmap-density"],
              0, "rgba(245, 245, 220, 0)",
              0.25, "rgba(245, 245, 220, 0.5)",
              0.5, "rgba(127, 149, 117, 0.6)",
              0.75, "rgba(63, 113, 75, 0.75)",
              1, "rgba(63, 113, 75, 0.9)",
            ],
          },
        });
        map.on("mousemove", "heatmap", (e) => {
          const features = map.queryRenderedFeatures(e.point, { layers: ["heatmap"] });
          if (features.length) {
            map.getCanvas().style.cursor = "pointer";
            const feature = features[0];
            const props = feature.properties || {};
            setHoverInfo({
              category: props.category || "air_pollution",
              severity: props.severity != null ? (props.severity * 100).toFixed(1) : "—",
              coordinates: feature.geometry?.coordinates || [],
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
      <div style={{ padding: "2rem", fontFamily: "sans-serif", background: "#F5F5DC", minHeight: "100vh", color: "#3F714B" }}>
        <h2>Missing Mapbox token</h2>
        <p>Add <code>NEXT_PUBLIC_MAPBOX_TOKEN</code> to <code>fe/.env.local</code></p>
        <p><Link href="/">← Back to home</Link></p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "2rem", fontFamily: "sans-serif", background: "#F5F5DC", minHeight: "100vh", color: "#3F714B" }}>
        <h2>Failed to load data</h2>
        <p>Ensure backend is running: <code>cd be && uvicorn main:app --reload --port 8000</code></p>
        <p style={{ color: "#c00" }}>{error}</p>
        <p><Link href="/">← Back to home</Link></p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "100vh", width: "100%", background: "#F5F5DC", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div ref={mapContainerRef} style={{ flex: 1, minHeight: 0, minWidth: 0 }} />
      <div style={{ flex: "0 0 280px", padding: "1rem", borderLeft: "1px solid rgba(63, 113, 75, 0.3)", background: "#F5F5DC", overflow: "auto", color: "#3F714B" }}>
        <div style={{ marginBottom: "1rem" }}>
          <Link href="/" style={{ fontSize: "0.9rem", color: "#3F714B" }}>← Home</Link>
        </div>
        <h3 style={{ marginTop: 0, fontWeight: 600 }}>Air quality (OpenAQ)</h3>
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
