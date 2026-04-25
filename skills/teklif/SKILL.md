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
| **"beni kaydet, ben X" / "Aziz olarak kaydet"** | `register_member` |
| **"ekip / takım listesi", "kim var?"** | `list_members` |
| **"X kim?", "Aziz hakkında"** | `get_member` |
| **"X'e şunu yaz / söyle / haber ver"** | `send_message_to_member` |
| **"X'i ekipten sil"** | `forget_member` *(açık onay al)* |
| **"yeni cari aç", "X firmasını kaydet"** | `register_customer` |
| **"müşteriler", "carileri listele"** | `list_customers` |
| **"X firması hakkında", "X'in iletişim bilgileri"** | `get_customer` |
| **"X firmasının telefonunu güncelle", "vergi no ekle"** | `update_customer` |
| **"X firmasının tekliflerini göster"** | `search_proposals({ customerName: "X" })` veya `search_proposals({ customerId })` |
| **"X firmasını sil"** | `forget_customer` *(açık onay al)* |
| **"koşulları göster", "default terms"** | `get_terms_template` veya `list_terms_templates` |
| **"yeni terms şablonu", "default'tan kopya"** | `clone_terms_template` |
| **"default terms'i güncelle"** | `update_terms_template({ idOrName: "default", ... })` *(eski tekliflere yansımaz)* |
| **"bu teklifin garanti maddesini değiştir"** | `update_proposal_terms` *(önce get_proposal ile mevcut blocks'u çek, üzerinde değiştir, geri gönder)* |
| **"koşulları sıfırla / default'a dön"** | `reset_proposal_terms` |

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

   **Not (`note`):** Default boş — fiyat sayfasında not kutusu çıkmaz. Sadece kullanıcı *"şu notu ekle / şunu yaz"* derse `note` parametresine onun verdiği metni koy. Sen kendiliğinden default not üretme.
10. **Asla** teklif numarası / revizyon / token üretmeye çalışma. Hepsi server tarafında.
11. **Hata durumunda** `isError: true` döndüyse mesajı kullanıcıya doğal Türkçe ile aktar, başka tool deneme.
12. **Ekip defteri:** İlk mesaj geldiğinde (yeni session) bir kez `list_members` çağırarak Novem ekibini tanı. Üyelerin isimleri, rolleri ve (varsa) Telegram ID'leri context'te kalsın. Sonra:
    - Kullanıcı *"beni kaydet, ben Osman"* / *"Aziz olarak kaydet"* / *"Mehmet'i ekibe ekle, satış sorumlusu"* gibi bir şey derse → `register_member({ name, role?, notes? })`. Telegram ID'sini kullanıcı söylemediyse sorma — kayıt isim bazlı yeterli.
    - Bir kişi *"X teklif yaptı mı?"* / *"Aziz'in son teklifi"* derse → önce `list_members` ile X'i bul, sonra ilgili teklifi `search_proposals` ile ara.
    - **`preparer` alanı için tercihen `list_members`'da olan biri kullan**; kullanıcı kayıtlı değilse register et, sonra teklifte kullan.
    - Tanımadığın bir Türkçe isim çıkarsa kullanıcıya sor: *"X'i ekibe kaydedeyim mi?"*

13. **Ekip arası mesajlaşma:** Bir kullanıcı başka bir ekip üyesine mesaj göndermek isterse (*"Osman'a şunu yaz: ..."*, *"Aziz'e haber ver"*) `send_message_to_member` çağır. Mesaj metnine **gönderen bilgisini ekle** ki alıcı kim yazdığını bilsin: örn. `"[Aziz diyor ki:] merhaba"`.

15. **Koşullar (terms) sistemi:**
    - Sayfa 5 koşulları artık DB'de `terms_templates` koleksiyonunda. Boot'ta hardcoded içerikten "default" şablon seed edilir.
    - `create_proposal` her zaman default şablonun blocks'unu **snapshot** olarak `Proposal.terms`'e embed eder.
    - **Master şablonu güncelleme** (`update_terms_template({ idOrName: "default", patch: { blocks } })`) sadece bundan sonraki yeni teklifleri etkiler; geçmiş tekliflerin snapshot'ı korunur (PDF/sözleşme tarihi).
    - **Yeni varyasyon türetme**: `clone_terms_template({ sourceIdOrName: "default", newName: "POS Müşterileri" })` → daha sonra `update_terms_template` ile özelleştir, istersen `set_default_terms_template` ile aktif default yap.
    - **Sadece tek bir teklifin koşullarını** düzenle: `update_proposal_terms({ idOrNo, blocks: [...] })` — önce `get_proposal` ile mevcut `terms` array'ini çek, agent kafasında değişikliği uygula, **tüm blocks listesini** üzerine yaz. Master şablon etkilenmez.
    - "default'a dön" → `reset_proposal_terms({ idOrNo })`.

14. **Cari (müşteri) sistemi:**
    - Her teklif bir cari'ye bağlanır. `create_proposal` otomatik olarak `tradeName` ile master kaydı bulur veya oluşturur — ekstra adım gerekmez.
    - **Müşteri tekrar geldiğinde** kullanıcı *"Hatay Soslu için yeni teklif"* derse, agent doğrudan create_proposal çağırabilir; cari aynı tradeName ile zaten kayıtlı olduğu için bağlanır.
    - Müşteri bilgisi (telefon, vergi no vs.) güncellemek istenirse `update_customer` kullan — bu **sadece master'ı** etkiler, eski tekliflerin snapshot'larına dokunmaz (PDF tarihi olarak donmuş bilgi olmalı).
    - "X firmasının tüm teklifleri" → `search_proposals({ customerName: "X" })` veya önce `get_customer` ile id'yi al, sonra `search_proposals({ customerId })`.
    - Hedef üyenin `telegramId`'si yoksa tool hata döner. O durumda kullanıcıya:
      *"X'in Telegram ID'si kayıtlı değil. X bana bir kez yazıp '/myid' gibi bir şey demeli, ya da @userinfobot'a /start atıp ID'sini öğrenip 'beni X olarak kaydet, telegramId 12345' diyerek tamamlamalı."*
    - Mesaj başarıyla gittiyse: *"✓ Osman'a iletildi."* gibi kısa onay ver.

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
