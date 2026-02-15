"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const [showLeaf1, setShowLeaf1] = useState(false);
  const [showLeaf2, setShowLeaf2] = useState(false);
  const [showText, setShowText] = useState(false);
  const [animateUp, setAnimateUp] = useState(false);
  const [tabAnimateUp, setTabAnimateUp] = useState(false);
  const [showBgImage, setShowBgImage] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setTimeout(() => setShowLeaf1(true), 200);
    setTimeout(() => setShowLeaf2(true), 800);
    setTimeout(() => setShowText(true), 1500);
    setTimeout(() => setAnimateUp(true), 2400);
    setTimeout(() => setTabAnimateUp(true), 3800);
    setTimeout(() => setShowBgImage(true), 2600);
  }, []);

  const handleDashboardClick = () => {
    setFadeOut(true);
    setTimeout(() => {
      router.push("/dashboard");
    }, 700);
  };

  return (
    <div
      style={{
        background: fadeOut ? "rgb(56, 58, 45)" : "#0f240e",
        overflow: "auto",
        transition: "background 0.7s cubic-bezier(.4,1.3,.6,1)",
      }}
    >
      <style>{`
        @keyframes textPulse {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.05);
          }
        }
      `}</style>

      {/* HERO SECTION */}
      <div
        className="min-h-screen w-full relative flex items-center justify-center"
        style={{
          background: fadeOut ? "rgb(56, 58, 45)" : "#0f240e",
          overflow: "hidden",
          transition:
            "background 0.7s cubic-bezier(.4,1.3,.6,1), opacity 0.7s cubic-bezier(.4,1.3,.6,1)",
          opacity: fadeOut ? 0 : 1,
        }}
      >
        {/* Small header top left */}
        <div
          style={{
            position: "fixed",
            top: 24,
            left: 32,
            zIndex: 3,
            fontFamily: "Playfair Display, serif",
            fontWeight: 300,
            fontSize: "1.35rem",
            color: "rgb(237, 243, 189)",
            letterSpacing: "0.1em",
            textShadow: "0 2px 8px #222a1a, 0 0 1px #222a1a",
            userSelect: "none",
          }}
        >
          envest
        </div>
        {/* Background image at the back */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            zIndex: 0,
            backgroundImage: 'url("/background.png")',
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        {/* Muting overlay above background image */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 0.5,
            background: "rgba(24, 36, 20, 0.62)",
            pointerEvents: "none",
          }}
        />
        {/* Vertical gradient mask from green to transparent */}
        <div
          style={{
            position: "absolute",
            inset: -20,
            zIndex: 2,
            pointerEvents: "none",
            background:
              "linear-gradient(to bottom, rgb(56, 58, 45) 0%, rgb(56, 58, 45) 2%, rgba(56,58,45,0.7) 8%, rgba(56,58,45,0.0) 20%, rgba(56,58,45,0.0) 80%, rgba(56,58,45,0.7) 92%, rgb(56, 58, 45) 98%, rgb(56, 58, 45) 100%)",
          }}
        />
        {/* Large centered Playfair Display text after animation */}
        {animateUp && (
          <button
            onClick={handleDashboardClick}
            style={{
              position: "absolute",
              textAlign: "center",
              width: "100vw",
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
              animation: "textPulse 4s ease-in-out infinite 1.2s",
            }}
          >
            <span
              style={{
                fontFamily: "Playfair Display, serif",
                fontWeight: 700,
                fontStyle: "italic",
                fontSize: "6.5rem",
                color: "rgb(237, 243, 189)",
                letterSpacing: "-0.08em",
                display: "block",
                marginLeft: "-4vw",
                lineHeight: 1,
              }}
            >
              conscious
            </span>
            <span
              style={{
                fontFamily: "Playfair Display, serif",
                fontWeight: 400,
                fontStyle: "normal",
                fontSize: "6rem",
                color: "rgb(237, 243, 189)",
                letterSpacing: "-0.03em",
                display: "block",
                marginRight: "-10.5vw",
                lineHeight: 1,
                marginTop: "-1.7rem",
              }}
            >
              investing
            </span>
          </button>
        )}
        <span
          style={{
            position: "absolute",
            top: "calc(50% + 140px)",
            left: "50%",
            transform: "translateX(-50%)",
            display: "block",
            fontFamily: "Montserrat, sans-serif",
            fontWeight: 500,
            fontSize: "0.9rem",
            color: "rgb(237, 243, 189)",
            letterSpacing: "0.05em",
            opacity: 0.85,
            textShadow: "0 1px 6px #222a1a",
            zIndex: 10,
          }}
        >
          start your climate <span style={{ fontStyle: "italic" }}>envest</span>
          igation ↑
        </span>
        {/* Animated landing overlay (beige paper) */}
        <div
          className="flex min-h-screen items-center justify-center font-sans relative"
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 10,
            background: "rgb(217, 205, 183)",
            transition: "transform 1.2s cubic-bezier(0.77,0,0.175,1)",
            transform: animateUp ? "translateY(-100%)" : "translateY(0)",
            borderBottomLeftRadius: 24,
            borderBottomRightRadius: 24,
          }}
        >
          {/* Reveal tab below indent */}
          <div
            className={`fixed bottom-0 right-0 z-20 pointer-events-auto`}
            style={{
              width: 300,
              height: 50,
              background: "#9e8d75",
              borderRadius: "12px 0 0 0",
              marginBottom: 0,
            }}
          >
            {/* Crinkle overlay for folder tab */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
                zIndex: 0,
                borderRadius: "12px 0 0 0",
                overflow: "hidden",
              }}
            >
              <Image
                src="/crinkle.png"
                alt="Crinkle overlay"
                fill
                style={{ objectFit: "cover", opacity: 0.2 }}
                priority
              />
            </div>
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#1a5d3a",
                textTransform: "uppercase",
                letterSpacing: "1px",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            ></span>
          </div>
          {/* Folder tab revealed as beige moves up */}
          <div
            className="fixed right-0 z-30 pointer-events-none"
            style={{
              width: 300,
              height: 50,
              background: "rgb(217, 205, 183)",
              borderRadius: "0 0 12px 12px",
              display: "flex",
              alignItems: "right",
              justifyContent: "right",
              top: tabAnimateUp ? "calc(100vh - 100px)" : "100vh",
              transition: "top 0.5s cubic-bezier(0.77,0,0.175,1)",
              boxShadow: "0 2px 8px rgba(20,54,17,0.08)",
            }}
          >
            {/* Crinkle overlay for folder tab */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
                zIndex: 0,
                borderRadius: "0 0 12px 12px",
                overflow: "hidden",
              }}
            >
              <Image
                src="/crinkle.png"
                alt="Crinkle overlay"
                fill
                style={{ objectFit: "cover", opacity: 0.2 }}
                priority
              />
            </div>
          </div>
          {/* Crinkle overlay */}
          <div className="fixed inset-0 pointer-events-none z-0">
            <Image
              src="/crinkle.png"
              alt="Crinkle overlay"
              fill
              style={{ objectFit: "cover", opacity: 0.2 }}
              priority
            />
          </div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-row items-center justify-center gap-0 z-10">
            <span
              style={{
                fontFamily: "Playfair Display, serif",
                fontWeight: 400,
                fontSize: 128,
                letterSpacing: "0.15em",
                transition: "opacity 0.7s",
                opacity: showText ? 1 : 0,
                color: "#143611",
                textShadow: "0 0 2px #0a2108, 0 0 1px #0a2108",
                marginRight: "-56px",
                marginTop: "-32px",
              }}
              className="select-none"
            >
              en
            </span>
            <div className="flex flex-col items-center justify-center">
              <div className="relative h-[260px] w-[260px] flex items-center justify-center">
                <Image
                  src="/leaf3.png"
                  alt="Leaf 1"
                  width={260}
                  height={260}
                  className={`transition-all duration-700 ease-out absolute ${showLeaf1 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-16"}`}
                  priority
                />
                <Image
                  src="/leaf4.png"
                  alt="Leaf 2"
                  width={260}
                  height={260}
                  className={`transition-all duration-700 ease-out absolute ${showLeaf2 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-16"}`}
                  priority
                />
              </div>
            </div>
            <span
              style={{
                fontFamily: "Playfair Display, serif",
                fontWeight: 400,
                fontSize: 128,
                letterSpacing: "0.15em",
                transition: "opacity 0.7s",
                opacity: showText ? 1 : 0,
                marginLeft: "-48px",
                marginTop: "-32px",
                color: "#143611",
                textShadow: "0 0 2px #0a2108, 0 0 1px #0a2108",
              }}
              className="select-none"
            >
              est
            </span>
          </div>
        </div>
      </div>

      {/* SCROLL SECTION - Solid Background */}
      <div
        style={{
          minHeight: "100vh",
          width: "100%",
          background: "rgb(56, 58, 45)",
          padding: "80px 50px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <div style={{ maxWidth: "800px", textAlign: "center" }}>
          <h2
            style={{
              fontFamily: "Playfair Display, serif",
              fontSize: "3.5rem",
              fontWeight: 400,
              color: "rgb(237, 243, 189)",
              marginBottom: "2rem",
              letterSpacing: "-0.02em",
            }}
          >
            Your portfolio deserves the truth.
          </h2>
          <p
            style={{
              fontFamily: "Montserrat, sans-serif",
              fontSize: "1.1rem",
              color: "rgb(237, 243, 189)",
              lineHeight: 1.8,
              marginBottom: "2rem",
              opacity: 0.9,
            }}
          >
            Most climate claims sound good on paper. We look deeper. Using
            semantic analysis and legal verification, we uncover what's real and
            what's greenwashing.
          </p>
          <p
            style={{
              fontFamily: "Montserrat, sans-serif",
              fontSize: "1.1rem",
              color: "rgb(237, 243, 189)",
              lineHeight: 1.8,
              opacity: 0.85,
            }}
          >
            Climate action starts with clarity. Sincerity can't be marketed—only
            verified. We analyze legal disclosures and investor statements to
            separate genuine commitment from performative sustainability.
          </p>
        </div>
      </div>
    </div>
  );
}