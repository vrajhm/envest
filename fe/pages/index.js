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
              "interpolate",
              ["linear"],
              ["heatmap-density"],
              0,
              "rgba(245, 245, 220, 0)",
              0.25,
              "rgba(245, 245, 220, 0.5)",
              0.5,
              "rgba(127, 149, 117, 0.6)",
              0.75,
              "rgba(63, 113, 75, 0.75)",
              1,
              "rgba(63, 113, 75, 0.9)",
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
    <div style={{ 
      display: "flex", 
      height: "100vh", 
      width: "100%", 
      background: "linear-gradient(135deg, #e8f5e9 0%, #f1f8e9 100%)",
      fontFamily: "system-ui, -apple-system, sans-serif",
      padding: "2rem",
      gap: "2rem"
    }}>
      {/* Main Content Area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        {/* Header */}
        <div>
          <h1 style={{ 
            margin: 0, 
            fontSize: "2rem", 
            fontWeight: 700, 
            color: "#2e7d32",
            letterSpacing: "-0.03em"
          }}>
            Air Quality Monitor
          </h1>
          <p style={{ 
            margin: "0.5rem 0 0 0", 
            color: "#558b2f", 
            fontSize: "0.95rem" 
          }}>
            Real-time pollution data powered by OpenAQ
          </p>
        </div>

        {/* Map Card */}
        <div style={{
          flex: 1,
          background: "white",
          borderRadius: "16px",
          boxShadow: "0 4px 24px rgba(0, 0, 0, 0.08)",
          overflow: "hidden",
          position: "relative",
          minHeight: 0
        }}>
          <div
            ref={mapContainerRef}
            style={{ width: "100%", height: "100%" }}
          />
          
          {/* Legend Overlay */}
          <div style={{
            position: "absolute",
            bottom: "24px",
            left: "24px",
            background: "rgba(255, 255, 255, 0.95)",
            backdropFilter: "blur(8px)",
            padding: "1rem 1.25rem",
            borderRadius: "12px",
            boxShadow: "0 2px 12px rgba(0, 0, 0, 0.15)",
            minWidth: "200px"
          }}>
            <h4 style={{ 
              margin: "0 0 0.75rem 0", 
              fontSize: "0.875rem", 
              fontWeight: 600,
              color: "#2e7d32",
              textTransform: "uppercase",
              letterSpacing: "0.05em"
            }}>
              Pollution Intensity
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {[
                { color: "rgba(245, 245, 220, 0.8)", label: "Very Low" },
                { color: "rgba(127, 149, 117, 0.8)", label: "Moderate" },
                { color: "rgba(63, 113, 75, 0.9)", label: "High" }
              ].map((item, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <div style={{
                    width: "32px",
                    height: "16px",
                    background: item.color,
                    borderRadius: "4px",
                    border: "1px solid rgba(0, 0, 0, 0.1)"
                  }} />
                  <span style={{ fontSize: "0.8rem", color: "#424242" }}>{item.label}</span>
                </div>
              ))}
            </div>
            
            {/* Cursor Location Info */}
            {hoverInfo && (
              <div style={{
                marginTop: "1rem",
                paddingTop: "1rem",
                borderTop: "1px solid rgba(0, 0, 0, 0.1)"
              }}>
                <div style={{ fontSize: "0.75rem", color: "#666", marginBottom: "0.25rem" }}>
                  Current Location
                </div>
                <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "#2e7d32" }}>
                  {hoverInfo.category.replace(/_/g, " ").toUpperCase()}
                </div>
                <div style={{ fontSize: "0.875rem", color: "#424242", marginTop: "0.25rem" }}>
                  Severity: <strong>{hoverInfo.severity}%</strong>
                </div>
                <div style={{ fontSize: "0.75rem", color: "#666", marginTop: "0.25rem" }}>
                  {hoverInfo.coordinates[1]?.toFixed(4)}, {hoverInfo.coordinates[0]?.toFixed(4)}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Sidebar */}
      <div style={{
        width: "340px",
        display: "flex",
        flexDirection: "column",
        gap: "1.5rem"
      }}>
        {/* Current Data Card */}
        <div style={{
          background: "white",
          borderRadius: "16px",
          padding: "1.5rem",
          boxShadow: "0 4px 24px rgba(0, 0, 0, 0.08)"
        }}>
          <h3 style={{ 
            margin: "0 0 1rem 0", 
            fontSize: "1.1rem", 
            fontWeight: 600,
            color: "#2e7d32"
          }}>
            Current Reading
          </h3>
          {!data ? (
            <div style={{ color: "#666", fontSize: "0.9rem" }}>Loading data...</div>
          ) : !hoverInfo ? (
            <div style={{ 
              color: "#666", 
              fontSize: "0.9rem",
              fontStyle: "italic",
              padding: "1rem",
              background: "#f5f5f5",
              borderRadius: "8px",
              textAlign: "center"
            }}>
              Hover over the map to see pollution details
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div>
                <div style={{ fontSize: "0.75rem", color: "#666", marginBottom: "0.25rem" }}>
                  Pollutant Type
                </div>
                <div style={{ fontSize: "1rem", fontWeight: 600, color: "#2e7d32" }}>
                  {hoverInfo.category.replace(/_/g, " ").toUpperCase()}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "0.75rem", color: "#666", marginBottom: "0.25rem" }}>
                  Severity Level
                </div>
                <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#d32f2f" }}>
                  {hoverInfo.severity}%
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Companies Card */}
        <div style={{
          flex: 1,
          background: "white",
          borderRadius: "16px",
          padding: "1.5rem",
          boxShadow: "0 4px 24px rgba(0, 0, 0, 0.08)",
          display: "flex",
          flexDirection: "column",
          minHeight: 0
        }}>
          <h3 style={{ 
            margin: "0 0 1rem 0", 
            fontSize: "1.1rem", 
            fontWeight: 600,
            color: "#2e7d32"
          }}>
            Major Polluters Nearby
          </h3>
          <div style={{ 
            flex: 1,
            overflow: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem"
          }}>
            {/* Placeholder companies */}
            {[
              { name: "Industrial Plant A", distance: "2.3 km", type: "Manufacturing" },
              { name: "Chemical Facility B", distance: "4.7 km", type: "Chemical Processing" },
              { name: "Power Station C", distance: "6.1 km", type: "Energy Production" },
              { name: "Refinery D", distance: "8.5 km", type: "Oil & Gas" }
            ].map((company, i) => (
              <div key={i} style={{
                padding: "1rem",
                background: "#f9fbe7",
                borderRadius: "8px",
                borderLeft: "3px solid #827717",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#f0f4c3";
                e.currentTarget.style.transform = "translateX(4px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#f9fbe7";
                e.currentTarget.style.transform = "translateX(0)";
              }}>
                <div style={{ 
                  fontSize: "0.9rem", 
                  fontWeight: 600, 
                  color: "#33691e",
                  marginBottom: "0.25rem"
                }}>
                  {company.name}
                </div>
                <div style={{ fontSize: "0.75rem", color: "#666" }}>
                  {company.type} • {company.distance}
                </div>
              </div>
            ))}
            <div style={{
              padding: "1rem",
              background: "#f5f5f5",
              borderRadius: "8px",
              textAlign: "center",
              color: "#999",
              fontSize: "0.85rem",
              fontStyle: "italic"
            }}>
              More data will load based on map location
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}