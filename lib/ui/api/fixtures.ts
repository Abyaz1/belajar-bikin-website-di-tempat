/**
 * DATA CONTOH untuk mengembangkan antarmuka sebelum E1–E8 siap.
 *
 * Hanya aktif kalau NEXT_PUBLIC_UI_FIXTURES=1, dan setiap halaman lalu
 * menampilkan bilah peringatan. Semua nama tempat diberi awalan "[Contoh]".
 * Ini BUKAN data demonstrasi produk (`is_demo_seed`) — yang itu disemai ke
 * basis data dan tampil berlabel. Yang ini tidak pernah boleh sampai ke demo.
 *
 * Tidak ada logika aturan di sini: penilaian ditulis tangan per profil,
 * mengikuti tabel test case wajib di spek 20 §2.4.
 */

import type {
  ApiErrorBody,
  AttributeDetail,
  AuditEntry,
  CheckOutcome,
  PlaceDetail,
  PlaceSummary,
  ProfileCode,
  ProfileInfo,
  Vantage,
  Verdict,
  VerdictNote,
} from "./types";

type Attr = Partial<AttributeDetail> & { code: string };

interface FixturePlace {
  id: string;
  name: string;
  category: string;
  address: string | null;
  lat: number;
  lon: number;
  is_demo_seed: boolean;
  attrs: Attr[];
  verdicts: Record<ProfileCode, { verdict: Verdict; notes?: VerdictNote[]; unknown?: string[] }>;
  third_party_claims?: Record<string, string>;
}

const D = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString();
const plusDays = (iso: string, days: number) => new Date(new Date(iso).getTime() + days * 86_400_000).toISOString();

function verified(code: string, value: string, daysAgo: number, extra: Partial<AttributeDetail> = {}): Attr {
  const at = D(daysAgo);
  return {
    code,
    current_value: value,
    status: "terverifikasi",
    last_verified_at: at,
    next_review_at: plusDays(at, code === "elevator_status" ? 90 : 365),
    corroboration_count: 1,
    source: "contribution",
    photo_url: PHOTO,
    ...extra,
  };
}

const PHOTO =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 240"><rect width="320" height="240" fill="#d6d9de"/><rect x="110" y="40" width="100" height="150" fill="#5a6068"/><rect x="60" y="190" width="200" height="16" fill="#767d86"/><rect x="40" y="206" width="240" height="16" fill="#414851"/><text x="160" y="24" font-family="sans-serif" font-size="16" text-anchor="middle" fill="#17191c">FOTO CONTOH</text></svg>`,
  );

const MIN: Record<ProfileCode, string[]> = {
  kursi_roda_manual: ["step_count", "ramp_wheelchair", "door_width_band", "kerb", "surface_condition"],
  alat_bantu_jalan: ["step_count", "ramp_wheelchair", "kerb", "surface_condition"],
  netra: ["kerb", "tactile_paving", "surface_condition"],
};

const allUnknown = (p: ProfileCode) => ({ verdict: "belum_dapat_dipastikan" as const, unknown: MIN[p] });

const STEP_NOTE = (verdict: "blocker" | "caution"): VerdictNote => ({
  rule_id: verdict === "blocker" ? "kursi_tangga_tanpa_ramp" : "alat_tangga_tanpa_ramp",
  verdict,
  message: "Pintu masuk ini punya dua anak tangga tanpa ramp.",
});

