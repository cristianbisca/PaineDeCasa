-- Set passwords for the roles this stack actually uses.
-- Runs during first init (as part of 00-schema setup ordering: after roles exist).
-- Values come from PGPASSWORD (exported to :'pgpass' parameter by the entrypoint).
\set pgpass `echo $POSTGRES_PASSWORD`

ALTER USER supabase_admin WITH PASSWORD :'pgpass';
ALTER USER authenticator WITH PASSWORD :'pgpass';
ALTER USER supabase_storage_admin WITH PASSWORD :'pgpass';
ALTER USER postgres WITH SUPERUSER PASSWORD :'pgpass';
