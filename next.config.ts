import fs from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";

const simEntry = path.join(process.cwd(), "src/components/sim/NakayamaRaceSim.tsx");
const useLocalSim = process.env.NODE_ENV !== "production" && fs.existsSync(simEntry);
const raceSim = useLocalSim ? "./src/components/sim/NakayamaRaceSim.tsx" : "./src/components/raceSimFallback.tsx";

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: {
      "@race-sim": raceSim,
    },
  },
  webpack: (config) => {
    config.resolve.alias["@race-sim"] = path.join(process.cwd(), raceSim);
    return config;
  },
};

export default nextConfig;
