import type { MetadataRoute } from "next";

/** Web-App-Manifest: AbiOS lässt sich auf dem Handy-Homescreen installieren. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AbiOS",
    short_name: "AbiOS",
    description: "Persönliche Lernplattform fürs Abitur",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f7f8",
    theme_color: "#4f46e5",
    lang: "de",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
