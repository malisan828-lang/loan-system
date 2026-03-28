require("dotenv").config();

const http = require("http");
const { Server } = require("socket.io");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const express = require("express");
const mongoose = require("mongoose");
const crypto = require("crypto");
const cors = require("cors");
const Team = require("./models/Team");

const multer = require("multer");
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "uploads/");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + "-" + file.originalname);
    }
});

const upload = multer({ storage });
const axios = require("axios");
const fs = require("fs");
const nodemailer = require("nodemailer");

const LINE_TOKEN = "Fy89GDtriAetX2OkSBuRVHuoprGJambmc0t2gktm0SWA8eGw0ZgEzo3M0w+eKZgAk/akjRR6LxCJuJTGxIYye7dkc1c/SxAJIC3PmS1espJ6C9mG70SwFbRwkJwaqM/vNM5KmjGh/uMd8pTUVIVfcgdB04t89/1O/w1cDnyilFU=";
const GROUP_ID = "C338efe9ae62bab61956ef8913fd2dddc";

async function sendLineMessage(text) {
    await axios.post(
        "https://api.line.me/v2/bot/message/push",
        {
            to: GROUP_ID,
            messages: [
                {
                    type: "text",
                    text: text
                }
            ]
        },
        {
            headers: {
                Authorization: `Bearer ${LINE_TOKEN}`,
                "Content-Type": "application/json"
            }
        }
    );
}

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});
const User = require("./models/User");
const Loan = require("./models/Loan");
const Wallet = require("./models/Wallet");
const DailyReport = require("./models/DailyReport");
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("join", (userId) => {
        socket.join(userId);
    });

    socket.on("disconnect", () => {
        console.log("User disconnected");
    });
});
const otpStore = {};
app.use(cors());
app.use(express.json());
app.use(express.static("public"));
app.use("/uploads", express.static("uploads"));

const path = require("path");

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});


mongoose.connect(process.env.MONGO_URI)
.then(()=>console.log("MongoDB Atlas Connected"))
.catch(err=>console.log(err));


// ตรวจสอบ token
function authMiddleware(req,res,next){
    const authHeader = req.headers.authorization;

    if(!authHeader){
        return res.status(401).json({ success:false, message:"ไม่มีสิทธิ์" });
    }

    const token = authHeader.startsWith("Bearer ")
        ? authHeader.split(" ")[1]
        : authHeader;

    try{
        const decoded = jwt.verify(token,"SECRET_KEY");
        req.user = decoded;
        next();
    }catch(err){
        return res.status(401).json({ success:false, message:"Token ไม่ถูกต้อง" });
    }
}

// ตรวจสอบ admin
function adminOnly(req,res,next){
    if(req.user.role !== "admin"){
        return res.status(403).json({ success:false, message:"เฉพาะ Admin เท่านั้น" });
    }
    next();
}



