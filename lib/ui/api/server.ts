import "server-only";

/**
 * Pembacaan E1, E2, E3, E6 dari Server Component.
 *
 * Fungsi di berkas ini memanggil pemuat dan perakit jalur baca secara langsung
 * di proses server (dibungkus React.cache untuk deduplikasi antara
 * generateMetadata dan Page dalam satu request), sementara komponen antarmuka
 * tetap tidak tahu apa pun tentang basis data (seam S-1).
 */

import { cache } from "react";
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

export const getPlaces = cache(async function getPlaces(profile: ProfileCode): Promise<PlaceSummary[]> {
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
});

/**
 * Muat rincian satu tempat untuk seluruh profil sekaligus dalam satu gelombang
 * kueri basis data (5 kueri total, bukan 3x5 kueri).
 */
export const getPlaceByProfiles = cache(async function getPlaceByProfiles(
  id: string,
): Promise<Record<ProfileCode, PlaceDetail> | null> {
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
});

/** null bila 404. */
export const getPlace = cache(async function getPlace(
  id: string,
  profile: ProfileCode,
): Promise<PlaceDetail | null> {
  const byProfile = await getPlaceByProfiles(id);
  return byProfile?.[profile] ?? null;
});

/**
 * Fakta tempat tanpa penilaian — untuk layar yang URL-nya tidak membawa
 * profil (rincian atribut, alur kontribusi).
 */
export const getPlaceFacts = cache(async function getPlaceFacts(
  id: string,
): Promise<Omit<PlaceDetail, "verdict" | "notes" | "profile"> | null> {
  return getPlace(id, "kursi_roda_manual");
});

export const getAudit = cache(async function getAudit(
  placeId: string,
  code: string,
): Promise<AuditTrail | null> {
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
});

export const getProfiles = cache(async function getProfiles(): Promise<ProfileInfo[]> {
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
});
