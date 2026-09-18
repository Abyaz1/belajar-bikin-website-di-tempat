import { GeoWatch } from "@/lib/ui/geo";

// Pemantauan GPS dimulai begitu layar pilih titik pandang (L7) dibuka dan
// bertahan saat pindah ke layar kamera — layout ini tidak dipasang ulang
// selama navigasi di dalam /kontribusi/{tempatId}/…
export default function Layout({ children }: LayoutProps<"/kontribusi/[tempatId]">) {
  return <GeoWatch>{children}</GeoWatch>;
}
