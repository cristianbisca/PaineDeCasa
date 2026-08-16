// Genereaza toate secreturile stack-ului intr-un singur pas (fara dependinte).
// Foloseste:  node tools/generate-secrets.mjs > .env   (in local)
//              sau copiaza output-ul in editorul de variabile Portainer.
import { randomBytes, createHmac } from "node:crypto";

const b64url = (buf) =>
  buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const jwtSecret = b64url(randomBytes(48));

function signJwt(payload) {
  const h = b64url(Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const p = b64url(Buffer.from(JSON.stringify(payload)));
  const sig = b64url(createHmac("sha256", jwtSecret).update(`${h}.${p}`).digest());
  return `${h}.${p}.${sig}`;
}

const now = Math.floor(Date.now() / 1000);
const tenYears = now + 10 * 365 * 24 * 3600;
const claimOverrides = process.argv.slice(2);
const domainIdx = claimOverrides.indexOf("--domain");
const domain =
  domainIdx >= 0 && claimOverrides[domainIdx + 1]
    ? claimOverrides[domainIdx + 1]
    : null;

const lines = [
  "# Generat de tools/generate-secrets.mjs - NU publica aceste valori.",
  "POSTGRES_PASSWORD=" + b64url(randomBytes(24)),
  "JWT_SECRET=" + jwtSecret,
  "JWT_EXPIRY=3600",
  "PG_META_CRYPTO_KEY=" + randomBytes(36).toString("base64"),
  "ANON_KEY=" + signJwt({ role: "anon", iss: "painedecasa", iat: now, exp: tenYears }),
  "SERVICE_ROLE_KEY=" +
    signJwt({ role: "service_role", iss: "painedecasa", iat: now, exp: tenYears }),
  "POSTGRES_HOST=db",
  "POSTGRES_PORT=5432",
  "POSTGRES_DB=postgres",
];

if (domain) {
  lines.push(
    `PUBLIC_REST_URL=${domain}/rest`,
    `PUBLIC_STORAGE_URL=${domain}/storage`
  );
} else {
  lines.push("PUBLIC_REST_URL=http://localhost:3002");
  lines.push("PUBLIC_STORAGE_URL=http://localhost:5000");
}

lines.push("APP_PORT=3000", "REST_PORT=3002", "STORAGE_PORT=5000", "STUDIO_PORT=8080");

process.stdout.write(lines.join("\n") + "\n");
