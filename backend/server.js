const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const mlRoutes = require("./routes/mlRoutes");
const creditRiskRoutes = require("./routes/creditRiskRoutes");

// 1. Initialize Express app FIRST
const app = express();

// ============================================================
// Middleware
// ============================================================

// 2. Attach CORS and JSON parsing to app
app.use(cors());
app.use(express.json());

// ============================================================
// Routes
// ============================================================

// ML-only prediction
app.use("/api/ml", mlRoutes);

// Complete credit risk evaluation
app.use("/api/credit-risk", creditRiskRoutes);

// ============================================================
// Health Check
// ============================================================

app.get("/", (req, res) => {
    const frontendPath = path.join(__dirname, "../frontend/dist");
    res.sendFile(path.join(frontendPath, "index.html"), (error) => {
        if (error) {
            res.json({ message: "Credit Risk Backend API is running" });
        }
    });
});

app.use(express.static(path.join(__dirname, "../frontend/dist")));
app.get(/.*/, (req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    res.sendFile(path.join(__dirname, "../frontend/dist/index.html"), (error) => {
        if (error) next(error);
    });
});

// ============================================================
// Start Server
// ============================================================

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(
        `Backend server running on http://localhost:${PORT}`
    );
});
