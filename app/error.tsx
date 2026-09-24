"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="wrap page">
      <h1>Le catalogue est indisponible</h1>
      <button type="button" className="btn" onClick={reset}>
        Réessayer
      </button>
    </div>
  );
}
