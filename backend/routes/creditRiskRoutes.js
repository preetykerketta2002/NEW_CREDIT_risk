const express = require("express");
const { Entity, CreditOutcome } = require("../models");
const { evaluateCreditRisk } = require("../services/creditRiskService");

const router = express.Router();

// GET ALL ENTITIES (For Frontend Dashboard)
router.get("/entities", async (req, res) => {
    try {
        const entities = await Entity.findAll({
            include: [
                {
                    model: CreditOutcome,
                    required: false
                }
            ],
            order: [["entity_id", "ASC"]]
        });

        return res.status(200).json(entities);
    } catch (error) {
        console.error("Error fetching entities:", error);
        return res.status(500).json({
            message: "Failed to fetch entities",
            error: error.message
        });
    }
});

// COMPLETE CREDIT RISK EVALUATION
router.post("/evaluate", async (req, res) => {
    try {
        const applicationData = req.body;

        const result = await evaluateCreditRisk(applicationData);

        return res.status(200).json(result);
    } catch (error) {
        console.error("Credit risk evaluation error:", error);

        return res.status(error.status || 500).json({
            message: "Credit risk evaluation failed",
            error: error.message,
            details: error.details || null
        });
    }
});

module.exports = router;