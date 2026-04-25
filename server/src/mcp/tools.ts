import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as service from "../proposals/service.js";
import * as team from "../team/service.js";
import * as customers from "../customers/service.js";
import * as terms from "../terms/service.js";
import { renderPdf } from "../render/pdf.js";

const termBlockSchema = z.object({
  title: z.string().min(1),
  paragraphs: z.array(z.string().min(1)).min(1),
}).strict();

const customerSchema = z
  .object({
    tradeName: z.string().min(1).describe("Müşteri ticari unvanı (firma adı)"),
    contactPerson: z.string().min(1).describe("İletişim kurulan kişi adı"),
    greetingName: z
      .string()
      .optional()
      .describe('Hitap için isim ("Sayın X" satırında geçer). Boşsa contactPerson kullanılır.'),
    address: z.string().optional(),
    taxOffice: z.string().optional(),
    taxNo: z.string().optional(),
  })
  .strict();

const itemSchema = z
  .object({
    name: z.string().min(1).describe('Kalem adı, örn. "Termal Yazıcı" veya "Mikrotik RBD52G"'),
    qty: z.number().positive().describe("Adet"),
    unitPrice: z.number().nonnegative().describe("Birim fiyat (KDV hariç). Para birimi teklifin currency alanından gelir."),
  })
  .strict();

const currencySchema = z
  .enum(["TRY", "USD", "EUR"])
  .describe('Para birimi. "TRY" (₺ — varsayılan), "USD" ($), "EUR" (€). Teklifin tüm kalemleri aynı para birimindedir.');

const preparerSchema = z
  .string()
  .min(1)
  .describe(
    'Teklifi hazırlayan Novem personelinin tam adı, örn. "Osman Tuzcu". Kapakta "Saygılarımızla" satırının altında imza olarak görünür. ZORUNLU — kullanıcı söylemediyse SOR.',
  );

const titleSchema = z
  .object({
    main: z.string().optional().describe('Kapak başlığı, örn. "Novem POS" veya "Mikrotik Hotspot Çözümü". Default "Novem POS".'),
  })
  .strict()
  .optional();

const patchSchema = z
  .object({
    customer: customerSchema.partial().optional(),
    title: titleSchema,
    currency: currencySchema.optional(),
    preparer: preparerSchema.optional(),
    items: z.array(itemSchema).optional(),
    note: z
      .string()
      .nullable()
      .optional()
      .describe("Fiyat sayfasındaki not kutusu. null gönderirsen siler."),
    monthly: z
      .number()
      .nullable()
      .optional()
      .describe("Aylık bedel (destek/abonelik). null gönderirsen siler."),
    date: z.coerce.date().optional(),
  })
  .strict();

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function err(message: string) {
  return {
    isError: true,
    content: [{ type: "text" as const, text: message }],
  };
}

