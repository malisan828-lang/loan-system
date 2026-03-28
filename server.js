require("dotenv").config();

const express = require("express");
const http = require("http");

const app = express();
const server = http.createServer(app);

// static
app.use(express.static("public"));

// test route
app.get("/", (req, res) => {
    res.send("SERVER OK");
});

const PORT = process.env.PORT || 10000;

server.listen(PORT, "0.0.0.0", () => {
    console.log("Server running on port " + PORT);
});