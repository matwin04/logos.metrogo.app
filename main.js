import express from "express";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { engine } from "express-handlebars";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VIEWS_DIR = path.join(__dirname, "views");
const PARTIALS_DIR = path.join(VIEWS_DIR, "partials");
const MANIFEST_PATH = path.join(__dirname, "logos-manifest.json");

// Manifest shape:
// {
//   "metro~losangeles": {
//     "icons":  { "main": "https://upload.wikimedia.org/.../main.svg" },
//     "routes": { "704": "https://upload.wikimedia.org/.../704.svg" }
//   }
// }
// Hand-maintained now that logos come from Wikimedia instead of local files.
const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf-8"));

// Simple in-memory cache so repeat requests don't re-fetch Wikimedia every time.
const SVG_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 1 day
const svgCache = new Map(); // url -> { body: Buffer, fetchedAt: number }

async function fetchSvg(url) {
    const cached = svgCache.get(url);
    if (cached && Date.now() - cached.fetchedAt < SVG_CACHE_TTL_MS) {
        return cached.body;
    }

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Upstream fetch failed (${response.status}) for ${url}`);
    }

    const body = Buffer.from(await response.arrayBuffer());
    svgCache.set(url, { body, fetchedAt: Date.now() });
    return body;
}

async function sendSvg(res, url) {
    try {
        const body = await fetchSvg(url);
        res.type("image/svg+xml");
        res.set("Cache-Control", "public, max-age=86400"); // 1 day
        res.send(body);
    } catch (err) {
        res.status(502).json({ error: "Failed to fetch logo from source" });
    }
}

// =============================================
// VIEW & STATIC CONFIG
// =============================================
app.engine(
    "html",
    engine({
        extname: ".html",
        defaultLayout: false,
        partialsDir: PARTIALS_DIR,
        helpers: {
            formatTime(timestamp) {
                if (!timestamp) return "—";
                return new Date(timestamp * 1000).toLocaleTimeString("en-US", {
                    timeZone: "America/Los_Angeles",
                    hour: "numeric",
                    minute: "2-digit"
                });
            }
        }
    })
);
app.set("view engine", "html");
app.set("views", VIEWS_DIR);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/public", express.static(path.join(__dirname, "public")));
app.use("/views", express.static(path.join(__dirname, "views")));

app.get("/", (req, res) => {
    res.render("index");
});

app.get("/about", (req, res) => {
    res.render("about");
});

// =============================================
// LOGO API
// All lookups go through logos-manifest.json, which now maps
// agency/icon/route names to Wikimedia SVG URLs. Requests are proxied
// and cached in memory so the response looks like it's coming from
// this server, not Wikimedia directly.
// =============================================

// GET /api/:agencyId/main.svg  e.g. /api/metro~losangeles/main.svg
app.get("/api/:agencyId/main.svg", async (req, res) => {
    const { agencyId } = req.params;
    const url = manifest[agencyId]?.icons?.main;

    if (!url) {
        return res
            .status(404)
            .json({ error: `No main logo found for "${agencyId}"` });
    }

    await sendSvg(res, url);
});

// GET /api/:agencyId/routes/:routeId.svg  e.g. /api/metro~losangeles/routes/704.svg
app.get("/api/:agencyId/routes/:routeId.svg", async (req, res) => {
    const { agencyId, routeId } = req.params;
    const url = manifest[agencyId]?.routes?.[routeId];

    if (!url) {
        return res
            .status(404)
            .json({ error: `No route "${routeId}" logo found for "${agencyId}"` });
    }

    await sendSvg(res, url);
});

// GET /api/agencies -> full manifest
// (must come before /api/:agencyId, or "agencies" gets matched as an id)
app.get("/api/agencies", (req, res) => {
    res.json(manifest);
});

// GET /api/:agencyId -> list available icon/route names for that agency
app.get("/api/:agencyId", (req, res) => {
    const { agencyId } = req.params;
    const entry = manifest[agencyId];

    if (!entry) {
        return res.status(404).json({ error: `No logos found for "${agencyId}"` });
    }

    res.json({
        agency: agencyId,
        icons: Object.keys(entry.icons ?? {}),
        routes: Object.keys(entry.routes ?? {})
    });
});

if (!process.env.VERCEL && !process.env.NOW_REGION) {
    const PORT = process.env.PORT || 8088;
    app.listen(PORT, () => {
        console.log(`Server running: http://localhost:${PORT}`);
    });
}

export default app;