"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { prepareImageSource } from "@/utils/image-source";

export function usePreparedImageSource(sourceUrl: string): string {
  const [prepared, setPrepared] = useState<{ inputUrl: string; outputUrl: string }>({
    inputUrl: sourceUrl,
    outputUrl: sourceUrl,
  });
  const currentObjectUrl = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!sourceUrl) {
      if (currentObjectUrl.current) {
        URL.revokeObjectURL(currentObjectUrl.current);
        currentObjectUrl.current = null;
      }
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      const result = await prepareImageSource(sourceUrl);

      if (cancelled) {
        if (result.shouldRevoke) URL.revokeObjectURL(result.src);
        return;
      }

      if (currentObjectUrl.current && currentObjectUrl.current !== result.src) {
        URL.revokeObjectURL(currentObjectUrl.current);
        currentObjectUrl.current = null;
      }

      if (result.shouldRevoke) {
        currentObjectUrl.current = result.src;
      }

      setPrepared({
        inputUrl: sourceUrl,
        outputUrl: result.src,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [sourceUrl]);

  useEffect(() => {
    return () => {
      if (currentObjectUrl.current) {
        URL.revokeObjectURL(currentObjectUrl.current);
        currentObjectUrl.current = null;
      }
    };
  }, []);

  return prepared.inputUrl === sourceUrl ? prepared.outputUrl : sourceUrl;
}

export function usePreparedImageSources(sourceUrls: string[]): {
  preparedUrls: string[];
  isPreparing: boolean;
} {
  const sourceKey = JSON.stringify(sourceUrls);
  const keyedSourceUrls = useMemo(() => {
    try {
      const parsed: unknown = JSON.parse(sourceKey);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((item): item is string => typeof item === "string");
    } catch {
      return [];
    }
  }, [sourceKey]);

  const [state, setState] = useState<{
    sourceKey: string;
    preparedUrls: string[];
    isPreparing: boolean;
  }>({
    sourceKey,
    preparedUrls: keyedSourceUrls,
    isPreparing: keyedSourceUrls.length > 0,
  });

  useEffect(() => {
    let cancelled = false;
    const revokeUrls: string[] = [];

    (async () => {
      const nextUrls = await Promise.all(
        keyedSourceUrls.map(async (url) => {
          const result = await prepareImageSource(url);
          if (result.shouldRevoke) revokeUrls.push(result.src);
          return result.src;
        })
      );

      if (cancelled) {
        revokeUrls.forEach((url) => URL.revokeObjectURL(url));
        return;
      }

      setState({
        sourceKey,
        preparedUrls: nextUrls,
        isPreparing: false,
      });
    })();

    return () => {
      cancelled = true;
      revokeUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [keyedSourceUrls, sourceKey]);

  if (state.sourceKey !== sourceKey) {
    return {
      preparedUrls: keyedSourceUrls,
      isPreparing: keyedSourceUrls.length > 0,
    };
  }

  return {
    preparedUrls: state.preparedUrls,
    isPreparing: state.isPreparing,
  };
}
