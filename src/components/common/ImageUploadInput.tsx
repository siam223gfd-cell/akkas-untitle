import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  Image as ImageIcon,
  X,
  RefreshCw,
  Check,
  AlertCircle,
  FolderOpen,
  Trash2,
  ExternalLink,
  Plus,
  CheckCircle2,
  Maximize2,
  FileText,
} from 'lucide-react';
import { apiRequest } from '../../services/api';

export interface ImageUploadInputProps {
  label?: string;
  value?: string;
  onChange?: (url: string) => void;
  // Multiple images gallery support
  multiple?: boolean;
  values?: string[];
  onMultipleChange?: (urls: string[]) => void;
  placeholder?: string;
  helperText?: string;
  required?: boolean;
  disabled?: boolean;
  aspectRatioClass?: string;
  aspectRatio?: 'square' | 'video' | 'banner' | 'contain' | 'auto';
  previewMode?: 'cover' | 'contain';
  maxFileSizeMB?: number;
  maxImages?: number;
}

interface ImageMetadata {
  filename?: string;
  sizeBytes?: number;
  dimensions?: string;
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function isSafeImageSrc(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  if (/^\/(?!\/)/.test(trimmed)) return true;
  if (/^data:image\/(jpeg|jpg|png|webp|gif|svg\+xml);base64,/i.test(trimmed)) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export const ImageUploadInput: React.FC<ImageUploadInputProps> = ({
  label = 'Image',
  value = '',
  onChange,
  multiple = false,
  values = [],
  onMultipleChange,
  placeholder = 'https://...',
  helperText,
  required = false,
  disabled = false,
  aspectRatioClass,
  aspectRatio = 'auto',
  previewMode = 'cover',
  maxFileSizeMB = 5,
  maxImages = 8,
}) => {
  const [mode, setMode] = useState<'upload' | 'url'>('upload');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [imgLoadError, setImgLoadError] = useState(false);
  const [urlInput, setUrlInput] = useState(value || '');
  const [isDragging, setIsDragging] = useState(false);
  const [metadata, setMetadata] = useState<ImageMetadata>({});

  const fileInputRef = useRef<HTMLInputElement>(null);
  const multipleFileInputRef = useRef<HTMLInputElement>(null);

  // Sync internal single-value state
  useEffect(() => {
    setUrlInput(value || '');
    setImgLoadError(false);
    if (value) {
      inspectImageMetadata(value);
    }
  }, [value]);

  // Inspect image dimensions from URL
  const inspectImageMetadata = (srcUrl: string) => {
    if (!srcUrl) return;
    try {
      const img = new Image();
      img.onload = () => {
        setMetadata((prev) => ({
          ...prev,
          dimensions: `${img.naturalWidth} × ${img.naturalHeight} px`,
        }));
      };
      img.src = srcUrl;
    } catch {
      // Ignore non-fatal metadata inspection
    }
  };

  // Compute CSS aspect ratio classes
  const resolvedAspectClass = () => {
    if (aspectRatioClass) return aspectRatioClass;
    switch (aspectRatio) {
      case 'square':
        return 'aspect-square';
      case 'video':
        return 'aspect-video';
      case 'banner':
        return 'aspect-[21/9] sm:aspect-[24/9]';
      case 'contain':
        return 'aspect-[3/2]';
      case 'auto':
      default:
        return 'aspect-video';
    }
  };

  // Upload a single file blob to /api/upload
  const uploadFile = async (file: File): Promise<string> => {
    // Validate file size
    if (file.size > maxFileSizeMB * 1024 * 1024) {
      throw new Error(`File "${file.name}" exceeds ${maxFileSizeMB}MB limit (${formatBytes(file.size)}).`);
    }

    // Validate MIME type
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
    if (!allowed.includes(file.type.toLowerCase())) {
      throw new Error(`Unsupported format "${file.type}". Allowed: PNG, JPG, WEBP, GIF, SVG.`);
    }

    // Read as Base64 data URI
    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read file from your device.'));
      reader.readAsDataURL(file);
    });

    // Send to backend storage
    const res = await apiRequest<{ success: boolean; url: string; message?: string }>('/upload', {
      method: 'POST',
      body: JSON.stringify({
        data: base64Data,
        filename: file.name,
      }),
    });

    if (!res.success || !res.url) {
      throw new Error(res.message || 'Server upload failed to save file.');
    }

    return res.url;
  };

