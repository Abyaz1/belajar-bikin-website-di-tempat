// Keadaan "memuat" untuk daftar dan laporan tempat.
export default function Loading() {
  return (
    <div className="space-y-4">
      <p role="status" className="text-card">
        Memuat data tempat…
      </p>
      <div aria-hidden="true" className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 rounded-md border border-line bg-surface-alt" />
        ))}
      </div>
    </div>
  );
}
