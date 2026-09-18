import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Unit test jalur tulis. Tidak menyentuh basis data, tidak menyentuh jaringan.
// Uji hitam-kotak lewat HTTP ada terpisah di tests/rejection (pytest).
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
  },
});
