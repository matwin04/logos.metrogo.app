import postgres from "postgres";
import dotenv from "dotenv";
dotenv.config();

const connectionString = process.env.LOGO_POSTGRES_URL_NO_SSL;
const sql = postgres(process.env.LOGO_POSTGRES_URL);

console.log(`Connection String: ${connectionString}`);
console.log(`NO SSL-${process.env.DB_POSTGRES_URL_NO_SSL}`);
console.log(process.env.DB_POSTGRES_URL_BASEURL);

async function setupDB() {
    console.log("Database Connected");
    console.log("Starting DB...");
    try {
        await sql`
CREATE TABLE IF NOT EXISTS agencies (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    chateau TEXT NOT NULL UNIQUE
)`;

        await sql`
CREATE TABLE IF NOT EXISTS agency_logos (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    agency TEXT NOT NULL REFERENCES agencies(chateau) ON DELETE CASCADE,
    url TEXT NOT NULL,
    UNIQUE (agency, url)
)`;

        await sql`
CREATE TABLE IF NOT EXISTS routes_logos (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    chateau TEXT NOT NULL REFERENCES agencies(chateau) ON DELETE CASCADE,
    route_id TEXT NOT NULL,
    variant TEXT NOT NULL DEFAULT 'main',
    source_url TEXT NOT NULL,
    svg_path TEXT,
    UNIQUE (chateau, route_id, variant)
)`;

        await sql`
CREATE INDEX IF NOT EXISTS idx_agency_logos_agency ON agency_logos(agency)`;

        await sql`
CREATE INDEX IF NOT EXISTS idx_routes_logos_chateau_route ON routes_logos(chateau, route_id)`;
    } catch (err) {
        console.error(err);
    }
}

export { sql, setupDB };
