'use client';

import { useCallback, useRef, useState } from 'react';
import { FolderOpen, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileEntry {
  path: string;
  content: string;
}

interface DropZoneProps {
  onFilesLoaded: (files: FileEntry[]) => void;
  className?: string;
}

async function readFileEntry(entry: FileSystemEntry): Promise<FileEntry[]> {
  if (entry.isFile) {
    return new Promise((resolve) => {
      (entry as FileSystemFileEntry).file((file) => {
        const reader = new FileReader();
        reader.onload = () => {
          resolve([
            {
              path: entry.fullPath.replace(/^\//, ''),
              content: reader.result as string,
            },
          ]);
        };
        reader.onerror = () => resolve([]);
        reader.readAsText(file);
      });
    });
  }

  if (entry.isDirectory) {
    const dirReader = (entry as FileSystemDirectoryEntry).createReader();
    const entries = await new Promise<FileSystemEntry[]>((resolve) => {
      const allEntries: FileSystemEntry[] = [];
      const readBatch = () => {
        dirReader.readEntries((batch) => {
          if (batch.length === 0) {
            resolve(allEntries);
          } else {
            allEntries.push(...batch);
            readBatch();
          }
        });
      };
      readBatch();
    });
    const nested = await Promise.all(entries.map(readFileEntry));
    return nested.flat();
  }

  return [];
}

async function readFromInput(fileList: FileList): Promise<FileEntry[]> {
  const results: FileEntry[] = [];
  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i];
    const path =
      (file as File & { webkitRelativePath?: string }).webkitRelativePath ||
      file.name;
    try {
      const content = await file.text();
      results.push({ path, content });
    } catch {
      // skip binary files
    }
  }
  return results;
}

export default function DropZone({ onFilesLoaded, className }: DropZoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);

      const items = e.dataTransfer.items;
      const entries: FileSystemEntry[] = [];
      for (let i = 0; i < items.length; i++) {
        const entry = items[i].webkitGetAsEntry?.();
        if (entry) entries.push(entry);
      }

      setPending(true);
      try {
        const files = (await Promise.all(entries.map(readFileEntry))).flat();
        if (files.length > 0) onFilesLoaded(files);
      } finally {
        setPending(false);
      }
    },
    [onFilesLoaded],
  );

  const handleBrowse = useCallback(async () => {
    const input = inputRef.current;
    if (!input) return;
    input.click();
  }, []);

  const handleInputChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const fileList = e.target.files;
      if (!fileList || fileList.length === 0) return;
      setPending(true);
      try {
        const files = await readFromInput(fileList);
        if (files.length > 0) onFilesLoaded(files);
      } finally {
        setPending(false);
      }
    },
    [onFilesLoaded],
  );

  return (
    <div
      className={cn(
        'glass group flex flex-col items-center justify-center gap-4 rounded-xl p-8 transition-all duration-200 ease-out',
        dragOver &&
          'border-[var(--color-accent)] shadow-[var(--shadow-glow)]',
        pending && 'pointer-events-none opacity-60',
        className,
      )}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      <div
        className={cn(
          'flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--color-surface-2)] transition-colors duration-200',
          dragOver && 'bg-[var(--color-accent)]/15',
        )}
      >
        {dragOver ? (
          <Upload className="h-6 w-6 text-[var(--color-accent-bright)]" />
        ) : (
          <FolderOpen className="h-6 w-6 text-[var(--color-text-muted)] transition-colors group-hover:text-[var(--color-text)]" />
        )}
      </div>

      <div className="text-center">
        <p className="font-medium text-[var(--color-text)]">
          {pending ? 'Reading folder…' : 'Drop your project folder here'}
        </p>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          or{' '}
          <button
            type="button"
            onClick={handleBrowse}
            disabled={pending}
            aria-label="Browse for a project folder"
            className="font-medium text-[var(--color-accent)] underline underline-offset-2 transition hover:text-[var(--color-accent-bright)] disabled:opacity-50 disabled:pointer-events-none"
          >
            browse files
          </button>
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={handleInputChange}
        {...({ webkitdirectory: '', directory: '', mozdirectory: '' } as React.InputHTMLAttributes<HTMLInputElement>)}
      />
    </div>
  );
}
