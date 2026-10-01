require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");
const axios = require("axios");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getLogoBuffer(domain) {
  try {
    const response = await axios.get(`https://logo.clearbit.com/${domain}`, {
      responseType: "arraybuffer",
      timeout: 5000
    });
    return Buffer.from(response.data, "binary");
  } catch (err) {
    return null;
  }
}

async function processLogos() {
  console.log("🚀 Starting Logo Retrieval Pipeline...");

  // Select universities that have a website but do not have a logo URL yet
  const { data: universities, error } = await supabase
    .from("universities")
    .select('id, "Institution Name", web_page, logo')
    .not("web_page", "is", null)
    .is("logo", null)
    .limit(30);

  if (error) {
    console.error("Error fetching universities:", error);
    return;
  }

  console.log(`Processing logos for ${universities.length} institutions...`);

  for (let i = 0; i < universities.length; i++) {
    const uni = universities[i];
    const rawUrl = uni.web_page;

    try {
      // Parse domain out of the URL (e.g. "https://mit.edu/index.html" -> "mit.edu")
      const parsedUrl = new URL(rawUrl);
      let domain = parsedUrl.hostname;
      if (domain.startsWith("www.")) {
        domain = domain.substring(4);
      }

      console.log(`[${i+1}/${universities.length}] Fetching logo for ${domain}...`);
      const logoBuffer = await getLogoBuffer(domain);

      if (logoBuffer) {
        const fileName = `${uni.id}.png`;

        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("logos")
          .upload(fileName, logoBuffer, {
            contentType: "image/png",
            upsert: true
          });

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: publicUrlData } = supabase.storage
          .from("logos")
          .getPublicUrl(fileName);

        const logoUrl = publicUrlData.publicUrl;

        // Save URL back into the database column "logo"
        await supabase
          .from("universities")
          .update({ logo: logoUrl })
          .eq("id", uni.id);

        console.log(`✅ Uploaded logo for ${uni["Institution Name"]} -> ${logoUrl}`);
      } else {
        console.log(`⚠️ No favicon found for: ${domain}`);
      }
    } catch (err) {
      console.error(`❌ Failed processing logo for: ${uni["Institution Name"]}`, err.message);
    }

    await delay(500);
  }
  console.log("🎉 Logo Pipeline Run complete!");
}

processLogos();