app.post("/api/register", async (req, res) => {
    try {
        const { username, email, password } = req.body;

        const existingUser = await User.findOne({ email });
        if(existingUser){
            return res.json({ success:false, message:"อีเมลนี้ถูกใช้แล้ว" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = new User({
            username,
            email,
            password: hashedPassword,
            role: "staff",
            status: "pending"
        });

        await newUser.save();

        const newWallet = new Wallet({
            employeeId: newUser._id,
            balance: 0,
            totalTopup: 0,
            totalReleased: 0,
            totalCollected: 0
         });

await newWallet.save();

        res.json({ success:true, message:"สมัครสำเร็จ รอผู้ดูแลระบบอนุมัติ" });

    } catch(err){
        res.status(500).json({ success:false, error:err });
    }
});

app.post("/api/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if(!user){
            return res.json({ success:false, message:"ไม่พบผู้ใช้" });
        }

        if(user.status !== "approved"){
            return res.json({ success:false, message:"บัญชียังไม่ได้รับการอนุมัติจากผู้ดูแลระบบ" });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if(!isMatch){
            return res.json({ success:false, message:"รหัสผ่านไม่ถูกต้อง" });
        }

        const token = jwt.sign(
            { userId: user._id, role: user.role },
            "SECRET_KEY",
            { expiresIn: "1d" }
        );

        res.json({
            success:true,
            token,
            user:{
                id: user._id,
                username: user.username,
                role: user.role
            }
        });

    } catch(err){
        res.status(500).json({ success:false, error:err });
    }
});

app.post("/api/reset-password", async (req,res)=>{
try{

const { email, otp, newPassword } = req.body;

const record = otpStore[email];

if(!record){
return res.json({ success:false, message:"กรุณาขอ OTP ก่อน" });
}

// ⏳ เช็คหมดอายุ
if(Date.now() > record.expire){
delete otpStore[email];
return res.json({ success:false, message:"OTP หมดอายุ" });
}

// ❌ OTP ไม่ถูก
if(record.otp !== otp){
return res.json({ success:false, message:"OTP ไม่ถูกต้อง" });
}

const user = await User.findOne({ email });
if(!user){
return res.json({ success:false, message:"ไม่พบผู้ใช้" });
}

// 🔐 hash password
const hashed = await bcrypt.hash(newPassword,10);
user.password = hashed;

await user.save();

// 🧹 ลบ OTP
delete otpStore[email];

res.json({ success:true });

}catch(err){
console.error(err);
res.status(500).json({ success:false });
}
});

app.post("/api/send-otp", async (req,res)=>{
try{

const { email } = req.body;

if(!email){
return res.json({ success:false, message:"กรุณากรอกอีเมล" });
}

const user = await User.findOne({ email });
if(!user){
return res.json({ success:false, message:"ไม่พบอีเมลนี้" });
}

// 🔢 สร้าง OTP
const otp = Math.floor(100000 + Math.random() * 900000).toString();

// ⏳ เก็บ OTP
otpStore[email] = {
otp,
expire: Date.now() + 5 * 60 * 1000
};

console.log("OTP:", otp);

// 📧 ส่ง email
await transporter.sendMail({
from: `"Loan System" <${process.env.EMAIL_USER}>`,
to: email,
subject: "รหัส OTP เปลี่ยนรหัสผ่าน",
html: `
<div style="font-family:sans-serif">
    <h2>🔐 รหัส OTP ของคุณ</h2>
    <h1 style="color:#2563eb">${otp}</h1>
    <p>รหัสนี้จะหมดอายุภายใน 5 นาที</p>
    <p style="color:red">ห้ามแชร์ให้ผู้อื่น</p>
</div>
`
});

res.json({ success:true });

}catch(err){
console.error("EMAIL ERROR:", err);
res.status(500).json({ success:false, message:"ส่ง email ไม่สำเร็จ" });
}
});

app.get("/api/customers", authMiddleware, async (req,res)=>{

    let customers;

    if(req.user.role === "admin"){
    customers = await Loan.find({ status: "active" });
}

if(req.user.role === "staff"){
    customers = await Loan.find({
        employeeId: req.user.userId,
        status: "active"
    });
}

    const today = new Date().toDateString();

    let releasedToday = 0;

    for(const loan of customers){

        const loanDate = new Date(loan.createdAt).toDateString();

if(loanDate === today){
releasedToday += loan.loanAmount;
}

        const lastPayment = loan.paymentHistory?.slice(-1)[0];

        const lastDate = lastPayment
        ? new Date(lastPayment.date).toDateString()
        : new Date(loan.createdAt).toDateString();


    }

    res.json({
customers,
releasedToday
});

});

app.get("/api/admin/pending-users", authMiddleware, adminOnly, async (req, res) => {
    const users = await User.find({ status: "pending" });
    res.json({ success:true, users });
});

app.post("/api/admin/approve-user/:id", authMiddleware, adminOnly, async (req, res) => {
    await User.findByIdAndUpdate(req.params.id,{ status:"approved" });
    res.json({ success:true });
});

// บันทึกสัญญาใหม่
app.post("/api/loans", authMiddleware, async (req, res) => {
try {

const user = await User.findById(req.user.userId);


const {

loanDays,
loanAmount,

borrowerName,
borrowerPhone,
borrowerJob,
borrowerAddress,
borrowerProvince,
borrowerDistrict,
borrowerVillage,
borrowerZip,
borrowerPlace,
borrowerLocation,
source,

hasGuarantor,

guarantorId,
guarantorName,
guarantorPhone,
guarantorJob,
guarantorAddress,
guarantorProvince,
guarantorDistrict,
guarantorVillage,
guarantorZip,
guarantorLocation

} = req.body;

/* ===== ตรวจสอบเงินใน wallet ===== */

const wallet = await Wallet.findOne({ employeeId: user._id });

if (wallet && wallet.balance < loanAmount) {
    return res.json({
        success:false,
        message:"เงินในกระเป๋าไม่พอ"
    });
}

if(!loanDays || !loanAmount || !borrowerName){
return res.status(400).json({ success:false, message:"ข้อมูลไม่ครบ" });
}


// ======================= สูตรคำนวณ =======================

// ดอกเบี้ยรวม 20%
const totalInterest = loanAmount * 0.20;

// หนี้รวม
const totalDebt = loanAmount + totalInterest;

// จ่ายต่อวัน
const dailyPayment = totalDebt / loanDays;

// ค่าธรรมเนียม 5%
const fee = loanAmount * 0.05;

// ดอกวันแรก
const firstPayment = dailyPayment;

// เงินที่หักตอนเปิดสัญญา
const deduction = fee + firstPayment;

// เงินที่ลูกค้าได้รับจริง
const receivedAmount = loanAmount - deduction;

// หนี้คงเหลือหลังหักดอกวันแรก
const remainingAmount = totalDebt - firstPayment;


// ======================= บันทึกสัญญา =======================

const newLoan = new Loan({

employeeId: user._id,
employeeName: user.username,

borrowerName,
borrowerPhone,
borrowerJob,
borrowerAddress,
borrowerProvince,
borrowerDistrict,
borrowerVillage,
borrowerZip,
borrowerPlace,
borrowerLocation,
source,

hasGuarantor,

guarantorId,
guarantorName,
guarantorPhone,
guarantorJob,
guarantorAddress,
guarantorProvince,
guarantorDistrict,
guarantorVillage,
guarantorZip,
guarantorLocation,

loanDays,
loanAmount,

interest: totalInterest,
dailyInterest: dailyPayment,

fee,
deduction,
receivedAmount,

totalDebt,
installment: dailyPayment,
remainingAmount,

todayPaid: true,
paidDays: 1,

status: "active",

// บันทึกว่าดอกวันแรกจ่ายแล้ว
paymentHistory: [
{
amount: dailyPayment,
type: "paid",
date: new Date()
}
]

});

await newLoan.save();

io.to(user._id.toString()).emit("customersUpdated");

/* ===== หักเงินจาก wallet ===== */

if(wallet){

// เงินที่ปล่อยให้ลูกค้า
wallet.balance -= receivedAmount;
wallet.totalReleased += receivedAmount;

// 🔥 เอาเฉพาะ "ดอกวันแรก" เข้า wallet
wallet.balance += firstPayment;
wallet.totalCollected += firstPayment;

// ❗ ค่าธรรมเนียมไม่เข้า wallet
// แต่ยังเก็บไว้ใน loan.fee (เอาไปทำ report)

await wallet.save();

}

res.json({ success:true });

} catch (error) {
console.error(error);
res.status(500).json({ success:false, error });
}
});

app.post("/api/loans/:id/pay", authMiddleware, async (req,res)=>{
    try{

        const loan = await Loan.findById(req.params.id);

        if(!loan) return res.status(404).json({success:false});

        if(loan.remainingAmount <= 0){
            return res.json({success:false,message:"ปิดสัญญาแล้ว"});
        }

        loan.remainingAmount -= loan.installment;
        loan.todayPaid = true;

        if(loan.remainingAmount <= 0){
            loan.status = "closed";
            loan.remainingAmount = 0;
        }

        await loan.save();

io.to(loan.employeeId.toString()).emit("customersUpdated");
        res.json({success:true});

    }catch(err){
        res.status(500).json({success:false});
    }
});
 

/* ================= จ่ายงวด ================= */

app.post("/api/loans/:id/pay-installment", async (req, res) => {

try{

const loan = await Loan.findById(req.params.id);

if(!loan) return res.status(404).json({message:"Loan not found"});

const amount = Number(req.body.amount);

if(!amount || amount <= 0){
return res.status(400).json({message:"Amount required"});
}

/* =========================
   🔥 1️⃣ อัพเดต Wallet ก่อน (สำคัญมาก)
========================= */

const wallet = await Wallet.findOne({employeeId:loan.employeeId});

if(wallet){
wallet.balance += amount;
wallet.totalCollected += amount;
await wallet.save();
}

/* =========================
   2️⃣ เริ่มคำนวณเงินจริง
========================= */

let payAmount = amount;

/* เคลียร์ดอกค้างก่อน */

if(loan.overdueInterest > 0){

const payOverdue = Math.min(payAmount, loan.overdueInterest);

loan.overdueInterest -= payOverdue;
payAmount -= payOverdue;

}

/* จ่ายงวด */

if(payAmount > 0){

if(payAmount > loan.remainingAmount){
payAmount = loan.remainingAmount;
}

loan.remainingAmount -= payAmount;

}

/* =========================
   3️⃣ บันทึกประวัติ
========================= */

loan.paymentHistory.push({
amount: amount,
type: "paid",
date: new Date()
});

/* =========================
   4️⃣ อัพเดตสถานะ
========================= */

loan.todayPaid = true;
loan.paidDays += 1;

if (loan.remainingAmount <= 0) {
loan.remainingAmount = 0;
loan.status = "closed";
}

await loan.save();

io.to(loan.employeeId.toString()).emit("customersUpdated");
res.json({success:true});

}catch(err){

console.error(err);
res.status(500).json({message:"Server error"});

}

});

/* ================= ค้างชำระ ================= */

app.post("/api/loans/:id/overdue", async (req, res) => {

try{

const loan = await Loan.findById(req.params.id);

if(!loan) return res.status(404).json({message:"Loan not found"});

const amount = Number(req.body.amount);

loan.overdueInterest += amount;
loan.remainingAmount += amount;

loan.paymentHistory.push({
amount: amount,
type: "overdue",
date: new Date()
});

await loan.save();

io.emit("customersUpdated");
res.json({success:true});

}catch(err){

console.error(err);
res.status(500).json({message:"Server error"});

}

});

app.get("/api/loan/:id", authMiddleware, async (req,res)=>{

try{

const loan = await Loan.findById(req.params.id);

if(!loan) return res.status(404).json({message:"Loan not found"});

res.json(loan);

}catch(err){

console.error(err);
res.status(500).json({message:"Server error"});

}

});

app.post("/api/loans/:id/reloan", authMiddleware, async (req,res)=>{

try{

const oldLoan = await Loan.findById(req.params.id);

if(!oldLoan){
return res.status(404).json({message:"Loan not found"});
}

const newAmount = Number(req.body.loanAmount);
const days = oldLoan.loanDays;

const oldRemaining = oldLoan.remainingAmount;

/* =========================
   คำนวณสัญญาใหม่
========================= */

const interest = newAmount * 0.20;

const totalDebt = newAmount + interest;

const installment = totalDebt / days;

/* ดอกล่วงหน้า 2 วัน */

const advanceInterest = installment * 2;

/* dailyInterest สำหรับ schema */

const dailyInterest = installment;

/* ค่าธรรมเนียม */

const fee = newAmount * 0.05;

/* เงินที่ต้องหัก */

const deduction = oldRemaining + advanceInterest;

/* เงินที่ลูกค้าได้รับจริง */

const receivedAmount =
(newAmount - oldRemaining) - advanceInterest;

if(receivedAmount <= 0){

return res.status(400).json({
message:"ยอดกู้ใหม่ต่ำเกินไป เงินรับสุทธิติดลบ"
});

}

/* =========================
   ปิดสัญญาเก่า
========================= */

oldLoan.status = "closed";
oldLoan.closedDate = new Date();

await oldLoan.save();

/* =========================
   สร้างสัญญาใหม่
========================= */

const newLoanDoc = new Loan({

employeeId: oldLoan.employeeId,
employeeName: oldLoan.employeeName,

borrowerName: oldLoan.borrowerName,
borrowerPhone: oldLoan.borrowerPhone,

borrowerJob: oldLoan.borrowerJob,
borrowerAddress: oldLoan.borrowerAddress,
borrowerProvince: oldLoan.borrowerProvince,
borrowerDistrict: oldLoan.borrowerDistrict,
borrowerVillage: oldLoan.borrowerVillage,
borrowerZip: oldLoan.borrowerZip,

hasGuarantor: oldLoan.hasGuarantor,

guarantorName: oldLoan.guarantorName,
guarantorPhone: oldLoan.guarantorPhone,
guarantorAddress: oldLoan.guarantorAddress,

loanDays: days,
loanAmount: newAmount,

interest: interest,
dailyInterest: dailyInterest,

fee: fee,
deduction: deduction,

totalDebt: totalDebt,
installment: installment,

/* หักดอกล่วงหน้าแล้ว */

remainingAmount: totalDebt - advanceInterest,

receivedAmount: receivedAmount,

reloanFrom: oldLoan._id,
startDate: new Date(),

status: "active",

/* จ่ายไปแล้ว 2 วัน */

paidDays: 2,

todayPaid: true,

paymentHistory: [

{
amount: installment,
type: "paid",
date: new Date()
},

{
amount: installment,
type: "paid",
date: new Date()
}

]

});

await newLoanDoc.save();

io.to(oldLoan.employeeId.toString()).emit("customersUpdated");

/* =========================
   ส่งผลกลับ
========================= */

res.json({
success:true,
receivedAmount
});

}catch(err){

console.error(err);

res.status(500).json({
message:"Server error"
});

}

});


/* ================= เติมเงินพนักงาน ================= */

app.post("/api/admin/topup",authMiddleware,adminOnly,async(req,res)=>{

try{

const {employeeId,amount}=req.body;

let wallet=await Wallet.findOne({employeeId});

if(!wallet){

wallet=new Wallet({
employeeId,
balance:amount,
totalTopup:amount
});

}else{

wallet.balance+=amount;
wallet.totalTopup+=amount;

}

await wallet.save();

res.json({success:true});

}catch(err){

console.error(err);
res.status(500).json({message:"Server error"});

}

});

app.get("/api/wallet/me", authMiddleware, async (req, res) => {

const wallet = await Wallet.findOne({ employeeId: req.user.userId });

if(!wallet){
return res.json({
balance:0,
todayCollected:0,
myMoney:0
});
}

const today = new Date();
today.setHours(0,0,0,0);

const loans = await Loan.find({ employeeId: req.user.userId });

let collectedToday = 0;

for(const loan of loans){

for(const pay of loan.paymentHistory){

const payDate = new Date(pay.date);

if(pay.type === "paid" && payDate >= today){
collectedToday += pay.amount;
}

}

}

res.json({
balance: wallet.balance,
todayCollected: collectedToday
});

});

/* ================= แจ้งยอด ================= */

app.post("/api/daily-report",authMiddleware,async(req,res)=>{

try{

const wallet=await Wallet.findOne({employeeId:req.user.userId});

if(!wallet){
    return res.status(400).json({
        success:false,
        message:"ไม่พบ wallet"
    });
}

const report=new DailyReport({

employeeId:req.user.userId,
employeeName:req.user.username,

balance:wallet.balance,

releasedToday:wallet.totalReleased,

collectedToday:wallet.totalCollected,

reportAmount:wallet.balance

});

await report.save();

res.json({success:true});

}catch(err){

console.error(err);
res.status(500).json({message:"Server error"});

}

});


app.get("/api/admin/daily-reports",authMiddleware,adminOnly,async(req,res)=>{

const reports=await DailyReport.find()
.sort({date:-1});

res.json(reports);

});


/* ================= Admin Wallet Dashboard ================= */

app.get("/api/admin/wallets", authMiddleware, adminOnly, async (req,res)=>{

try{

const wallets = await Wallet.find()
.populate("employeeId","username email");

const result = [];

for(const w of wallets){

// 🔥 ดึง loan ของพนักงานคนนั้น
if(!w.employeeId) continue;

const loans = await Loan.find({ employeeId: w.employeeId._id });

let totalCollected = 0;
let totalReleased = 0;

// 🔥 คำนวณใหม่จาก Loan จริง
for(const loan of loans){

// เงินที่ปล่อยจริง (เงินที่ลูกค้าได้รับ)
totalReleased += loan.receivedAmount || 0;

// รวมเงินที่เก็บได้ทั้งหมด
loan.paymentHistory.forEach(p=>{
if(p.type === "paid"){
totalCollected += p.amount;
}
});

}

// 🔥 push ค่าใหม่ (ทับค่าเดิม)
result.push({
...w.toObject(),
totalCollected,
totalReleased
});

}

res.json(result);

}catch(err){

console.error(err);
res.status(500).json({message:"Server error"});

}

});

app.get("/api/dashboard/income", async (req,res)=>{

const today = new Date();
const sevenDaysAgo = new Date();

sevenDaysAgo.setDate(today.getDate()-6);

const loans = await Loan.find({
createdAt:{$gte:sevenDaysAgo}
});

const result={};

loans.forEach(l=>{

const date=new Date(l.createdAt).toLocaleDateString();

if(!result[date]) result[date]=0;

result[date]+=l.installment;

});

res.json(result);

});

app.post("/api/send-slip", authMiddleware, upload.single("slip"), async (req, res) => {
try {

const amount = Number(req.body.amount);
const note = req.body.note;

// =========================
// 🔒 ตรวจสอบข้อมูล
// =========================
if(!amount || amount <= 0){
return res.json({ success:false, message:"จำนวนเงินไม่ถูกต้อง" });
}

const wallet = await Wallet.findOne({ employeeId: req.user.userId });

if(!wallet){
return res.json({ success:false, message:"ไม่พบ Wallet" });
}

if(wallet.balance < amount){
return res.json({ success:false, message:"เงินใน Wallet ไม่พอ" });
}

// =========================
// 💸 หักเงินจาก Wallet
// =========================
wallet.balance -= amount;
wallet.totalSent = (wallet.totalSent || 0) + amount;

await wallet.save();

// =========================
// 📊 กระจายยอดไป Loan
// =========================
const loans = await Loan.find({ employeeId: req.user.userId });

let remain = amount;

for(const loan of loans){

if(remain <= 0) break;

const today = new Date().toDateString();

const paidToday = loan.paymentHistory
.filter(p => new Date(p.date).toDateString() === today && p.type === "paid")
.reduce((sum,p)=>sum+p.amount,0);

const sentToday = loan.paymentHistory
.filter(p => new Date(p.date).toDateString() === today && p.type === "sent")
.reduce((sum,p)=>sum+p.amount,0);

const available = paidToday - sentToday;

if(available <= 0) continue;

const sendAmount = Math.min(available, remain);

loan.paymentHistory.push({
amount: sendAmount,
type: "sent",
date: new Date()
});

await loan.save();

io.to(loan.employeeId.toString()).emit("customersUpdated");

remain -= sendAmount;

}

// =========================
// 📩 ส่ง LINE
// =========================
const user = await User.findById(req.user.userId);

const message = `📥 แจ้งโอนเงิน

👤 พนักงาน: ${user.username}
💰 ยอดเงิน: ${Number(amount).toLocaleString()}

📝 หมายเหตุ:
${note || "-"}`;

// ส่งข้อความ
await axios.post(
    "https://api.line.me/v2/bot/message/push",
    {
        to: GROUP_ID,
        messages: [
            {
                type: "text",
                text: message
            }
        ]
    },
    {
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + LINE_TOKEN
        }
    }
);

// 🔥 ส่งรูป
if(req.file){

    const imageUrl = `${process.env.BASE_URL}/uploads/${req.file.filename}`;

    await axios.post(
        "https://api.line.me/v2/bot/message/push",
        {
            to: GROUP_ID,
            messages: [
                {
                    type: "image",
                    originalContentUrl: imageUrl,
                    previewImageUrl: imageUrl
                }
            ]
        },
        {
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + LINE_TOKEN
            }
        }
    );
}

// =========================
// ✅ ตอบกลับ
// =========================
res.json({ success:true });

}catch(err){

console.error(err);
res.status(500).json({ success:false });

}
});


