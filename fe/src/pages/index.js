import Link from "next/link";

export default function Home() {
  const linkStyle = {
    display: "inline-block",
    padding: "12px 24px",
    background: "#3F714B",
    color: "#fff",
    textDecoration: "none",
    borderRadius: 8,
    fontSize: 16,
    fontWeight: 600,
    margin: 4,
  };
  return (
    <div style={{
      minHeight: "100vh",
      background: "#F5F5DC",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
      fontFamily: "system-ui, -apple-system, sans-serif",
      color: "#3F714B",
    }}>
      <h1 style={{ margin: "0 0 8px", fontSize: 36, fontWeight: 600, letterSpacing: "-0.03em" }}>
        Envest
      </h1>
      <p style={{ margin: "0 0 32px", opacity: 0.8, fontSize: 16 }}>
        Climate-conscious investing
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
        <Link href="/map" style={linkStyle}>
          Air Quality Map
        </Link>
        <Link href="/preferences/investors" style={linkStyle}>
          Investor Questionnaire
        </Link>
      </div>
    </div>
  );
}
