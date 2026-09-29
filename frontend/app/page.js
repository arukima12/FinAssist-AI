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
  Sparkles,
  ExternalLink,
  BookOpen,
  Sun,
  Moon,
  Settings,
  Link2,
  AlertCircle
} from "lucide-react";

const DEFAULT_API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function Home() {
  // Theme State (Default: light or dark based on system / preference)
  const [theme, setTheme] = useState("light");

  // Backend API URL State (configurable directly in UI or loaded from localStorage)
  const [apiUrl, setApiUrl] = useState(DEFAULT_API_BASE);
  const [showConfig, setShowConfig] = useState(false);
  const [tempUrl, setTempUrl] = useState("");

  // System & Health State
  const [health, setHealth] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(false);

  // File Upload State
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

  // Initialize theme from localStorage or system preference
  useEffect(() => {
    const savedTheme = localStorage.getItem("finassist_theme");
    if (savedTheme) {
      setTheme(savedTheme);
      if (savedTheme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    } else if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      setTheme("dark");
      document.documentElement.classList.add("dark");
    } else {
      setTheme("light");
      document.documentElement.classList.remove("dark");
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    localStorage.setItem("finassist_theme", nextTheme);
    if (nextTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const savedUrl = localStorage.getItem("finassist_api_url") || DEFAULT_API_BASE;
    setApiUrl(savedUrl);
    fetchHealth(savedUrl);
    fetchDocuments(savedUrl);
    const interval = setInterval(() => {
      const activeUrl = localStorage.getItem("finassist_api_url") || DEFAULT_API_BASE;
      fetchHealth(activeUrl);
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const fetchHealth = async (targetUrl = apiUrl) => {
    try {
      const res = await fetch(`${targetUrl}/api/health`);
      if (res.ok) {
        const data = await res.json();
        setHealth(data);
      } else {
        setHealth(null);
      }
    } catch {
      setHealth(null);
    }
  };

  const fetchDocuments = async (targetUrl = apiUrl) => {
    setLoadingDocs(true);
    try {
      const res = await fetch(`${targetUrl}/api/documents`);
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

  const saveApiUrl = (newUrl) => {
    const clean = (newUrl || "").trim().replace(/\/$/, "");
    if (!clean) return;
    setApiUrl(clean);
    localStorage.setItem("finassist_api_url", clean);
    setShowConfig(false);
    fetchHealth(clean);
    fetchDocuments(clean);
  };

  // --- MULTI-FORMAT FILE UPLOAD ---
  const handleFileUpload = async (selectedFiles) => {
    if (!selectedFiles || selectedFiles.length === 0) return;

    setUploading(true);
    setUploadStatus({ type: "info", message: `Ingesting ${selectedFiles.length} file(s) with Docling layout analysis...` });

    const formData = new FormData();
    for (let i = 0; i < selectedFiles.length; i++) {
      formData.append("files", selectedFiles[i]);
    }

    try {
      const res = await fetch(`${apiUrl}/api/upload`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (res.ok) {
        setUploadStatus({
          type: "success",
          message: `Indexed into ${data.total_chunks_created} semantic vectors.`
        });
        fetchDocuments();
        fetchHealth();
        if (fileInputRef.current) fileInputRef.current.value = "";
      } else {
        setUploadStatus({
          type: "error",
          message: data.detail || "Document parsing failed."
        });
      }
    } catch {
      setUploadStatus({
        type: "error",
        message: `Server at ${apiUrl} unreachable. Please verify backend status.`
      });
    } finally {
      setUploading(false);
    }
  };

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

  const handleDeleteDoc = async (docId) => {
    try {
      const res = await fetch(`${apiUrl}/api/documents/${docId}`, {
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

  const handleClearAll = async () => {
    if (!confirm("Are you sure you want to clear all indexed documents and vector embeddings?")) return;
    try {
      await fetch(`${apiUrl}/api/clear`, { method: "POST" });
      fetchDocuments();
      fetchHealth();
      setMessages([]);
      setUploadStatus(null);
    } catch (err) {
      console.error("Failed to clear vectors", err);
    }
  };

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

    const msgId = Date.now();
    setMessages((prev) => [
      ...prev,
      {
        id: msgId,
        sender: "user",
        text: userText,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      },
      {
        id: msgId + 1,
        sender: "ai",
        text: "",
        reasoning: "",
        route: null,
        sources: [],
        isStreaming: true,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      }
    ]);

    setIsStreaming(true);

    try {
      const res = await fetch(`${apiUrl}/api/query`, {
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
            // Wait for next buffer chunk
          }
        }
      }
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last && last.sender === "ai") {
          last.text = `Connection failed to backend at "${apiUrl}". If your backend is hosted on Render, click the Settings icon in the sidebar to configure your backend URL.`;
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

  const handleCopy = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

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

  const SUGGESTED_PROMPTS = [
    {
      title: "Analyze EBITDA & Margins",
      query: "Analyze EBITDA, operating margins, and YoY revenue growth from the financial statements."
    },
    {
      title: "Extract Debt Covenants",
      query: "Extract all debt covenants, leverage ratio thresholds, and borrowing restrictions."
    },
    {
      title: "Balance Sheet Summary",
      query: "Provide a structured breakdown of Total Assets, Current Liabilities, and Cash Equivalents in a table."
    },
    {
      title: "Identify Risk Disclosures",
      query: "What are the primary operational, regulatory, or litigation risks disclosed?"
    }
  ];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50 font-sans transition-colors duration-200">
      
      {/* ============================================================ */}
      {/* SIDEBAR: shadcn/ui Inspired Clean Control Panel               */}
      {/* ============================================================ */}
      <aside className="w-80 md:w-96 flex-shrink-0 bg-zinc-50/80 dark:bg-zinc-900/40 border-r border-zinc-200 dark:border-zinc-800/80 flex flex-col justify-between backdrop-blur-sm transition-colors duration-200">
        
        {/* BRAND & HEADER */}
        <div className="p-5 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="h-8 w-8 rounded-lg bg-zinc-900 dark:bg-zinc-100 flex items-center justify-center text-zinc-50 dark:text-zinc-950 shadow-sm">
                <TrendingUp className="h-4 w-4 stroke-[2.5]" />
              </div>
              <div>
                <h1 className="text-sm font-semibold tracking-tight text-zinc-950 dark:text-zinc-100">
                  FinAssist AI
                </h1>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">
                  Enterprise Document RAG
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-1">
              {/* THEME TOGGLE BUTTON */}
              <button
                onClick={toggleTheme}
                title={theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}
                className="p-1.5 text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 rounded-md transition-colors"
              >
                {theme === "light" ? (
                  <Moon className="h-4 w-4 stroke-[2]" />
                ) : (
                  <Sun className="h-4 w-4 stroke-[2]" />
                )}
              </button>

              <button
                onClick={() => { setTempUrl(apiUrl); setShowConfig(true); }}
                title="Configure Backend URL"
                className="p-1.5 text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 rounded-md transition-colors"
              >
                <Settings className="h-4 w-4 stroke-[2]" />
              </button>

              <button
                onClick={handleNewChat}
                title="Reset Session"
                className="p-1.5 text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 rounded-md transition-colors"
              >
                <RefreshCw className="h-4 w-4 stroke-[2]" />
              </button>
            </div>
          </div>

          {/* TELEMETRY BADGES (shadcn card style) */}
          <div className="mt-4 grid grid-cols-2 gap-2 text-[11px]">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-2.5 shadow-xs">
              <div className="flex items-center space-x-1.5 mb-0.5">
                <span className={`h-2 w-2 rounded-full ${health?.ollama?.online || health?.provider_online || health?.status === "healthy" ? "bg-emerald-500" : "bg-zinc-400"}`} />
                <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">Model Engine</span>
              </div>
              <div className="font-semibold text-zinc-900 dark:text-zinc-200 truncate">
                {health?.target_llm || health?.ollama?.target_llm || "DeepSeek-R1"}
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-2.5 shadow-xs">
              <div className="flex items-center space-x-1.5 mb-0.5">
                <Database className="h-3 w-3 text-zinc-500 dark:text-zinc-400" />
                <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">Chroma Index</span>
              </div>
              <div className="font-semibold text-zinc-900 dark:text-zinc-200">
                {health?.vector_store?.total_vectors ?? 0} Vectors
              </div>
            </div>
          </div>

          {/* DISCONNECTED WARNING / ACTIVE TARGET BADGE */}
          {!health ? (
            <div className="mt-3 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-800 dark:text-amber-300">
              <div className="flex items-center justify-between font-medium">
                <span className="flex items-center space-x-1">
                  <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
                  <span>Backend Offline</span>
                </span>
                <button
                  onClick={() => { setTempUrl(apiUrl); setShowConfig(true); }}
                  className="underline text-[10px] font-semibold hover:opacity-80"
                >
                  Connect Render
                </button>
              </div>
              <p className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-400 truncate font-mono">
                Target: {apiUrl}
              </p>
            </div>
          ) : (
            <div className="mt-2.5 flex items-center justify-between text-[10px] text-zinc-400 dark:text-zinc-500 px-1 font-mono">
              <span className="truncate max-w-[190px]">Target: {apiUrl}</span>
              <button
                onClick={() => { setTempUrl(apiUrl); setShowConfig(true); }}
                className="hover:text-zinc-600 dark:hover:text-zinc-300 underline font-sans"
              >
                Change
              </button>
            </div>
          )}
        </div>

        {/* UPLOAD & DOCUMENT LIST */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          
          {/* DRAG-AND-DROP UPLOAD DROPZONE */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-zinc-900 dark:text-zinc-200 flex items-center space-x-1.5">
                <UploadCloud className="h-3.5 w-3.5" />
                <span>Upload Documents</span>
              </label>
              <span className="text-[10px] text-zinc-500 dark:text-zinc-400">PDF, DOCX, XLSX</span>
            </div>

            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border border-dashed rounded-lg p-4 text-center cursor-pointer transition-all duration-200 ${
                dragActive
                  ? "border-zinc-900 bg-zinc-100 dark:border-zinc-100 dark:bg-zinc-800"
                  : "border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600 bg-white dark:bg-zinc-900/50 shadow-xs"
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
                <div className="h-8 w-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-300">
                  <FileText className="h-4 w-4" />
                </div>
                <p className="text-xs font-medium text-zinc-900 dark:text-zinc-200">
                  {uploading ? "Analyzing Layout..." : "Click or Drag & Drop Documents"}
                </p>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                  Docling parses balance sheets, tables & contract terms
                </p>
              </div>
            </div>

            {uploadStatus && (
              <div
                className={`mt-2.5 p-2.5 rounded-lg text-[11px] leading-relaxed border ${
                  uploadStatus.type === "success"
                    ? "bg-zinc-50 border-zinc-200 text-zinc-800 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-200"
                    : uploadStatus.type === "error"
                    ? "bg-red-50 border-red-200 text-red-700 dark:bg-red-950/40 dark:border-red-900 dark:text-red-300"
                    : "bg-zinc-100 border-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300"
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
                <BookOpen className="h-3.5 w-3.5 text-zinc-700 dark:text-zinc-300" />
                <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-200">Indexed Library</h3>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-200/70 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-mono">
                {documents.length} files
              </span>
            </div>

            {loadingDocs ? (
              <div className="p-4 text-center text-xs text-zinc-500">Updating catalog...</div>
            ) : documents.length === 0 ? (
              <div className="p-4 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-center shadow-xs">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">No documents indexed yet.</p>
                <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">Upload a 10-K, earnings report, or contract.</p>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {documents.map((doc) => (
                  <div
                    key={doc.doc_id}
                    className="group bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-800 rounded-lg p-2.5 flex items-center justify-between transition-all shadow-xs"
                  >
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <div className="h-6 w-6 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 flex items-center justify-center text-[10px] font-bold uppercase flex-shrink-0">
                        {doc.file_type ? doc.file_type.replace(".", "") : "DOC"}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-zinc-900 dark:text-zinc-200 truncate" title={doc.filename}>
                          {doc.filename}
                        </div>
                        <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono">
                          {doc.chunk_count} chunks
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteDoc(doc.doc_id)}
                      title="Delete document"
                      className="opacity-0 group-hover:opacity-100 p-1 text-zinc-400 hover:text-red-500 dark:hover:text-red-400 transition-opacity"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* BOTTOM METADATA & CLEAR */}
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-900/50 flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
          <span className="flex items-center space-x-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-zinc-700 dark:text-zinc-300" />
            <span>Air-Gapped Privacy</span>
          </span>
          <button
            onClick={handleClearAll}
            className="hover:text-red-600 dark:hover:text-red-400 text-[10px] transition-colors"
          >
            Clear All
          </button>
        </div>
      </aside>

      {/* ============================================================ */}
      {/* MAIN VIEWPORT: Clean shadcn/ui Canvas                         */}
      {/* ============================================================ */}
      <main className="flex-1 flex flex-col h-full bg-zinc-50/50 dark:bg-zinc-950 overflow-hidden transition-colors duration-200">
        
        {/* TOP NAVIGATION BAR */}
        <header className="h-14 border-b border-zinc-200 dark:border-zinc-800 px-6 flex items-center justify-between bg-white/80 dark:bg-zinc-950/80 backdrop-blur-sm">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <span className="text-xs text-zinc-500 dark:text-zinc-400">Session:</span>
              <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-200 font-medium">
                {sessionId}
              </span>
            </div>
            <div className="h-4 w-[1px] bg-zinc-200 dark:bg-zinc-800" />
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 hidden sm:flex items-center space-x-1">
              <span>Model:</span>
              <span className="font-medium text-zinc-900 dark:text-zinc-200">
                {health?.target_llm || health?.ollama?.target_llm || "DeepSeek-R1"}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {messages.length > 0 && (
              <button
                onClick={handleExportChat}
                className="text-xs text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-zinc-100 px-3 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors flex items-center space-x-1.5 shadow-xs"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>Export Markdown</span>
              </button>
            )}
          </div>
        </header>

        {/* CHAT CONVERSATION TRAY */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center max-w-2xl mx-auto text-center px-4">
              <div className="h-12 w-12 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-zinc-50 dark:text-zinc-950 flex items-center justify-center mb-4 shadow-sm">
                <Sparkles className="h-6 w-6 stroke-[2]" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                FinAssist AI
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2 max-w-md leading-relaxed">
                Ingest 10-K annual reports, credit agreements, or financial balance sheets.
                Extract verified metrics, calculate EBITDA, and audit contract covenants with zero cloud data leakage.
              </p>

              {/* SHADCN CARD STYLE PROMPT CHIPS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-8 w-full text-left">
                {SUGGESTED_PROMPTS.map((p, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleQuerySubmit(null, p.query)}
                    className="p-3.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 shadow-xs transition-all text-left group cursor-pointer"
                  >
                    <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-zinc-950 dark:group-hover:text-white transition-colors">
                      {p.title}
                    </div>
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2 leading-snug">
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
                <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mb-1 px-1 flex items-center space-x-1.5 font-mono">
                  <span>{msg.sender === "user" ? "You" : "FinAssist AI"}</span>
                  <span>•</span>
                  <span>{msg.timestamp}</span>
                </div>

                {/* USER BUBBLE */}
                {msg.sender === "user" ? (
                  <div className="max-w-2xl bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900 px-4 py-2.5 rounded-2xl rounded-tr-sm text-xs leading-relaxed font-medium shadow-xs">
                    {msg.text}
                  </div>
                ) : (
                  /* AI MESSAGE CARD (shadcn card style) */
                  <div className="w-full max-w-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 space-y-4 shadow-sm">
                    
                    {/* QUERY ROUTE HEADER */}
                    {msg.route && (
                      <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800/80">
                        <span className="text-[10px] uppercase font-semibold tracking-wider px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 flex items-center space-x-1.5">
                          {msg.route.route === "FINANCIAL_TABLE_ANALYSIS" && <TrendingUp className="h-3 w-3" />}
                          {msg.route.route === "LEGAL_COMPLIANCE" && <Scale className="h-3 w-3" />}
                          {msg.route.route === "DOCUMENT_SUMMARY" && <FileText className="h-3 w-3" />}
                          {msg.route.route === "GENERAL_QA" && <HelpCircle className="h-3 w-3" />}
                          <span>{msg.route.label}</span>
                        </span>

                        <button
                          onClick={() => handleCopy(msg.text, msg.id)}
                          className="text-[10px] text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 px-2 py-1 rounded bg-zinc-100/60 dark:bg-zinc-800 transition-colors flex items-center space-x-1"
                        >
                          {copiedIndex === msg.id ? (
                            <>
                              <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                              <span className="text-emerald-600 dark:text-emerald-400 font-medium">Copied</span>
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
                      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/60 overflow-hidden">
                        <button
                          onClick={() =>
                            setExpandedReasoning((old) => ({
                              ...old,
                              [msg.id]: !old[msg.id]
                            }))
                          }
                          className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-zinc-100/50 dark:hover:bg-zinc-900/60 transition-colors"
                        >
                          <div className="flex items-center space-x-2 text-xs font-mono text-zinc-600 dark:text-zinc-400">
                            <Cpu className="h-3.5 w-3.5" />
                            <span>DeepSeek-R1 Reasoning Chain</span>
                            {msg.isStreaming && !msg.text && (
                              <span className="inline-block h-1.5 w-1.5 rounded-full bg-zinc-900 dark:bg-zinc-100 animate-ping" />
                            )}
                          </div>
                          {expandedReasoning[msg.id] ? (
                            <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 text-zinc-400" />
                          )}
                        </button>

                        {expandedReasoning[msg.id] && (
                          <div className="px-3 py-2.5 border-t border-zinc-200 dark:border-zinc-800 text-[11px] font-mono text-zinc-600 dark:text-zinc-400 leading-relaxed max-h-56 overflow-y-auto whitespace-pre-wrap bg-zinc-50 dark:bg-zinc-950">
                            {msg.reasoning}
                          </div>
                        )}
                      </div>
                    )}

                    {/* MAIN VERIFIED ANSWER */}
                    <div className="text-xs text-zinc-900 dark:text-zinc-100 leading-relaxed whitespace-pre-wrap font-sans">
                      {msg.text ? (
                        msg.text
                      ) : msg.isStreaming ? (
                        <div className="flex items-center space-x-2 text-zinc-500 italic">
                          <span className="h-2 w-2 rounded-full bg-zinc-900 dark:bg-zinc-100 animate-pulse" />
                          <span>Generating grounded financial analysis...</span>
                        </div>
                      ) : null}
                    </div>

                    {/* VERIFIED SOURCES DRAWER */}
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800">
                        <div className="text-[10px] uppercase font-semibold tracking-wider text-zinc-500 dark:text-zinc-400 mb-2 flex items-center space-x-1.5">
                          <Database className="h-3 w-3" />
                          <span>Context Citations ({msg.sources.length} Chunks Matched)</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {msg.sources.map((src) => {
                            const isExpanded = expandedSources[`${msg.id}_${src.id}`];
                            return (
                              <div
                                key={src.id}
                                className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-2.5 text-[11px] cursor-pointer hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
                                onClick={() =>
                                  setExpandedSources((old) => ({
                                    ...old,
                                    [`${msg.id}_${src.id}`]: !isExpanded
                                  }))
                                }
                              >
                                <div className="flex items-center justify-between font-mono">
                                  <div className="font-semibold text-zinc-900 dark:text-zinc-200 truncate max-w-[160px]" title={src.source}>
                                    {src.source}
                                  </div>
                                  <span className="px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-300 font-semibold text-[10px]">
                                    {src.relevance_pct} Match
                                  </span>
                                </div>
                                <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1">
                                  Chunk #{src.chunk_index}
                                </div>

                                {isExpanded && (
                                  <div className="mt-2 pt-2 border-t border-zinc-200 dark:border-zinc-800 text-[10px] text-zinc-600 dark:text-zinc-400 leading-relaxed font-mono bg-white dark:bg-zinc-900 p-2 rounded">
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

        {/* BOTTOM QUERY INPUT DOCK (shadcn/ui style) */}
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-sm">
          <form
            onSubmit={(e) => handleQuerySubmit(e)}
            className="max-w-4xl mx-auto flex items-end gap-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus-within:border-zinc-400 dark:focus-within:border-zinc-600 rounded-xl p-2 transition-all shadow-xs"
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
              placeholder="Ask an analytical question regarding balance sheets, debt covenants, or EBITDA..."
              className="flex-1 bg-transparent px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none resize-none max-h-32"
            />

            <button
              type="submit"
              disabled={isStreaming || !query.trim()}
              className="h-9 px-4 rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-zinc-50 dark:text-zinc-900 disabled:opacity-40 text-xs font-semibold transition-all flex items-center space-x-1.5 cursor-pointer shadow-xs"
            >
              <span>Analyze</span>
              <Send className="h-3.5 w-3.5" />
            </button>
          </form>

          <div className="max-w-4xl mx-auto mt-2 flex items-center justify-between text-[10px] text-zinc-400 dark:text-zinc-500 px-2 font-mono">
            <span>Enter to Submit • Shift+Enter for newline</span>
            <span>ChromaDB + DeepSeek-R1 • FinAssist AI</span>
          </div>
        </div>

      </main>

      {/* CONFIGURE BACKEND API URL MODAL */}
      {showConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 w-full max-w-md shadow-xl text-zinc-950 dark:text-zinc-50 transition-all">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold flex items-center space-x-2">
                <Link2 className="h-4 w-4" />
                <span>Configure Backend API URL</span>
              </h3>
              <button
                onClick={() => setShowConfig(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xs p-1"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3 leading-relaxed">
              Paste your Render backend URL (e.g. <span className="font-mono bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded text-[11px] text-zinc-800 dark:text-zinc-200">https://finassist-backend.onrender.com</span>) to connect this frontend to your cloud service.
            </p>
            <input
              type="text"
              value={tempUrl}
              onChange={(e) => setTempUrl(e.target.value)}
              placeholder="https://your-service.onrender.com"
              className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 mb-4"
            />
            <div className="flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => {
                  setTempUrl("http://localhost:8000");
                }}
                className="text-[11px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 underline"
              >
                Reset to Localhost
              </button>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setShowConfig(false)}
                  className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => saveApiUrl(tempUrl)}
                  className="px-3.5 py-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-zinc-50 dark:text-zinc-950 font-medium hover:opacity-90 shadow-xs transition-opacity"
                >
                  Connect & Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}