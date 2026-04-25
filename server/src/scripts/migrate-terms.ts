/**
 * Bir kerelik migration: default terms_template'i seed eder, mevcut tekliflerde
 * terms snapshot eksikse default'tan kopya embed eder.
 *
 * Çalıştır:  npm run migrate:terms
 * Idempotent: zaten terms'i olan teklifleri atlar.
 */
import { ObjectId } from "mongodb";
import { connectDb, closeDb, proposals } from "../db.js";
import * as termsService from "../terms/service.js";

interface Stats {
  defaultEnsured: { id: string; name: string };
  scanned: number;
  alreadyHasTerms: number;
  embeddedNow: number;
  errors: Array<{ proposalNo: string; error: string }>;
}

async function run(): Promise<Stats> {
  await connectDb();
  console.log("[migrate-terms] connected");

  const def = await termsService.ensureDefault();
  const stats: Stats = {
    defaultEnsured: { id: def.id, name: def.name },
    scanned: 0,
    alreadyHasTerms: 0,
    embeddedNow: 0,
    errors: [],
  };

  const cursor = proposals().find({ deletedAt: null });
  for await (const p of cursor) {
    stats.scanned++;
    if (p.terms && p.terms.length > 0) {
      stats.alreadyHasTerms++;
      continue;
    }
    try {
      await proposals().updateOne(
        { _id: p._id },
        {
          $set: {
            terms: def.blocks.map((b) => ({ title: b.title, paragraphs: [...b.paragraphs] })),
            termsTemplateId: new ObjectId(def.id),
          },
        },
      );
      stats.embeddedNow++;
      console.log(`[migrate-terms] ${p.proposalNo} → terms snapshot eklendi`);
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
