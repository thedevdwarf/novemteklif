import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as service from "../proposals/service.js";
import { renderPdf } from "../render/pdf.js";

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
      "customerName regex prefix arar; query text index üzerinden tüm metinde arar.",
    {
      query: z.string().optional(),
      customerName: z.string().optional(),
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
