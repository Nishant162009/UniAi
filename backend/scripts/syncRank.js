require("dotenv").config();
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const CSV_FILE_PATH = path.join(__dirname, "universities.csv"); 

async function syncRanks() {
  console.log("🚀 Starting Smart Rank Synchronization Pipeline...");
  const rows = [];

  fs.createReadStream(CSV_FILE_PATH)
    .pipe(csv())
    .on("data", (data) => rows.push(data))
    .on("end", async () => {
      console.log(`Parsed ${rows.length} rows from CSV...`);

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        
        // Find keys dynamically to prevent issues with hidden spaces or BOM characters
        const keys = Object.keys(row);
        const nameKey = keys.find(k => k.trim().toLowerCase() === "institution name" || k.trim().toLowerCase() === "name");
        
        // Look for any key that contains both "2024" and "rank"
        const rankKey = keys.find(k => k.toLowerCase().includes("2024") && k.toLowerCase().includes("rank"));

        const rawName = nameKey ? row[nameKey] : null;
        const rawRank = rankKey ? row[rankKey] : null;

        if (!rawName) continue;

        const cleanName = rawName.trim();

        // SKIP SUB-HEADERS OR EMPTY ROWS
        if (
          cleanName.toLowerCase() === "institution name" || 
          cleanName.toLowerCase() === "name" || 
          cleanName.toLowerCase() === "display name" ||
          cleanName === ""
        ) {
          console.log(`⏭️ Skipping header/metadata row: "${cleanName}"`);
          continue;
        }

        let parsedRank = null;
        if (rawRank) {
          let cleanRank = rawRank.toString().replace(/=/g, "").trim();
          if (cleanRank.includes("-")) {
            cleanRank = cleanRank.split("-")[0].trim();
          }
          if (!isNaN(cleanRank) && cleanRank !== "") {
            parsedRank = parseInt(cleanRank, 10);
          }
        }

        // Update Supabase
        const { error } = await supabase
          .from("universities")
          .update({ qs_rank: parsedRank })
          .ilike("name", cleanName);

        if (error) {
          console.error(`❌ Failed to update rank for "${cleanName}":`, error.message);
        } else {
          console.log(`[${i + 1}/${rows.length}] ✅ "${cleanName}" -> qs_rank: ${parsedRank}`);
        }
      }
      console.log("\n🎉 Synchronization complete!");
    });
}

syncRanks();