export const FIXTURE_PLACES: FixturePlace[] = [
  {
    id: "contoh-gedung-serba-guna",
    name: "[Contoh] Gedung Serba Guna Kampus",
    category: "kampus",
    address: "Jl. Contoh No. 1, Bandung",
    lat: -6.8906,
    lon: 107.6159,
    is_demo_seed: false,
    attrs: [
      verified("step_count", "2", 3),
      verified("ramp_wheelchair", "no", 3),
      verified("kerb", "lowered", 3),
      verified("door_width_band", "gt90", 3),
      verified("surface_condition", "good", 3),
      verified("tactile_paving", "yes", 3),
    ],
    verdicts: {
      kursi_roda_manual: { verdict: "tidak_dapat_diakses", notes: [STEP_NOTE("blocker")] },
      alat_bantu_jalan: { verdict: "dengan_catatan", notes: [STEP_NOTE("caution")] },
      netra: { verdict: "dapat_diakses" },
    },
  },
  {
    id: "contoh-perpustakaan",
    name: "[Contoh] Perpustakaan Pusat",
    category: "kampus",
    address: "Jl. Contoh No. 5, Bandung",
    lat: -6.8889,
    lon: 107.6108,
    is_demo_seed: true,
    attrs: [
      verified("step_count", "0", 20, { corroboration_count: 2, is_demo_seed: true }),
      verified("ramp_wheelchair", "yes", 20, { corroboration_count: 2, is_demo_seed: true }),
      verified("kerb", "flush", 20, { is_demo_seed: true }),
      verified("door_width_band", "gt90", 20, { is_demo_seed: true }),
      verified("surface_condition", "good", 20, { is_demo_seed: true }),
      verified("tactile_paving", "no", 2, {
        is_demo_seed: true,
        is_disputed: true,
        previous_value: "yes",
        previous_observed_at: D(40),
      }),
      {
        ...verified("elevator_status", "working", 130, { is_demo_seed: true }),
        status: "perlu_ditinjau_ulang",
      },
    ],
    verdicts: {
      kursi_roda_manual: { verdict: "dapat_diakses" },
      alat_bantu_jalan: { verdict: "dapat_diakses" },
      netra: {
        verdict: "dengan_catatan",
        notes: [{ rule_id: "netra_tanpa_jalur_pemandu", verdict: "caution", message: "Tidak ada jalur pemandu menuju pintu masuk ini." }],
      },
    },
  },
  {
    id: "contoh-puskesmas",
    name: "[Contoh] Puskesmas Kelurahan",
    category: "fasilitas kesehatan",
    address: null,
    lat: -6.8871,
    lon: 107.6181,
    is_demo_seed: false,
    attrs: [
      verified("step_count", "0", 1),
      verified("ramp_wheelchair", "yes", 1),
      { code: "kerb", current_value: "raised", status: "belum_terverifikasi", source: "osm_seed" },
    ],
    third_party_claims: { wheelchair: "yes" },
    verdicts: {
      kursi_roda_manual: { verdict: "belum_dapat_dipastikan", unknown: ["door_width_band", "kerb", "surface_condition"] },
      alat_bantu_jalan: { verdict: "belum_dapat_dipastikan", unknown: ["kerb", "surface_condition"] },
      netra: { verdict: "belum_dapat_dipastikan", unknown: ["kerb", "tactile_paving", "surface_condition"] },
    },
  },
  ...["Halte Dipatiukur", "Halte Dago Atas", "Klinik Pratama", "Gedung Kuliah Timur", "Masjid Kampus"].map(
    (n, i): FixturePlace => ({
      id: `contoh-${i + 1}`,
      name: `[Contoh] ${n}`,
      category: n.startsWith("Halte") ? "halte" : n.startsWith("Klinik") ? "fasilitas kesehatan" : "kampus",
      address: null,
      lat: -6.892 + i * 0.0012,
      lon: 107.613 + i * 0.0009,
      is_demo_seed: false,
      attrs: [],
      verdicts: { kursi_roda_manual: allUnknown("kursi_roda_manual"), alat_bantu_jalan: allUnknown("alat_bantu_jalan"), netra: allUnknown("netra") },
    }),
  ),
];

const ALL_CODES = [
  "step_count",
  "ramp_wheelchair",
  "kerb",
  "door_width_band",
  "surface_condition",
  "tactile_paving",
  "elevator_status",
  "toilets_wheelchair",
];

function attributes(p: FixturePlace): AttributeDetail[] {
  return ALL_CODES.map((code) => {
    const a = p.attrs.find((x) => x.code === code);
    return {
      code,
      label: "",
      current_value: null,
      status: "belum_terverifikasi",
      is_disputed: false,
      previous_value: null,
      previous_observed_at: null,
      corroboration_count: 0,
      last_verified_at: null,
      next_review_at: null,
      source: null,
      photo_url: null,
      photo_alt: a?.photo_url ? `Foto pintu masuk ${p.name}, bukti untuk atribut ${code}` : null,
      is_demo_seed: false,
      audit_url: `/api/places/${p.id}/attributes/${code}/audit`,
      ...a,
    } as AttributeDetail;
  });
}

function summary(p: FixturePlace, profile: ProfileCode): PlaceSummary {
  const attrs = attributes(p);
  const v = p.verdicts[profile];
  return {
    id: p.id,
    name: p.name,
    category: p.category,
    lat: p.lat,
    lon: p.lon,
    source: "osm_seed",
    verdict: v.verdict,
    status_counts: {
      terverifikasi: attrs.filter((a) => a.status === "terverifikasi").length,
      belum_terverifikasi: attrs.filter((a) => a.status === "belum_terverifikasi").length,
      perlu_ditinjau_ulang: attrs.filter((a) => a.status === "perlu_ditinjau_ulang").length,
    },
    unknown_attributes: v.unknown ?? [],
    freshness_notes: attrs
      .filter((a) => a.status === "perlu_ditinjau_ulang")
      .map((a) => ({ attribute_code: a.code, last_verified_at: a.last_verified_at, next_review_at: a.next_review_at })),
    is_demo_seed: p.is_demo_seed,
  };
}

