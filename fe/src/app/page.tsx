"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const [showLeaf1, setShowLeaf1] = useState(false);
  const [showLeaf2, setShowLeaf2] = useState(false);
  const [showText, setShowText] = useState(false);
  const [animateUp, setAnimateUp] = useState(false); // State to control upward animation
  const router = useRouter();

  useEffect(() => {
    setTimeout(() => setShowLeaf1(true), 200);
    setTimeout(() => setShowLeaf2(true), 800);
    setTimeout(() => setShowText(true), 1500);
    setTimeout(() => setAnimateUp(true), 2200);
  }, []);

  return (
    <div
      className="min-h-screen w-full relative flex items-center justify-center"
      style={{ background: "#0f240e" }}
    >
      {/* Placeholder button, only visible after animation */}
      {animateUp && (
        <button
          className="px-8 py-4 rounded-lg bg-white text-green-900 text-xl font-bold shadow-lg transition hover:bg-green-100 z-10"
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
          }}
          onClick={() => router.push("/dashboard")}
        >
          to dashboard (placeholder)
        </button>
      )}
      {/* Animated landing overlay (beige paper) */}
      <div
        className="flex min-h-screen items-center justify-center font-sans relative"
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 10,
          background: "rgb(217, 205, 183)",
          transition: "transform 1s cubic-bezier(0.77,0,0.175,1)",
          transform: animateUp ? "translateY(-100%)" : "translateY(0)",
        }}
      >
        {/* Folder tab */}
        <div
          className="fixed bottom-0 right-0 z-20 pointer-events-none"
          style={{
            width: 300,
            height: 70,
            background: "#b6a899",
            borderRadius: "12px 0 0 0",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginTop: -1,
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
  );
}