  // Handle single file selection
  const handleSingleFile = async (file: File) => {
    setUploadError(null);
    setIsUploading(true);
    setUploadProgress(20);

    try {
      setMetadata({
        filename: file.name,
        sizeBytes: file.size,
      });

      setUploadProgress(50);
      const serverUrl = await uploadFile(file);

      setUploadProgress(100);
      setImgLoadError(false);
      setUrlInput(serverUrl);

      if (onChange) {
        onChange(serverUrl);
      }

      inspectImageMetadata(serverUrl);
      setUploadError(null);
    } catch (err: any) {
      setUploadError(err.message || 'An error occurred during image upload.');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Handle multiple files selection (for galleries)
  const handleMultipleFiles = async (fileList: FileList) => {
    if (!fileList || fileList.length === 0) return;
    setUploadError(null);
    setIsUploading(true);

    const currentList = [...(values || [])];
    const remainingSlots = maxImages - currentList.length;

    if (remainingSlots <= 0) {
      setUploadError(`Maximum gallery image limit (${maxImages} photos) reached.`);
      setIsUploading(false);
      return;
    }

    const filesToUpload = Array.from(fileList).slice(0, remainingSlots);
    const uploadedUrls: string[] = [];

    try {
      for (let i = 0; i < filesToUpload.length; i++) {
        setUploadProgress(Math.round(((i + 1) / filesToUpload.length) * 100));
        const file = filesToUpload[i];
        const uploadedUrl = await uploadFile(file);
        uploadedUrls.push(uploadedUrl);
      }

      const merged = [...currentList, ...uploadedUrls];
      if (onMultipleChange) {
        onMultipleChange(merged);
      }
    } catch (err: any) {
      setUploadError(err.message || 'Error occurred while uploading multiple gallery photos.');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      if (multipleFileInputRef.current) {
        multipleFileInputRef.current.value = '';
      }
    }
  };

  // Native input change handler (single)
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleSingleFile(file);
    }
  };

