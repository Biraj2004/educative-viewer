"use client";

import { useHandleLibrary } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

interface Props {
  excalidrawAPI: ExcalidrawImperativeAPI | null;
}

export default function ExcalidrawLibraryHandler({ excalidrawAPI }: Props) {
  useHandleLibrary({
    excalidrawAPI,
  });
  return null;
}

