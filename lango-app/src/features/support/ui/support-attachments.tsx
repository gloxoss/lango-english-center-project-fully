'use client';

import React, { useRef, useState } from 'react';
import {
  FileText,
  Video,
  Image as ImageIcon,
  Download,
  Eye,
  X,
  UploadCloud,
  Loader2,
  Paperclip,
  Film,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { SupportAttachment } from '@/models/Schema';

export type { SupportAttachment };

interface AttachmentUploaderProps {
  attachments: SupportAttachment[];
  onChange: (attachments: SupportAttachment[]) => void;
  maxFiles?: number;
  disabled?: boolean;
}

export function AttachmentUploader({
  attachments,
  onChange,
  maxFiles = 5,
  disabled = false,
}: AttachmentUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0 || disabled) return;

    if (attachments.length + files.length > maxFiles) {
      setErrorMsg(`Limite maximale de ${maxFiles} pièces jointes par message atteinte.`);
      return;
    }

    setErrorMsg(null);
    setUploading(true);

    try {
      const newUploaded: SupportAttachment[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file) continue;

        if (file.size > 50 * 1024 * 1024) {
          setErrorMsg(`Le fichier "${file.name}" dépasse la limite autorisée de 50 Mo.`);
          continue;
        }

        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch('/api/support/upload', {
          method: 'POST',
          body: formData,
        });

        const json = await res.json();
        if (json.success && json.data) {
          newUploaded.push(json.data);
        } else {
          setErrorMsg(json.error?.message || `Échec du téléversement de "${file.name}".`);
        }
      }

      if (newUploaded.length > 0) {
        onChange([...attachments, ...newUploaded]);
      }
    } catch (err) {
      console.error('File upload error', err);
      setErrorMsg('Erreur de connexion lors du téléversement.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeAttachment = (index: number) => {
    const updated = attachments.filter((_, i) => i !== index);
    onChange(updated);
  };

  return (
    <div className="space-y-2">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime,application/pdf"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
        disabled={disabled || uploading}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || uploading || attachments.length >= maxFiles}
          onClick={() => fileInputRef.current?.click()}
          className="h-8 text-xs rounded-xl border-slate-200 hover:border-[#0066FF] hover:text-[#0066FF] font-medium gap-1.5"
        >
          {uploading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0066FF]" />
              <span>Téléversement...</span>
            </>
          ) : (
            <>
              <Paperclip className="w-3.5 h-3.5" />
              <span>Joindre image / vidéo (max 50 Mo)</span>
            </>
          )}
        </Button>

        <span className="text-[11px] text-slate-400">
          Captures d’écran, MP4, WebM, MOV ou PDF
        </span>
      </div>

      {errorMsg && (
        <p className="text-[11px] font-medium text-rose-600 bg-rose-50 border border-rose-200/80 px-2.5 py-1 rounded-lg">
          {errorMsg}
        </p>
      )}

      {/* Uploaded Attachments Chips */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {attachments.map((att, idx) => {
            const isVideo = att.type === 'video' || att.mimeType.startsWith('video/');
            const isImage = att.type === 'image' || att.mimeType.startsWith('image/');
            const sizeMb = (att.size / (1024 * 1024)).toFixed(1);

            return (
              <div
                key={idx}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-700 shadow-2xs group"
              >
                {isVideo ? (
                  <Film className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                ) : isImage ? (
                  <ImageIcon className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                ) : (
                  <FileText className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                )}

                <span className="max-w-[140px] truncate font-medium text-[11px]">
                  {att.name}
                </span>

                <span className="text-[10px] text-slate-400 shrink-0">
                  ({sizeMb} Mo)
                </span>

                {!disabled && (
                  <button
                    type="button"
                    onClick={() => removeAttachment(idx)}
                    className="text-slate-400 hover:text-rose-600 p-0.5 rounded transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface AttachmentsGalleryProps {
  attachments?: SupportAttachment[] | null;
  onPreviewImage?: (url: string) => void;
}

export function AttachmentsGallery({
  attachments,
  onPreviewImage,
}: AttachmentsGalleryProps) {
  if (!attachments || attachments.length === 0) return null;

  return (
    <div className="mt-2.5 pt-2 border-t border-slate-200/60 space-y-2">
      <div className="text-[10px] font-bold text-slate-500 flex items-center gap-1.5 uppercase tracking-wider">
        <Paperclip className="w-3 h-3 text-slate-400" />
        Pièces jointes ({attachments.length})
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {attachments.map((att, idx) => {
          const isVideo = att.type === 'video' || att.mimeType.startsWith('video/');
          const isImage = att.type === 'image' || att.mimeType.startsWith('image/');
          const sizeMb = (att.size / (1024 * 1024)).toFixed(1);

          if (isVideo) {
            return (
              <div
                key={idx}
                className="col-span-full rounded-xl overflow-hidden border border-slate-200 bg-slate-950 shadow-sm"
              >
                <div className="px-3 py-1.5 bg-slate-900 text-white text-[11px] font-semibold flex items-center justify-between border-b border-slate-800">
                  <span className="truncate flex items-center gap-1.5 text-slate-200">
                    <Video className="w-3.5 h-3.5 text-[#0066FF]" />
                    {att.name}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-slate-400">{sizeMb} Mo</span>
                    <a
                      href={att.url}
                      download={att.name}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 hover:text-[#0066FF] transition-colors"
                      title="Télécharger la vidéo"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>

                <video
                  controls
                  preload="metadata"
                  className="w-full max-h-80 bg-black object-contain"
                  src={att.url}
                >
                  Votre navigateur ne prend pas en charge la lecture de cette vidéo.
                </video>
              </div>
            );
          }

          if (isImage) {
            return (
              <div
                key={idx}
                onClick={() => onPreviewImage?.(att.url)}
                className="group relative cursor-pointer rounded-xl overflow-hidden border border-slate-200/80 bg-slate-100 hover:border-[#0066FF] transition-all shadow-2xs"
              >
                <img
                  src={att.url}
                  alt={att.name}
                  className="w-full h-36 object-cover group-hover:scale-105 transition-transform duration-200"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold gap-1.5">
                  <Eye className="w-4 h-4" /> Agrandir
                </div>
                <div className="p-2 bg-white/95 text-[11px] flex items-center justify-between text-slate-700 font-medium border-t border-slate-100">
                  <span className="truncate">{att.name}</span>
                  <span className="text-[10px] text-slate-400 shrink-0">{sizeMb} Mo</span>
                </div>
              </div>
            );
          }

          return (
            <a
              key={idx}
              href={att.url}
              target="_blank"
              rel="noopener noreferrer"
              download={att.name}
              className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 bg-white hover:border-[#0066FF] text-xs text-slate-700 shadow-2xs hover:shadow-xs transition-all"
            >
              <span className="truncate flex items-center gap-2 font-medium">
                <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                {att.name}
              </span>
              <div className="flex items-center gap-1.5 text-slate-400 text-[10px] shrink-0">
                <span>{sizeMb} Mo</span>
                <Download className="w-3.5 h-3.5 text-slate-500" />
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}

interface ImageLightboxProps {
  url: string | null;
  onClose: () => void;
}

export function ImageLightbox({ url, onClose }: ImageLightboxProps) {
  if (!url) return null;

  return (
    <Dialog open={Boolean(url)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl p-2 rounded-2xl bg-black/90 border-slate-800 text-white">
        <DialogHeader className="p-2 flex flex-row items-center justify-between">
          <DialogTitle className="text-xs text-slate-300 font-medium">
            Aperçu de la pièce jointe
          </DialogTitle>
          <div className="flex items-center gap-2">
            <a
              href={url}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs flex items-center gap-1 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Télécharger
            </a>
          </div>
        </DialogHeader>
        <div className="max-h-[80vh] overflow-auto flex items-center justify-center p-2">
          <img
            src={url}
            alt="Pièce jointe en taille réelle"
            className="max-w-full max-h-[75vh] object-contain rounded-lg"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
