# novemteklif — Agent Install Runbook

> Bu dosya **bir AI agent'ın (openclaw) sırayla uygulaması için** yazılmıştır. Her adımın kendi **Komut**, **Doğrulama** ve **Hata durumu** bölümü vardır. Kullanıcıya her başarısız adımda danış.

## Ortam Varsayımları

- İşletim sistemi: Ubuntu (WSL2)
- Kullanıcı: `$USER` (whoami ile doğrula)
- Node.js 22+ ve `npm` kurulu ve PATH'te
- MongoDB (`mongod`) çalışıyor, `mongodb://127.0.0.1:27017` erişilebilir
- İnternet erişimi var (GitHub ve npm registry'ye ulaşılabilir)
- Shell: `bash`

**İlk iş:** Bu varsayımları bir doğrula.

```bash
uname -a
whoami
node -v          # v22.x bekleniyor
npm -v
mongosh --quiet --eval 'db.runCommand({ping:1})' | head -3
```

Herhangi biri yoksa **kullanıcıya sor**, kendin apt install yapma.

---

## Adım 1 — Repo'yu Clone Et

**Komut:**
```bash
cd ~
git clone https://github.com/thedevdwarf/novemteklif.git
cd ~/novemteklif
```

Eğer dizin zaten varsa (önceden clone'lanmış):
```bash
cd ~/novemteklif && git pull --ff-only
```

**Doğrulama:**
```bash
ls ~/novemteklif/server/src/index.ts && echo OK
```
`OK` yazmazsa clone başarısız, yeniden dene.

---

## Adım 2 — Bağımlılıkları Yükle

**Komut:**
```bash
cd ~/novemteklif/server
npm install
```

Uzun sürebilir (~1-2 dk). "added N packages" ile bitmeli.

**Doğrulama:**
```bash
test -d ~/novemteklif/server/node_modules && echo OK
```

**Hata durumu:** `EACCES` / permission → kullanıcıya sor (sudo gerekmiyor, büyük ihtimal NPM cache sorunu). `ETIMEDOUT` → ağ sorunu, kullanıcıya bildir.

---

## Adım 3 — Playwright Chromium'u Yükle

`--with-deps` sudo ister, ilk önce deps'siz dene:

**Komut (deps'siz, sudo istemez):**
```bash
cd ~/novemteklif/server
npx playwright install chromium
```

**Doğrulama:**
```bash
ls ~/.cache/ms-playwright | grep chromium && echo OK
```

**Hata durumu:** Çalışırken "Host system is missing dependencies" uyarısı çıkarsa bu adımdan sonra **Adım 3b**'yi çalıştır. Uyarı yoksa atla.

### Adım 3b — Sistem Bağımlılıkları (sadece gerekiyorsa)

**Komut (sudo gerektirir, kullanıcıdan şifre beklenir):**
```bash
sudo npx playwright install-deps chromium
```

Kullanıcıya "sudo şifren gerekiyor" diye **önceden haber ver**, sonra komutu çalıştır.

---

## Adım 4 — `.env` Dosyasını Hazırla

**Komut:**
```bash
cd ~/novemteklif/server
cp -n .env.example .env
```

İlk test için public URL'i localhost'a sabitle (cloudflared sonraki bir adımda):

```bash
sed -i 's|^PUBLIC_BASE_URL=.*|PUBLIC_BASE_URL=http://127.0.0.1:7879|' .env
cat .env | grep -E '^(PORT_|MONGO_|OUT_DIR|PUBLIC_BASE_URL|PREVIEW_TTL_DAYS)='
```

**Doğrulama:** Çıktıda 6 satır görmeli (PORT_INTERNAL, PORT_PUBLIC, MONGO_URL, MONGO_DB, OUT_DIR, PUBLIC_BASE_URL, PREVIEW_TTL_DAYS).

---

## Adım 5 — PDF Çıktı Klasörünü Oluştur

**Komut:**
```bash
mkdir -p /home/$USER/Teklifler
```

**Doğrulama:**
```bash
test -d /home/$USER/Teklifler && echo OK
```

> Not: `.env`'de `OUT_DIR=/home/Teklifler` yazıyor (root home). Eğer o path erişilebilir değilse `.env`'i user home'a çevir:
> ```bash
> sed -i "s|^OUT_DIR=.*|OUT_DIR=/home/$USER/Teklifler|" ~/novemteklif/server/.env
> ```

---

## Adım 6 — Typecheck (Opsiyonel, hızlı sağlamlık testi)

**Komut:**
```bash
cd ~/novemteklif/server
npm run typecheck
```

**Doğrulama:** Hata yok, çıkış kodu 0.

Hata varsa **kullanıcıya durumu bildir**, bu bir kod sorunu demek — kendi başına çözmeye çalışma.

---

## Adım 7 — Servisi Başlat (Arka Planda)

**Komut:**
```bash
mkdir -p ~/.local/log/teklify
cd ~/novemteklif/server
nohup npm run dev > ~/.local/log/teklify/server.log 2>&1 &
echo $! > ~/.local/log/teklify/server.pid
sleep 4
tail -20 ~/.local/log/teklify/server.log
```

**Beklenen log satırları:**
```
[db] connected mongodb://127.0.0.1:27017 db=teklify
[pdf] chromium ready
[server] internal http://127.0.0.1:7878 ...
[server] public   http://127.0.0.1:7879 ...
```

**Doğrulama:**
```bash
curl -sS http://127.0.0.1:7878/healthz
echo
curl -sS http://127.0.0.1:7879/healthz
```

İki satırda da `ok` yazmalı.

**Hata durumu:**
- `ECONNREFUSED` Mongo'ya → mongod çalışmıyor, `mongosh` ile ping at; başlat: `sudo systemctl start mongod`.
- `EADDRINUSE` → port dolu; `lsof -i:7878` veya `lsof -i:7879` ile bak. Kullanıcıya sor, rastgele kill etme.
- Playwright hatası → Adım 3b'yi çalıştırmamış olabilirsin.

---

## Adım 8 — Servisi Durdurma (gerekirse)

```bash
kill "$(cat ~/.local/log/teklify/server.pid)" 2>/dev/null || true
pkill -f "tsx watch src/index.ts" 2>/dev/null || true
```

Sonra yeniden Adım 7.

---

## Adım 9 — openclaw'a MCP Server'ı Tanıt

**Sen (openclaw) kendi MCP config'ine bu servisi ekleyeceksin:**

```bash
openclaw mcp set teklif '{"transport":"streamable-http","url":"http://127.0.0.1:7878/mcp"}'
openclaw mcp list
```

**Doğrulama:** `openclaw mcp list` çıktısında `teklif` görünmeli ve ~10 tool listelenmeli (`create_proposal`, `get_proposal`, ...). Tool listesi `0` ise servis cevap vermiyor → Adım 7'ye dön.

---

## Adım 10 — Skill'i Yerine Koy

```bash
mkdir -p ~/.openclaw/workspace/skills
ln -sfn ~/novemteklif/skills/teklif ~/.openclaw/workspace/skills/teklif
```

**Doğrulama:**
```bash
test -f ~/.openclaw/workspace/skills/teklif/SKILL.md && echo OK
```

Yeni skill'in yüklenmesi için **gateway'i yeniden başlat** (openclaw dokümanı gereği): `/new` komutu veya `openclaw gateway restart` (kullanıcıya sor, hangisini tercih ediyor).

---

## Adım 11 — Canlı Test

**Agent diyaloğu (kullanıcıyla beraber test et):**

1. Söyle: "Test için bir teklif oluşturuyorum."
2. Çağır:
   ```
   create_proposal({
     customer: { tradeName: "Test Firma", contactPerson: "Osman" },
     items: [{ name: "Termal Yazıcı", qty: 4, unitPrice: 100 }]
   })
   ```
3. Dönen `previewUrl`'i kullanıcıya ver. Şu an localhost olduğu için yalnızca bu bilgisayarda açılır: `http://127.0.0.1:7879/p/...`
4. Kullanıcı tarayıcıda açıp "evet görünüyor" dediğinde **Adım 12**'ye geç. "Görünmüyor" derse servis loguna bak (`tail -40 ~/.local/log/teklify/server.log`).

---

## Adım 12 — (Opsiyonel) Cloudflared Tunnel

**Sadece kullanıcı "public'e açalım" derse bu adıma geç.** Localhost test yeterliyse atla.

```bash
# Kurulum (tek seferlik)
sudo mkdir -p /usr/share/keyrings
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main' | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt-get update && sudo apt-get install -y cloudflared

# Oturum + tunnel oluştur
cloudflared tunnel login       # browser açar, kullanıcı giriş yapmalı
cloudflared tunnel create teklify
cloudflared tunnel route dns teklify teklif.novem.com.tr   # kullanıcıya domain sor
```

**Config yerine koy:**
```bash
UUID=$(grep -oP '(?<=Created tunnel teklify with id )[a-f0-9-]+' <(cloudflared tunnel list 2>&1) | head -1 \
       || cloudflared tunnel list | awk '/teklify/{print $1; exit}')
cat > ~/.cloudflared/config.yml <<YAML
tunnel: $UUID
credentials-file: /home/$USER/.cloudflared/$UUID.json
ingress:
  - hostname: teklif.novem.com.tr
    service: http://127.0.0.1:7879
  - service: http_status:404
YAML
```

Sonra:
```bash
nohup cloudflared tunnel run teklify > ~/.local/log/teklify/cloudflared.log 2>&1 &
sleep 3 && tail -10 ~/.local/log/teklify/cloudflared.log
```

**`.env` güncelle:**
```bash
sed -i 's|^PUBLIC_BASE_URL=.*|PUBLIC_BASE_URL=https://teklif.novem.com.tr|' ~/novemteklif/server/.env
```

Servis bu değişikliği alsın diye Adım 7-8'i tekrarla.

---

## Adım 13 — Bitti

Kullanıcıya şunu söyle:
- "Servis çalışıyor: internal `:7878`, public `:7879`"
- "MCP server `teklif` bağlı, 10 tool hazır"
- "Skill kuruldu, teklif/fiyat/proposal demen yeterli"
- "PDF'ler: `/home/$USER/Teklifler/`"

## Hata/Geri Dönme Noktaları

| Belirti | Çözüm |
|---|---|
| `EADDRINUSE :7878` | Eski process var. `pkill -f "tsx watch src/index.ts"`, Adım 7. |
| Preview URL 404 | Token revoke edilmiş olabilir (PDF üretildi mi?). `regenerate_preview_token` tool'unu dene. |
| PDF boş veya crash | Chromium deps eksik. Adım 3b. |
| Mongo ping fail | `sudo systemctl start mongod` veya kullanıcıya sor. |
| Logda `text index exists` uyarısı | Zararsız, ignore. |

## Dosya Yerleri Hızlı Referans

- Repo: `~/novemteklif/`
- Server: `~/novemteklif/server/`
- Logs: `~/.local/log/teklify/server.log`
- PDF'ler: `/home/$USER/Teklifler/`
- Skill: `~/.openclaw/workspace/skills/teklif/SKILL.md`
- MCP config: `openclaw mcp show teklif`