app.post("/api/request-money", authMiddleware, upload.single("slip"), async (req,res)=>{

try{

const {amount,account,note} = req.body;

const user = await User.findById(req.user.userId);

const message =
`💰 คำขอเบิกเงินใหม่

👤 พนักงาน: ${user.username}
💰 ยอดเงิน: ${Number(amount).toLocaleString()}

🏦 เลขบัญชี: ${account}

📝 หมายเหตุ:
${note || "-"}`;


// =========================
// 🔥 1️⃣ ส่งข้อความก่อน
// =========================

await axios.post(
  "https://api.line.me/v2/bot/message/push",
  {
    to: "C338efe9ae62bab61956ef8913fd2dddc",
    messages: [
      {
        type: "text",
        text: message
      }
    ]
  },
  {
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + LINE_TOKEN
    }
  }
);


// =========================
// 🔥 2️⃣ ส่งรูป (ถ้ามี)
// =========================

if(req.file){

// ❗ ต้องมี URL ที่เข้าถึงได้ (ngrok)
const imageUrl = `${process.env.BASE_URL}/uploads/${req.file.filename}`;

await axios.post(
  "https://api.line.me/v2/bot/message/push",
  {
    to: "C338efe9ae62bab61956ef8913fd2dddc",
    messages: [
      {
        type: "image",
        originalContentUrl: imageUrl,
        previewImageUrl: imageUrl
      }
    ]
  },
  {
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + LINE_TOKEN
    }
  }
);

}

res.json({success:true});

}catch(err){

console.error(err);
res.json({success:false});

}

});

