"use client";
import Image from "next/image";
import Link from "next/link";

export default function Dashboard() {
  return (
    <div
      className="min-h-screen w-full relative px-6 py-10"
      style={{ background: "rgb(217, 205, 183)" }}
    >
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
      <div className="relative z-10 max-w-5xl mx-auto">
        <div className="mb-6 flex justify-end">
          <Link
            href="/chat"
            className="rounded-lg bg-green-900 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-green-800"
          >
            Open RAG Chat
          </Link>
        </div>
        {/* 2x2 Cards Grid */}
        <div className="grid grid-cols-2 gap-6 mb-10">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="rounded-xl bg-white/80 shadow p-8 h-52 flex items-center justify-center text-2xl font-semibold text-green-900 border border-green-100"
            >
              Card {i}
            </div>
          ))}
        </div>
        {/* Placeholder Table */}
        <div className="bg-white/90 rounded-xl shadow p-6 border border-green-100">
          <table className="w-full text-left">
            <thead>
              <tr className="text-green-900 font-bold">
                <th className="py-2 px-4">Column 1</th>
                <th className="py-2 px-4">Column 2</th>
                <th className="py-2 px-4">Column 3</th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3].map((row) => (
                <tr key={row} className="border-t border-green-100">
                  <td className="py-2 px-4">Row {row} Data 1</td>
                  <td className="py-2 px-4">Row {row} Data 2</td>
                  <td className="py-2 px-4">Row {row} Data 3</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
