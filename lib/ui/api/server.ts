import "server-only";

/**
 * Pembacaan E1, E2, E3, E6 dari Server Component.
 *
 * Saat mode contoh (`UI_FIXTURES`) menyala, pembacaan dialihkan ke fixture
 * statis. Saat mode produksi/pengembangan normal, fungsi di berkas ini
 * memanggil pemuat dan perakit jalur baca secara langsung di proses server
 * tanpa melompat lewat HTTP self-fetch (`x-forwarded-host`), sementara
 * komponen antarmuka tetap tidak tahu apa pun tentang basis data (seam S-1).
 */

import {
  muatDaftarTempat,
  muatFoto,
  muatJejak,
  muatState,
  muatTempat,
  muatTipeAtribut,
} from "@/app/api/places/muat";
import {
  idSah,
  LIMIT_BAWAAN,
  rakitJejakAudit,
  rakitRincian,
  rakitRingkasan,
} from "@/app/api/places/rakit";
import { muatAturan } from "@/lib/rules/muat";
import { profilPublik } from "@/lib/rules/profil";
import { UI_FIXTURES } from "../brand";
import {
  PROFILES,
  type ApiErrorBody,
  type AuditTrail,
  type PlaceDetail,
  type PlaceSummary,
  type ProfileCode,
  type ProfileInfo,
} from "./types";

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: ApiErrorBody | null,
  ) {
    super(body?.message ?? `Permintaan gagal (${status})`);
  }
}

async function readFixtureJson(path: string): Promise<Response> {
  const { fixtureFetch } = await import("./fixtures");
  return fixtureFetch(path);
}

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let body: ApiErrorBody | null = null;
    try {
      body = (await res.json()) as ApiErrorBody;
    } catch {}
    throw new ApiError(res.status, body);
  }
  return (await res.json()) as T;
}

/** Terima larik langsung, atau dibungkus satu kunci. */
function unwrap<T>(json: unknown, key: string): T[] {
  if (Array.isArray(json)) return json as T[];
  const inner = (json as Record<string, unknown> | null)?.[key];
  return Array.isArray(inner) ? (inner as T[]) : [];
}

export async function getPlaces(profile: ProfileCode): Promise<PlaceSummary[]> {
  if (UI_FIXTURES) {
    const res = await readFixtureJson(`/api/places?profile=${encodeURIComponent(profile)}`);
    return unwrap<PlaceSummary>(await parseJson(res), "places");
  }

  try {
    const [tempat, aturan, tipe] = await Promise.all([
      muatDaftarTempat(null, LIMIT_BAWAAN),
      muatAturan(),
      muatTipeAtribut(),
    ]);
    const states = await muatState(tempat.map((t) => t.id));
    return tempat.map((t) =>
      rakitRingkasan(
        t,
        states.filter((s) => s.place_id === t.id),
        tipe,
        profile,
        aturan,
      ),
    );
  } catch (e) {
    throw new ApiError(503, {
      code: "PLACES_UNAVAILABLE",
      message: e instanceof Error ? e.message : "Daftar tempat tidak dapat dibaca dari basis data.",
      measured: null,
      threshold: null,
    });
  }
}

/** null bila 404. */
export async function getPlace(id: string, profile: ProfileCode): Promise<PlaceDetail | null> {
  if (UI_FIXTURES) {
    const res = await readFixtureJson(`/api/places/${encodeURIComponent(id)}?profile=${encodeURIComponent(profile)}`);
    if (res.status === 404) return null;
    const place = await parseJson<PlaceDetail>(res);
    return { ...place, profile, attributes: place.attributes ?? [], notes: place.notes ?? [] };
  }

  if (!idSah(id)) return null;
  try {
    const tempat = await muatTempat(id);
    if (!tempat) return null;
    const [states, tipe, foto, aturan] = await Promise.all([
      muatState([id]),
      muatTipeAtribut(),
      muatFoto(id),
      muatAturan(),
    ]);
    return rakitRincian(tempat, states, tipe, foto, profile, aturan);
  } catch (e) {
    throw new ApiError(503, {
      code: "PLACES_UNAVAILABLE",
      message: e instanceof Error ? e.message : "Tempat tidak dapat dibaca dari basis data.",
      measured: null,
      threshold: null,
    });
  }
}

