require("dotenv").config();

const axios = require("axios");
const supabase = require("./supabase");

function sleep(ms){
    return new Promise(r=>setTimeout(r,ms));
}

async function searchEntity(name){

    const url=`https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(name)}&language=en&format=json`;

    const {data}=await axios.get(url);

    if(!data.search.length) return null;

    return data.search[0].id;
}

async function getEntity(id){

    const url=`https://www.wikidata.org/wiki/Special:EntityData/${id}.json`;

    const {data}=await axios.get(url);

    return data.entities[id];
}

async function main(){

    const {data:universities}=await supabase
    .from("universities")
    .select("id,name");

    console.log(`Found ${universities.length} universities`);

    let updated=0;

    for(const uni of universities){

        console.log("Searching",uni.name);

        try{

            const entityId=await searchEntity(uni.name);

            if(!entityId){
                console.log("Not found");
                continue;
            }

            const entity=await getEntity(entityId);

            const claims=entity.claims;

            const website=
            claims.P856?.[0]?.mainsnak?.datavalue?.value || null;

            const founded=
            claims.P571?.[0]?.mainsnak?.datavalue?.value?.time || null;

            const coords=
            claims.P625?.[0]?.mainsnak?.datavalue?.value || null;

            const logoFile=
            claims.P154?.[0]?.mainsnak?.datavalue?.value || null;

            const description=
            entity.descriptions?.en?.value || null;

            let logo=null;

            if(logoFile){

                logo=`https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(logoFile)}`;
            }

            await supabase
            .from("universities")
            .update({

                website:website,

                description:description,

                founded_year:
                founded?parseInt(founded.substring(1,5)):null,

                latitude:coords?coords.latitude:null,

                longitude:coords?coords.longitude:null,

                logo:logo

            })
            .eq("id",uni.id);

            updated++;

            console.log("Updated",uni.name);

        }catch(e){

            console.log("Skipped",uni.name);

        }

        await sleep(250);

    }

    console.log("Finished");
    console.log(updated);

}

main();