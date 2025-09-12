// In server/routes/calculator.js

// Import the Express router.
const express = require("express");
// Import the analyzeImage function from our utility file.
const { analyzeImage } = require("../utils/gemini-analyzer");

// Create a new router instance.
const router = express.Router();

// Define a POST route at the root ('/').
// This route will be asynchronous.
router.post("/", async (req, res) => {
  //  1. Use a try...catch block for error handling.
  try {
    //  2. Destructure 'image' and 'dict_of_vars' from the request body (req.body).
    const { image, dict_of_vars } = req.body || {};
    //  3. If they don't exist, return a 400 error.
    if (!image || typeof dict_of_vars !== "object") {
      return res.status(400).json({
        error:
          "Missing required fields: image (base64 data URL) and dict_of_vars (object).",
      });
    }
    //  4. Call the analyzeImage function, passing the image data and the variables.
    const result = await analyzeImage(image, dict_of_vars);
    //  5. Send a 200 success response with the JSON result from analyzeImage.
    if (!Array.isArray(result)) {
      console.error("Analyzer returned non-array result");
      return res
        .status(500)
        .json({ error: "Analyzer failed to produce a valid array" });
    }
    return res.status(200).json(result);
  } catch (err) {
    //  6. In the catch block, log the error and send an appropriate server error response.
    const message = err?.message || String(err);
    const isOverload =
      message.includes("503") || message.toLowerCase().includes("overloaded");
    const status = isOverload ? 503 : 500;
    console.error("Error in /api/calculate:", message);
    return res
      .status(status)
      .json({
        error:
          status === 503 ? "Model overloaded, please retry" : "Server error",
        details: message,
      });
  }
});

// Export the router.
module.exports = router;
