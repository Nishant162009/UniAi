const supabase = require("../supabase");

// ======================
// GET ALL UNIVERSITIES
// Search + Filters
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

    // Sorting
    if (sort === "rank") {
      query = query.order("qs_rank", {
        ascending: true,
      });
    }

    if (sort === "score") {
      query = query.order("overall_score", {
        ascending: false,
      });
    }

    const { data, error } = await query;

    if (error) {
      return res.status(500).json(error);
    }

    let filtered = data;

    // Budget Filter
    if (budget) {
      filtered = filtered.filter(
        (u) =>
          !u.tuition_fee ||
          Number(u.tuition_fee) <= Number(budget)
      );
    }

    res.json(filtered);

  } catch (err) {
    console.log(err);
    res.status(500).json({
      message: "Server Error",
    });
  }
};

// ======================
// GET SINGLE UNIVERSITY
// ======================

const getUniversity = async (req, res) => {
  try {

    const { slug } = req.params;

    const { data, error } = await supabase
      .from("universities")
      .select("*")
      .eq("slug", slug)
      .single();

    if (error || !data) {
      return res.status(404).json({
        message: "University not found"
      });
    }

    res.json(data);

  } catch (err) {

    console.error(err);

    res.status(500).json({
      message: err.message
    });

  }
};




const getCountries = async (req, res) => {
    try {

        const { data, error } = await supabase
            .from("universities")
            .select("country");

        if (error) {
            return res.status(500).json(error);
        }

        const countries = [...new Set(
            data
                .map(u => u.country)
                .filter(Boolean)
        )].sort();

        res.json(countries);

    } catch (err) {

        res.status(500).json({
            message: err.message
        });

    }
};

module.exports = {
    getUniversities,
    getUniversity,
    getCountries
};