document.addEventListener("DOMContentLoaded", function () {

    const token = localStorage.getItem("token");
    const user = JSON.parse(localStorage.getItem("user"));

    // ❌ ไม่ได้ login → กลับหน้า login
    if (!token || !user) {
        window.location.href = "index.html";
        return;
    }

    const currentPage = window.location.pathname.split("/").pop();

    const navItems = [
        { name: "ตรางใบงาน", file: "dashboard.html" },
        { name: "ลงใบงาน", file: "customers.html" },
        { name: "เปิดสัญญาใหม่", file: "new-loan.html" },
        { name: "เบิกเงินบ้าน", file: "daily-report.html" },
        { name: "อัพสลิปส่งยอด", file: "send-slip.html" }
    ];

    // 🔥 เมนูเฉพาะ ADMIN
    if (user.role === "admin") {

        navItems.push({
            name:"Wallet พนักงาน",
            file:"admin-wallet.html"
        });

        navItems.push({
            name: "จัดการผู้ใช้",
            file: "admin-users.html",
            type: "admin"
        });

        // ✅ เพิ่มตรงนี้ (จัดการทีม)
        navItems.push({
            name: "จัดการสายทีม",
            file: "admin-teams.html",
            type: "admin"
        });
    }

    // 🔥 ปุ่ม logout (ไม่ใช้ link ปกติแล้ว)
    navItems.push({
        name: "ออกจากระบบ",
        file: "#",
        type: "danger",
        action: "logout"
    });

    let navHTML = `<div class="top-nav">`;

    navItems.forEach(item => {

        let className = "nav-btn";

        if (item.file === currentPage) {
            className += " primary";
        }

        if (item.type === "danger") {
            className += " danger";
        }

        if (item.type === "admin") {
            className += " warning";
        }

        // 🔥 ถ้าเป็น logout → ใช้ onclick
        if(item.action === "logout"){
            navHTML += `<a href="#" onclick="logout()" class="${className}">${item.name}</a>`;
        }else{
            navHTML += `<a href="${item.file}" class="${className}">${item.name}</a>`;
        }

    });

    navHTML += `</div>`;

    const navContainer = document.getElementById("navbar");
    if (navContainer) {
        navContainer.innerHTML = navHTML;
    }

});

// 🔥 ฟังก์ชัน logout
function logout(){
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "index.html";
}
