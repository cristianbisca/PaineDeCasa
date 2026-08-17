# Paine de Casa

Aplicatie mica pentru gestionarea comenzilor de paine artesana.

- **Clientii** comanda online (fara cont, fara platesti) si primesti un cod de 6
  caractere cu care pot verifica statusul comenzii („în așteptare" / „livrata").
- **Brutarul** are un panou protejat cu PIN: vede comenzile, le marcheaza ca
  livrate, vede cantitatile de pregatit si gestioneaza catalogul.
- Fără date personale sensibile: nume, telefon, adresa. Fără plata online.

## Arhitectura

| Serviciu    | Imagen                                      |
|-------------|---------------------------------------------|
| `app`       | Next.js (acest repo, `Dockerfile`)          |
| `db`        | `supabase/postgres` (baza + extensii)       |
| `rest`      | `postgrest/postgrest` (API JSON pe Postgres) |
| `storage`   | `supabase/storage-api` (imagini paini)      |
| `db-init` / `storage-init` | job-uri o singura data (schema + bucket) |

Toata logica de afaceri (generezi cod, validari, PIN, RLS) e in baza de date,
in functii SQL din `volumes/db/migrations/98-paine-de-casa.sql`.

## Pornire locala

```bash
cp .env.example .env      # apoi umple secreturile (vezi mai jos)
docker compose up -d
```

- Aplicatie: http://localhost:4500
- Panou brutar: http://localhost:4500/admin
- API: http://localhost:4502
- Storage: http://localhost:4510
- DB (psql): localhost:4532

Porturile publicate folosesc blocul 45XX ca sa nu conflictuiesca cu
celelalte aplicatii de pe server (ele ruleaza in host mode: 4400 sesizari,
4300 price-monitor, 5432/5000 lemn360 etc.).

### Secreturi

Generezi o singura data cu:

```bash
node tools/generate-secrets.mjs --domain https://<domeniu>
```

Output-ul contine toate cheile (`POSTGRES_PASSWORD`, `JWT_SECRET`,
`ANON_KEY`, `SERVICE_ROLE_KEY`, URL-urile publice si porturile), gata de pus
in `.env` (local) sau in editorul de variabile Portainer.
Fara `--domain` foloseste `localhost` (potrivit pentru dezvoltare).

La prima pornire aplica un PIN aleator de 6 cifre pentru brutar.
`POSTGRES_PASSWORD` si `JWT_SECRET` trebuie sa ramana **stabile** intre
restarturi — daca le schimbi, baza de date si cheile JWT nu mai functioneaza
(trebuie reinitializate volumele).

### Afla PIN-ul initial

```bash
docker compose exec db psql -U postgres -d postgres \
  -c "select value from app_config where key='baker_pin';"
```

## Deploy in Portainer (din git)

1. In Portainer: **Stacks -> Add stack -> Git** -> `https://github.com/cristianbisca/PaineDeCasa`.
2. In editorul de **env variables** din Portainer, adauga exact aceaste chei:

   | Cheie | Din |
   |-------|-----|
   | `POSTGRES_PASSWORD` | `node tools/generate-secrets.mjs` |
   | `JWT_SECRET` | idem |
   | `JWT_EXPIRY` | `3600` |
    | `ANON_KEY` | idem |
   | `SERVICE_ROLE_KEY` | idem |
   | `PUBLIC_REST_URL` | `https://<domeniu>/rest` (vezi nginx) |
   | `PUBLIC_STORAGE_URL` | `https://<domeniu>/storage` |
    | `APP_PORT` / `REST_PORT` / `STORAGE_PORT` / `DB_PORT` | `4500` / `4502` / `4510` / `4532` |

    `POSTGRES_PASSWORD` si `JWT_SECRET` trebuie sa ramana **stabile** intre
    restarturi (schimbarea lor blocheaza baza de date).
3. **Deploy the stack** (Portainer face clone + build automat).

## nginx (reverse proxy)

Aplicatia, API-ul si storage-ul raman pe porturile lor; nginx le expune pe un
singur domeniu, cu HTTPS. `PUBLIC_REST_URL` / `PUBLIC_STORAGE_URL` trebuie sa
fie adresele publice cu sufixele `/rest` si `/storage`:

```nginx
server {
    listen 443 ssl http2;
    server_name paine.example.ro;

    ssl_certificate     /etc/letsencrypt/live/paine.example.ro/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/paine.example.ro/privkey.pem;

    client_max_body_size 60m;   # incarcarea pozelor

    # API PostgREST
    location /rest/ {
        proxy_pass http://127.0.0.1:4502/;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Storage (poze paini)
    location /storage/ {
        proxy_pass http://127.0.0.1:4510/;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Aplicatia
    location / {
        proxy_pass http://127.0.0.1:4500;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Stack-ul nu mai contine `studio` (dashboard-ul Supabase pentru baza de date)
nici `meta` (serviciul de metadata folosit doar de Studio) — aplicatia
functioneaza fara ele, iar panoul brutar ramane la `https://<domeniu>/admin`.

Daca vrei totusi dashboard-ul DB: adaugi inapoi serviciile `meta` si `studio`
(vezi istoricul git), pe un subdomeniu propriu — nu ruleaza sub sub-path —
cu allow doar pe IP-urile tale.

In firewall lasa deschise doar 443/80; porturile `4500/4502/4510/4532` raman
doar pentru nginx (local).

### Note importante

- `app` citeste `ANON_KEY`, `PUBLIC_REST_URL`, `PUBLIC_STORAGE_URL` la
  runtime si le serveste pe `/api/config` — nu sunt embedd la build.
- Porturile sunt expuse ca sa functioneze din browser; pe server poate sa
  le pui la un reverse proxy si sa tii doar `app` publice.
- Datele sunt in volume Docker: `db-data`, `db-config`, `storage-files`.
  Backup = `docker run --rm -v painedecasa_db-data:/d alpine tar cf - /d`.

## Structura

```
src/app/page.tsx        pagina clientului (comanda)
src/app/o/[code]        statusul comenzii dupa cod
src/app/admin           panoul brutar (PIN)
src/lib/api.ts          client HTTP pentru PostgREST + Storage
volumes/db/migrations/  schema + functii SQL (toata logica)
docker-compose.yml      stack-ul complet
```
