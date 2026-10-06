import type { KokuraMap } from "@/domain/sim/kokuraCourse";

const TURF = "#1f5c45";
const TURF_DIM = "#8fb5a3";
const DIRT = "#8a5a32";
const DIRT_DIM = "#c4a484";

export function KokuraTemplateMap({ map }: { map: KokuraMap }) {
  return (
    <div className="rounded-lg border border-ink/10 bg-[#e7f3ec]">
      <svg
        viewBox={map.viewBox}
        width="100%"
        height="auto"
        className="block h-auto w-full"
        role="img"
        aria-label={`${map.title}。右回りの模式図`}
      >
        <path d={map.turfD} fill="none" stroke={TURF_DIM} strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
        <path d={map.dirtD} fill="none" stroke={DIRT_DIM} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
        {map.used.map((d, index) => (
          <path
            key={index}
            d={d}
            fill="none"
            stroke={map.title.startsWith("ダート") ? DIRT : TURF}
            strokeWidth="14"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
        <path d={map.hillD} fill="none" stroke="#c2410c" strokeWidth="8" strokeLinecap="round" />
        <line
          x1={map.finish.x1.toFixed(1)}
          y1={map.finish.y1.toFixed(1)}
          x2={map.finish.x2.toFixed(1)}
          y2={map.finish.y2.toFixed(1)}
          stroke="#ffffff"
          strokeWidth="3"
        />
        <line
          x1={map.start.x1.toFixed(1)}
          y1={map.start.y1.toFixed(1)}
          x2={map.start.x2.toFixed(1)}
          y2={map.start.y2.toFixed(1)}
          stroke="#ffffff"
          strokeWidth="3"
        />
        {map.labels.map((label) => (
          <text
            key={`${label.text}-${label.x.toFixed(0)}-${label.y.toFixed(0)}`}
            x={label.x.toFixed(1)}
            y={label.y.toFixed(1)}
            textAnchor="middle"
            fill="#141210"
            fontSize="13"
            fontWeight="700"
          >
            {label.text}
          </text>
        ))}
      </svg>
    </div>
  );
}
