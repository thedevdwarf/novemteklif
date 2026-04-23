# Novem Yazılım — Fiyat Teklifi Şablonu

## Dosyalar

- `teklif.html` — Şablonun kaynak dosyası, istediğin editörde açıp düzenleyebilirsin
- `logo.svg` — Beyaz logo (kapaktaki koyu zemin için)
- `logo-dark.svg` — Koyu logo (içerik sayfalarındaki beyaz zemin için)
- `Novem_Teklif_Sablonu.pdf` — Referans olarak son çıktı

## Düzenlenecek Yerler

HTML'in içinde köşeli parantezle işaretli alanlar:

- `[Müşteri Ticari Unvanı]` — kapaktaki büyük müşteri adı
- `[Müşteri Adı]` — içerik sayfalarının üst bilgisindeki kısa ad
- `[NVM-2026-XXX]` — teklif numarası (kendi sistematiğine göre değiştir)
- `[GG.AA.YYYY]` — teklif tarihi
- `[Müşteri]` — hitap satırındaki isim

**Fiyat tablosu:** `<tr class="empty">` satırlarını kendi ürünlerinle doldur. Boş kalanları sil.

## PDF'e Çevirmek

Şu araçlardan biriyle:

```bash
# WeasyPrint (Python)
pip install weasyprint
weasyprint teklif.html teklif.pdf

# Veya tarayıcıda aç, Ctrl+P ile "PDF olarak kaydet"
```

Chrome/Edge ile yazdır seçeneği genelde daha hızlı ve görsel olarak birebir çıkar.

## Marka Renkleri

- Koyu lacivert: `#0A1628` (kapak zemini, başlıklar)
- Turkuaz aksan: `#00FFF0`
- Açık mavi aksan: `#73ABFF`
- Gövde metni: `#1A2332`
- Yardımcı metin: `#5A6878`

HTML'in `<style>` bloğunda hepsini kolayca değiştirebilirsin.