app.get("/api/dashboard/summary", authMiddleware, async (req, res) => {
try{

const startToday = new Date();
startToday.setHours(0,0,0,0);

const startMonth = new Date();
startMonth.setDate(1);
startMonth.setHours(0,0,0,0);

const loans = await Loan.find().populate({
    path:"employeeId",
    populate:{ path:"teamId" }
});

if(!loans || loans.length === 0){
    return res.json({
        totalCapital: 0,
        releasedToday: 0,
        collectedToday: 0,
        profitToday: 0,
        ranking: []
    });
}

const teamMap = {};

let totalCapital = 0;
let releasedToday = 0;
let collectedToday = 0;

loans.forEach(loan=>{

const team = loan.employeeId?.teamId;
if(!team) return;

const teamName = team.name;

// 🔥 สร้างทีม
if(!teamMap[teamName]){
teamMap[teamName] = {
name: team.name,
members: {},

dailyRelease:0,
dailyCollect:0,
monthlyRelease:0,
monthlyCollect:0,
newToday:0,
active:0,

badDebt:0,
safeDebt:0,
risk4x:0,
diff:0,
over3month:0,
loss3month:0,
fail:0,
star:""
};
}

// ================= สมาชิก =================
const user = loan.employeeId;

if(user && user.username){
    const username = user.username.trim();

    teamMap[teamName].members[username] = {
        name: username,
        image: user.profileImage || ""
    };
}

// ================= เงินรวม =================
totalCapital += loan.remainingAmount || 0;

// ================= ปล่อย =================
const created = new Date(loan.createdAt);

if(created >= startToday){
teamMap[teamName].dailyRelease += loan.receivedAmount || 0;
releasedToday += loan.receivedAmount || 0;
teamMap[teamName].newToday++;
}

if(created >= startMonth){
teamMap[teamName].monthlyRelease += loan.receivedAmount || 0;
}

// ================= active =================
if(loan.status === "active"){
teamMap[teamName].active++;
}

// ================= เก็บ =================
(loan.paymentHistory || []).forEach(p=>{

const payDate = new Date(p.date);

if(p.type === "paid"){

if(payDate >= startToday){
teamMap[teamName].dailyCollect += p.amount || 0;
collectedToday += p.amount || 0;
}

if(payDate >= startMonth){
teamMap[teamName].monthlyCollect += p.amount || 0;
}

}

});

});

// ================= คำนวณ =================
Object.values(teamMap).forEach(t=>{

t.dailyProfit = t.dailyCollect - t.dailyRelease;
t.monthlyProfit = t.monthlyCollect - t.monthlyRelease;
t.totalProfit = t.monthlyProfit;

t.dailyPercent = t.dailyRelease ? (t.dailyCollect / t.dailyRelease * 100) : 0;
t.monthlyPercent = t.monthlyRelease ? (t.monthlyCollect / t.monthlyRelease * 100) : 0;

// 🔥 ยอดเสีย
t.badDebt = t.monthlyRelease - t.monthlyCollect;

// KPI
t.safeDebt = t.badDebt * 0.3;
t.risk4x = t.badDebt * 4;
t.diff = t.monthlyCollect - t.badDebt;

t.over3month = Math.floor(t.badDebt * 0.2);
t.loss3month = Math.floor(t.badDebt * 0.3);

t.fail = t.monthlyPercent < 50 ? 1 : 0;

// ⭐ ดาว
if(t.monthlyPercent >= 80){
    t.star = "⭐⭐⭐";
}else if(t.monthlyPercent >= 60){
    t.star = "⭐⭐";
}else if(t.monthlyPercent >= 40){
    t.star = "⭐";
}else{
    t.star = "";
}

// 🔥 แปลงสมาชิก + เรียงชื่อ
t.members = Object.values(t.members);

});

// ================= Ranking =================
const ranking = Object.values(teamMap)
.sort((a,b)=> b.totalProfit - a.totalProfit);

res.json({
totalCapital,
releasedToday,
collectedToday,
profitToday: collectedToday - releasedToday,
ranking
});

}catch(err){
console.error(err);
res.status(500).json({message:"server error"});
}
});

