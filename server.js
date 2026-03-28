require("dotenv").config();

const express = require("express");
const app = express();

app.use(express.static("public"));

app.get("/", (req, res) => {
    res.send("SERVER OK");
});

const PORT = process.env.PORT;

app.listen(PORT, "0.0.0.0", () => {
    console.log("Server running on port " + PORT);
});