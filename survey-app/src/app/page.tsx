import BuildingForm from './components/BuildingForm';

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-3xl mx-auto bg-white shadow-xl rounded-2xl overflow-hidden border border-gray-100">
        {/* Header Section */}
        <div className="bg-blue-700 p-8 text-white text-center">
          <h1 className="text-3xl font-bold uppercase tracking-tight">
            Seismic Vulnerability Data Collection
          </h1>
          <p className="mt-2 text-blue-100 opacity-90">
            Swiss-Funded Research Project | District-Level Assessment
          </p>
        </div>

        {/* The Form Component */}
        <div className="p-8">
          <BuildingForm />
        </div>
      </div>
    </main>
  );
}