  // Native input change handler (multiple)
  const handleMultipleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleMultipleFiles(e.target.files);
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !isUploading) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (disabled || isUploading) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      if (multiple) {
        handleMultipleFiles(e.dataTransfer.files);
      } else {
        handleSingleFile(e.dataTransfer.files[0]);
      }
    }
  };

  // Manual URL apply
  const handleApplyUrl = () => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    if (!isSafeImageSrc(trimmed)) {
      setUploadError('Please enter a valid relative image path (/uploads/...) or http(s) URL.');
      return;
    }
    setImgLoadError(false);
    setUploadError(null);
    if (onChange) {
      onChange(trimmed);
    }
  };

  // Remove single image
  const handleRemove = () => {
    if (onChange) {
      onChange('');
    }
    setUrlInput('');
    setUploadError(null);
    setImgLoadError(false);
    setMetadata({});
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Remove one image from multiple gallery list
  const handleRemoveGalleryImage = (indexToRemove: number) => {
    const updated = (values || []).filter((_, idx) => idx !== indexToRemove);
    if (onMultipleChange) {
      onMultipleChange(updated);
    }
  };

  // Move image to primary (index 0)
  const handleSetPrimaryGalleryImage = (indexToPrimary: number) => {
    if (indexToPrimary === 0) return;
    const current = [...(values || [])];
    const [target] = current.splice(indexToPrimary, 1);
    current.unshift(target);
    if (onMultipleChange) {
      onMultipleChange(current);
    }
  };

  // =========================================================================
  // MULTIPLE IMAGES (GALLERY) RENDERING
  // =========================================================================
  if (multiple) {
    const galleryItems = values || [];

    return (
      <div className="space-y-3">
        {/* Hidden Multi-file input */}
        <input
          type="file"
          ref={multipleFileInputRef}
          onChange={handleMultipleFileInputChange}
          accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
          multiple
          disabled={disabled || isUploading}
          className="hidden"
        />

        <div className="flex items-center justify-between">
          <div>
            <label className="block text-xs font-bold text-slate-800">
              {label} {required && <span className="text-rose-500">*</span>}
            </label>
            <p className="text-[11px] text-slate-500">
              {galleryItems.length} of {maxImages} images uploaded. First image serves as primary storefront card.
            </p>
          </div>
          <button
            type="button"
            onClick={() => multipleFileInputRef.current?.click()}
            disabled={disabled || isUploading || galleryItems.length >= maxImages}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Photos</span>
          </button>
        </div>

        {/* Gallery Grid */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`grid grid-cols-2 sm:grid-cols-4 md:grid-cols-4 gap-3 p-3 rounded-2xl border-2 transition-all ${
            isDragging
              ? 'border-blue-500 bg-blue-50/50'
              : 'border-slate-200/80 bg-slate-50/50'
          }`}
        >
          {galleryItems.map((imgUrl, idx) => (
            <div
              key={`${imgUrl}-${idx}`}
              className="group relative rounded-xl overflow-hidden border border-slate-200 bg-white aspect-square shadow-2xs flex flex-col justify-between"
            >
              <img
                src={imgUrl}
                alt={`Gallery ${idx + 1}`}
                className="w-full h-full object-cover"
                loading="lazy"
              />

              {/* Cover Badge */}
              {idx === 0 ? (
                <span className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-md bg-blue-600 text-white text-[10px] font-black uppercase tracking-wider shadow-sm">
                  Cover
                </span>
              ) : (
                <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-slate-900/60 backdrop-blur-xs text-white text-[10px] font-bold">
                  #{idx + 1}
                </span>
              )}

              {/* Hover Actions */}
              <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5 p-2">
                {idx !== 0 && (
                  <button
                    type="button"
                    onClick={() => handleSetPrimaryGalleryImage(idx)}
                    className="w-full py-1 bg-white/90 hover:bg-white text-slate-800 rounded-lg text-[10px] font-bold transition shadow-xs cursor-pointer"
                  >
                    Set as Cover
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleRemoveGalleryImage(idx)}
                  className="w-full py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[10px] font-bold transition flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Remove</span>
                </button>
              </div>
            </div>
          ))}

          {/* Add Dropzone Slot */}
          {galleryItems.length < maxImages && (
            <button
              type="button"
              onClick={() => multipleFileInputRef.current?.click()}
              disabled={disabled || isUploading}
              className="aspect-square rounded-xl border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50/30 transition flex flex-col items-center justify-center p-3 text-center cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mb-1 group-hover:scale-110 transition-transform">
                <Plus className="w-4 h-4" />
              </div>
              <span className="text-[11px] font-bold text-slate-700">Add Image</span>
              <span className="text-[9px] text-slate-400">or drop here</span>
            </button>
          )}
        </div>

        {/* Uploading indicator */}
        {isUploading && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-1.5 animate-pulse">
            <div className="flex items-center justify-between text-xs font-bold text-blue-700">
              <span className="flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Uploading to permanent storage...
              </span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="w-full h-1.5 bg-blue-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Error message */}
        {uploadError && (
          <div className="flex items-center gap-2 p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{uploadError}</span>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // SINGLE IMAGE RENDERING
  // =========================================================================
  return (
    <div className="space-y-2">
      {/* Header with Mode Toggle for Full Backward Compatibility */}
      {label && (
        <div className="flex items-center justify-between">
          <label className="block text-xs font-bold text-slate-700">
            {label} {required && <span className="text-rose-500">*</span>}
          </label>
          <div className="flex items-center gap-1.5 text-[11px]">
            <button
              type="button"
              onClick={() => setMode('upload')}
              className={`px-2 py-0.5 rounded-md font-medium transition cursor-pointer ${
                mode === 'upload' ? 'bg-blue-100 text-blue-700 font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Choose from Computer
            </button>
            <span className="text-slate-300">|</span>
            <button
              type="button"
              onClick={() => setMode('url')}
              className={`px-2 py-0.5 rounded-md font-medium transition cursor-pointer ${
                mode === 'url' ? 'bg-blue-100 text-blue-700 font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Paste CDN URL
            </button>
          </div>
        </div>
      )}

      {/* Hidden native file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
        disabled={disabled || isUploading}
        className="hidden"
      />

      {/* ACTIVE IMAGE PREVIEW CARD */}
      {value ? (
        <div className="relative rounded-2xl border border-slate-200 bg-slate-900/5 p-2 overflow-hidden group shadow-2xs">
          <div
            className={`relative w-full ${resolvedAspectClass()} max-h-56 rounded-xl overflow-hidden ${
              previewMode === 'contain' ? 'bg-slate-950/90' : 'bg-slate-900'
            } flex items-center justify-center`}
          >
            {imgLoadError ? (
              <div className="flex flex-col items-center justify-center text-center p-4 text-slate-300">
                <ImageIcon className="w-8 h-8 text-rose-400 mb-1.5" />
                <p className="text-xs font-bold text-white">Preview Unavailable</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Asset will be served from disk or CDN link.</p>
              </div>
            ) : (
              <img
                src={value}
                alt={label || 'Uploaded Asset'}
                className={`w-full h-full ${previewMode === 'contain' ? 'object-contain p-2' : 'object-cover'} transition-transform duration-300 group-hover:scale-[1.02]`}
                onError={() => setImgLoadError(true)}
              />
            )}

            {/* Quick action buttons overlay */}
            <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled || isUploading}
                className="px-3 py-1.5 bg-white text-slate-800 hover:bg-slate-100 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition cursor-pointer"
              >
                <FolderOpen className="w-3.5 h-3.5 text-blue-600" />
                <span>Replace</span>
              </button>
              <a
                href={value}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 bg-slate-800/90 text-white hover:bg-slate-800 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Full View</span>
              </a>
              <button
                type="button"
                onClick={handleRemove}
                disabled={disabled || isUploading}
                className="px-3 py-1.5 bg-rose-600 text-white hover:bg-rose-700 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove</span>
              </button>
            </div>
          </div>

          {/* Metadata & Status Footer */}
          <div className="mt-2 px-1 flex items-center justify-between text-[11px] text-slate-500">
            <div className="flex items-center gap-2 truncate max-w-[65%]">
              <span className="font-mono text-slate-600 truncate">{metadata.filename || value}</span>
              {metadata.dimensions && (
                <span className="bg-slate-200/70 text-slate-700 px-1.5 py-0.2 rounded text-[10px] font-mono shrink-0">
                  {metadata.dimensions}
                </span>
              )}
              {metadata.sizeBytes ? (
                <span className="text-[10px] text-slate-400 shrink-0">{formatBytes(metadata.sizeBytes)}</span>
              ) : null}
            </div>

            {value.startsWith('/uploads/') ? (
              <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-bold flex items-center gap-1 text-[10px] shrink-0">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Local Storage
              </span>
            ) : (
              <span className="text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full font-bold flex items-center gap-1 text-[10px] shrink-0">
                <Check className="w-3 h-3 text-blue-600" /> Stored
              </span>
            )}
          </div>
        </div>
      ) : (
        /* EMPTY UPLOAD / URL ENTRY AREA */
        <div className="space-y-2">
          {mode === 'upload' ? (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer ${
                isDragging
                  ? 'border-blue-500 bg-blue-50/60 scale-[1.01]'
                  : 'border-slate-300 hover:border-blue-500 bg-slate-50/60 hover:bg-blue-50/20'
              } ${isUploading ? 'opacity-70 pointer-events-none' : ''}`}
            >
              <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 mx-auto flex items-center justify-center mb-2.5 shadow-2xs group-hover:scale-105 transition-transform">
                {isUploading ? (
                  <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
                ) : (
                  <FolderOpen className="w-6 h-6 text-blue-600" />
                )}
              </div>

              <h4 className="text-xs font-black text-slate-800">
                {isUploading ? 'Uploading to Server Storage...' : 'Upload Image from Computer'}
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Click to open File Explorer or drag & drop file here
              </p>

              {/* Badges */}
              <div className="flex items-center justify-center gap-2 mt-3 text-[10px] font-semibold text-slate-400">
                <span className="bg-white border border-slate-200 px-2 py-0.5 rounded-md">PNG, JPG, WEBP, SVG</span>
                <span>•</span>
                <span className="bg-white border border-slate-200 px-2 py-0.5 rounded-md">Max {maxFileSizeMB}MB</span>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onBlur={handleApplyUrl}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleApplyUrl())}
                placeholder={placeholder}
                className="flex-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
              />
              <button
                type="button"
                onClick={handleApplyUrl}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
              >
                Apply
              </button>
            </div>
          )}
        </div>
      )}

      {/* Progress Bar for Active Upload */}
      {isUploading && (
        <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl space-y-1 animate-pulse">
          <div className="flex items-center justify-between text-[11px] font-bold text-blue-700">
            <span className="flex items-center gap-1.5">
              <RefreshCw className="w-3 h-3 animate-spin" />
              Transferring asset to server disk...
            </span>
            <span>{uploadProgress}%</span>
          </div>
          <div className="w-full h-1 bg-blue-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Error Banner */}
      {uploadError && (
        <div className="flex items-center justify-between gap-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 p-2.5 rounded-xl">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{uploadError}</span>
          </div>
          <button
            type="button"
            onClick={() => setUploadError(null)}
            className="text-rose-500 hover:text-rose-700 p-1 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Helpful context guidance */}
      {helperText && !uploadError && (
        <p className="text-[11px] text-slate-400 leading-tight">{helperText}</p>
      )}
    </div>
  );
};
