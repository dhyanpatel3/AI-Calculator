// In server/index.js

// Import necessary packages: express, cors, and dotenv.
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

// Configure dotenv to load environment variables.
dotenv.config();

// Initialize an Express app.
const app = express();

// Use the cors middleware to allow cross-origin requests.
app.use(cors());
// Use the express.json middleware to parse incoming JSON payloads.
// Increase the payload limit to handle the large base64 image string
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

// Import the calculator routes.
const calculatorRouter = require("./routes/calculator");
// Use the calculator routes for any requests to the '/api/calculate' endpoint.
app.use("/api/calculate", calculatorRouter);

// Health endpoint
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Define the port from environment variables, with a fallback.
const PORT = process.env.PORT || 8000;

// Start the server and listen on the defined port. Log a confirmation message to the console.
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
