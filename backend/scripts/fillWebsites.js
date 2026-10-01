require("dotenv").config();

const axios = require("axios");
const supabase = require("./supabase");

async function fillWebsites() {
  console.log("🚀 Fetching universities from Supabase...");

  const { data: universities, error } = await supabase
    .from("universities")
    .select("id, name, country");

  if (error) {
    console.log(error);
    return;
  }

  console.log(`📚 Found ${universities.length} universities`);

  let updated = 0;

  for (const uni of universities) {
    try {
      const url = `http://universities.hipolabs.com/search?name=${encodeURIComponent(
        uni.name
      )}&country=${encodeURIComponent(uni.country)}`;

      const response = await axios.get(url);

      if (response.data.length > 0) {
        const website = response.data[0].web_pages[0];

        await supabase
          .from("universities")
          .update({
            website: website,
          })
          .eq("id", uni.id);

        updated++;

        console.log(
          `✅ ${updated}/${universities.length} - ${uni.name}`
        );
      } else {
        console.log(`❌ Website not found: ${uni.name}`);
      }

    } catch (err) {
      console.log(`⚠️ Error: ${uni.name}`);
    }
  }

  console.log("🎉 Finished!");
}

fillWebsites();