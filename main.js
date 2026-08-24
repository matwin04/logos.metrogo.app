import express from "express";
import path from "path";
import dotenv from "dotenv";
import { engine } from "express-handlebars";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import fs from "node:fs/promises";
import { fetchAllTrains } from "amtrak";
import session from "express-session";
//import { sql, setupDB } from "./db.js";
//import gtfsRealtime from "gtfs-realtime";
//import {runAll} from "./gtfsrt.js";

dotenv.config();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VIEWS_DIR = path.join(__dirname, "views");
const PARTIALS_DIR = path.join(VIEWS_DIR, "partials");
const IMGS_DIR = path.join
//const DB_PATH = path.join(__dirname, "public", "data.db");
//const FEEDS_PATH = path.join(__dirname, "public", "data","feeds");
// =============================================
// DATABASE INITIALIZATION
// =============================================

//const db = new Database(DB_PATH);
//setupDB();
//setInterval(runAll, 10000);
// =============================================
// VIEW & STATIC CONFIG
// =============================================

//setInterval(runAll, 15000);
app.engine(
    "html",
    engine({
        extname: ".html",
        defaultLayout: false,
        partialsDir: PARTIALS_DIR,

        helpers: {
            formatTime(timestamp) {
                if (!timestamp) return "—";

                return new Date(timestamp * 1000).toLocaleTimeString(
                    "en-US",
                    {
                        timeZone: "America/Los_Angeles",
                        hour: "numeric",
                        minute: "2-digit"
                    }
                );
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
app.use("/images", express.static(path.join(__dirname, "images")));
app.get("/", async (req, res) => {
    res.render("index");
});
app.get("/about", (req, res) => {
    res.render("about");
});

// =============================================
// DATA MANAGEMENT ENDPOINTS
// =============================================

/**
 * Get all transit sources from database
 * GET /api/sources/transit
 */

if (!process.env.VERCEL && !process.env.NOW_REGION) {
    const PORT = process.env.PORT || 8088;
    app.listen(PORT, () => {
        console.log(`Server running: http://localhost:${PORT}`);
        console.log(`Database: MICHEAL BALLS PENIS`);
    });
}

export default app;
