"use client";

import { useState } from "react";

export default function Copilot() {
  const [message, setMessage] = useState("Explain the current setup, the strongest evidence, what would invalidate it, and whether a recent retail flip matters.");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);

  async function ask() {
    setLoading(true); setAnswer("");
    try {
      const r = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message }) });
      const j = await r.json();
      setAnswer(j.text || j.error || "No response.");
    } catch (e) { setAnswer(String(e)); }
    finally { setLoading(false); }
  }

  return (
    <section className="copilot">
      <div className="section-label">AI RESEARCH COPILOT</div>
      <h2>Ask the system about the setup.</h2>
      <textarea value={message} onChange={(e) => setMessage(e.target.value)} />
      <button className="secondary-btn" onClick={ask} disabled={loading}>{loading ? "Analyzing…" : "Ask with live context"}</button>
      {answer && <div className="copilot-answer">{answer}</div>}
    </section>
  );
}