/**
 * Muat rincian satu tempat untuk seluruh profil sekaligus dalam satu gelombang
 * kueri basis data (5 kueri total, bukan 3x5 kueri).
 */
export async function getPlaceByProfiles(id: string): Promise<Record<ProfileCode, PlaceDetail> | null> {
  if (UI_FIXTURES) {
    const results = await Promise.all(PROFILES.map((p) => getPlace(id, p)));
    if (!results[0]) return null;
    return Object.fromEntries(PROFILES.map((p, i) => [p, results[i]!])) as Record<ProfileCode, PlaceDetail>;
  }

  if (!idSah(id)) return null;
  try {
    const tempat = await muatTempat(id);
    if (!tempat) return null;
    const [states, tipe, foto, aturan] = await Promise.all([
      muatState([id]),
      muatTipeAtribut(),
      muatFoto(id),
      muatAturan(),
    ]);
    return Object.fromEntries(
      PROFILES.map((p) => [p, rakitRincian(tempat, states, tipe, foto, p, aturan)]),
    ) as Record<ProfileCode, PlaceDetail>;
  } catch (e) {
    throw new ApiError(503, {
      code: "PLACES_UNAVAILABLE",
      message: e instanceof Error ? e.message : "Tempat tidak dapat dibaca dari basis data.",
      measured: null,
      threshold: null,
    });
  }
}

/**
 * Fakta tempat tanpa penilaian — untuk layar yang URL-nya tidak membawa
 * profil (rincian atribut, alur kontribusi). E2 mewajibkan `profile`, jadi
 * dipakai profil tetap dan penilaiannya disembunyikan dari tipe.
 */
export async function getPlaceFacts(id: string): Promise<Omit<PlaceDetail, "verdict" | "notes" | "profile"> | null> {
  return getPlace(id, "kursi_roda_manual");
}

export async function getAudit(placeId: string, code: string): Promise<AuditTrail | null> {
  if (UI_FIXTURES) {
    const res = await readFixtureJson(
      `/api/places/${encodeURIComponent(placeId)}/attributes/${encodeURIComponent(code)}/audit`,
    );
    if (res.status === 404) return null;
    const trail = await parseJson<AuditTrail>(res);
    return { ...trail, entries: trail.entries ?? [] };
  }

  if (!idSah(placeId)) return null;
  try {
    const [tempat, tipe] = await Promise.all([muatTempat(placeId), muatTipeAtribut()]);
    if (!tempat) return null;
    const atribut = tipe.find((t) => t.code === code);
    if (!atribut) return null;

    const [states, bahan] = await Promise.all([
      muatState([placeId]),
      muatJejak(placeId, code, atribut.vantage),
    ]);
    return rakitJejakAudit({
      tempat,
      atribut,
      state: states.find((s) => s.attribute_code === code) ?? null,
      ...bahan,
    });
  } catch (e) {
    throw new ApiError(503, {
      code: "AUDIT_UNAVAILABLE",
      message: e instanceof Error ? e.message : "Jejak audit tidak dapat dibaca dari basis data.",
      measured: null,
      threshold: null,
    });
  }
}

export async function getProfiles(): Promise<ProfileInfo[]> {
  if (UI_FIXTURES) {
    const res = await readFixtureJson("/api/profiles");
    return unwrap<ProfileInfo>(await parseJson(res), "profiles");
  }

  try {
    const { rules, minimum } = await muatAturan();
    return profilPublik(rules, minimum);
  } catch (e) {
    throw new ApiError(503, {
      code: "RULES_UNAVAILABLE",
      message: e instanceof Error ? e.message : "Aturan profil tidak dapat dibaca dari basis data.",
      measured: null,
      threshold: null,
    });
  }
}
