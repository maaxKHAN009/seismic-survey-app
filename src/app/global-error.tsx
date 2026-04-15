'use client';

import LogRocket from 'logrocket';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    LogRocket.captureException(error);
  }, [error]);

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
