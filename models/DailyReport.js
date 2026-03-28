const mongoose = require("mongoose");

const DailyReportSchema = new mongoose.Schema({

employeeId:{
type:mongoose.Schema.Types.ObjectId,
ref:"User"
},

employeeName:String,

date:{
type:Date,
default:Date.now
},

balance:Number,

releasedToday:Number,

collectedToday:Number,

reportAmount:Number

});

module.exports = mongoose.model("DailyReport",DailyReportSchema);