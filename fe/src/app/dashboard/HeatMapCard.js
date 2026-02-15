"use client";

import { useEffect, useRef, useState } from "react";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

export default function HeatMapCard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const mapRef = useRef(null);
  const mapContainerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    fetch("http://localhost:8000/issues")
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to fetch issues (${res.status})`);
        }
        return res.json();
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) setError("Could not load map data.");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!MAPBOX_TOKEN || !data || !mapContainerRef.current) return;

    let disposed = false;

    const initMap = async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (disposed) return;

      mapboxgl.accessToken = MAPBOX_TOKEN;

      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: "mapbox://styles/mapbox/light-v11",
        center: [-122.4194, 37.7749],
        zoom: 11,
      });

      mapRef.current = map;

      map.on("load", () => {
        map.addSource("issues", {
          type: "geojson",
          data,
        });

        if (Array.isArray(data?.features) && data.features.length > 0) {
          const bounds = new mapboxgl.LngLatBounds();
          data.features.forEach((feature) => {
            const coords = feature?.geometry?.coordinates;
            if (Array.isArray(coords) && coords.length === 2) {
              bounds.extend(coords);
            }
          });

          if (!bounds.isEmpty()) {
            map.fitBounds(bounds, { padding: 40, maxZoom: 17 });
          }
        }

        map.addLayer({
          id: "pollution-heat",
          type: "heatmap",
          source: "issues",
          maxzoom: 17,
          paint: {
            "heatmap-weight": [
              "interpolate",
              ["linear"],
              ["get", "severity"],
              0,
              0,
              1,
              1,
            ],
            "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 0, 1, 12, 5],
            "heatmap-color": [
              "interpolate",
              ["linear"],
              ["heatmap-density"],
              0,
              "rgba(0,0,255,0)",
              0.2,
              "blue",
              0.4,
              "cyan",
              0.6,
              "lime",
              0.8,
              "yellow",
              1,
              "red",
            ],
            "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 0, 15, 8, 25, 12, 30],
            "heatmap-opacity": 0.6,
          },
        });

        map.addLayer({
          id: "pollution-points",
          type: "circle",
          source: "issues",
          minzoom: 17,
          paint: {
            "circle-radius": 4,
            "circle-color": "red",
            "circle-opacity": 0.8,
          },
        });

        map.on("click", "pollution-points", (e) => {
          const feature = e.features?.[0];
          if (!feature) return;
          const props = feature.properties || {};

          const severity = Number(props.severity);
          const severityLabel = Number.isFinite(severity)
            ? `${(severity * 100).toFixed(1)}%`
            : "N/A";

          new mapboxgl.Popup()
            .setLngLat(feature.geometry.coordinates)
            .setHTML(`
              <div style="font-family: sans-serif;">
                <h3>Pollution Reading</h3>
                <p><strong>Category:</strong> ${props.category || "unknown"}</p>
                <p><strong>Source:</strong> ${props.source || "unknown"}</p>
                <p><strong>Raw Value:</strong> ${props.raw_value ?? "N/A"}</p>
                <p><strong>Severity:</strong> ${severityLabel}</p>
              </div>
            `)
            .addTo(map);
        });
      });
    };

    initMap();

    return () => {
      disposed = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [data]);

  if (!MAPBOX_TOKEN) {
    return (
      <div className="p-4" style={{ color: "rgb(26, 28, 18)" }}>
        Missing NEXT_PUBLIC_MAPBOX_TOKEN
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4" style={{ color: "rgb(26, 28, 18)" }}>
        {error}
      </div>
    );
  }

  return <div ref={mapContainerRef} style={{ width: "100%", height: "100%" }} />;
}
