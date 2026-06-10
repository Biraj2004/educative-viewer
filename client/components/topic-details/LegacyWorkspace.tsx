"use client";

import React, { useMemo } from "react";
import WebpackBin, { WebpackBinData } from "./WebpackBin";

interface LegacyWorkspaceProps {
  data: {
    files: Record<string, string>;
  };
}

export default function LegacyWorkspace({ data }: LegacyWorkspaceProps) {
  const webpackBinData = useMemo<WebpackBinData>(() => {
    const rootNodes: any[] = [];
    let nextId = 1;
    const dirMap = new Map<string, any>();

    const files = data?.files || {};
    // Sort paths so parents are processed before children
    const paths = Object.keys(files).sort();

    for (const filePath of paths) {
      const content = files[filePath];
      // Normalize slashes
      const parts = filePath.replace(/\\/g, "/").split("/").filter(Boolean);
      
      let parentId = 0;
      let currentPath = "";

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        const isLeaf = i === parts.length - 1;

        if (!dirMap.has(currentPath)) {
          const id = nextId++;
          const node: any = {
            id,
            leaf: isLeaf,
            module: part,
            parentId: parentId,
          };

          if (isLeaf) {
            node.data = {
              content: content || "",
              staticFile: false,
              hidden: false,
              language: part.split(".").pop() || "plaintext",
            };
          } else {
            node.children = [];
          }

          dirMap.set(currentPath, node);

          if (parentId === 0) {
            rootNodes.push(node);
          } else {
            const parentPath = currentPath.substring(0, currentPath.lastIndexOf("/"));
            const parentNode = dirMap.get(parentPath);
            if (parentNode && parentNode.children) {
              parentNode.children.push(node);
            }
          }
        }
        parentId = dirMap.get(currentPath).id;
      }
    }

    // Find the first leaf node to select
    let selectedId = 0;
    const findFirstLeaf = (nodes: any[]): any => {
      for (const n of nodes) {
        if (n.leaf) return n;
        if (n.children?.length) {
          const leaf = findFirstLeaf(n.children);
          if (leaf) return leaf;
        }
      }
      return null;
    };
    
    const firstLeaf = findFirstLeaf(rootNodes);
    if (firstLeaf) {
      selectedId = firstLeaf.id;
    }

    return {
      codeContents: {
        id: 0,
        module: "/",
        selectedId,
        children: rootNodes,
      },
      showConsole: true,
    };
  }, [data]);

  if (!data?.files || Object.keys(data.files).length === 0) {
    return null;
  }

  return (
    <div className="my-6">
      <WebpackBin data={webpackBinData} />
    </div>
  );
}
