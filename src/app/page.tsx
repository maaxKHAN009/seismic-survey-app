import BuildingForm from './components/BuildingForm';
import { Metadata, Viewport } from 'next';

// 1. Move viewport settings here to fix the warnings
export const viewport: Viewport = {
  themeColor: '#14452F',
  width: 'device-width',
  initialScale: 1,
};

// 2. Metadata remains on the server
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