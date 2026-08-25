// Run this whenever you add/remove agencies, icons, or route SVGs:
//   node build-manifest.js
// Scans:
//   images/<agency>/main.svg            -> manifest[agency].icons
//   images/<agency>/routes/<routeId>.svg -> manifest[agency].routes
// and writes logos-manifest.json

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IMAGES_DIR = path.join(__dirname, "images");
const OUT_PATH = path.join(__dirname, "logos-manifest.json");

const manifest = {};

function svgNames(dir) {
    if (!fs.existsSync(dir)) return [];
    return fs
        .readdirSync(dir)
        .filter((f) => f.endsWith(".svg"))
        .map((f) => f.replace(/\.svg$/, ""));
}

if (fs.existsSync(IMAGES_DIR)) {
    for (const agency of fs.readdirSync(IMAGES_DIR)) {
        const agencyDir = path.join(IMAGES_DIR, agency);
        if (!fs.statSync(agencyDir).isDirectory()) continue;

        manifest[agency] = {
            icons: svgNames(agencyDir), // images/<agency>/*.svg (e.g. "main")
            routes: svgNames(path.join(agencyDir, "routes")) // images/<agency>/routes/*.svg
        };
    }
}

fs.writeFileSync(OUT_PATH, JSON.stringify(manifest, null, 2));
console.log(`Wrote ${Object.keys(manifest).length} agencies to ${OUT_PATH}`);