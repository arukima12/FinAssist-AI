"use client";

import { useState, useEffect, useRef } from "react";
import {
  FileText,
  UploadCloud,
  Trash2,
  Cpu,
  Database,
  ShieldCheck,
  TrendingUp,
  Scale,
  HelpCircle,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  RefreshCw,
  Send,
  AlertCircle,
  Layers,
  Sparkles,
  ExternalLink,
  BookOpen
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function Home() {
  // System & Health State
  const [health, setHealth] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(false);

  // File Upload State
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  // Chat & Query State
  const [sessionId, setSessionId] = useState("session_" + Math.random().toString(36).substring(2, 9));
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [expandedSources, setExpandedSources] = useState({});
  const [expandedReasoning, setExpandedReasoning] = useState({});

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // Scroll to bottom when messages update
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch system health & documents on mount
  useEffect(() => {
    fetchHealth();
    fetchDocuments();
    const interval = setInterval(fetchHealth, 15000);
    return () => clearInterval(interval);
  }, []);

  const fetchHealth = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/health`);
      if (res.ok) {
        const data = await res.json();
        setHealth(data);
      }
    } catch {
      setHealth(null);
    }
  };

  const fetchDocuments = async () => {
    setLoadingDocs(true);
    try {
      const res = await fetch(`${API_BASE}/api/documents`);
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.documents || []);
      }
    } catch (err) {
      console.error("Failed to load documents", err);
    } finally {
      setLoadingDocs(false);
    }
  };

  // --- MULTI-FORMAT FILE UPLOAD HANDLER ---
  const handleFileUpload = async (selectedFiles) => {
    if (!selectedFiles || selectedFiles.length === 0) return;

    setUploading(true);
    setUploadStatus({ type: "info", message: `Ingesting ${selectedFiles.length} document(s) with Docling layout analysis...` });

    const formData = new FormData();
    for (let i = 0; i < selectedFiles.length; i++) {
      formData.append("files", selectedFiles[i]);
    }

    try {
      const res = await fetch(`${API_BASE}/api/upload`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (res.ok) {
        setUploadStatus({
          type: "success",
          message: `Indexed successfully! Generated ${data.total_chunks_created} high-dimension vector embeddings.`
        });
        fetchDocuments();
        fetchHealth();
        setFiles([]);
        if (fileInputRef.current) fileInputRef.current.value = "";
      } else {
        setUploadStatus({
          type: "error",
          message: data.detail || "Document ingestion failed."
        });
      }
    } catch {
      setUploadStatus({
        type: "error",
        message: "Backend server unreachable. Ensure FastAPI is running on port 8000."
      });
    } finally {
      setUploading(false);
    }
  };

  // Drag and drop handlers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files);
    }
  };

  // Delete a single document
  const handleDeleteDoc = async (docId) => {
    try {
      const res = await fetch(`${API_BASE}/api/documents/${docId}`, {
        method: "DELETE"
      });
      if (res.ok) {
        fetchDocuments();
        fetchHealth();
      }
    } catch (err) {
      console.error("Failed to delete document", err);
    }
  };

  // Clear all vectors
  const handleClearAll = async () => {
    if (!confirm("Are you sure you want to purge all indexed documents and vector embeddings?")) return;
    try {
      await fetch(`${API_BASE}/api/clear`, { method: "POST" });
      fetchDocuments();
      fetchHealth();
      setMessages([]);
      setUploadStatus(null);
    } catch (err) {
      console.error("Failed to clear vectors", err);
    }
  };

  // Reset conversation
  const handleNewChat = () => {
    setSessionId("session_" + Math.random().toString(36).substring(2, 9));
    setMessages([]);
    setExpandedReasoning({});
    setExpandedSources({});
  };

  // --- STREAMING QUERY SUBMISSION ---
  const handleQuerySubmit = async (e, forcedQuery = null) => {
    if (e) e.preventDefault();
    const queryToSend = forcedQuery || query;
    if (!queryToSend.trim() || isStreaming) return;

    const userText = queryToSend;
    setQuery("");

    // Append user message & placeholder for streaming AI message
    const msgId = Date.now();
    setMessages((prev) => [
      ...prev,
      {
        id: msgId,
        sender: "user",
        text: userText,
        timestamp: new Date().toLocaleTimeString()
      },
      {
        id: msgId + 1,
        sender: "ai",
        text: "",
        reasoning: "",
        route: null,
        sources: [],
        isStreaming: true,
        timestamp: new Date().toLocaleTimeString()
      }
    ]);

    setIsStreaming(true);

    try {
      const res = await fetch(`${API_BASE}/api/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: userText,
          session_id: sessionId
        }),
      });

      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;

          try {
            const jsonStr = trimmed.slice(5).trim();
            if (!jsonStr) continue;
            const parsed = JSON.parse(jsonStr);

            setMessages((prev) => {
              const updated = [...prev];
              const currentAi = updated[updated.length - 1];
              if (!currentAi || currentAi.sender !== "ai") return prev;

              if (parsed.type === "route") {
                currentAi.route = parsed.data;
              } else if (parsed.type === "sources") {
                currentAi.sources = parsed.data || [];
              } else if (parsed.type === "reasoning") {
                currentAi.reasoning = (currentAi.reasoning || "") + parsed.delta;
                // Auto-expand reasoning while generating
                setExpandedReasoning((old) => ({ ...old, [currentAi.id]: true }));
              } else if (parsed.type === "content") {
                currentAi.text = (currentAi.text || "") + parsed.delta;
              } else if (parsed.type === "done") {
                currentAi.isStreaming = false;
              } else if (parsed.type === "error") {
                currentAi.text = `Error: ${parsed.detail || "Pipeline failed"}`;
                currentAi.isStreaming = false;
              }
              return updated;
            });
          } catch {
            // Buffer chunk incomplete, wait for next event
          }
        }
      }
    } catch (err) {
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last && last.sender === "ai") {
          last.text = "Connection interrupted. Verify that FastAPI server is listening on port 8000 and Ollama is active.";
          last.isStreaming = false;
        }
        return updated;
      });
    } finally {
      setIsStreaming(false);
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last) last.isStreaming = false;
        return updated;
      });
    }
  };

  // Copy text to clipboard
  const handleCopy = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Export session transcript
  const handleExportChat = () => {
    const transcript = messages
      .map((m) => `### ${m.sender === "user" ? "USER" : "FINASSIST AI"}\n${m.text}\n`)
      .join("\n---\n\n");
    const blob = new Blob([transcript], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `finassist_analysis_${sessionId}.md`;
    a.click();
  };

  // Query chips for rapid analytical testing
  const SUGGESTED_PROMPTS = [
    {
      title: "Analyze EBITDA & Margins",
      query: "Analyze EBITDA, operating margins, and year-over-year revenue trajectory from the uploaded financial statements."
    },
    {
      title: "Extract Debt Covenants",
      query: "Extract all debt covenants, negative covenants, default trigger ratios, and borrowing restrictions."
    },
    {
      title: "Balance Sheet Breakdown",
      query: "Provide a structured breakdown of Total Assets, Current Liabilities, and Cash Equivalents in a markdown table."
    },
    {
      title: "Identify Risk Disclosures",
      query: "What are the primary regulatory, operational, or legal dispute risks disclosed in the filing?"
    }
  ];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 font-sans">
      
      {/* ============================================================ */}
      {/* LEFT SIDEBAR: DOCUMENT REPOSITORY & PIPELINE CONTROL CENTER */}
      {/* ============================================================ */}
      <aside className="w-80 md:w-96 flex-shrink-0 bg-slate-900/90 border-r border-slate-800/80 flex flex-col justify-between backdrop-blur-md">
        
        {/* BRAND & HEADER */}
        <div className="p-5 border-b border-slate-800/80">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-400 flex items-center justify-center shadow-lg shadow-teal-500/20">
                <TrendingUp className="h-5 w-5 text-slate-950 stroke-[2.5]" />
              </div>
              <div>
                <h1 className="text-base font-extrabold tracking-tight bg-gradient-to-r from-teal-300 via-emerald-300 to-cyan-300 bg-clip-text text-transparent">
                  FinAssist AI
                </h1>
                <p className="text-[10px] text-slate-400 font-medium tracking-wide uppercase">
                  Enterprise Financial RAG
                </p>
              </div>
            </div>
            
            <button
              onClick={handleNewChat}
              title="Start New Analytical Session"
              className="p-1.5 text-xs text-slate-400 hover:text-teal-300 hover:bg-slate-800 rounded-lg transition-colors border border-transparent hover:border-slate-700"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          {/* SYSTEM HEALTH TELEMETRY */}
          <div className="mt-4 grid grid-cols-2 gap-2 text-[10px]">
            <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-2.5 flex items-center space-x-2">
              <span className={`h-2 w-2 rounded-full ${health?.ollama?.online ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`} />
              <div className="truncate">
                <div className="text-slate-400 font-medium">Inference</div>
                <div className="text-slate-200 font-semibold truncate">
                  {health?.ollama?.target_llm || "DeepSeek-R1"}
                </div>
              </div>
            </div>

            <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-2.5 flex items-center space-x-2">
              <Database className="h-3.5 w-3.5 text-teal-400 flex-shrink-0" />
              <div className="truncate">
                <div className="text-slate-400 font-medium">Chroma DB</div>
                <div className="text-slate-200 font-semibold">
                  {health?.vector_store?.total_vectors ?? 0} Vectors
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* DOCUMENT UPLOAD & CATALOG TRAY */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          
          {/* DRAG-AND-DROP UPLOAD DROPZONE */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-300 flex items-center space-x-1.5">
                <UploadCloud className="h-3.5 w-3.5 text-teal-400" />
                <span>Ingest Source Documents</span>
              </label>
              <span className="text-[10px] text-slate-400">PDF, DOCX, XLSX</span>
            </div>

            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all duration-200 ${
                dragActive
                  ? "border-teal-400 bg-teal-500/10"
                  : "border-slate-800 hover:border-slate-700 bg-slate-950/40 hover:bg-slate-950/70"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.docx,.xlsx,.xls,.csv,.txt,.md"
                onChange={(e) => handleFileUpload(e.target.files)}
                className="hidden"
              />
              <div className="flex flex-col items-center justify-center space-y-1.5">
                <div className="h-8 w-8 rounded-full bg-slate-800/80 flex items-center justify-center text-teal-400">
                  <FileText className="h-4 w-4" />
                </div>
                <p className="text-xs font-medium text-slate-300">
                  {uploading ? "Parsing Document Layouts..." : "Click or Drag & Drop Documents"}
                </p>
                <p className="text-[10px] text-slate-400">
                  Docling layout engine extracts tables, forms & multi-columns locally
                </p>
              </div>
            </div>

            {uploadStatus && (
              <div
                className={`mt-2.5 p-2.5 rounded-lg text-[11px] leading-relaxed border ${
                  uploadStatus.type === "success"
                    ? "bg-emerald-950/40 border-emerald-800/60 text-emerald-300"
                    : uploadStatus.type === "error"
                    ? "bg-rose-950/40 border-rose-800/60 text-rose-300"
                    : "bg-slate-800/50 border-slate-700 text-slate-300"
                }`}
              >
                {uploadStatus.message}
              </div>
            )}
          </div>

          {/* INDEXED DOCUMENTS LIST */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-1.5">
                <BookOpen className="h-3.5 w-3.5 text-teal-400" />
                <h3 className="text-xs font-semibold text-slate-300">Indexed Knowledge Base</h3>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-teal-300 font-mono">
                {documents.length} docs
              </span>
            </div>

            {loadingDocs ? (
              <div className="p-4 text-center text-xs text-slate-400">Refreshing vector catalog...</div>
            ) : documents.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800/70 text-center">
                <Layers className="h-6 w-6 text-slate-700 mx-auto mb-1.5" />
                <p className="text-xs text-slate-400">No documents indexed yet.</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Upload a 10-K, earnings report, or contract to start.</p>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {documents.map((doc) => (
                  <div
                    key={doc.doc_id}
                    className="group bg-slate-950/60 hover:bg-slate-950 border border-slate-800/80 rounded-lg p-2.5 flex items-center justify-between transition-all"
                  >
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <div className="h-7 w-7 rounded bg-teal-500/10 text-teal-400 flex items-center justify-center text-[10px] font-bold uppercase flex-shrink-0">
                        {doc.file_type ? doc.file_type.replace(".", "") : "DOC"}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-slate-200 truncate" title={doc.filename}>
                          {doc.filename}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {doc.chunk_count} semantic chunks
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteDoc(doc.doc_id)}
                      title="Remove document from index"
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-rose-400 transition-opacity"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* BOTTOM METADATA & CONTROLS */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/50 space-y-2">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center space-x-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              <span>Offline Air-Gapped Privacy</span>
            </span>
            <button
              onClick={handleClearAll}
              className="text-slate-400 hover:text-rose-400 text-[10px] transition-colors"
            >
              Purge All
            </button>
          </div>
        </div>
      </aside>

      {/* ============================================================ */}
      {/* MAIN VIEWPORT: STREAMING CONVERSATION & ANALYTICS VIEW */}
      {/* ============================================================ */}
      <main className="flex-1 flex flex-col h-full bg-slate-950 overflow-hidden">
        
        {/* TOP BAR WITH PIPELINE CONTROLS */}
        <header className="h-14 border-b border-slate-800/80 px-6 flex items-center justify-between bg-slate-950/80 backdrop-blur-md">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-medium text-slate-400">Session:</span>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-teal-300">
                {sessionId}
              </span>
            </div>
            <div className="h-4 w-[1px] bg-slate-800" />
            <div className="text-[11px] text-slate-400 hidden sm:flex items-center space-x-1">
              <span>Model:</span>
              <span className="text-slate-300 font-medium">DeepSeek-R1 (1.5B)</span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {messages.length > 0 && (
              <button
                onClick={handleExportChat}
                className="text-xs text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-lg border border-slate-800 hover:bg-slate-900 transition-colors flex items-center space-x-1.5"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>Export Analysis</span>
              </button>
            )}
          </div>
        </header>

        {/* CHAT VIEWPORT */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center max-w-2xl mx-auto text-center px-4">
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-teal-500/20 to-emerald-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 mb-5 shadow-xl shadow-teal-500/5">
                <Sparkles className="h-8 w-8 stroke-[1.75]" />
              </div>
              <h2 className="text-xl font-bold text-slate-100 tracking-tight">
                Enterprise Financial & Legal Intelligence
              </h2>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Ingest 10-K annual reports, credit agreements, or financial balance sheets.
                FinAssist AI analyzes table structures, verifies citations, and delivers mathematically grounded answers completely offline.
              </p>

              {/* PROMPT SUGGESTION CHIPS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-8 w-full text-left">
                {SUGGESTED_PROMPTS.map((p, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleQuerySubmit(null, p.query)}
                    className="p-3.5 rounded-xl bg-slate-900/60 hover:bg-slate-900 border border-slate-800/80 hover:border-teal-500/40 transition-all text-left group cursor-pointer"
                  >
                    <div className="text-xs font-semibold text-slate-200 group-hover:text-teal-300 transition-colors">
                      {p.title}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-snug">
                      {p.query}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
              >
                {/* SENDER LABEL & TIME */}
                <div className="text-[10px] text-slate-400 mb-1 px-1 flex items-center space-x-1.5 font-mono">
                  <span>{msg.sender === "user" ? "Financial Analyst" : "FinAssist Intelligence"}</span>
                  <span>•</span>
                  <span>{msg.timestamp}</span>
                </div>

                {/* USER BUBBLE */}
                {msg.sender === "user" ? (
                  <div className="max-w-2xl bg-teal-500/10 border border-teal-500/30 text-teal-200 px-4 py-3 rounded-2xl rounded-tr-sm text-xs leading-relaxed font-medium">
                    {msg.text}
                  </div>
                ) : (
                  /* AI MESSAGE CARD */
                  <div className="w-full max-w-3xl bg-slate-900/70 border border-slate-800/80 rounded-2xl rounded-tl-sm p-5 space-y-4 shadow-xl">
                    
                    {/* QUERY ROUTING BADGE */}
                    {msg.route && (
                      <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
                        <div className="flex items-center space-x-2">
                          <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-md bg-teal-500/10 text-teal-300 border border-teal-500/20 flex items-center space-x-1.5">
                            {msg.route.route === "FINANCIAL_TABLE_ANALYSIS" && <TrendingUp className="h-3 w-3" />}
                            {msg.route.route === "LEGAL_COMPLIANCE" && <Scale className="h-3 w-3" />}
                            {msg.route.route === "DOCUMENT_SUMMARY" && <FileText className="h-3 w-3" />}
                            {msg.route.route === "GENERAL_QA" && <HelpCircle className="h-3 w-3" />}
                            <span>{msg.route.label}</span>
                          </span>
                        </div>

                        {/* COPY BUTTON */}
                        <button
                          onClick={() => handleCopy(msg.text, msg.id)}
                          className="text-[10px] text-slate-400 hover:text-slate-200 px-2 py-1 rounded bg-slate-800/50 hover:bg-slate-800 transition-colors flex items-center space-x-1"
                        >
                          {copiedIndex === msg.id ? (
                            <>
                              <Check className="h-3 w-3 text-emerald-400" />
                              <span className="text-emerald-400">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}

                    {/* EXPANDABLE REASONING TRACE (DeepSeek-R1 Chain of Thought) */}
                    {msg.reasoning && (
                      <div className="rounded-xl border border-slate-800 bg-slate-950/60 overflow-hidden">
                        <button
                          onClick={() =>
                            setExpandedReasoning((old) => ({
                              ...old,
                              [msg.id]: !old[msg.id]
                            }))
                          }
                          className="w-full px-3.5 py-2 flex items-center justify-between text-left hover:bg-slate-900/60 transition-colors"
                        >
                          <div className="flex items-center space-x-2 text-xs font-mono text-slate-400">
                            <Cpu className="h-3.5 w-3.5 text-teal-400 animate-subtle-glow" />
                            <span>DeepSeek-R1 Reasoning Chain</span>
                            {msg.isStreaming && !msg.text && (
                              <span className="inline-block h-1.5 w-1.5 rounded-full bg-teal-400 animate-ping" />
                            )}
                          </div>
                          {expandedReasoning[msg.id] ? (
                            <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
                          )}
                        </button>

                        {expandedReasoning[msg.id] && (
                          <div className="px-3.5 py-2.5 border-t border-slate-800/80 text-[11px] font-mono text-slate-400 leading-relaxed max-h-60 overflow-y-auto whitespace-pre-wrap bg-slate-950">
                            {msg.reasoning}
                          </div>
                        )}
                      </div>
                    )}

                    {/* MAIN VERIFIED ANSWER STREAM */}
                    <div className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap font-sans">
                      {msg.text ? (
                        msg.text
                      ) : msg.isStreaming ? (
                        <div className="flex items-center space-x-2 text-slate-400 italic">
                          <span className="h-2 w-2 rounded-full bg-teal-400 animate-pulse" />
                          <span>Synthesizing grounded analysis from verified vectors...</span>
                        </div>
                      ) : null}
                    </div>

                    {/* VERIFIED SOURCES & RELEVANCE ATTRIBUTION DRAWER */}
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="pt-3 border-t border-slate-800/80">
                        <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-2 flex items-center space-x-1.5">
                          <Database className="h-3 w-3 text-teal-400" />
                          <span>Verified Context Citations ({msg.sources.length} Chunks Matched)</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {msg.sources.map((src) => {
                            const isExpanded = expandedSources[`${msg.id}_${src.id}`];
                            return (
                              <div
                                key={src.id}
                                className="bg-slate-950/80 border border-slate-800 rounded-lg p-2.5 text-[11px] cursor-pointer hover:border-slate-700 transition-colors"
                                onClick={() =>
                                  setExpandedSources((old) => ({
                                    ...old,
                                    [`${msg.id}_${src.id}`]: !isExpanded
                                  }))
                                }
                              >
                                <div className="flex items-center justify-between font-mono">
                                  <div className="text-teal-300 font-semibold truncate max-w-[160px]" title={src.source}>
                                    {src.source}
                                  </div>
                                  <span className="px-1.5 py-0.5 rounded bg-slate-900 text-emerald-400 font-bold text-[10px]">
                                    {src.relevance_pct} Match
                                  </span>
                                </div>
                                <div className="text-[10px] text-slate-400 mt-1">
                                  Chunk #{src.chunk_index}
                                </div>

                                {isExpanded && (
                                  <div className="mt-2 pt-2 border-t border-slate-800/80 text-[10px] text-slate-400 leading-relaxed font-mono bg-slate-900/60 p-2 rounded">
                                    {src.content_preview}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* BOTTOM QUERY INPUT DOCK */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/90 backdrop-blur-md">
          <form
            onSubmit={(e) => handleQuerySubmit(e)}
            className="max-w-4xl mx-auto flex items-end gap-2.5 bg-slate-900/80 border border-slate-800 focus-within:border-teal-500/50 rounded-2xl p-2 transition-all shadow-xl"
          >
            <textarea
              rows={1}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleQuerySubmit(e);
                }
              }}
              placeholder="Ask a question about balance sheets, debt covenants, revenue growth, or EBITDA..."
              className="flex-1 bg-transparent px-3 py-2 text-xs text-slate-100 placeholder-slate-400 focus:outline-none resize-none max-h-32"
            />

            <button
              type="submit"
              disabled={isStreaming || !query.trim()}
              className="h-9 px-4 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-400 hover:from-teal-400 hover:to-emerald-300 disabled:opacity-40 disabled:hover:from-teal-500 disabled:hover:to-emerald-400 text-slate-950 text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer shadow-md shadow-teal-500/10"
            >
              <span>Analyze</span>
              <Send className="h-3.5 w-3.5" />
            </button>
          </form>

          <div className="max-w-4xl mx-auto mt-2 flex items-center justify-between text-[10px] text-slate-400 px-2 font-mono">
            <span>Press Enter to Submit • Shift+Enter for newline</span>
            <span>Local ChromaDB & Ollama DeepSeek-R1 • 100% Offline</span>
          </div>
        </div>

      </main>
    </div>
  );
}