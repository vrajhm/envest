import Link from "next/link";

export default function Home() {
  return (
    <div style={{
      minHeight: "100vh", background: "#F5F5DC", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", padding: 24,
      fontFamily: "system-ui, -apple-system, sans-serif", color: "#3F714B",
    }}>
      <h1 style={{ margin: "0 0 8px", fontSize: 36, fontWeight: 600, letterSpacing: "-0.03em" }}>
        Envest
      </h1>
      <p style={{ margin: "0 0 24px", opacity: 0.8, fontSize: 16 }}>
        Climate-conscious investing
      </p>
      <Link
        href="/preferences/investors"
        style={{
          display: "inline-block", padding: "12px 24px", background: "#3F714B", color: "#fff",
          textDecoration: "none", borderRadius: 8, fontSize: 16, fontWeight: 600,
        }}
      >
        Investor Questionnaire
      </Link>
    </div>
  );
}
