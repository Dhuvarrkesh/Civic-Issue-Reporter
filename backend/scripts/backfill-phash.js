"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const database_1 = require("../src/config/database");
const multimedia_model_1 = require("../src/models/multimedia.model");
const image_1 = require("../src/utils/image");
const backfill = () => __awaiter(void 0, void 0, void 0, function* () {
    yield (0, database_1.connectDB)();
    console.log("Starting phash backfill...");
    const cursor = multimedia_model_1.MultimediaModel.find({ fileType: "image", $or: [{ phash: { $exists: false } }, { phash: null }] }).cursor();
    let count = 0;
    for (let doc = yield cursor.next(); doc != null; doc = yield cursor.next()) {
        try {
            console.log("Processing:", doc._id, doc.url);
            const ph = yield (0, image_1.computePhash)(doc.url).catch((err) => {
                console.warn("phash failed for", doc.url, err.message || err);
                return null;
            });
            if (ph) {
                doc.phash = ph;
                yield doc.save();
                count++;
                console.log("Updated", doc._id);
            }
        }
        catch (err) {
            console.error("Error processing doc", doc._id, err.message || err);
        }
    }
    console.log(`Completed. Updated ${count} docs.`);
    process.exit(0);
});
backfill().catch((err) => {
    console.error("Backfill error:", err);
    process.exit(1);
});
