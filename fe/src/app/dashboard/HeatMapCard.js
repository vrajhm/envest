"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";
const ISSUES_URL = `${API_BASE_URL}/issues`;

/**
 * @typedef {Object} StartupItem
 * @property {string} name
 * @property {string} sector
 * @property {"healthy" | "watch" | "high_risk" | string} status
 * @property {number} climate_trust
 * @property {number} greenwash_risk
 * @property {number} net_zero_cred
 * @property {number} confidence
 * @property {{ city?: string, lat: number, lng: number }} geo
 */

/**
 * @param {{ startups?: StartupItem[] }} props
 */
export default function HeatMapCard({ startups = [] }) {
  const mapRef = useRef(null);
  const mapContainerRef = useRef(null);
  const [issuesGeojson, setIssuesGeojson] = useState(null);
  const [issuesWarning, setIssuesWarning] = useState("");
  const [selectedCompany, setSelectedCompany] = useState(null);

  const companiesGeojson = useMemo(
    () => ({
      type: "FeatureCollection",
      features: startups
        .filter(
          (startup) =>
            Number.isFinite(startup?.geo?.lat) && Number.isFinite(startup?.geo?.lng),
        )
        .map((startup) => ({
          type: "Feature",
          properties: {
            name: startup.name,
            sector: startup.sector,
            status: startup.status,
            city: startup.geo.city || "San Francisco",
            climate_trust: startup.climate_trust,
            greenwash_risk: startup.greenwash_risk,
            net_zero_cred: startup.net_zero_cred,
            confidence: startup.confidence,
          },
          geometry: {
            type: "Point",
            coordinates: [startup.geo.lng, startup.geo.lat],
          },
        })),
    }),
    [startups],
  );

  useEffect(() => {
    let cancelled = false;

    fetch(ISSUES_URL)
      .then((res) => {
        if (!res.ok) {
          setIssuesWarning(`Heatmap unavailable (${res.status}). Showing company dots only.`);
          return { type: "FeatureCollection", features: [] };
        }
        return res.json();
      })
      .then((json) => {
        if (!cancelled) {
          setIssuesGeojson(json);
        }
      })
      .catch((err) => {
        console.error("Heatmap data fetch failed:", err);
        if (!cancelled) {
          setIssuesWarning("Heatmap unavailable. Showing company dots only.");
          setIssuesGeojson({ type: "FeatureCollection", features: [] });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!MAPBOX_TOKEN || !mapContainerRef.current || !issuesGeojson) return;

    let disposed = false;

    const initMap = async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (disposed) return;

      mapboxgl.accessToken = MAPBOX_TOKEN;

      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: "mapbox://styles/mapbox/light-v11",
        center: [-122.4194, 37.7749],
        zoom: 2.2,
      });

      mapRef.current = map;

      map.on("load", () => {
        map.addSource("issues", {
          type: "geojson",
          data: issuesGeojson,
        });

        map.addSource("companies", {
          type: "geojson",
          data: companiesGeojson,
        });

        map.addLayer({
          id: "pollution-heat",
          type: "heatmap",
          source: "issues",
          maxzoom: 16,
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
            "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 0, 1.0, 12, 4.4],
            "heatmap-color": [
              "interpolate",
              ["linear"],
              ["heatmap-density"],
              0,
              "rgba(120,170,220,0)",
              0.4,
              "rgba(130,180,230,0.25)",
              0.5,
              "rgba(150,215,220,0.35)",
              0.7,
              "rgba(190,225,150,0.45)",
              0.8,
              "rgba(240,220,140,0.55)",
              1,
              "rgba(235,150,120,0.65)",
            ],
            "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 0, 15, 8, 25, 12, 30],
            "heatmap-opacity": 0.8,
          },
        });

        map.addLayer({
          id: "company-points",
          type: "circle",
          source: "companies",
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 6, 6, 12, 10, 16, 12],
            "circle-color": [
              "match",
              ["get", "status"],
              "healthy",
              "#2db861",
              "watch",
              "#f4a300",
              "high_risk",
              "#d94a45",
              "#b0a979",
            ],
            "circle-opacity": 1,
            "circle-stroke-width": 2,
            "circle-stroke-color": "#fff7db",
          },
        });

        map.on("click", "company-points", (e) => {
          const feature = e.features?.[0];
          if (!feature) return;
          const props = feature.properties || {};
          setSelectedCompany({
            name: props.name || "Company",
            sector: props.sector || "N/A",
            status: String(props.status || "unknown"),
            city: props.city || "San Francisco",
            climate_trust: props.climate_trust ?? "N/A",
            greenwash_risk: props.greenwash_risk ?? "N/A",
            net_zero_cred: props.net_zero_cred ?? "N/A",
            confidence: props.confidence ?? "N/A",
          });
        });

        map.on("click", (e) => {
          const clickedFeatures = map.queryRenderedFeatures(e.point, {
            layers: ["company-points"],
          });
          if (!clickedFeatures.length) {
            setSelectedCompany(null);
          }
        });

        map.on("mouseenter", "company-points", () => {
          map.getCanvas().style.cursor = "pointer";
        });

        map.on("mouseleave", "company-points", () => {
          map.getCanvas().style.cursor = "";
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
  }, [issuesGeojson, companiesGeojson]);

  if (!MAPBOX_TOKEN) {
    return (
      <div className="p-4" style={{ color: "rgb(26, 28, 18)" }}>
        Missing NEXT_PUBLIC_MAPBOX_TOKEN
      </div>
    );
  }

  if (!issuesGeojson) {
    return (
      <div className="p-4" style={{ color: "rgb(26, 28, 18)" }}>
        Loading heatmap data...
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      {issuesWarning ? (
        <div
          className="pb-2 text-sm"
          style={{ color: "rgb(120, 60, 30)", position: "absolute", left: 8, top: 6, zIndex: 4 }}
        >
          {issuesWarning}
        </div>
      ) : null}
      <div ref={mapContainerRef} style={{ width: "100%", height: "100%" }} />
      {selectedCompany ? (
        <div
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            zIndex: 5,
            minWidth: 250,
            maxWidth: 300,
            padding: "12px 12px 10px",
            borderRadius: 10,
            border: "1px solid #d7ceaa",
            background: "#f5f0d8",
            fontFamily: "Montserrat, Arial, sans-serif",
            color: "#1a1c12",
            boxShadow: "0 6px 16px rgba(27, 33, 16, 0.18)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, lineHeight: 1.1, fontWeight: 700 }}>{selectedCompany.name}</h3>
              <p style={{ margin: "4px 0 0", fontSize: 12, opacity: 0.85 }}>
                {selectedCompany.sector} • {selectedCompany.city}
              </p>
            </div>
            <span
              style={{
                background:
                  selectedCompany.status === "healthy"
                    ? "#e8f4df"
                    : selectedCompany.status === "watch"
                      ? "#f9eed2"
                      : selectedCompany.status === "high_risk"
                        ? "#f8dfdb"
                        : "#ece6cf",
                color:
                  selectedCompany.status === "healthy"
                    ? "#1f6d39"
                    : selectedCompany.status === "watch"
                      ? "#8b5d1e"
                      : selectedCompany.status === "high_risk"
                        ? "#8f2f28"
                        : "#5b573f",
                border: "1px solid rgba(0,0,0,0.08)",
                borderRadius: 999,
                padding: "2px 8px",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.04em",
                whiteSpace: "nowrap",
              }}
            >
              {selectedCompany.status.replace("_", " ").toUpperCase()}
            </span>
          </div>
          <div
            style={{
              marginTop: 10,
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
            }}
          >
            <Metric label="CLIMATE TRUST" value={selectedCompany.climate_trust} />
            <Metric label="GREENWASH RISK" value={selectedCompany.greenwash_risk} />
            <Metric label="NET-ZERO CRED." value={selectedCompany.net_zero_cred} />
            <Metric label="CONFIDENCE" value={selectedCompany.confidence} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div style={{ background: "#ece6cf", borderRadius: 8, padding: "7px 8px" }}>
      <div style={{ fontSize: 10, letterSpacing: "0.04em", opacity: 0.8 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.1 }}>{value}</div>
    </div>
  );
}