function detail(p: FixturePlace, profile: ProfileCode): PlaceDetail {
  const s = summary(p, profile);
  return {
    ...s,
    address: p.address,
    profile,
    notes: p.verdicts[profile].notes ?? [],
    attributes: attributes(p),
  };
}

const PASS = (code: string, measured: string | null = null, threshold: string | null = null): CheckOutcome => ({
  code,
  result: "pass",
  measured,
  threshold,
});

function audit(p: FixturePlace, code: string) {
  const a = attributes(p).find((x) => x.code === code)!;
  const entries: AuditEntry[] = [];
  if (a.status !== "belum_terverifikasi") {
    const at = a.last_verified_at!;
    entries.push(
      {
        id: "e1",
        at: D(9),
        action: "provenance_failed",
        actor: "Kontributor #4",
        checks: [
          PASS("C0"),
          PASS("C1", "2", "10"),
          { code: "C3", result: "fail", measured: "EXIF, tag GPS", threshold: null },
          PASS("C4", "12", "180"),
          PASS("C5"),
          PASS("C6", "22", "150"),
          PASS("C6b", "8", "60"),
          { code: "C7", result: "fail", measured: "214", threshold: "120" },
          PASS("C8", "31", "2"),
        ],
        before: null,
        after: null,
        evidence: { id: "ev0", photo_url: null, distance_to_place_m: 214, client_accuracy_m: 22, captured_at: D(9), capture_method: "galeri" },
        is_demo_seed: false,
      },
      {
        id: "e2",
        at,
        action: "evidence_submitted",
        actor: "Kontributor #7",
        checks: [
          PASS("C0"),
          PASS("C1", "1", "10"),
          PASS("C3"),
          PASS("C4", "9", "180"),
          PASS("C5"),
          PASS("C6", "18", "150"),
          PASS("C6b", "4", "60"),
          PASS("C7", "31", "93"),
          PASS("C8", "28", "2"),
        ],
        before: null,
        after: null,
        evidence: { id: "ev1", photo_url: PHOTO, distance_to_place_m: 31, client_accuracy_m: 18, captured_at: at, capture_method: "getusermedia" },
        is_demo_seed: a.is_demo_seed,
      },
      {
        id: "e3",
        at,
        action: "observation_confirmed",
        actor: "Kontributor #7",
        checks: [],
        before: null,
        after: null,
        ai_suggested_value: code === "step_count" ? a.current_value : null,
        confirmed_value: a.current_value,
        is_demo_seed: a.is_demo_seed,
      },
      {
        id: "e4",
        at,
        action: "state_updated",
        actor: "system",
        checks: [],
        before: a.previous_value,
        after: a.current_value,
        is_demo_seed: a.is_demo_seed,
      },
    );
  }
  return {
    place: { id: p.id, name: p.name },
    attribute: { code, label: "" },
    entries,
    third_party_claims: p.third_party_claims ?? null,
    is_demo_seed: a.is_demo_seed,
  };
}

