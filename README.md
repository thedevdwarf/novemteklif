# Novem Teklif Sistemi

`teklif.html` şablonu üzerine kurulmuş; **openclaw** AI agent'ı üzerinden konuşma ile teklif oluşturup yöneten, MongoDB destekli, geçici token'lı public önizleme + PDF çıktılı bir sistem.

## Mimari

```
┌─────── WSL ────────────────────────────────┐         ┌──────────────────┐
│                                            │         │  Cloudflared     │
│  openclaw ──► localhost:7878/mcp (MCP)    │         │  Tunnel          │
│  CLI/admin ──► localhost:7878/admin/...   │         │  ┌────────────┐  │
│                                            │         │  │            │  │
│  teklif servisi (Node 22+)                 │         │  │  HTTPS     │  │
│  ├─ :7878 internal (mcp + admin)           │         │  │  edge      │  │
│  └─ :7879 public  ◄────── tunnel ◄─────────┼─────────┼──┤            │  │
│                                            │         │  └────────────┘  │
│  MongoDB (teklify db)                      │         │                  │
│  /home/Teklifler/*.pdf                     │         │  teklif.novem... │
└────────────────────────────────────────────┘         └──────────────────┘
```

- **Internal :7878** sadece WSL içinden erişilebilir. MCP server (`/mcp`) ve admin endpoint'leri (`/admin/proposals/...`) burada.
- **Public :7879** sadece `GET /p/:token` endpoint'ini servis eder. Cloudflared tunnel sadece bu porta bağlanır.
- **Önizleme link'i** geçici alfanumerik token'lıdır (`/p/aB3xYz...`). PDF üretildiğinde otomatik **revoke** edilir → `410 Gone`.

## Dizin

```
.
├── teklif.html                    [referans / manuel düzenleme şablonu]
├── logo.svg, logo-dark.svg        [SVG'ler — server inline embed eder]
├── lunaspot-logo*.svg
├── server/                        [Node + TS + MCP + HTTP servisi]
│   ├── src/
│   │   ├── index.ts               [bootstrap]
│   │   ├── config.ts, db.ts
│   │   ├── proposals/             [types, repository, service]
│   │   ├── render/                [Handlebars, SVG embed, Playwright PDF]
│   │   ├── http/                  [internal + public listener]
│   │   └── mcp/                   [MCP server + 10 tool]
│   ├── templates/proposal.hbs     [teklif.html'den türetilmiş]
│   └── .env.example
├── skills/teklif/SKILL.md         [openclaw skill — kopyalanır]
└── deploy/
    ├── cloudflared-config.yml.example
    └── start.sh                   [mongo + node + cloudflared tek seferde]
```

## Kurulum (WSL)

### 1) Bağımlılıklar
```bash
# WSL içinde
cd /mnt/c/Users/Osman/Documents/development/novemteklif/server
npm install
npx playwright install --with-deps chromium
```

### 2) MongoDB (zaten kuruluysa atla)
```bash
sudo systemctl start mongod
mongosh --eval 'db.runCommand({ ping: 1 })'
```

### 3) `.env` hazırla
```bash
cp .env.example .env
# domain'ini düzenle: PUBLIC_BASE_URL=https://teklif.<senin-domainin>
```

### 4) Servisi başlat
```bash
npm run dev
# Beklenen log:
#   [db] connected mongodb://127.0.0.1:27017 db=teklify
#   [pdf] chromium ready
#   [server] internal http://127.0.0.1:7878 (admin + mcp at /mcp)
#   [server] public   http://127.0.0.1:7879
```

### 5) Cloudflared tunnel
```bash
# Tek seferlik kurulum
cloudflared tunnel login
cloudflared tunnel create teklify
cloudflared tunnel route dns teklify teklif.novem.com.tr   # kendi domain'in
cp deploy/cloudflared-config.yml.example ~/.cloudflared/config.yml
# ~/.cloudflared/config.yml içinde <UUID> ve $USER değerlerini düzelt

# Çalıştır
cloudflared tunnel run teklify
```

### 6) openclaw'a MCP server'ı tanıt
```bash
openclaw mcp set teklif '{"transport":"streamable-http","url":"http://127.0.0.1:7878/mcp"}'
openclaw mcp list   # teklif: 10 tools görünmeli
```

### 7) openclaw skill'ini kur
```bash
mkdir -p ~/.openclaw/workspace/skills
ln -s /mnt/c/Users/Osman/Documents/development/novemteklif/skills/teklif ~/.openclaw/workspace/skills/teklif
# Veya kopyala (symlink istenmiyorsa):
# cp -r skills/teklif ~/.openclaw/workspace/skills/teklif
```

### Hepsini tek komutla
```bash
bash deploy/start.sh
```

## Kullanım — Konuşma örnekleri

| Sen | Olan |
|---|---|
| "Hatay Soslu Döner — Tayfun Dede için 4 adet 100 TL termal yazıcı teklifi" | `create_proposal` çağrılır, `previewUrl` döner |
| "Adetı 6 yap" | `update_proposal` — aynı link, F5 yap |
| "Notu sil" | `update_proposal({ patch: { note: null } })` |
| "PDF ver" | Önce onay, sonra `generate_pdf`. PDF `/home/Teklifler/`'a düşer, link revoke |
| "Hatay'ın geçen ki teklifi nerde" | `search_proposals({ customerName: "Hatay" })` |
| "Bunun kopyasını çıkar Manolya Kafe için" | `clone_proposal_for_customer` — yeni teklif no |
| "Yeni revizyon hazırla, KDV %18" | `revise_proposal({ patch: { vatRate: 18 } })` |

## Tool listesi (MCP)

`create_proposal`, `get_proposal`, `search_proposals`, `update_proposal`, `revise_proposal`, `clone_proposal_for_customer`, `generate_pdf`, `regenerate_preview_token`, `set_status`, `delete_proposal`.

Detaylı parametreler için `server/src/mcp/tools.ts` veya `openclaw mcp show teklif`.

## Veri modeli

`teklify` veritabanı, `proposals` koleksiyonu. Müşteri embed (ayrı tablo yok). Revizyonlar ayrı doc + `parentId`. Klonlamalar yeni `proposalNo` + `clonedFromId`.

İndeksler:
- `{ proposalNo, revision }` unique
- `{ previewToken }` sparse + unique
- `{ "customer.tradeName": "text", "customer.contactPerson": "text" }`
- `{ "customer.tradeName" }`, `{ createdAt: -1 }`, `{ parentId }`, `{ clonedFromId }`

## Marka renkleri

- Koyu lacivert: `#0A1628`
- Turkuaz aksan: `#00FFF0`
- Açık mavi aksan: `#73ABFF`
- Gövde metni: `#1A2332`
- Yardımcı metin: `#5A6878`

`server/templates/proposal.hbs` içindeki `<style>` bloğunda hepsi tek seferde değiştirilebilir.

## PDF çıktıları

`/home/Teklifler/NVM-2026-001_Hatay_Soslu_Doner_v1.00.pdf` formatında. Windows'tan: `\\wsl$\<distro>\home\Teklifler\`.

## Kapanış

- Bilgisayar / WSL kapalıyken servis düşer → public link erişilemez. Bu kabul edilen bir trade-off.
- Önizleme süresi default 7 gün (`PREVIEW_TTL_DAYS` ile ayarlanır).
- Token PDF üretildiğinde otomatik revoke. Yeniden açmak için `regenerate_preview_token`.
