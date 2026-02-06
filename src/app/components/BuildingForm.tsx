"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import ImageUpload from "./ImageUpload";

interface Image {
  url: string;
  label: string;
  isLocal?: boolean;
}

interface FormState {
  building_name: string;
  location: string;
  condition: string;
  date: string;
  images: Image[];
  admin_notes?: string;
}

export default function BuildingForm() {
  const router = useRouter();
  const [formState, setFormState] = useState<FormState>({
    building_name: "",
    location: "",
    condition: "Select Condition",
    date: new Date().toISOString().split("T")[0],
    images: [],
    admin_notes: "",
  });

  const [isAdmin, setIsAdmin] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState("");

  useEffect(() => {
    const checkAdmin = localStorage.getItem("adminUser") === "true";
    setIsAdmin(checkAdmin);
  }, []);

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;
    setFormState((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleImageUpload = (newImages: Image[]) => {
    setFormState((prev) => ({
      ...prev,
      images: [...prev.images, ...newImages],
    }));
  };

  const removeImage = (index: number) => {
    setFormState((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  };

  const base64ToBlob = (base64: string): Blob => {
    const arr = base64.split(",");
    const mime = arr[0].match(/:(.*?);/)?.[1] || "image/jpeg";
    const bstr = atob(arr[1]);
    const n = bstr.length;
    const u8arr = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      u8arr[i] = bstr.charCodeAt(i);
    }
    return new Blob([u8arr], { type: mime });
  };

  const uploadImageToR2 = async (base64: string): Promise<string> => {
    const blob = base64ToBlob(base64);
    const file = new File([blob], `image-${Date.now()}.jpg`, {
      type: blob.type,
    });

    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) throw new Error("Upload failed");
    const data = await response.json();
    return data.url;
  };

  const runSync = async () => {
    setIsSyncing(true);
    setSyncStatus("Syncing...");

    try {
      // Process images: convert local Base64 to R2 URLs
      const processedImages: Image[] = [];

      for (const img of formState.images) {
        if (img.isLocal) {
          try {
            const r2Url = await uploadImageToR2(img.url);
            processedImages.push({
              url: r2Url,
              label: img.label,
              isLocal: false,
            });
          } catch (error) {
            console.error("Failed to upload local image:", error);
            processedImages.push(img);
          }
        } else {
          processedImages.push(img);
        }
      }

      const full_data = {
        building_name: formState.building_name,
        location: formState.location,
        condition: formState.condition,
        date: formState.date,
        images: processedImages,
        ...(isAdmin && { admin_notes: formState.admin_notes }),
      };

      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(full_data),
      });

      if (!response.ok) throw new Error("Failed to sync report");

      setSyncStatus("Synced successfully!");
      setTimeout(() => {
        setFormState({
          building_name: "",
          location: "",
          condition: "Select Condition",
          date: new Date().toISOString().split("T")[0],
          images: [],
          admin_notes: "",
        });
        setSyncStatus("");
        router.push("/");
      }, 1500);
    } catch (error) {
      console.error("Sync error:", error);
      setSyncStatus("Sync failed. Check console.");
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="min-h-screen bg-black p-3 sm:p-6 lg:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-yellow-300 mb-4 sm:mb-6 lg:mb-8 text-center">
          Building Report
        </h1>

        {/* Main Form Container */}
        <div className="bg-yellow-300 rounded-xl sm:rounded-2xl lg:rounded-[3rem] border sm:border-2 lg:border-4 border-black p-3 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 lg:space-y-8">
          {/* Building Name */}
          <div>
            <label className="block text-sm sm:text-base lg:text-lg font-bold text-black mb-2">
              Building Name
            </label>
            <input
              type="text"
              name="building_name"
              value={formState.building_name}
              onChange={handleInputChange}
              className="w-full bg-black text-yellow-300 border-2 border-yellow-300 rounded-lg sm:rounded-xl p-3 sm:p-4 lg:p-6 text-sm sm:text-base lg:text-2xl font-bold focus:outline-none focus:ring-2 focus:ring-yellow-300"
              placeholder="Enter building name"
            />
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm sm:text-base lg:text-lg font-bold text-black mb-2">
              Location
            </label>
            <input
              type="text"
              name="location"
              value={formState.location}
              onChange={handleInputChange}
              className="w-full bg-black text-yellow-300 border-2 border-yellow-300 rounded-lg sm:rounded-xl p-3 sm:p-4 lg:p-6 text-sm sm:text-base lg:text-2xl font-bold focus:outline-none focus:ring-2 focus:ring-yellow-300"
              placeholder="Enter location"
            />
          </div>

          {/* Condition */}
          <div>
            <label className="block text-sm sm:text-base lg:text-lg font-bold text-black mb-2">
              Condition
            </label>
            <div className="relative">
              <select
                name="condition"
                value={formState.condition}
                onChange={handleInputChange}
                className="w-full bg-black text-yellow-300 border-2 border-yellow-300 rounded-lg sm:rounded-xl p-3 sm:p-4 lg:p-6 text-sm sm:text-base lg:text-lg font-bold focus:outline-none focus:ring-2 focus:ring-yellow-300 appearance-none"
              >
                <option>Select Condition</option>
                <option>Excellent</option>
                <option>Good</option>
                <option>Fair</option>
                <option>Poor</option>
                <option>Demolished</option>
              </select>
              <svg
                className="absolute right-3 sm:right-4 lg:right-6 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-yellow-300 pointer-events-none"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 14l-7 7m0 0l-7-7m7 7V3"
                />
              </svg>
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm sm:text-base lg:text-lg font-bold text-black mb-2">
              Date
            </label>
            <input
              type="date"
              name="date"
              value={formState.date}
              onChange={handleInputChange}
              className="w-full bg-black text-yellow-300 border-2 border-yellow-300 rounded-lg sm:rounded-xl p-3 sm:p-4 lg:p-6 text-sm sm:text-base lg:text-2xl font-bold focus:outline-none focus:ring-2 focus:ring-yellow-300"
            />
          </div>

          {/* Image Upload */}
          <div>
            <label className="block text-sm sm:text-base lg:text-lg font-bold text-black mb-2">
              Images
            </label>
            <ImageUpload onImagesUpload={handleImageUpload} />
          </div>

          {/* Image Gallery */}
          {formState.images.length > 0 && (
            <div>
              <label className="block text-sm sm:text-base lg:text-lg font-bold text-black mb-2">
                Uploaded Images
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {formState.images.map((img, index) => (
                  <div
                    key={index}
                    className="relative rounded-lg overflow-hidden group"
                  >
                    <img
                      src={img.url}
                      className="w-full h-auto object-cover"
                      alt={`Uploaded image ${index + 1}`}
                    />
                    <button
                      onClick={() => removeImage(index)}
                      className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-2 shadow-md hover:bg-red-700 transition-all"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Admin Notes (Admin only) */}
          {isAdmin && (
            <div>
              <label className="block text-sm sm:text-base lg:text-lg font-bold text-black mb-2">
                Admin Notes
              </label>
              <textarea
                name="admin_notes"
                value={formState.admin_notes}
                onChange={handleInputChange}
                className="w-full bg-black text-yellow-300 border-2 border-yellow-300 rounded-lg sm:rounded-xl p-3 sm:p-4 lg:p-6 text-sm sm:text-base lg:text-2xl font-bold focus:outline-none focus:ring-2 focus:ring-yellow-300"
                placeholder="Enter any admin notes here"
                rows={3}
              />
            </div>
          )}

          {/* Sync Status */}
          <div>
            <button
              onClick={runSync}
              disabled={isSyncing}
              className="w-full bg-black text-yellow-300 border-2 border-yellow-300 rounded-lg sm:rounded-xl p-3 sm:p-4 lg:p-6 text-sm sm:text-base lg:text-2xl font-bold focus:outline-none focus:ring-2 focus:ring-yellow-300 flex items-center justify-center gap-2"
            >
              {isSyncing ? (
                <svg
                  className="animate-spin h-5 w-5 text-yellow-300"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx={12}
                    cy={12}
                    r={10}
                    stroke="currentColor"
                    strokeWidth={4}
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v5l4.5-4.5A10 10 0 0012 2 10 10 0 002 12h2z"
                  />
                </svg>
              ) : (
                "Sync Report"
              )}
            </button>
            {syncStatus && (
              <p className="mt-2 text-center text-sm sm:text-base lg:text-lg font-semibold text-black">
                {syncStatus}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}