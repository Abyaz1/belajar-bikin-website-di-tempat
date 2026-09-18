import "server-only";

// Nama harus sama dengan .env.example.
type NamaEnv =
  | "GCP_PROJECT_ID"
  | "GCP_REGION"
  | "VERTEX_LOCATION"
  | "VERTEX_MODEL"
  | "CLOUD_SQL_CONNECTION_NAME"
  | "DB_NAME"
  | "DB_USER"
  | "DB_PASSWORD"
  | "GCS_BUCKET";

export function envWajib(nama: NamaEnv): string {
  const nilai = process.env[nama];
  if (!nilai) throw new Error(`Env ${nama} belum diisi; lihat .env.example.`);
  return nilai;
}
