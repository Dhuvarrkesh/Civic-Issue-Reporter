import "dotenv/config";
import { connectDB } from "../src/config/database";
import { MultimediaModel } from "../src/models/multimedia.model";
import { computePhash } from "../src/utils/image";

const backfill = async () => {
  await connectDB();
  console.log("Starting phash backfill...");

  const cursor = MultimediaModel.find({ fileType: "image", $or: [{ phash: { $exists: false } }, { phash: null }] }).cursor();

  let count = 0;
  for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
    try {
      console.log("Processing:", doc._id, doc.url);
      const ph = await computePhash(doc.url).catch((err) => {
        console.warn("phash failed for", doc.url, err.message || err);
        return null;
      });
      if (ph) {
        doc.phash = ph as any;
        await doc.save();
        count++;
        console.log("Updated", doc._id);
      }
    } catch (err) {
      console.error("Error processing doc", doc._id, err.message || err);
    }
  }

  console.log(`Completed. Updated ${count} docs.`);
  process.exit(0);
};

backfill().catch((err) => {
  console.error("Backfill error:", err);
  process.exit(1);
});
