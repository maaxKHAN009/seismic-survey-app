'use client';

export default function GlobalError({
  reset,
}: {
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <main style={{ padding: 24, fontFamily: 'sans-serif' }}>
          <h2>Something went wrong.</h2>
          <button onClick={() => reset()}>Try again</button>
        </main>
      </body>
    </html>
  );
}
