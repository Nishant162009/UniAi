const express = require("express");
const router = express.Router();

const {
  getUniversities,
  getUniversity,
  getCountries
} = require("../controllers/universityController");

// MUST come before "/:slug"
router.get("/countries", getCountries);

router.get("/", getUniversities);

router.get("/:slug", getUniversity);

module.exports = router;