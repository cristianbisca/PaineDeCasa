FROM postgres:16-alpine
COPY volumes/db/migrations/98-paine-de-casa.sql /sql/db.sql
COPY volumes/db/init-scripts/90-pdc-roles.sql /sql/roles.sql
COPY volumes/storage-init/init.sql /sql/storage.sql
ENTRYPOINT ["psql"]
