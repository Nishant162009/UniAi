
const supabase = require("../supabase");
const enricher = require("../services/enricher");

// ======================
// GET ALL UNIVERSITIES
// Search + Filters
// No AI enrichment on the list
// ======================

const getUniversities = async (req, res) => {
  try {
    const {
      search,
      country,
      budget,
      rank,
      sort,
    } = req.query;

    let query = supabase
      .from("universities")
      .select("*");

    // Search by university name
    if (search) {
      query = query.ilike("name", `%${search}%`);
    }

    // Country filter
    if (country) {
      query = query.eq("country", country);
    }

    // QS Rank filter
    if (rank) {
      query = query.lte("qs_rank", Number(rank));
    }

    // Sorting by QS rank
    if (sort === "rank") {
      query = query.order("qs_rank", {
        ascending: true,
      });
    }

    // Sorting by overall score
    if (sort === "score") {
      query = query.order("overall_score", {
        ascending: false,
      });
    }

    const { data, error } = await query;

    if (error) {
      console.error("Fetch universities error:", error);

      return res.status(500).json({
        message: "Failed to fetch universities",
      });
    }

    let filtered = data || [];

    // Budget filter
    if (budget) {
      const maxBudget = Number(budget);

      if (!Number.isFinite(maxBudget) || maxBudget < 0) {
        return res.status(400).json({
          message: "Invalid budget value",
        });
      }

      filtered = filtered.filter(
        (u) =>
          !u.tuition_fee ||
          Number(u.tuition_fee) <= maxBudget
      );
    }

    return res.json(filtered);

  } catch (err) {
    console.error("Get universities error:", err);

    return res.status(500).json({
      message: "Server Error",
    });
  }
};


// ======================
// GET SINGLE UNIVERSITY
// AI enrichment only for one university
// ======================

const getUniversity = async (req, res) => {
  try {
    const { slug } = req.params;

    // Fetch one university by slug
    const { data, error } = await supabase
      .from("universities")
      .select("*")
      .eq("slug", slug)
      .single();

    // University not found
    if (error || !data) {
      return res.status(404).json({
        message: "University not found",
      });
    }

    // Enrich only this university
    const enriched = await enricher.enrich(data, {
      generate: true,
      timeoutMs: 9000,
    });

    return res.json(enriched);

  } catch (err) {
    console.error("Get single university error:", err);

    return res.status(500).json({
      message: err.message || "Server Error",
    });
  }
};


// ======================
// GET ALL COUNTRIES
// ======================

const getCountries = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("universities")
      .select("country");

    if (error) {
      console.error("Fetch countries error:", error);

      return res.status(500).json({
        message: "Failed to fetch countries",
      });
    }

    const countries = [
      ...new Set(
        (data || [])
          .map((u) => u.country)
          .filter(Boolean)
      ),
    ].sort();

    return res.json(countries);

  } catch (err) {
    console.error("Get countries error:", err);

    return res.status(500).json({
      message: err.message || "Server Error",
    });
  }
};


// ======================
// EXPORT CONTROLLERS
// ======================

module.exports = {
  getUniversities,
  getUniversity,
  getCountries,
};
