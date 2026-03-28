function showPopup(title,message){
    document.getElementById("popupTitle").innerText = title;
    document.getElementById("popupMessage").innerText = message;
    document.getElementById("popup").classList.remove("hidden");
}

function closePopup(){
    document.getElementById("popup").classList.add("hidden");
}

function togglePassword(id){
    const input = document.getElementById(id);
    input.type = input.type === "password" ? "text" : "password";
}

async function sendOTP(){
    const email = document.getElementById("email").value;
    const message = document.getElementById("message");

    try{
        const response = await fetch("/api/send-otp",{
            method:"POST",
            headers:{"Content-Type":"application/json"},
            body:JSON.stringify({email})
        });

        const data = await response.json();

        if(data.success){
            document.getElementById("otpSection").style.display="block";
            message.innerHTML = "<div class='success'>ส่ง OTP แล้ว</div>";
        }else{
            message.innerHTML = "<div class='error'>"+data.message+"</div>";
        }

    }catch(err){
        message.innerHTML = "<div class='error'>error</div>";
    }
}

document.addEventListener("DOMContentLoaded",()=>{

document.getElementById("resetForm").addEventListener("submit", async function(e){
    e.preventDefault();

    const email = document.getElementById("email").value;
    const otp = document.getElementById("otp").value;
    const newPassword = document.getElementById("newPassword").value;
    const confirmPassword = document.getElementById("confirmPassword").value;

if(newPassword !== confirmPassword){
    showPopup("ผิดพลาด","รหัสผ่านไม่ตรงกัน");
    return;
}

    const res = await fetch("/api/reset-password",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({email,otp,newPassword})
    });

    const data = await res.json();

    if(data.success){
        showPopup("สำเร็จ","เปลี่ยนรหัสผ่านเรียบร้อยแล้ว");

setTimeout(()=>{
    window.location.href = "index.html";
},1500);
    }else{
        alert(data.message);
    }
});

});

