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
| `meta`      | `supabase/postgres-meta`                    |
| `studio`    | `supabase/studio` (dashboard optional)      |
| `db-init` / `storage-init` | job-uri o singura data (schema + bucket) |

Toata logica de afaceri (generezi cod, validari, PIN, RLS) e in bazo de date,
in functii SQL din `volumes/db/migrations/98-paine-de-casa.sql`.

## Pornire locala

```bash
cp .env.example .env      # apoi umple secreturile (vezi mai jos)
docker compose up -d
```

- Aplicatiie: http://localhost:3000
- Panou brutar: http://localhost:3000/admin
- API: http://localhost:3002
- Storage: http://localhost:5000
- Studio: http://localhost:8080

### Secreturi

Generezi o data o singura:

```bash
# JWT_SECRET (>=32 caractere)
openssl rand -base64 36
# ANON_KEY si SERVICE_ROLE_KEY: JWT-uri semnate HS256 cu JWT_SECRET.
# Pe un proiect Supabase (managed) le gasesti in Dashboard -> Settings -> API.
```

La prima pornire aplica un PIN aleator de 6 cifre pentru brutar.
`POSTGRES_PASSWORD`, `PG_META_CRYPTO_KEY` si `JWT_SECRET` trebuie sa ramana
stabile intre restarturi ca sa nu fii blocat.

### Afla PIN-ul initial

```bash
docker compose exec db psql -U postgres -d postgres \
  -c "select value from app_config where key='baker_pin';"
```

## Deploy in Portainer (din git)

1. Publica acest repo pe GitHub/GitLab.
2. In Portainer: **Stacks -> Add stack -> Git**, pune URL-ul repoului.
3. In secziua de variabile de mediu, define si valorile din `.env`
   (`POSTGRES_PASSWORD`, `JWT_SECRET`, `PG_META_CRYPTO_KEY`,
   `ANON_KEY`, `SERVICE_ROLE_KEY`, `PUBLIC_REST_URL`,
   `PUBLIC_STORAGE_URL`, porturile).
4. **Deploy the stack**.

Pentru acces de pe telefon, `PUBLIC_REST_URL` si `PUBLIC_STORAGE_URL` trebuie
sa fie adresa publica a serverului (ex: `http://<ip>:3002`), nu `localhost`.

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
