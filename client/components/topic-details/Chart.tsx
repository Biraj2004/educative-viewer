"use client";

import { useMemo } from "react";
import { Chart as ChartJS, registerables } from "chart.js";
import { Chart as ReactChart } from "react-chartjs-2";

ChartJS.register(...registerables);

export interface ChartComponentData {
  comp_id: string;
  config: string;
  type?: string;
}

export default function ChartComponent({ data }: { data: ChartComponentData }) {
  const parsedConfig = useMemo(() => {
    try {
      const parsed = JSON.parse(data.config);
      if (parsed && parsed.data && parsed.data.datasets) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        parsed.data.datasets.forEach((dataset: any) => {
          if (dataset.fill === undefined) dataset.fill = true;
          if (dataset.tension === undefined) dataset.tension = 0.4;
        });
      }
      return parsed;
    } catch (err) {
      console.error("Failed to parse chart config:", err);
      return null;
    }
  }, [data.config]);

  if (!parsedConfig) {
    return (
      <div className="w-full h-64 flex items-center justify-center bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 text-gray-400 text-sm">
        Invalid Chart Data
      </div>
    );
  }

  // Fallback to "line" if type is missing or invalid
  const chartType = parsedConfig.type || data.type || "line";

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    ...parsedConfig.options,
    plugins: {
      legend: {
        labels: {
          color: "currentColor", // Attempt to adapt to light/dark mode
          usePointStyle: true, // makes the legend icon a box/point
          boxWidth: 20,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onHover: (event: any) => {
          if (event.native?.target) {
            event.native.target.style.cursor = "pointer";
          }
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onLeave: (event: any) => {
          if (event.native?.target) {
            event.native.target.style.cursor = "default";
          }
        },
        ...parsedConfig.options?.plugins?.legend,
      },
      ...parsedConfig.options?.plugins,
    },
    scales: {
      x: {
        ticks: { color: "#888" },
        grid: { color: "#e5e7eb", drawBorder: true }, // Tailwind gray-200
        ...parsedConfig.options?.scales?.x,
      },
      y: {
        ticks: { color: "#888" },
        grid: { color: "#e5e7eb", drawBorder: true },
        ...parsedConfig.options?.scales?.y,
      },
    },
  };

  return (
    <div className="w-full max-w-4xl mx-auto rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden bg-white shadow-sm p-6">
      <div className="w-full h-96 relative">
        <ReactChart
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          type={chartType as any}
          data={parsedConfig.data}
          options={options}
        />
      </div>
    </div>
  );
}
