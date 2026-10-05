import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Erzeugt einen eigenständigen Server-Build für das Docker-Image.
  output: "standalone",
  // Native/Node-only Pakete nicht bündeln.
  serverExternalPackages: ["better-sqlite3", "unpdf", "mammoth"],
};

export default nextConfig;
