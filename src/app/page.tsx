import BuildingForm from './components/BuildingForm';
import { Metadata } from 'next';

// This is the correct way to link the manifest in Next.js
export const metadata: Metadata = {
  manifest: '/manifest.json',
  title: 'Building Survey | UET x EPFL',
};

export default function Page() {
  // Ensure BuildingForm is called as a function, as it may not be a React component (JSX) itself
  return (
    <main>
      {typeof BuildingForm === "function" ? <>{BuildingForm()}</> : null}
    </main>
  );
}