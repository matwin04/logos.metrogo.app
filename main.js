import express from "express";
import path from "path";
import dotenv from "dotenv";
import { engine } from "express-handlebars";
import { fileURLToPath } from "url";
import { sql, setupDB } from "./db.js";

dotenv.config();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VIEWS_DIR = path.join(__dirname, "views");
const PARTIALS_DIR = path.join(VIEWS_DIR, "partials");

// DB setup — creates agencies / agency_logos / routes_logos if they don't exist yet
setupDB();

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
// Lookups now go through Postgres (agencies / agency_logos / routes_logos)
// instead of the old logos-manifest.json. Requests are proxied and cached
// in memory so the response looks like it's coming from this server,
// not Wikimedia directly.
// =============================================

// GET /api/:agencyId/main.svg  e.g. /api/metro~losangeles/main.svg
// Uses the first agency_logos row for that chateau as the "main" logo.
app.get("/api/:agencyId/main.svg", async (req, res) => {
    const { agencyId } = req.params;
    try {
        const rows = await sql`
            SELECT url FROM agency_logos
            WHERE agency = ${agencyId}
            ORDER BY id ASC
            LIMIT 1
        `;

        if (rows.length === 0) {
            return res
                .status(404)
                .json({ error: `No main logo found for "${agencyId}"` });
        }

        await sendSvg(res, rows[0].url);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Database lookup failed" });
    }
});

// GET /api/:agencyId/routes/:routeId.svg  e.g. /api/metro~losangeles/routes/704.svg
app.get("/api/:agencyId/routes/:routeId.svg", async (req, res) => {
    const { agencyId, routeId } = req.params;
    try {
        const rows = await sql`
            SELECT source_url FROM routes_logos
            WHERE chateau = ${agencyId} AND route_id = ${routeId}
            ORDER BY id ASC
            LIMIT 1
        `;

        if (rows.length === 0) {
            return res
                .status(404)
                .json({ error: `No route "${routeId}" logo found for "${agencyId}"` });
        }

        await sendSvg(res, rows[0].source_url);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Database lookup failed" });
    }
});

// GET /api/agencies -> list of all known agency chateaus
// (must come before /api/:agencyId, or "agencies" gets matched as an id)
app.get("/api/agencies", async (req, res) => {
    try {
        const rows = await sql`SELECT chateau FROM agencies ORDER BY chateau ASC`;
        res.json(rows.map((r) => r.chateau));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Database lookup failed" });
    }
});

// GET /api/:agencyId -> list available logo URLs and route ids for that agency
app.get("/api/:agencyId", async (req, res) => {
    const { agencyId } = req.params;
    try {
        const agencyRows = await sql`
            SELECT id FROM agencies WHERE chateau = ${agencyId} LIMIT 1
        `;

        if (agencyRows.length === 0) {
            return res.status(404).json({ error: `No agency found for "${agencyId}"` });
        }

        const logos = await sql`
            SELECT url FROM agency_logos WHERE agency = ${agencyId} ORDER BY id ASC
        `;
        const routes = await sql`
            SELECT route_id, variant FROM routes_logos
            WHERE chateau = ${agencyId}
            ORDER BY route_id ASC
        `;

        res.json({
            agency: agencyId,
            logos: logos.map((l) => l.url),
            routes: routes.map((r) => ({ route_id: r.route_id, variant: r.variant }))
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Database lookup failed" });
    }
});

if (!process.env.VERCEL && !process.env.NOW_REGION) {
    const PORT = process.env.PORT || 8088;
    app.listen(PORT, () => {
        console.log(`Server running: http://localhost:${PORT}`);
    });
}

export default app;