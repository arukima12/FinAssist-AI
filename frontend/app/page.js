"use client";

import { useState } from "react";

export default function Home() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");

  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState([]);
  const [loadingAnswer, setLoadingAnswer] = useState(false);

  // --- HANDLER 1: DISPATCH PDF FILE TO BACKEND ---
  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    setUploadStatus("Processing layout via Docling & training memory clusters...");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("http://localhost:8000/api/upload", {
        method: "POST",
        body: formData,
      });
      
      const data = await res.json();
      if (res.ok) {
        setUploadStatus(`Success! Document indexed into ${data.chunks_created} secure vectors.`);
      } else {
        setUploadStatus(`Extraction Failed: ${data.detail || "Server internal error"}`);
      }
    } catch (error) {
      setUploadStatus("Pipeline Unreachable. Is your FastAPI terminal up on port 8000?");
    } finally {
      setUploading(false);
    }
  };

  // --- HANDLER 2: DISPATCH QUERY AND STREAM DEEPSEEK ANSWERS ---
  const handleQuerySubmit = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    const userMessage = query;
    setMessages((prev) => [
      ...prev,
      { sender: "user", text: userMessage },
      { sender: "ai", text: "" }
    ]);
    setQuery("");
    setLoadingAnswer(true);

    try {
      const res = await fetch("http://localhost:8000/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: userMessage }),
      });

      if (!res.ok) {
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1].text = "An error occurred retrieving data coordinates from Python layer.";
          return updated;
        });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        const chunkValue = decoder.decode(value);
        
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1].text += chunkValue;
          return updated;
        });
      }

    } catch (error) {
      console.error(error);
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1].text = "Lost connection stream to local host infrastructure.";
        return updated;
      });
    } finally {
      setLoadingAnswer(false);
    }
  };

  return (
    <main className="flex flex-col md:flex-row h-screen w-screen overflow-hidden bg-slate-950 font-sans">
      
      {/* LEFT COMPONENT LAYER: CONTROL CENTER & UPLOAD INGESTION BAR */}
      <section className="w-full md:w-1/3 bg-slate-900 border-b md:border-b-0 md:border-r border-slate-800 p-6 flex flex-col justify-between">
        <div>
          <div className="mb-8">
            <h1 className="text-2xl font-extrabold text-teal-400 tracking-tight">FinAssist AI</h1>
            <p className="text-xs text-slate-400 mt-1">Local Compliance & Structural Financial RAG</p>
          </div>

          <div className="bg-slate-950 p-5 rounded-xl border border-slate-800">
            <h2 className="text-sm font-semibold text-slate-200 mb-3">Ingest Financial Source File</h2>
            <form onSubmit={handleUpload} className="space-y-4">
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => setFile(e.target.files[0])}
                className="w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-teal-500/10 file:text-teal-400 hover:file:bg-teal-500/20 cursor-pointer"
              />
              <button
                type="submit"
                disabled={uploading || !file}
                className="w-full bg-teal-500 hover:bg-teal-600 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 text-xs font-bold py-2.5 px-4 rounded-lg transition-colors cursor-pointer"
              >
                {uploading ? "Analyzing Matrix Tables..." : "Index Vector Matrix"}
              </button>
            </form>

            {uploadStatus && (
              <div className="mt-4 p-3 bg-slate-900 rounded-lg border border-slate-800 text-[11px] leading-relaxed text-slate-300 break-words">
                {uploadStatus}
              </div>
            )}
          </div>
        </div>

        <div className="text-[10px] text-slate-500 hidden md:block pt-4 border-t border-slate-800">
          Stack Architecture: Next.js 15 + FastAPI Server + Docling Core + ChromaDB Embedded + DeepSeek-R1 (Ollama)
        </div>
      </section>

      {/* RIGHT COMPONENT LAYER: STREAMING CHAT VIEWPORT */}
      <section className="flex-1 flex flex-col justify-between h-full bg-slate-950">
        
        {/* CONVERSATION SCROLL TRAY */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin scrollbar-thumb-slate-800">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6">
              <div className="bg-slate-900 border border-slate-800 rounded-full p-4 mb-4 text-teal-400 text-2xl">📊</div>
              <h3 className="text-slate-300 font-medium">Analytics Workspace Open</h3>
              <p className="text-xs text-slate-500 max-w-sm mt-1">
                Upload your financial reporting tracking asset or type an analytical query to pull live context generation from ChromaDB.
              </p>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-2xl px-4 py-3 rounded-xl text-xs leading-relaxed whitespace-pre-wrap ${
                    msg.sender === "user"
                      ? "bg-teal-500 text-slate-950 font-medium rounded-tr-none"
                      : "bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-none"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))
          )}

          {loadingAnswer && !messages[messages.length - 1]?.text && (
            <div className="flex justify-start">
              <div className="bg-slate-900 border border-slate-800 px-4 py-3 rounded-xl rounded-tl-none flex items-center space-x-2 text-xs text-slate-400">
                <span className="animate-pulse text-teal-400">●</span>
                <span>DeepSeek-R1 parsing vectors and streaming analytics...</span>
              </div>
            </div>
          )}
        </div>

        {/* INPUT SUBMISSION FIELD TRUNK */}
        <div className="p-4 border-t border-slate-900 bg-slate-900/50">
          <form onSubmit={handleQuerySubmit} className="flex gap-2 max-w-4xl mx-auto">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask an analytical question regarding layout balance sheets or regulatory filings..."
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500 transition-colors"
            />
            <button
              type="submit"
              disabled={loadingAnswer || !query.trim()}
              className="bg-teal-500 hover:bg-teal-600 disabled:bg-slate-800 text-slate-950 disabled:text-slate-500 text-xs font-bold px-5 rounded-xl transition-colors cursor-pointer"
            >
              Analyze
            </button>
          </form>
        </div>
      </section>

    </main>
  );
}