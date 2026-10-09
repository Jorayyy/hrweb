"use client";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const detail = [error.message, error.digest].filter(Boolean).join(" — ");

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#000",
          color: "#fff",
          fontFamily: 'system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 384,
            margin: 16,
            padding: 32,
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.1)",
            background: "rgba(255,255,255,0.05)",
          }}
        >
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Something went wrong</h1>
          <p style={{ margin: "4px 0 0", fontSize: 14, color: "#a1a1aa" }}>
            The app hit an unexpected error.
          </p>

          {detail ? (
            <p
              style={{
                margin: "16px 0 0",
                padding: 12,
                maxHeight: 160,
                overflow: "auto",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(0,0,0,0.4)",
                fontSize: 12,
                color: "#a1a1aa",
                wordBreak: "break-word",
              }}
            >
              {detail}
            </p>
          ) : null}

          <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
            <button
              type="button"
              onClick={reset}
              style={{
                flex: 1,
                padding: "10px 16px",
                borderRadius: 8,
                border: "none",
                background: "#fff",
                color: "#18181b",
                fontSize: 14,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => history.back()}
              style={{
                flex: 1,
                padding: "10px 16px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(255,255,255,0.05)",
                color: "#d4d4d8",
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              Go back
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
