import { prepareSvg } from "@/utils/svg-helpers";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MatrixCell {
  text: string;
  color?: string;
  height?: number;
  width?: number;
}

interface MatrixCol {
  cells: MatrixCell[];
  max_width?: number;
}

interface MatrixData {
  cols?: MatrixCol[];
  row_gap?: number;
  col_gap?: number;
  top_padding?: number;
  left_padding?: number;
}

export interface MatrixComponentData {
  comp_id: string;
  caption?: string;
  svg_string?: string;
  svg_width?: number;
  svg_height?: number;
  matrix_data?: MatrixData;
  version?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Matrix({ data }: { data: MatrixComponentData }) {
  // Primary: inline SVG
  if (data.svg_string) {
    return (
      <div className="max-w-full mx-auto px-6 py-4">
        <div className="flex flex-col items-center gap-3">
          <div
            className="overflow-x-auto max-w-full dark:brightness-90 dark:invert dark:hue-rotate-180"
            dangerouslySetInnerHTML={{ __html: prepareSvg(data.svg_string) }}
          />
          {data.caption && (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center italic">{data.caption}</p>
          )}
        </div>
      </div>
    );
  }

  // Fallback: render matrix_data as HTML table grid
  const cols = data.matrix_data?.cols ?? [];
  if (cols.length === 0) {
    return (
      <div className="flex items-center justify-center h-20 text-sm text-gray-400 italic">
        No matrix data.
      </div>
    );
  }

  const rowCount = Math.max(...cols.map((c) => c.cells.length));

  return (
    <div className="max-w-full mx-auto px-6 py-4 overflow-x-auto">
      <table className="border-collapse mx-auto">
        <tbody>
          {Array.from({ length: rowCount }).map((_, rowIdx) => (
            <tr key={rowIdx}>
              {cols.map((col, colIdx) => {
                const cell = col.cells[rowIdx];
                if (!cell) return <td key={colIdx} />;
                return (
                  <td
                    key={colIdx}
                    className="border border-gray-400 px-3 py-2 text-sm font-mono whitespace-nowrap"
                    style={{ backgroundColor: cell.color ?? "#fff" }}
                  >
                    {cell.text}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {data.caption && (
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center mt-2 italic">{data.caption}</p>
      )}
    </div>
  );
}
