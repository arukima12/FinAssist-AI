import "./globals.css";

export const metadata = {
  title: "FinAssist AI - Intelligent Financial RAG",
  description: "Analyze complex financial layouts locally.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-slate-900 text-slate-100 min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