const PROFILE_INFO: ProfileInfo[] = [
  {
    code: "kursi_roda_manual",
    label: "Kursi roda manual",
    rule_groups: [
      { id: "kursi_tangga_tanpa_ramp", verdict: "blocker", message: "Ada anak tangga tanpa ramp.", conditions: [
        { subject_type: "attribute", subject_code: "step_count", operator: "gte", value: "1" },
        { subject_type: "attribute", subject_code: "ramp_wheelchair", operator: "neq", value: "yes" },
      ] },
      { id: "kursi_pintu_sempit", verdict: "blocker", message: "Pintu kurang dari 80 cm.", conditions: [
        { subject_type: "attribute", subject_code: "door_width_band", operator: "eq", value: "lt80" },
      ] },
      { id: "kursi_kerb_tinggi", verdict: "blocker", message: "Tepi trotoar tinggi.", conditions: [
        { subject_type: "attribute", subject_code: "kerb", operator: "eq", value: "raised" },
      ] },
      { id: "kursi_lift_mati", verdict: "blocker", message: "Lift mati, layanan di atas lantai dasar.", conditions: [
        { subject_type: "attribute", subject_code: "elevator_status", operator: "eq", value: "not_working" },
        { subject_type: "place_property", subject_code: "layanan_di_atas_lantai_dasar", operator: "eq", value: "true" },
      ] },
      { id: "kursi_permukaan_buruk", verdict: "caution", message: "Permukaan tidak rata atau rusak.", conditions: [
        { subject_type: "attribute", subject_code: "surface_condition", operator: "in", value: "uneven,damaged" },
      ] },
    ],
    minimum_attributes: [
      ...MIN.kursi_roda_manual.map((c) => ({ attribute_code: c, required_when_property: null, required_when_value: null })),
      { attribute_code: "elevator_status", required_when_property: "layanan_di_atas_lantai_dasar", required_when_value: "true" },
    ],
  },
  {
    code: "alat_bantu_jalan",
    label: "Alat bantu jalan",
    rule_groups: [
      { id: "alat_tangga_tanpa_ramp", verdict: "caution", message: "Ada anak tangga tanpa ramp.", conditions: [
        { subject_type: "attribute", subject_code: "step_count", operator: "gte", value: "1" },
        { subject_type: "attribute", subject_code: "ramp_wheelchair", operator: "neq", value: "yes" },
      ] },
      { id: "alat_kerb_tinggi", verdict: "caution", message: "Tepi trotoar tinggi.", conditions: [
        { subject_type: "attribute", subject_code: "kerb", operator: "eq", value: "raised" },
      ] },
      { id: "alat_lift_mati", verdict: "caution", message: "Lift mati, layanan di atas lantai dasar.", conditions: [
        { subject_type: "attribute", subject_code: "elevator_status", operator: "eq", value: "not_working" },
        { subject_type: "place_property", subject_code: "layanan_di_atas_lantai_dasar", operator: "eq", value: "true" },
      ] },
      { id: "alat_permukaan_buruk", verdict: "caution", message: "Permukaan tidak rata atau rusak.", conditions: [
        { subject_type: "attribute", subject_code: "surface_condition", operator: "in", value: "uneven,damaged" },
      ] },
    ],
    minimum_attributes: [
      ...MIN.alat_bantu_jalan.map((c) => ({ attribute_code: c, required_when_property: null, required_when_value: null })),
      { attribute_code: "elevator_status", required_when_property: "layanan_di_atas_lantai_dasar", required_when_value: "true" },
    ],
  },
  {
    code: "netra",
    label: "Netra",
    rule_groups: [
      { id: "netra_kerb_tinggi", verdict: "caution", message: "Tepi trotoar tinggi.", conditions: [
        { subject_type: "attribute", subject_code: "kerb", operator: "eq", value: "raised" },
      ] },
      { id: "netra_tanpa_jalur_pemandu", verdict: "caution", message: "Tidak ada jalur pemandu.", conditions: [
        { subject_type: "attribute", subject_code: "tactile_paving", operator: "eq", value: "no" },
      ] },
      { id: "netra_permukaan_buruk", verdict: "caution", message: "Permukaan tidak rata atau rusak.", conditions: [
        { subject_type: "attribute", subject_code: "surface_condition", operator: "in", value: "uneven,damaged" },
      ] },
    ],
    minimum_attributes: MIN.netra.map((c) => ({ attribute_code: c, required_when_property: null, required_when_value: null })),
  },
];

const CLAIMABLE: Record<Vantage, { attribute_code: string; required: boolean }[]> = {
  entrance: [
    { attribute_code: "step_count", required: true },
    { attribute_code: "ramp_wheelchair", required: true },
    { attribute_code: "kerb", required: false },
    { attribute_code: "door_width_band", required: false },
    { attribute_code: "surface_condition", required: false },
    { attribute_code: "tactile_paving", required: false },
  ],
  interior: [{ attribute_code: "elevator_status", required: false }],
  toilet: [{ attribute_code: "toilets_wheelchair", required: false }],
};

// Ingatan sementara di memori tab, untuk mensimulasikan C8 di mode contoh.
const seenSizes = new Set<number>();

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function err(code: string, message: string, measured: string | null = null, threshold: string | null = null): ApiErrorBody {
  return { code, message, measured, threshold };
}

