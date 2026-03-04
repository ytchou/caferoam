'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const MAX_SIZE_DEFAULT = 5; // MB
const MAX_PHOTOS_DEFAULT = 3;

interface PhotoUploaderProps {
  files: File[];
  onChange: (files: File[]) => void;
  maxPhotos?: number;
  maxSizeMB?: number;
}

export function PhotoUploader({
  files,
  onChange,
  maxPhotos = MAX_PHOTOS_DEFAULT,
  maxSizeMB = MAX_SIZE_DEFAULT,
}: PhotoUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const previewUrls = useMemo(
    () => files.map((f) => URL.createObjectURL(f)),
    [files]
  );
  useEffect(() => {
    return () => previewUrls.forEach((url) => URL.revokeObjectURL(url));
  }, [previewUrls]);

  // Detect mobile via pointer: coarse media query
  const isMobile =
    typeof window !== 'undefined' &&
    window.matchMedia('(pointer: coarse)').matches;

  const handleFiles = useCallback(
    (newFiles: FileList | null) => {
      if (!newFiles) return;
      setError(null);

      const valid: File[] = [];
      for (const file of Array.from(newFiles)) {
        if (!file.type.startsWith('image/')) {
          setError('Only image files are accepted');
          return;
        }
        if (file.size > maxSizeMB * 1024 * 1024) {
          setError(`File too large (max ${maxSizeMB} MB)`);
          return;
        }
        valid.push(file);
      }

      const existingNames = new Set(files.map((f) => `${f.name}:${f.size}`));
      const deduped = valid.filter(
        (f) => !existingNames.has(`${f.name}:${f.size}`)
      );
      const combined = [...files, ...deduped].slice(0, maxPhotos);
      onChange(combined);
    },
    [files, onChange, maxPhotos, maxSizeMB]
  );

  const removeFile = useCallback(
    (index: number) => {
      onChange(files.filter((_, i) => i !== index));
    },
    [files, onChange]
  );

  return (
    <div className="space-y-3">
      {files.length === 0 ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex h-32 w-full items-center justify-center rounded-lg border-2 border-dashed border-gray-300 text-sm text-gray-500 hover:border-gray-400"
        >
          {isMobile ? 'Take Photo' : 'Add Photo'}
        </button>
      ) : (
        <div className="flex gap-2">
          {files.map((file, i) => (
            <div key={i} className="relative h-24 w-24">
              <img
                src={previewUrls[i]}
                alt={`Photo ${i + 1}`}
                className="h-full w-full rounded-lg object-cover"
              />
              <button
                type="button"
                aria-label="Remove photo"
                onClick={() => removeFile(i)}
                className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-xs text-white"
              >
                &times;
              </button>
            </div>
          ))}
          {files.length < maxPhotos && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex h-24 w-24 items-center justify-center rounded-lg border-2 border-dashed border-gray-300 text-xs text-gray-400"
            >
              + Add another
            </button>
          )}
        </div>
      )}

      <input
        ref={inputRef}
        data-testid="photo-input"
        type="file"
        accept="image/*"
        {...(isMobile ? { capture: 'environment' as const } : {})}
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {isMobile && files.length > 0 && files.length < maxPhotos && (
        <button
          type="button"
          onClick={() => {
            if (inputRef.current) {
              inputRef.current.removeAttribute('capture');
              inputRef.current.click();
              inputRef.current.setAttribute('capture', 'environment');
            }
          }}
          className="text-xs text-blue-600 underline"
        >
          Choose from gallery
        </button>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
