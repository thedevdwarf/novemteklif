import type { ObjectId } from "mongodb";

export interface TermBlock {
  title: string;
  paragraphs: string[];
}

export interface TermsTemplateDoc {
  _id: ObjectId;
  name: string;
  isDefault: boolean;
  blocks: TermBlock[];
  parentId?: ObjectId | null;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TermsTemplateInput {
  name: string;
  blocks: TermBlock[];
  notes?: string;
}

export interface TermsTemplateView {
  id: string;
  name: string;
  isDefault: boolean;
  blocks: TermBlock[];
  parentId?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Şu an proposal.hbs'te hardcoded olarak duran 7 maddeden oluşan koşullar.
 * Boot sırasında DB'de "default" adıyla seed edilir.
 */
export const DEFAULT_BLOCKS: TermBlock[] = [
  {
    title: "Fiyatlandırma ve KDV",
    paragraphs: [
      "Yazılım ürünlerimiz bulut tabanlı olarak sunulmakta olup, teklifteki yazılım kalemleri yıllık kiralama bedelidir.",
      "Fiyat tekliflerimize KDV dahil değildir.",
      "Döviz cinsinden verilen fiyatlar, fatura tarihinde geçerli olan Garanti Bankası döviz satış kuru üzerinden Türk Lirası'na çevrilerek faturalandırılır.",
    ],
  },
  {
    title: "Ödeme Koşulları",
    paragraphs: [
      "Toplam tutarın %50'si sözleşme imzasında peşin, kalan %50'si kurulum ile birlikte ödenir.",
      "Yıllık destek ve abonelik bedelleri, o yılın faturası kesildikten sonra 15 gün içinde ödenir.",
    ],
  },
  {
    title: "Teslimat Koşulları",
    paragraphs: [
      "Proje teklif onayı ve satış koşulları yerine getirildikten sonra 1 iş günü içinde yerinde kurulum yapılıp eğitimleri verilecektir.",
      "Kurulumun yapılacağı işletmede gerekli çalışma koşulları sağlandığı sürece 1 iş günü içinde kurulum ve eğitim işlemleri yetkili personelimiz tarafından gerçekleştirilerek teslim edilecektir.",
      "Novem Yazılım personeli müşterinin personel sayısına bakılmaksızın bütün çalışanların kullanacağı kısımlarla ilgili eğitimleri eksiksiz bir şekilde vermekle yükümlüdür.",
      "İstanbul dışı yapılacak olan kargo gönderimleri olması halinde ücreti müşteri tarafından karşılanacaktır.",
      "İstanbul dışı yapılacak olan kurulumlarda yol ve konaklama ücretleri müşteri tarafından karşılanacaktır.",
      "Novem Yazılım personeli işletmenin çalışırken kullandığı fiş ve fatura dizaynlarını yetkili personelin istekleri doğrultusunda yapacaktır.",
    ],
  },
  {
    title: "Garanti",
    paragraphs: [
      "Yazılım ürünlerimiz aktif destek anlaşması süresince güncelleme ve versiyon değişikliklerinden ücretsiz olarak faydalanır.",
      "Müşteri 7 gün, saat 09:00 - 00:00 arasında teknik servisten uzaktan masaüstü desteği alabilir.",
      "Donanım ürünlerinin garantisi distribütör firma üzerinden devam etmektedir ve süresi 2 yıldır.",
      "Yetkili olmayan kişilerin müdahalesi, Novem'e haber verilmeden yapılan müdahale ve değişiklikler, ürün garanti etiketine zarar verilmesi, yetersiz topraklama, enerji ve data hattı sorunları vb. gibi hallerde cihazlarda oluşan arızalar garanti kapsamı dışında kalır. Sorunun durumuna göre 100 $ üzerinden servis fiyatlandırması yapılır.",
    ],
  },
  {
    title: "Teknik Altyapı ve Barındırma",
    paragraphs: [
      "Bulut tabanlı Novem POS hizmetimiz, Novem Yazılım altyapısında barındırılır. Müşteri tarafında stabil internet bağlantısı, uygun elektrik altyapısı (topraklı hat, tercihen UPS) ve gerekli donanım sağlanmalıdır.",
      "Ödeme Kaydedici Cihaz (ÖKC) kullanan işletmelerde, yürürlükteki Vergi Usul Kanunu gereği ÖKC ile satış yazılımının entegre çalışması zorunludur. Bu yükümlülük mükellefe aittir.",
    ],
  },
  {
    title: "Gizlilik ve Güvenlik",
    paragraphs: [
      'Bu doküman ve ekleri çerçevesinde, taraflarca birbirlerine (sözleşme, tutanak, teknik-özellikler, iş ve organizasyon dokümanları gibi yollar dahil) her şekil ve biçimde verilen bilgiler, bu bilgileri temin eden tarafın "Açıklayan Taraf" mülkiyetinde olan "Gizli Bilgi" sayılır. Bu bilgileri "Alan Taraf", "Açıklayan Taraf"ın özel yazılı izin vermesi dışında, bu bilgileri gizli tutacak, kısmen ya da tamamen üçüncü taraflara açıklamayacaktır. Bu yükümlülük sözleşme ile kurulan bağların sona ermesi ya da erdirilmesi halinde de sürecektir. Bilgiyi "Alan Taraf", bu bilgiyi sadece sözleşmede tanımlanan amaçlar için kullanacak ve sadece bu kapsamda bilmesi gereken personeline açıklayacak ve ilgili personelini, bu bilgileri vermeden önce, "Bilgi Gizliliği" sorumlulukları hususunda uyaracaktır.',
    ],
  },
  {
    title: "Teklif Geçerliliği",
    paragraphs: [
      "Bu teklif, teklif tarihinden itibaren 7 gün süre ile geçerlidir. Bu sürenin sonunda fiyatlar yeniden değerlendirilebilir.",
    ],
  },
];
