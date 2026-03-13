"use client";

import type { Accept } from "react-dropzone";
import { useDropzone } from "react-dropzone";
import { FileText, UploadCloud, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type FileDropzoneProps = {
  accept: Accept;
  files: File[];
  onFilesChange: (files: File[]) => void;
  title: string;
  description: string;
  helperText?: string;
  multiple?: boolean;
  className?: string;
};

export function FileDropzone({
  accept,
  files,
  onFilesChange,
  title,
  description,
  helperText,
  multiple = false,
  className
}: FileDropzoneProps) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept,
    multiple,
    onDrop: (acceptedFiles) => {
      if (!acceptedFiles.length) {
        return;
      }

      onFilesChange(multiple ? [...files, ...acceptedFiles] : acceptedFiles.slice(0, 1));
    }
  });

  return (
    <div className={cn("space-y-4", className)}>
      <div
        className={cn(
          "w-full rounded-3xl border border-dashed border-zinc-300 bg-white/70 p-8 text-left transition",
          isDragActive && "border-zinc-950 bg-zinc-100",
          files.length && "border-zinc-950/30 bg-zinc-50"
        )}
        {...getRootProps()}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-4 text-center">
          <div
            className={cn(
              "flex h-14 w-14 items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-50 text-zinc-700",
              isDragActive && "border-zinc-950/20 bg-zinc-950 text-white"
            )}
          >
            <UploadCloud className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <p className="text-base font-semibold text-zinc-950">{title}</p>
            <p className="text-sm text-zinc-500">{description}</p>
          </div>
          {helperText ? <p className="text-xs uppercase tracking-[0.16em] text-zinc-400">{helperText}</p> : null}
        </div>
      </div>

      {files.length ? (
        <div className="space-y-2">
          {files.map((file, index) => (
            <div
              key={`${file.name}-${file.size}-${index}`}
              className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white px-4 py-3"
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-900">{file.name}</p>
                  <p className="text-xs text-zinc-500">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onFilesChange(files.filter((_, itemIndex) => itemIndex !== index))}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
