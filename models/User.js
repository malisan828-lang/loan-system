const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        default: "staff"
    },
    status: {
        type: String,
        default: "pending"   // pending | approved
    },

    // 🔥 เพิ่มตรงนี้ (สำคัญมาก)
    teamId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Team",
        default: null
    },

    createdAt: {
        type: Date,
        default: Date.now
    },
    
    profileImage: {
    type: String,
    default: ""
    }
});

module.exports = mongoose.model("User", UserSchema);