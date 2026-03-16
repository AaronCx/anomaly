'use client';

import { useCallback, useState } from 'react';
import { loadFromFileList } from '@/lib/loader/file-loader';
import {
  loadFromGitHub,
  type ProgressCallback,
} from '@/lib/loader/github-loader';

export type LoaderStatus = 'idle' | 'loading' | 'parsing' | 'complete' | 'error';

export interface LoaderProgress {
  filesLoaded: number;
  totalFiles: number;
  rateLimitRemaining?: number;
}

export interface UseFileLoaderReturn {
  status: LoaderStatus;
  progress: LoaderProgress | null;
  files: Map<string, string> | null;
  error: string | null;
  loadFromFiles: (files: FileList) => Promise<void>;
  loadFromGitHub: (owner: string, repo: string, token?: string) => Promise<void>;
  loadFromDemo: (name: string) => Promise<void>;
  reset: () => void;
}

export function useFileLoader(): UseFileLoaderReturn {
  const [status, setStatus] = useState<LoaderStatus>('idle');
  const [progress, setProgress] = useState<LoaderProgress | null>(null);
  const [files, setFiles] = useState<Map<string, string> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setStatus('idle');
    setProgress(null);
    setFiles(null);
    setError(null);
  }, []);

  const handleLoadFromFiles = useCallback(async (fileList: FileList) => {
    try {
      setStatus('loading');
      setError(null);
      setProgress(null);

      const result = await loadFromFileList(fileList);

      setStatus('complete');
      setFiles(result);
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Failed to load files');
    }
  }, []);

  const handleLoadFromGitHub = useCallback(
    async (owner: string, repo: string, token?: string) => {
      try {
        setStatus('loading');
        setError(null);
        setProgress({ filesLoaded: 0, totalFiles: 0 });

        const onProgress: ProgressCallback = (
          filesLoaded,
          totalFiles,
          rateLimitRemaining,
        ) => {
          setProgress({ filesLoaded, totalFiles, rateLimitRemaining });
        };

        const result = await loadFromGitHub(owner, repo, token, onProgress);

        setStatus('complete');
        setFiles(result);
      } catch (err) {
        setStatus('error');
        setError(err instanceof Error ? err.message : 'Failed to load from GitHub');
      }
    },
    [],
  );

  const handleLoadFromDemo = useCallback(async (name: string) => {
    try {
      setStatus('loading');
      setError(null);
      setProgress(null);

      const res = await fetch(`/demos/${name}.json`);
      if (!res.ok) {
        throw new Error(`Demo "${name}" not found`);
      }

      const data: Record<string, string> = await res.json();
      const result = new Map<string, string>(Object.entries(data));

      setStatus('complete');
      setFiles(result);
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Failed to load demo');
    }
  }, []);

  return {
    status,
    progress,
    files,
    error,
    loadFromFiles: handleLoadFromFiles,
    loadFromGitHub: handleLoadFromGitHub,
    loadFromDemo: handleLoadFromDemo,
    reset,
  };
}
