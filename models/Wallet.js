const mongoose = require("mongoose");

const WalletSchema = new mongoose.Schema({

employeeId:{
type:mongoose.Schema.Types.ObjectId,
ref:"User",
required:true
},

employeeName:String,

email:String,

balance:{
type:Number,
default:0
},

totalTopup:{
type:Number,
default:0
},

totalReleased:{
type:Number,
default:0
},

totalCollected:{
type:Number,
default:0
},

totalSent:{
type:Number,
default:0
},

updatedAt:{
type:Date,
default:Date.now
}

});

module.exports = mongoose.model("Wallet",WalletSchema);