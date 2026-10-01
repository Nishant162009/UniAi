require("dotenv").config();

const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
// Step 2: Added the similarity package import
const stringSimilarity = require("string-similarity");

const supabase = require("../supabase");

const rows = [];

/*
----------------------------------------
Normalize university names
----------------------------------------
*/
// Step 2: Replaced the normalize function
function normalize(str) {
    if (!str) return "";

    return str
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\w\s]/g, " ")
        .replace(/\buniversity\b/g, "")
        .replace(/\buniversitat\b/g, "")
        .replace(/\buniversité\b/g, "")
        .replace(/\binstitute\b/g, "")
        .replace(/\bcollege\b/g, "")
        .replace(/\bof\b/g, "")
        .replace(/\bthe\b/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

/*
----------------------------------------
Aliases
----------------------------------------
*/
const aliases = {
    "technical munich": "ludwig-maximilians-universitat munchen",
    "tum": "technische munchen",
    "lmu munich": "ludwig maximilians munchen",
    "eth zurich": "eth zurich",
    "uc berkeley": "california berkeley"
};

/*
----------------------------------------
Main
----------------------------------------
*/
(async () => {
    // Step 7: Replaced the fixed range fetch with a paginated while loop to load all records
    let database = [];
    let from = 0;
    while (true) {
        const { data, error } = await supabase
            .from("universities")
            .select("*")
            .range(from, from + 999);

        if (error) {
            console.error("Error fetching data:", error);
            break;
        }

        if (!data || !data.length) break;

        database.push(...data);
        from += 1000;
    }
    console.log("Loaded", database.length, "universities");

    const csvPath = path.join(__dirname, "education.csv");
    console.log(csvPath);

    fs.createReadStream(csvPath)
        .pipe(csv())
        .on("data", row => rows.push(row))
        .on("end", async () => {
            let updated = 0;
            let skipped = 0;
            let notFound = 0;

            for (const row of rows) {
                let target = normalize(row.University);

                if (aliases[target]) {
                    target = aliases[target];
                }

                // Step 3: Replaced exact/substring loop with stringSimilarity scoring loop
                let best = null;
                let bestScore = 0;
                
                for (const uni of database) {
                    const score = stringSimilarity.compareTwoStrings(
                        target,
                        normalize(uni.name)
                    );

                    if (score > bestScore) {
                        bestScore = score;
                        best = uni;
                    }
                }

                // Step 3 (cont.): Skip if the matching confidence score is below 72%
                if (bestScore < 0.72) {
                    console.log("❌", row.University);
                    notFound++;
                    continue;
                }

                console.log(
                    `Matched ${row.University} -> ${best.name} (${(bestScore * 100).toFixed(1)}%)`
                );

                // Step 4: Initialized and updated all requested fields
                const update = {};

                if (!best.city && row.City)
                    update.city = row.City;
                
                if (!best.state && row.State)
                    update.state = row.State;
                
                if (!best.country && row.Country)
                    update.country = row.Country;
                
                if (!best.tuition_fee && row.Tuition_USD)
                    update.tuition_fee = Number(row.Tuition_USD);
                
                if (!best.living_cost && row.Living_Cost_Index)
                    update.living_cost = Number(row.Living_Cost_Index);

                // Step 5 & 6: Log changes and skip if there's nothing new to update
                if (Object.keys(update).length === 0) {
                    skipped++;
                    continue;
                }

                console.log("--------------------------------");
                console.log(best.name);
                console.table(update);

                // Perform the actual update in Supabase
                const { error: updateError } = await supabase
                    .from("universities")
                    .update(update)
                    .eq("id", best.id);

                if (updateError) {
                    console.log(updateError.message);
                    continue;
                }

                updated++;
                console.log("✅ Updated database successfully");
            }

            console.log("\n=====================");
            console.log("Updated :", updated);
            console.log("Skipped :", skipped);
            console.log("Not Found:", notFound);
            console.log("=====================");
        });
})();