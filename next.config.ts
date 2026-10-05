import path from "node:path";
import type { NextConfig } from "next";

// Projektordner fest vorgeben – sonst wählt Next.js bei einer package-lock.json
// in einem übergeordneten Ordner einen falschen Wurzelordner für den Build.
const projectRoot = path.resolve(import.meta.dirname);

const nextConfig: NextConfig = {
  // Erzeugt einen eigenständigen Server-Build für das Docker-Image.
  output: "standalone",
  outputFileTracingRoot: projectRoot,
  turbopack: { root: projectRoot },
  // Native/Node-only Pakete nicht bündeln.
  serverExternalPackages: ["@libsql/client", "libsql", "unpdf", "mammoth"],
};

export default nextConfig;
