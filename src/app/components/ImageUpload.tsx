"use client";

import { useState, useRef } from "react";

interface Image {
  url: string;
  label: string;
  isLocal?: boolean;
}

interface ImageUploadProps {
  onImagesUpload: (images: Image[]) => void;
  label?: string;
  value?: Image[];
  onChange?: (images: Image[]) => void;
}

export default function ImageUpload({
  onImagesUpload,
  label,
  value,
  onChange,
}: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList) => {
    const newImages: Image[] = [];

    Array.from(files).forEach((file) => {
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const base64 = e.target?.result as string;
          newImages.push({
            url: base64,
            label: file.name.replace(/\.[^/.]+$/, ""),
            isLocal: true,
          });

          if (newImages.length === Array.from(files).length) {
            if (onChange) {
              onChange([...(value || []), ...newImages]);
            } else {
              onImagesUpload(newImages);
            }
          }
        };
        reader.readAsDataURL(file);
      }
    });
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
  };

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`w-full p-8 rounded-2xl border-4 border-dashed transition-all ${
        isDragging
          ? "bg-yellow-200 border-yellow-500"
          : "bg-black/20 border-yellow-300"
      }`}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        onChange={handleInputChange}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="w-full text-center text-yellow-300 font-bold text-lg hover:text-yellow-200 transition-colors"
      >
        📸 Click to upload or drag images here
      </button>
    </div>
  );
}
