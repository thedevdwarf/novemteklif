/**
 * Kullanılabilir teklif HTML tema/şablonlarının kayıt defteri.
 *
 * Her şablon `server/templates/` altında bir .hbs dosyasına karşılık gelir ve
 * aynı ProposalView veri alanlarını ({{proposalNo}}, {{#each items}} ...) kullanır;
 * sadece görsel düzen/tema değişir. Yeni bir tema eklemek için:
 *   1) server/templates/proposal-<id>.hbs dosyasını oluştur,
 *   2) buraya bir TemplateMeta kaydı ekle.
 * Veri modeline veya render akışına dokunmaya gerek yoktur.
 */

export interface TemplateMeta {
  id: string;
  label: string;
  description: string;
  file: string;
}

export const DEFAULT_TEMPLATE_ID = "default";

export const PROPOSAL_TEMPLATES: Record<string, TemplateMeta> = {
  default: {
    id: "default",
    label: "Standart",
    description: "Novem standart teklif teması (restoran/POS odaklı): kapak + ürün tanıtımı + modüller + fiyat tablosu + koşullar. Lacivert + camgöbeği.",
    file: "proposal.hbs",
  },
  retail: {
    id: "retail",
    label: "Perakende",
    description: "Perakende/market odaklı tema: barkodlu satış, stok-raf, kampanya, sadakat ve çoklu şube içeriği. Zümrüt yeşili + amber.",
    file: "proposal-retail.hbs",
  },
};

export function listTemplates(): TemplateMeta[] {
  return Object.values(PROPOSAL_TEMPLATES);
}

export function isValidTemplateId(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(PROPOSAL_TEMPLATES, id);
}

/**
 * Verilen id'ye karşılık gelen meta'yı döner; bilinmiyorsa default'a düşer.
 * (Render tarafında güvenli fallback için; girdi validasyonu service katmanında yapılır.)
 */
export function resolveTemplate(id?: string | null): TemplateMeta {
  return (id ? PROPOSAL_TEMPLATES[id] : undefined) ?? PROPOSAL_TEMPLATES[DEFAULT_TEMPLATE_ID]!;
}