/** Pengganti `fetch` untuk mode contoh. Jalur dan bentuknya meniru E1–E8. */
export async function fixtureFetch(path: string, init?: RequestInit): Promise<Response> {
  const url = new URL(path, "http://contoh.local");
  const method = (init?.method ?? "GET").toUpperCase();
  const profile = url.searchParams.get("profile") as ProfileCode | null;
  const seg = url.pathname.split("/").filter(Boolean); // ["api", ...]
  await new Promise((r) => setTimeout(r, 250));

  if (method === "GET" && seg[1] === "places" && seg.length === 2) {
    if (!profile) return json(err("PROFILE_REQUIRED", "Parameter profile wajib."), 400);
    return json(FIXTURE_PLACES.map((p) => summary(p, profile)));
  }
  if (method === "GET" && seg[1] === "places" && seg.length === 3) {
    const p = FIXTURE_PLACES.find((x) => x.id === seg[2]);
    if (!p) return json(err("NOT_FOUND", "Tempat tidak ditemukan."), 404);
    if (!profile) return json(err("PROFILE_REQUIRED", "Parameter profile wajib."), 400);
    return json(detail(p, profile));
  }
  if (method === "GET" && seg[1] === "places" && seg[3] === "attributes" && seg[5] === "audit") {
    const p = FIXTURE_PLACES.find((x) => x.id === seg[2]);
    if (!p) return json(err("NOT_FOUND", "Tempat tidak ditemukan."), 404);
    return json(audit(p, seg[4]));
  }
  if (method === "GET" && seg[1] === "profiles") return json(PROFILE_INFO);

  if (method === "POST" && seg[1] === "session") return json({ contributor_id: "contoh", display_handle: "Kontributor #contoh" });

  if (method === "POST" && seg[1] === "capture-sessions") {
    const body = JSON.parse(String(init?.body ?? "{}"));
    const vantage = body.vantage as Vantage;
    return json({
      token: `contoh-${Math.random().toString(36).slice(2)}`,
      expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
      claimable: CLAIMABLE[vantage] ?? [],
    });
  }

  if (method === "POST" && seg[1] === "contributions" && seg[2] === "draft") {
    const form = init?.body as FormData;
    const place = FIXTURE_PLACES.find((x) => x.id === form.get("place_id"));
    const vantage = form.get("vantage") as Vantage;
    const scenario = String(form.get("ui_fixture_scenario") ?? "");
    const image = form.get("file") as Blob | null;
    const errors: ApiErrorBody[] = [];
    if (form.get("capture_method") === "galeri")
      errors.push(err("FILE_METADATA_PRESENT", "Berkas ini tampak berasal dari galeri, bukan dari kamera aplikasi", "EXIF", null));
    if (!form.get("client_lat")) errors.push(err("GEO_MISSING", "Izin lokasi diperlukan untuk memverifikasi kontribusi"));
    if (scenario === "lokasi_lain")
      errors.push(err("GEO_TOO_FAR", "Lokasi pengambilan terlalu jauh dari tempat yang dipilih", "214 m", "120 m"));
    if (image && seenSizes.has(image.size))
      errors.push(err("DUPLICATE_IMAGE", "Foto ini sudah pernah dikirim sebelumnya", "hamming 0", "hamming 2"));
    if (image) seenSizes.add(image.size);
    if (errors.length) return json({ errors }, 422);

    const claimable = CLAIMABLE[vantage] ?? [];
    const modelFails = place?.id === "contoh-2";
    return json({
      draft_id: `draft-${Math.random().toString(36).slice(2)}`,
      checks: [
        PASS("C0"),
        PASS("C1", "1", "10"),
        PASS("C3"),
        PASS("C4", "6", "180"),
        PASS("C5"),
        PASS("C6", "19", "150"),
        PASS("C6b", "3", "60"),
        { code: "C7", result: "flag", measured: "101", threshold: "94" },
        PASS("C8", "30", "2"),
      ],
      suggestions: modelFails
        ? []
        : vantage === "entrance"
          ? [
              { attribute_code: "step_count", value: "2", active: true },
              { attribute_code: "ramp_wheelchair", value: "no", active: true },
              { attribute_code: "tactile_paving", value: "not_visible", active: true },
            ]
          : [],
      claimable,
      model_status: modelFails ? "timeout" : "ok",
    });
  }

  if (method === "POST" && seg[1] === "contributions" && seg[3] === "confirm") {
    const items = JSON.parse(String(init?.body ?? "[]")) as { attribute_code: string; confirmed_value: string }[];
    return json({
      changes: items
        .filter((i) => i.confirmed_value !== "not_visible")
        .map((i) => ({
          attribute_code: i.attribute_code,
          before: i.attribute_code === "ramp_wheelchair" ? { current_value: "yes" } : null,
          after: {
            current_value: i.confirmed_value,
            is_disputed: i.attribute_code === "ramp_wheelchair" && i.confirmed_value !== "yes",
            corroboration_count: 1,
          },
        })),
    });
  }

  return json(err("NOT_FOUND", `Jalur contoh tidak dikenal: ${method} ${url.pathname}`), 404);
}