app.get("/api/teams", authMiddleware, adminOnly, async (req,res)=>{

    const teams = await Team.find()
    .populate("leader","username profileImage")
    .populate("assistant","username profileImage");

    res.json({ teams });

});

app.delete("/api/teams/:id", authMiddleware, adminOnly, async (req,res)=>{

    const team = await Team.findById(req.params.id);

    if(!team) return res.json({ success:false });

    // 🔥 ลบ teamId ออกจาก user
    await User.updateMany(
        { teamId: team._id },
        { $unset: { teamId: "" } }
    );

    await Team.findByIdAndDelete(team._id);

    res.json({ success:true });

});

app.get("/api/users", authMiddleware, adminOnly, async (req,res)=>{
    const users = await User.find({ role:"staff" });
    res.json({ users });
});

app.post("/api/teams", authMiddleware, adminOnly, async (req,res)=>{

    const { name, leader, assistant } = req.body;

    const team = new Team({ name, leader, assistant });

    await team.save();

    // 🔥 ผูก user เข้าทีม
    await User.findByIdAndUpdate(leader,{ teamId: team._id });
    await User.findByIdAndUpdate(assistant,{ teamId: team._id });

    res.json({ success:true });
});

app.post("/api/upload-profile", upload.single("image"), async (req, res) => {

    const userId = req.body.userId;

    if(!req.file){
        return res.status(400).json({ message: "ไม่มีไฟล์" });
    }

    const imagePath = "/uploads/" + req.file.filename;

    await User.findByIdAndUpdate(userId, {
        profileImage: imagePath
    });

    res.json({ success: true, image: imagePath });

});


const PORT = process.env.PORT;

server.listen(PORT, "0.0.0.0", () => {
    console.log("Server running on port " + PORT);
});