import BuildingForm from './components/BuildingForm';

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Professional Header Section */}
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase sm:text-4xl">
            Building Assessment Portal
          </h1>
          <p className="mt-2 text-sm font-bold text-blue-600 uppercase tracking-widest">
            Research Project | Pakistan 2026
          </p>
        </div>

        {/* The Main Dynamic Form */}
        <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 p-1">
           <BuildingForm />
        </div>
      </div>
    </main>
  );
}