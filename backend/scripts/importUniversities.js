require("dotenv").config();

const fs = require("fs");
const csv = require("csv-parser");
const supabase = require("./supabase");

const universities = [];

fs.createReadStream("universities.csv")
  .pipe(csv())
  .on("data", (row) => {

    // Skip the second header row
    if (row["Institution Name"] === "institution") return;

    universities.push({
      name: row["Institution Name"],
      country: row["Country"],
      country_code: row["Country Code"],

      qs_rank: Number(row["2024 RANK"]) || null,

      overall_score: Number(row["Overall SCORE"]) || null,
      academic_score: Number(row["Academic Reputation Score"]) || null,
      employer_score: Number(row["Employer Reputation Score"]) || null,
      faculty_score: Number(row["Faculty Student Score"]) || null,
      citations_score: Number(row["Citations per Faculty Score"]) || null,
      international_score: Number(row["International Students Score"]) || null,
      sustainability_score: Number(row["Sustainability Score"]) || null,

      city: null,
      continent: null,

      tuition_fee: null,
      living_cost: null,

      ielts: null,
      toefl: null,

      gre: false,
      scholarships: false,

      degree_levels: null,
      courses: [],

      application_deadline: null,
      intakes: [],

      acceptance_rate: null,

      website: null,
      logo: null,
      description: null
    });

  })
  .on("end", async () => {

    console.log(`📚 Found ${universities.length} universities`);

    const chunkSize = 100;

    for (let i = 0; i < universities.length; i += chunkSize) {

      const chunk = universities.slice(i, i + chunkSize);

      const { error } = await supabase
        .from("universities")
        .insert(chunk);

      if (error) {
        console.log(error);
        return;
      }

      console.log(`✅ Imported ${i + chunk.length}/${universities.length}`);

    }

    console.log("🎉 ALL UNIVERSITIES IMPORTED!");
  });