const express = require("express");
const app = express();

// 🔥 ต้องอยู่บนสุด
app.get("/", (req, res) => {
  res.status(200).send("OK");
});

// 🔥 ใช้ PORT จาก Render เท่านั้น
const PORT = process.env.PORT;

// 🔥 เปิด server
app.listen(PORT, "0.0.0.0", () => {
  console.log("RUNNING ON", PORT);
});