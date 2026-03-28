const mongoose = require("mongoose");

const TeamSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },

    // 👤 หัวสาย
    leader: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },

    // 👤 ผู้ช่วย
    assistant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },

    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("Team", TeamSchema);