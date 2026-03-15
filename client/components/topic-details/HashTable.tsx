import { prepareSvg } from "@/utils/svg-helpers";

export interface HashTableValueNode {
  content?: string;
  fillcolor?: string;
  id?: string;
  strokecolor?: string;
  textcolor?: string;
  x?: string | number;
  y?: string | number;
}

export interface HashTableNode {
  content?: string;
  fillcolor?: string;
  id?: string;
  keyList?: HashTableValueNode[];
  strokecolor?: string;
  textcolor?: string;
  x?: string | number;
  y?: string | number;
}

export interface HashTableData {
  caption?: string;
  comp_id: string;
  nodes?: HashTableNode[];
  svg_string?: string;
  version?: string;
}

function KeyValueRow({
  keyNode,
  valueNodes,
}: {
  keyNode: HashTableNode;
  valueNodes: HashTableValueNode[];
}) {
  const keyBg = keyNode.fillcolor ?? "#c9daf8";
  const keyBorder = keyNode.strokecolor ?? "#FF0000";
  const keyText = keyNode.textcolor ?? "#111827";

  return (
    <div className="grid grid-cols-[minmax(120px,220px)_1fr] gap-3 items-start">
      <div
        className="px-3 py-2 rounded-md border font-mono text-sm break-words"
        style={{ backgroundColor: keyBg, borderColor: keyBorder, color: keyText }}
      >
        {keyNode.content ?? keyNode.id ?? "key"}
      </div>
      <div className="flex flex-wrap gap-2">
        {valueNodes.length > 0 ? (
          valueNodes.map((valueNode, idx) => {
            const valueBg = valueNode.fillcolor ?? "#cfe2f3";
            const valueBorder = valueNode.strokecolor ?? "#FF0000";
            const valueText = valueNode.textcolor ?? "#111827";
            return (
              <div
                key={`${valueNode.id ?? "value"}-${idx}`}
                className="px-3 py-2 rounded-md border font-mono text-sm break-words"
                style={{
                  backgroundColor: valueBg,
                  borderColor: valueBorder,
                  color: valueText,
                }}
              >
                {valueNode.content ?? valueNode.id ?? "value"}
              </div>
            );
          })
        ) : (
          <div className="px-3 py-2 rounded-md border border-dashed text-sm text-gray-400 dark:text-gray-500">
            No value
          </div>
        )}
      </div>
    </div>
  );
}

export default function HashTable({ data }: { data: HashTableData }) {
  if (data.svg_string) {
    return (
      <div className="max-w-full mx-auto px-6 py-4">
        <div className="flex flex-col items-center gap-3">
          <div
            className="overflow-x-auto max-w-full dark:brightness-90 dark:invert dark:hue-rotate-180"
            dangerouslySetInnerHTML={{ __html: prepareSvg(data.svg_string) }}
          />
          {data.caption && (
            <span className="text-sm font-medium text-gray-700 bg-gray-50 px-3 py-1 rounded-md mt-1 shadow-sm border border-gray-100 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300">
              {data.caption}
            </span>
          )}
        </div>
      </div>
    );
  }

  const nodes = Array.isArray(data.nodes) ? data.nodes : [];
  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-20 text-sm text-gray-400 italic bg-gray-50 dark:bg-gray-900/50 rounded-lg">
        No hash table data.
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-4">
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-4 sm:p-5 space-y-3 bg-white dark:bg-gray-900">
        {nodes.map((node, idx) => (
          <KeyValueRow
            key={node.id ?? `hash-node-${idx}`}
            keyNode={node}
            valueNodes={Array.isArray(node.keyList) ? node.keyList : []}
          />
        ))}
      </div>
      {data.caption && (
        <div className="flex justify-center w-full mt-3">
          <span className="text-sm font-medium text-gray-700 bg-gray-50 px-3 py-1 rounded-md shadow-sm border border-gray-100 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300">
            {data.caption}
          </span>
        </div>
      )}
    </div>
  );
}
