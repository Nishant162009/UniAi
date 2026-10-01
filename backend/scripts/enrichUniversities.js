require("dotenv").config();

const axios = require("axios");
const supabase = require("./supabase");

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function searchWikipedia(name) {
  try {
    const search = await axios.get(
      "https://en.wikipedia.org/w/api.php",
      {
        params: {
          action: "query",
          list: "search",
          srsearch: name,
          format: "json"
        }
      }
    );

    if (!search.data.query.search.length) return null;

    const title = search.data.query.search[0].title;

    const summary = await axios.get(
      "https://en.wikipedia.org/api/rest_v1/page/summary/" +
      encodeURIComponent(title)
    );

    return {
      title,
      description: summary.data.extract || null,
      wikipedia:
        "https://en.wikipedia.org/wiki/" +
        encodeURIComponent(title),

      banner:
        summary.data.originalimage
          ? summary.data.originalimage.source
          : null,

      logo:
        summary.data.thumbnail
          ? summary.data.thumbnail.source
          : null
    };

  } catch (err) {
    return null;
  }
}

async function main() {

  const { data: universities } = await supabase
    .from("universities")
    .select("id,name,logo,description,wikipedia,banner");

  console.log(`Found ${universities.length} universities`);

  let updated = 0;

  for (const uni of universities) {

    console.log("Searching:", uni.name);

    const wiki = await searchWikipedia(uni.name);

    if (!wiki) continue;

    const { error } = await supabase
      .from("universities")
      .update({

        description: wiki.description,

        wikipedia: wiki.wikipedia,

        banner: wiki.banner,

        logo: uni.logo || wiki.logo

      })
      .eq("id", uni.id);

    if (!error) {
      updated++;
      console.log("Updated:", uni.name);
    }

    await sleep(400);
  }

  console.log("Finished");
  console.log(updated);

}

main();