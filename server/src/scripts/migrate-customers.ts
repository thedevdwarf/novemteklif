/**
 * Bir kerelik migration: mevcut tekliflerdeki embed customer bilgilerini tarar,
 * benzersiz cari (customers) kayıtları oluşturur, her teklife customerId atar.
 *
 * Çalıştır:
 *   cd server && npm run build && node dist/scripts/migrate-customers.js
 * Veya geliştirme için:
 *   cd server && npx tsx src/scripts/migrate-customers.ts
 *
 * Idempotent: tekrar çalıştırılırsa zaten customerId'si olan teklifleri atlar,
 * tradeName eşleşen carileri yeniden oluşturmaz.
 */
import { ObjectId } from "mongodb";
import { connectDb, closeDb, proposals } from "../db.js";
import * as customerRepo from "../customers/repository.js";
import * as customerService from "../customers/service.js";

interface Stats {
  proposalsScanned: number;
  proposalsAlreadyLinked: number;
  proposalsLinkedNow: number;
  customersCreated: number;
  customersExisting: number;
  errors: Array<{ proposalNo: string; error: string }>;
}

async function run(): Promise<Stats> {
  const stats: Stats = {
    proposalsScanned: 0,
    proposalsAlreadyLinked: 0,
    proposalsLinkedNow: 0,
    customersCreated: 0,
    customersExisting: 0,
    errors: [],
  };

  await connectDb();
  console.log("[migrate] connected");

  // En son güncellenmiş tekliften en eskiye doğru — böylece master record en güncel bilgiyi alır
  const cursor = proposals().find({ deletedAt: null }).sort({ updatedAt: -1 });

  for await (const p of cursor) {
    stats.proposalsScanned++;
    if (p.customerId) {
      stats.proposalsAlreadyLinked++;
      continue;
    }
    if (!p.customer?.tradeName) {
      stats.errors.push({ proposalNo: p.proposalNo, error: "tradeName yok" });
      continue;
    }
    try {
      const beforeCount = await customerRepo
        .findByTradeName(p.customer.tradeName)
        .then((d) => (d ? 1 : 0));
      const master = await customerService.findOrCreate({
        tradeName: p.customer.tradeName,
        contactPerson: p.customer.contactPerson,
        greetingName: p.customer.greetingName,
        address: p.customer.address,
        taxOffice: p.customer.taxOffice,
        taxNo: p.customer.taxNo,
      });
      if (beforeCount === 0) stats.customersCreated++;
      else stats.customersExisting++;

      await proposals().updateOne(
        { _id: p._id },
        { $set: { customerId: new ObjectId(master.id) } },
      );
      stats.proposalsLinkedNow++;
      console.log(`[migrate] ${p.proposalNo} → ${master.tradeName} (${master.id})`);
    } catch (e) {
      stats.errors.push({ proposalNo: p.proposalNo, error: (e as Error).message });
    }
  }

  return stats;
}

run()
  .then(async (stats) => {
    console.log("\n=== ÖZET ===");
    console.log(JSON.stringify(stats, null, 2));
    await closeDb();
    process.exit(stats.errors.length > 0 ? 1 : 0);
  })
  .catch(async (e) => {
    console.error("[fatal]", e);
    await closeDb();
    process.exit(1);
  });
