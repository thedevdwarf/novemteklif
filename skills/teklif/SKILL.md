---
name: teklif
description: Novem Yazılım fiyat teklifi yönetimi — oluştur, güncelle, ara, kopyala, PDF üret. MCP server "teklif" üzerinden çalışır.
---

# Teklif Yönetimi

Bu skill aktif olduğunda, kullanıcı **teklif / proposal / fiyat / quote** ile ilgili herhangi bir istekte bulunduğunda `teklif` MCP server'ındaki tool'ları kullan. Hiçbir teklif verisini hafızadan değil, tool çağrılarıyla yönet.

## Tool seçimi

| Kullanıcı dedi ki | Çağır |
|---|---|
| "yeni teklif", "X firması için Y ürün teklifi hazırla" | `create_proposal` |
| "şu firmanın teklifi", "geçen ay verdiğim teklif", "X'in tekliflerini listele" | `search_proposals` |
| "şu teklifi getir", "NVM-2026-005'i göster" | `get_proposal` |
| "adetı 6 yap", "X kalemini sil", "fiyatı güncelle", "notu değiştir" | `update_proposal` |
| "yeni revizyon", "revize et" | `revise_proposal` |
| "kopyasını çıkar X firması için", "bu teklifi Y'ye uyarla" | `clone_proposal_for_customer` |
| "PDF ver", "PDF üret", "indirilebilir hale getir" | `generate_pdf` *(önce onay al!)* |
| "yeni link", "link süresi dolmuş", "linki yenile" | `regenerate_preview_token` |
| "gönderildi olarak işaretle", "kabul edildi" | `set_status` |
| "sil bu teklifi" | `delete_proposal` *(açık onay al)* |

## Davranış kuralları

1. **Yeni teklif oluşturduğunda:** Yanıtında `proposalNo` ve `previewUrl`'i mutlaka ver. previewUrl'i Markdown link olarak yaz: `[Önizleme](https://...)`. Kullanıcının bunu tarayıcıda açabilmesi şart.
2. **Update sonrası:** Aynı linki tekrar yazma — onun yerine kısaca "Güncellendi, sayfada F5 yapın" de. Toplam değişti ise yeni grandTotal'ı belirt.
3. **PDF üretmeden ÖNCE onay al:** "Önizleme bağlantısını kapatıp PDF üreteyim mi?" diye sor. Çünkü `generate_pdf` token'ı revoke eder. Onay alındıktan sonra çağır, sonra dosya yolunu (filePath ve windowsPath) kullanıcıya ver.
4. **Müşteri adı / firma sorgularında** önce `search_proposals` ile dene. Birden fazla sonuç varsa kısa liste göster (proposalNo, müşteri, tarih, tutar), kullanıcı seçsin.
5. **Klonlama:** `clone_proposal_for_customer` kullandığında dönen yeni `proposalNo`'yu vurgula. "X firmasına yeni teklif **NVM-2026-XXX** numarasıyla oluşturuldu."
6. **Revizyon:** `revise_proposal` her çağrıldığında revision artar. Yeni link de yeni revizyona ait. Eski link revoke EDİLMEZ — ayrı doc, ayrı token.
7. **Tarih:** Kullanıcı tarih vermezse bugünün tarihini kullan (tool zaten default eder).
8. **Para birimi:** Default `TRY` (₺). Kullanıcı "dolar / USD" derse `currency: "USD"`, "euro / avro / EUR" derse `currency: "EUR"` gönder. Tüm fiyatlar KDV hariç — KDV satırı çıktıda görünmez, kullanıcıya da öyle anlat.
9. **Hazırlayan (preparer):** ZORUNLU. Kullanıcı söylemediyse `create_proposal` çağırmadan ÖNCE sor: *"Bu teklifi kim hazırlıyor? (örn. Osman Tuzcu)"*. Aldığın değeri `preparer` parametresi olarak gönder. Kapakta "Saygılarımızla" satırının altında imza olarak çıkar.
10. **Asla** teklif numarası / revizyon / token üretmeye çalışma. Hepsi server tarafında.
11. **Hata durumunda** `isError: true` döndüyse mesajı kullanıcıya doğal Türkçe ile aktar, başka tool deneme.

## Örnek diyalog

**Kullanıcı:** "Hatay Soslu Döner — Tayfun Dede için 4 adet 100 TL termal yazıcı teklifi oluştur."

**Sen:** "Bu teklifi kim hazırlıyor?"

**Kullanıcı:** "Osman Tuzcu"

**Sen (tool çağrısı):**
```json
create_proposal({
  customer: { tradeName: "Hatay Soslu Döner", contactPerson: "Tayfun Dede" },
  preparer: "Osman Tuzcu",
  items: [{ name: "Termal Yazıcı", qty: 4, unitPrice: 100 }]
})
```

**Yanıt:**
> Teklif oluşturuldu: **NVM-2026-001** (Rev 1.00) — Toplam **400,00 ₺** (KDV hariç)
> Önizleme: [https://teklif.novem.com.tr/p/aB3xYz...](...)
>
> Bu link 7 gün geçerli, PDF ürettiğinde kapanır.

---

**Kullanıcı:** "Adetı 6 yap"

**Sen:** `update_proposal({ idOrNo: "NVM-2026-001", patch: { items: [{ name: "Termal Yazıcı", qty: 6, unitPrice: 100 }] } })`

> Güncellendi, sayfada F5 yapın. Yeni toplam: **600,00 ₺**.

---

**Kullanıcı:** "5000 dolarlık bir teklif yap, ABC Şirketi için, 10 adet lisans 500 dolar."

**Sen:** `create_proposal({ customer: { tradeName: "ABC Şirketi", contactPerson: "..." }, items: [{ name: "Lisans", qty: 10, unitPrice: 500 }], currency: "USD" })`

> Teklif oluşturuldu: **NVM-2026-002** — Toplam **5.000,00 $** (KDV hariç).
> Önizleme: [...](...)

---

**Kullanıcı:** "Tamam, PDF ver"

**Sen:** "Önizleme bağlantısını kapatıp PDF üreteyim mi?"

**Kullanıcı:** "Evet"

**Sen:** `generate_pdf({ idOrNo: "NVM-2026-001" })`

> PDF hazır:
> - WSL: `/home/Teklifler/NVM-2026-001_Hatay_Soslu_Doner_v1.00.pdf`
> - Windows: `\\wsl$\<distro>\home\Teklifler\NVM-2026-001_Hatay_Soslu_Doner_v1.00.pdf`
>
> Önizleme bağlantısı kapatıldı.
