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
const IMAGES_DIR = path.join(__dirname, "images");
const MANIFEST_PATH = path.join(__dirname, "logos-manifest.json");

// Loaded once at startup. Re-run `node build-manifest.js` and restart
// the server whenever you add/remove agencies, icons, or route SVGs.
const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf-8"));

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
app.use("/images", express.static(IMAGES_DIR));

app.get("/", (req, res) => {
    res.render("index");
});

app.get("/about", (req, res) => {
    res.render("about");
});

// =============================================
// LOGO API
// All lookups go through logos-manifest.json — nothing touches the
// filesystem with a request param that wasn't already a known key/value.
// =============================================

// GET /api/:agencyId/main.svg  e.g. /api/metro~losangeles/main.svg
app.get("/api/:agencyId/main.svg", (req, res) => {
    const { agencyId } = req.params;
    const entry = manifest[agencyId];

    if (!entry || !entry.icons.includes("main")) {
        return res
            .status(404)
            .json({ error: `No main logo found for "${agencyId}"` });
    }

    const filePath = path.join(IMAGES_DIR, agencyId, "main.svg");
    res.type("image/svg+xml");
    res.set("Cache-Control", "public, max-age=86400"); // 1 day
    res.sendFile(filePath);
});

// GET /api/:agencyId/routes/:routeId.svg  e.g. /api/metro~losangeles/routes/704.svg
app.get("/api/:agencyId/routes/:routeId.svg", (req, res) => {
    const { agencyId, routeId } = req.params;
    const entry = manifest[agencyId];

    if (!entry || !entry.routes.includes(routeId)) {
        return res
            .status(404)
            .json({ error: `No route "${routeId}" logo found for "${agencyId}"` });
    }

    const filePath = path.join(IMAGES_DIR, agencyId, "routes", `${routeId}.svg`);
    res.type("image/svg+xml");
    res.set("Cache-Control", "public, max-age=86400"); // 1 day
    res.sendFile(filePath);
});

// GET /api/agencies -> full manifest
// (must come before /api/:agencyId, or "agencies" gets matched as an id)
app.get("/api/agencies", (req, res) => {
    res.json(manifest);
});

// GET /api/:agencyId -> list available icons + routes for that agency
app.get("/api/:agencyId", (req, res) => {
    const { agencyId } = req.params;
    const entry = manifest[agencyId];

    if (!entry) {
        return res.status(404).json({ error: `No logos found for "${agencyId}"` });
    }

    res.json({ agency: agencyId, ...entry });
});

if (!process.env.VERCEL && !process.env.NOW_REGION) {
    const PORT = process.env.PORT || 8088;
    app.listen(PORT, () => {
        console.log(`Server running: http://localhost:${PORT}`);
    });
}

export default app;