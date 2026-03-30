require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const axios = require("axios");

const app = express();

// ================= CONFIG =================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use("/uploads", express.static("uploads"));

// ================= ROOT =================
app.get("/", (req, res) => {
  res.status(200).send("SERVER WORKING OK");
});

// ================= ENV =================
const LINE_TOKEN = process.env.LINE_TOKEN;
const GROUP_ID = process.env.GROUP_ID;

// ================= SAFE LINE FUNCTION =================
function sendLine(text) {
  if (!LINE_TOKEN || !GROUP_ID) return;

  axios.post(
    "https://api.line.me/v2/bot/message/push",
    {
      to: GROUP_ID,
      messages: [{ type: "text", text }]
    },
    {
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + LINE_TOKEN
      }
    }
  ).catch(err => console.log("LINE ERROR:", err));
}

// ================= MONGODB =================
if (process.env.MONGO_URI) {
  mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("✅ MongoDB Connected"))
    .catch(err => console.log("❌ Mongo Error:", err));
}

// ================= TEST API =================
app.get("/api/test", (req, res) => {
  res.json({ message: "API OK" });
});

// ================= EXAMPLE =================
app.get("/api/notify", (req, res) => {
  sendLine("Hello from Loan System 🚀");
  res.json({ success: true });
});

// ================= ERROR HANDLER =================
app.use((err, req, res, next) => {
  console.error("🔥 ERROR:", err);
  res.status(500).json({ error: "Server error" });
});

// ================= START SERVER =================
const PORT = process.env.PORT;

app.listen(PORT, "0.0.0.0", () => {
  console.log("🔥 SERVER RUNNING ON PORT", PORT);
});