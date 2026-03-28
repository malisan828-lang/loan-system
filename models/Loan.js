const mongoose = require("mongoose");

const LoanSchema = new mongoose.Schema({

/* ================= ผู้ดูแลสัญญา ================= */

employeeId:{
type:mongoose.Schema.Types.ObjectId,
ref:"User",
required:true
},

employeeName:{
type:String,
required:true
},

/* ================= สถานะสัญญา ================= */

status:{
type:String,
default:"active"
},

hasGuarantor:{
type:Boolean,
default:false
},

/* ================= ข้อมูลผู้กู้ ================= */

borrowerName:{
type:String,
required:true
},

borrowerPhone:String,
borrowerJob:String,
borrowerAddress:String,
borrowerProvince:String,
borrowerDistrict:String,
borrowerVillage:String,
borrowerZip:String,
borrowerLocation:String,
source:String,

/* ================= ข้อมูลผู้ค้ำ ================= */

guarantorId:String,
guarantorName:String,
guarantorPhone:String,
guarantorJob:String,
guarantorAddress:String,
guarantorProvince:String,
guarantorDistrict:String,
guarantorVillage:String,
guarantorZip:String,
guarantorLocation:String,

/* ================= ข้อมูลการกู้ ================= */

loanDays:{
type:Number,
required:true
},

loanAmount:{
type:Number,
required:true
},

interest:{
type:Number,
required:true
},

dailyInterest:{
type:Number,
required:true
},

fee:{
type:Number,
required:true
},

deduction:{
type:Number,
required:true
},

receivedAmount:{
type:Number,
required:true
},

totalDebt:{
type:Number,
required:true
},

installment:{
type:Number,
required:true
},

remainingAmount:{
type:Number,
required:true
},

/* ================= การจ่ายเงิน ================= */

paidDays:{
type:Number,
default:1
},

todayPaid:{
type:Boolean,
default:true
},

overdueInterest:{
type:Number,
default:0
},

paymentHistory: {
type: [
{
amount: {
type: Number
},
type: {
type: String
},
date: {
type: Date,
default: Date.now
}
}
],
default: []
},

/* ================= วันที่ ================= */

startDate:{
type:Date,
default:Date.now
},

createdAt:{
type:Date,
default:Date.now
},

/* ================= Re-loan ================= */

reloanFrom:{
type:mongoose.Schema.Types.ObjectId,
ref:"Loan",
default:null
},

reloanHistory:{
type:[
{
amount:Number,
oldLoan:String,
date:{
type:Date,
default:Date.now
}
}
],
default:[]
}

});


module.exports = mongoose.model("Loan",LoanSchema);