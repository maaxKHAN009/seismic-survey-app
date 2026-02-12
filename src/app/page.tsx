import BuildingForm from './components/BuildingForm';
import { Metadata } from 'next';

// This is the correct way to link the manifest in Next.js
export const metadata: Metadata = {
  manifest: '/manifest.json',
  title: 'Building Specific Survey | UET x EPFL',
};

export default function Page() {
  return (
    <main>
      <BuildingForm />
    </main>
  );
}