'use client';

import { useState, useRef } from 'react';

interface ImageUploadProps {
  currentImage?: string | null;
  onImageChange: (imageData: string | null) => void;
  label?: string;
  maxSizeKB?: number;
}

export default function ImageUpload({ 
  currentImage, 
  onImageChange, 
  label = 'Image',
  maxSizeKB = 500 
}: ImageUploadProps) {
  const [preview, setPreview] = useState<string | null>(currentImage || null);
  const [error, setError] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const compressImage = (file: File, maxWidth: number = 800): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Scale down if needed
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Could not get canvas context'));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);

          // Start with high quality and reduce until under size limit
          let quality = 0.9;
          let dataUrl = canvas.toDataURL('image/jpeg', quality);

          while (dataUrl.length > maxSizeKB * 1024 && quality > 0.1) {
            quality -= 0.1;
            dataUrl = canvas.toDataURL('image/jpeg', quality);
          }

          if (dataUrl.length > maxSizeKB * 1024) {
            // If still too large, reduce dimensions
            const scale = Math.sqrt((maxSizeKB * 1024) / dataUrl.length);
            canvas.width = width * scale;
            canvas.height = height * scale;
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          }

          resolve(dataUrl);
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    setError('');
    setUploading(true);

    try {
      const compressedImage = await compressImage(file);
      setPreview(compressedImage);
      onImageChange(compressedImage);
    } catch (err) {
      setError('Failed to process image');
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    setPreview(null);
    onImageChange(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-gray-400 mb-1">{label}</label>
      
      {preview ? (
        <div className="relative">
          <img 
            src={preview} 
            alt="Preview" 
            className="w-full h-48 object-cover rounded-lg border border-gray-600"
          />
          <button
            type="button"
            onClick={handleRemove}
            className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white p-2 rounded-full"
          >
            ✕
          </button>
        </div>
      ) : (
        <div 
          onClick={() => fileInputRef.current?.click()}
          className="w-full h-48 border-2 border-dashed border-gray-600 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 hover:bg-gray-700/30 transition"
        >
          {uploading ? (
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
          ) : (
            <>
              <span className="text-4xl mb-2">📷</span>
              <span className="text-gray-400">Click to upload image</span>
              <span className="text-gray-500 text-xs mt-1">Max {maxSizeKB}KB after compression</span>
            </>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {error && (
        <p className="text-red-400 text-sm">{error}</p>
      )}
    </div>
  );
}