export function registerTools(mcp: McpServer): void {
  mcp.tool(
    "create_proposal",
    "Yeni bir teklif oluşturur. Kullanıcı 'X firmasına Y ürün teklifi hazırla / oluştur' dediğinde çağır. " +
      "Teklif numarası ve revizyon (1.00) otomatik atanır. Geçici bir önizleme bağlantısı (previewUrl) döner; " +
      "kullanıcıya bu linki ver. " +
      "Para birimi: 'dolar teklifi' / 'usd' geçerse currency=USD, 'euro' / 'avro' geçerse currency=EUR, " +
      "değilse TRY (varsayılan). Tüm fiyatlar KDV hariçtir, KDV satırı çıktılarda gösterilmez.",
    {
      customer: customerSchema,
      preparer: preparerSchema,
      items: z.array(itemSchema).min(1),
      title: titleSchema,
      currency: currencySchema.optional(),
      note: z.string().optional(),
      monthly: z.number().nonnegative().optional(),
      date: z.coerce.date().optional(),
    },
    async (args) => {
      try {
        const r = await service.createProposal(args);
        return ok(r);
      } catch (e) {
        return err((e as Error).message);
      }
    },
  );

  mcp.tool(
    "get_proposal",
    "Tek bir teklifi getirir. idOrNo olarak teklif numarasını (örn. NVM-2026-001) veya MongoDB ID'sini ver.",
    { idOrNo: z.string().min(3) },
    async ({ idOrNo }) => {
      try {
        const r = await service.getProposal(idOrNo);
        return ok(r);
      } catch (e) {
        return err((e as Error).message);
      }
    },
  );

  mcp.tool(
    "search_proposals",
    "Teklifleri arar. 'Hatay'ın geçen ki teklifi', 'şu firmanın teklifleri' türü sorgular için kullan. " +
      "customerName regex prefix arar; query text index üzerinden tüm metinde arar. " +
      "customerId verirsen o cariye yapılan tüm teklifleri getirir.",
    {
      query: z.string().optional(),
      customerName: z.string().optional(),
      customerId: z.string().optional(),
      dateFrom: z.coerce.date().optional(),
      dateTo: z.coerce.date().optional(),
      status: z.enum(["draft", "sent", "accepted", "rejected"]).optional(),
      limit: z.number().int().min(1).max(100).optional(),
    },
    async (args) => {
      try {
        const r = await service.search(args);
        return ok(r);
      } catch (e) {
        return err((e as Error).message);
      }
    },
  );

  mcp.tool(
    "update_proposal",
    "Mevcut teklifin içeriğini günceller (aynı revizyon üstünde). " +
      "Önizleme linki AYNI KALIR — kullanıcı tarayıcıda yenileyebilir. " +
      "Toplamlar otomatik yeniden hesaplanır. Sadece gönderdiğin alanlar değişir.",
    {
      idOrNo: z.string().min(3),
      patch: patchSchema,
    },
    async ({ idOrNo, patch }) => {
      try {
        const r = await service.updateProposal(idOrNo, patch);
        return ok(r);
      } catch (e) {
        return err((e as Error).message);
      }
    },
  );

  mcp.tool(
    "revise_proposal",
    "Yeni bir revizyon oluşturur (örn. 1.00 → 2.00). Eski revizyon kayıtlı kalır. " +
      "PDF üretildikten sonra düzeltme isteği gelirse bunu kullan. parentId ile zincir korunur.",
    {
      idOrNo: z.string().min(3),
      patch: patchSchema.optional(),
    },
    async ({ idOrNo, patch }) => {
      try {
        const r = await service.reviseProposal(idOrNo, patch);
        return ok(r);
      } catch (e) {
        return err((e as Error).message);
      }
    },
  );

  mcp.tool(
    "clone_proposal_for_customer",
    "Mevcut bir teklifi başka bir müşteriye uyarlar. Yeni teklif numarası alır, revizyon 1.00 olur. " +
      "'Bu teklifin kopyasını çıkar X firması için yap' dendiğinde kullan. clonedFromId ile bağ korunur.",
    {
      sourceIdOrNo: z.string().min(3),
      newCustomer: customerSchema,
      patch: patchSchema.optional(),
    },
    async ({ sourceIdOrNo, newCustomer, patch }) => {
      try {
        const r = await service.cloneProposalForCustomer(sourceIdOrNo, newCustomer, patch);
        return ok(r);
      } catch (e) {
        return err((e as Error).message);
      }
    },
  );

  mcp.tool(
    "generate_pdf",
    "Teklifin PDF'ini üretir ve diskte /home/Teklifler altına kaydeder. " +
      "ÖNEMLİ: Bu çağrıdan sonra önizleme bağlantısı (previewUrl) OTOMATİK olarak kapatılır. " +
      "Kullanıcıdan onay almadan çağırma. Dönen filePath WSL içi yoldur.",
    { idOrNo: z.string().min(3) },
    async ({ idOrNo }) => {
      try {
        const doc = await service.findByIdOrNo(idOrNo);
        if (!doc) return err(`Teklif bulunamadı: ${idOrNo}`);
        const view = service.toView(doc);
        const pdf = await renderPdf(view);
        const updated = await service.markPdfGenerated(doc._id, pdf.filePath);
        return ok({
          filePath: pdf.filePath,
          fileName: pdf.fileName,
          windowsPath: toWindowsPath(pdf.filePath),
          proposalNo: updated.proposalNo,
          revision: updated.revision,
          previewClosed: true,
        });
      } catch (e) {
        return err((e as Error).message);
      }
    },
  );

  mcp.tool(
    "regenerate_preview_token",
    "Yeni bir önizleme bağlantısı üretir. PDF üretildikten sonra düzeltme/tekrar paylaşma " +
      "gerekirse veya link süresi dolduysa kullan.",
    { idOrNo: z.string().min(3) },
    async ({ idOrNo }) => {
      try {
        const r = await service.regenerateToken(idOrNo);
        return ok(r);
      } catch (e) {
        return err((e as Error).message);
      }
    },
  );

  mcp.tool(
    "set_status",
    "Teklif durumunu değiştirir (draft / sent / accepted / rejected). 'Bu teklifi gönderdim olarak işaretle' " +
      "veya 'kabul edildi' dendiğinde kullan.",
    {
      idOrNo: z.string().min(3),
      status: z.enum(["draft", "sent", "accepted", "rejected"]),
    },
    async ({ idOrNo, status }) => {
      try {
        const r = await service.setStatus(idOrNo, status);
        return ok(r);
      } catch (e) {
        return err((e as Error).message);
      }
    },
  );

  // ────────── KOŞULLAR (TERMS TEMPLATES) ──────────

  mcp.tool(
    "list_terms_templates",
    "Tüm koşullar (terms) şablonlarını listeler. 'default' her zaman bulunur, ek varyasyonlar (POS, hotspot vb.) opsiyonel.",
    {},
    async () => {
      try {
        const r = await terms.listTemplates();
        return ok(r);
      } catch (e) {
        return err((e as Error).message);
      }
    },
  );

  mcp.tool(
    "get_terms_template",
    "Tek bir koşullar şablonunu ID veya adıyla getirir. Tüm madde başlıkları + paragrafları görmek için.",
    { idOrName: z.string().min(1) },
    async ({ idOrName }) => {
      try {
        const r = await terms.getTemplate(idOrName);
        return ok(r);
      } catch (e) {
        return err((e as Error).message);
      }
    },
  );

  mcp.tool(
    "clone_terms_template",
    "Mevcut bir şablonun kopyasını yeni bir adla oluşturur (varyasyon türetme). " +
      "Örn: 'default'tan kopya 'POS Müşterileri' adıyla, sonra update_terms_template ile içeriğini özelleştir.",
    {
      sourceIdOrName: z.string().min(1),
      newName: z.string().min(1).describe("Yeni şablon adı (default rezerve)"),
      notes: z.string().optional(),
    },
    async ({ sourceIdOrName, newName, notes }) => {
      try {
        const r = await terms.cloneTemplate(sourceIdOrName, newName, notes);
        return ok(r);
      } catch (e) {
        return err((e as Error).message);
      }
    },
  );

  mcp.tool(
    "update_terms_template",
    "Mevcut bir şablonun blocks (madde) listesini, adını veya notunu günceller. " +
      "ÖNEMLİ: Bu sadece master template'i değiştirir; bundan sonra çıkan teklifler güncel halini snapshot alır, " +
      "eski tekliflerin snapshot'ı DEĞİŞMEZ. Default şablonun adı değiştirilemez.",
    {
      idOrName: z.string().min(1),
      patch: z.object({
        name: z.string().optional(),
        blocks: z.array(termBlockSchema).optional(),
        notes: z.string().optional(),
      }).strict(),
    },
    async ({ idOrName, patch }) => {
      try {
        const r = await terms.updateTemplate(idOrName, patch);
        return ok(r);
      } catch (e) {
        return err((e as Error).message);
      }
    },
  );

  mcp.tool(
    "set_default_terms_template",
    "Bir şablonu default olarak işaretler (önceki default'un işareti kaldırılır). " +
      "Bundan sonra create_proposal default şablon olarak bunun snapshot'ını alır.",
    { idOrName: z.string().min(1) },
    async ({ idOrName }) => {
      try {
        const r = await terms.setDefault(idOrName);
        return ok(r);
      } catch (e) {
        return err((e as Error).message);
      }
    },
  );

  mcp.tool(
    "delete_terms_template",
    "Bir koşullar şablonunu siler. Default şablon silinemez. Mevcut tekliflerin snapshot'ı etkilenmez.",
    {
      idOrName: z.string().min(1),
      confirm: z.literal(true),
    },
    async ({ idOrName }) => {
      try {
        const deleted = await terms.deleteTemplate(idOrName);
        return ok({ deleted });
      } catch (e) {
        return err((e as Error).message);
      }
    },
  );

  // ────────── PROPOSAL-LEVEL TERMS (snapshot edit) ──────────

  mcp.tool(
    "update_proposal_terms",
    "Sadece bir teklifin koşullar (terms) snapshot'ını günceller. Master şablonu etkilemez. " +
      "Kullanıcı 'bu teklifin garanti maddesini değiştir' / 'şu maddeyi çıkar' gibi bir şey derse bunu çağır. " +
      "Tüm blocks'u eksiksiz gönder (mevcut + değişen). Önce get_proposal ile mevcut terms'i çek, üzerinde değiştir, geri gönder.",
    {
      idOrNo: z.string().min(3),
      blocks: z.array(termBlockSchema).min(1).describe("Tüm madde listesi (snapshot tamamen üzerine yazılır)"),
    },
    async ({ idOrNo, blocks }) => {
      try {
        const r = await service.updateProposalTerms(idOrNo, blocks);
        return ok(r);
      } catch (e) {
        return err((e as Error).message);
      }
    },
  );

  mcp.tool(
    "reset_proposal_terms",
    "Bir teklifin koşullar snapshot'ını bir şablondan (default veya başka) yeniden alır. " +
      "Kullanıcı 'koşulları sıfırla / default'a dön' derse çağır. templateIdOrName boşsa default kullanılır.",
    {
      idOrNo: z.string().min(3),
      templateIdOrName: z.string().optional(),
    },
    async ({ idOrNo, templateIdOrName }) => {
      try {
        const r = await service.resetProposalTermsToTemplate(idOrNo, templateIdOrName);
        return ok(r);
      } catch (e) {
        return err((e as Error).message);
      }
    },
  );

  // ────────── CARİ (MÜŞTERİLER) ──────────

  mcp.tool(
    "register_customer",
    "Yeni bir cari (müşteri firma) kaydı açar veya mevcut kaydı zenginleştirir. " +
      "tradeName aynıysa kaydedilmiş olanı bulur ve eksik alanları doldurur (üzerine yazmaz). " +
      "Üzerine yazmak için update_customer kullan. " +
      "create_proposal zaten otomatik cari oluşturduğu için bunu sadece müşteriyi önceden kaydetmek " +
      "veya iletişim/vergi bilgisi eklemek için kullan.",
    {
      tradeName: z.string().min(1).describe("Ticari unvan, örn. 'Hatay Soslu Döner'"),
      contactPerson: z.string().optional(),
      greetingName: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().optional(),
      address: z.string().optional(),
      taxOffice: z.string().optional().describe("Vergi dairesi"),
      taxNo: z.string().optional().describe("Vergi numarası / TCKN"),
      notes: z.string().optional(),
    },
    async (args) => {
      try {
        const r = await customers.registerCustomer(args);
        return ok(r);
      } catch (e) {
        return err((e as Error).message);
      }
    },
  );

  mcp.tool(
    "list_customers",
    "Cari (müşteri) listesi. query verirsen tradeName içinde regex arar.",
    {
      query: z.string().optional(),
      limit: z.number().int().min(1).max(200).optional(),
    },
    async ({ query, limit }) => {
      try {
        const r = await customers.listCustomers(query, limit);
        return ok(r);
      } catch (e) {
        return err((e as Error).message);
      }
    },
  );

  mcp.tool(
    "get_customer",
    "Tek bir cari kaydını ID veya ticari unvanla getirir.",
    { idOrTradeName: z.string().min(1) },
    async ({ idOrTradeName }) => {
      try {
        const r = await customers.getCustomer(idOrTradeName);
        return ok(r);
      } catch (e) {
        return err((e as Error).message);
      }
    },
  );

  mcp.tool(
    "update_customer",
    "Cari master kaydını günceller. ÖNEMLİ: bu yalnızca master kaydı etkiler — " +
      "eski tekliflerdeki snapshot bilgileri DEĞİŞMEZ (PDF/sözleşme tarihi olarak donmuş kalır). " +
      "Bundan sonra yapılan teklifler güncel master snapshot'ını alır. " +
      "patch'te sadece değişen alanları gönder.",
    {
      idOrTradeName: z.string().min(1),
      patch: z
        .object({
          tradeName: z.string().optional(),
          contactPerson: z.string().optional(),
          greetingName: z.string().optional(),
          phone: z.string().optional(),
          email: z.string().optional(),
          address: z.string().optional(),
          taxOffice: z.string().optional(),
          taxNo: z.string().optional(),
          notes: z.string().optional(),
        })
        .strict(),
    },
    async ({ idOrTradeName, patch }) => {
      try {
        const r = await customers.updateCustomer(idOrTradeName, patch);
        return ok(r);
      } catch (e) {
        return err((e as Error).message);
      }
    },
  );

  mcp.tool(
    "forget_customer",
    "Cari kaydını siler. Bu carinin geçmiş teklifleri silinmez ama customerId referansı boşa düşer. " +
      "Kullanıcıdan açık 'evet sil' onayı al.",
    {
      idOrTradeName: z.string().min(1),
      confirm: z.literal(true),
    },
    async ({ idOrTradeName }) => {
      try {
        const deleted = await customers.forgetCustomer(idOrTradeName);
        return ok({ deleted });
      } catch (e) {
        return err((e as Error).message);
      }
    },
  );

  // ────────── EKİP ÜYELERİ ──────────

  mcp.tool(
    "register_member",
    "Bir ekip üyesini (Novem Yazılım personeli) takım defterine kaydeder veya günceller. " +
      "Kullanıcı 'beni kaydet, ben Osman' / 'Aziz olarak kaydet' / 'Mehmet'i ekibe ekle' " +
      "tarzı bir şey derse çağır. İsim aynıysa üzerine yazar (upsert). " +
      "telegramId opsiyonel ama varsa kayıt et — gelecekte sender'ı tanımak için kritik. " +
      "role örn. 'satış', 'yönetici', 'destek'.",
    {
      name: z.string().min(1).describe("Üyenin tam adı, örn. 'Osman Tuzcu'"),
      telegramId: z.string().regex(/^\d+$/).optional().describe("Telegram numerik user ID'si (sadece rakam)"),
      role: z.string().optional().describe("Görev/rol, örn. 'satış sorumlusu'"),
      notes: z.string().optional().describe("Serbest not, örn. 'POS uzmanı'"),
    },
    async (args) => {
      try {
        const r = await team.registerMember(args);
        return ok(r);
      } catch (e) {
        return err((e as Error).message);
      }
    },
  );

  mcp.tool(
    "list_members",
    "Tüm kayıtlı ekip üyelerini listeler. Her session başında bir kez çağırarak ekibi tanı. " +
      "Bir kişi ('Osman', 'Aziz' vb.) ile ilgili soru gelirse de buradan kontrol et.",
    {},
    async () => {
      try {
        const r = await team.listMembers();
        return ok(r);
      } catch (e) {
        return err((e as Error).message);
      }
    },
  );

  mcp.tool(
    "get_member",
    "Tek bir ekip üyesini ID veya isimle getirir.",
    { idOrName: z.string().min(1) },
    async ({ idOrName }) => {
      try {
        const r = await team.getMember(idOrName);
        return ok(r);
      } catch (e) {
        return err((e as Error).message);
      }
    },
  );

  mcp.tool(
    "send_message_to_member",
    "Bir ekip üyesinin Telegram DM'ine doğrudan mesaj gönderir. Bot Telegram API üzerinden bu kişiye yazar. " +
      "Kullanıcı 'Osman'a şunu söyle: ...' / 'Aziz'e haber ver: ...' tarzı bir şey derse bunu çağır. " +
      "Hedef üyenin telegramId'si kayıtlı olmalı. Değilse hata döner — o zaman kullanıcıya: " +
      "'X'in Telegram ID'si kayıtlı değil. X kendi botuna /start atıp @userinfobot'tan ID'sini alıp register_member çağırmalı.' de. " +
      "Mesaj içeriğine [Aziz diyor ki: ...] gibi gönderen bilgisini sen ekle ki alıcı kim yazdığını bilsin.",
    {
      memberName: z.string().min(1).describe("Hedef üyenin adı (örn. 'Osman') veya MongoDB ID'si"),
      message: z.string().min(1).describe("Gönderilecek tam mesaj metni. Gönderen bilgisini de ekle, örn. 'Aziz diyor ki: merhaba'"),
    },
    async ({ memberName, message }) => {
      try {
        const r = await team.sendMessageToMember(memberName, message);
        return ok(r);
      } catch (e) {
        return err((e as Error).message);
      }
    },
  );

  mcp.tool(
    "forget_member",
    "Bir ekip üyesini takım defterinden siler. Kullanıcıdan açık onay al ('evet sil').",
    {
      idOrName: z.string().min(1),
      confirm: z.literal(true).describe("Silmeyi onaylamak için true."),
    },
    async ({ idOrName }) => {
      try {
        const deleted = await team.forgetMember(idOrName);
        return ok({ deleted });
      } catch (e) {
        return err((e as Error).message);
      }
    },
  );

  // ────────── TEKLİF SİLME ──────────

  mcp.tool(
    "delete_proposal",
    "Teklifi siler (soft delete — DB'de işaretlenir, fiziksel silinmez). " +
      "Kullanıcıdan açıkça 'evet sil' onayı al. Önizleme tokenı da kapatılır.",
    {
      idOrNo: z.string().min(3),
      confirm: z.literal(true).describe("Silmeyi onaylamak için true gönder."),
    },
    async ({ idOrNo }) => {
      try {
        const ok_ = await service.deleteProposal(idOrNo);
        return ok({ deleted: ok_ });
      } catch (e) {
        return err((e as Error).message);
      }
    },
  );
}

/**
 * /home/<user>/Teklifler/foo.pdf → \\wsl$\<distro>\home\<user>\Teklifler\foo.pdf
 * (kullanıcı manuel açabilsin diye Windows'a uyumlu yol da döneriz; distro adı bilinmediği için
 * generic bir prefix kullanıyoruz — kullanıcı bilgisayar başında bunu manuel düzeltebilir.)
 */
function toWindowsPath(unixPath: string): string {
  return `\\\\wsl$\\<distro>${unixPath.replace(/\//g, "\\")}`;
}
