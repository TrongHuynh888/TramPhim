// LOGIC XỬ LÝ TRANG NÂNG CẤP
console.log("💎 Upgrade Module Loaded");

function openPaymentQRModal(type = "vip") {
  if (!currentUser) {
    showNotification("Vui lòng đăng nhập để nâng cấp!", "warning");
    openAuthModal();
    return;
  }

  const qrImage = document.getElementById("vietqrImage");
  const amountEl = document.getElementById("paymentAmount");
  const memoEl = document.getElementById("paymentMemo");

  const BANK_ID = "VBA"; // Agribank MÃ NGÂN HÀNG VIẾT TẮT QR
  const ACCOUNT_NO = "88880384495717"; // Thay số TK của bạn vào đây
  const TEMPLATE = "compact";

  let amount = 49000;
  let content = `VIP ${currentUser.email.split("@")[0]}`;

  if (type === "lifetime") {
    amount = 499000;
    content = `LIFETIME ${currentUser.email.split("@")[0]}`;
  }

  amountEl.textContent = formatNumber(amount) + "đ";
  memoEl.textContent = content;

  const qrUrl = `https://img.vietqr.io/image/${BANK_ID}-${ACCOUNT_NO}-${TEMPLATE}.png?amount=${amount}&addInfo=${encodeURIComponent(content)}`;
  qrImage.src = qrUrl;

  openModal("paymentQRModal");
}

function openUploadBillModal() {
  closeModal("paymentQRModal");
  
  // Reset UI
  document.getElementById("billImageInput").value = "";
  document.getElementById("billPreview").src = "";
  document.getElementById("billPreview").style.display = "none";
  document.getElementById("uploadPlaceholder").style.display = "block";
  document.getElementById("submitBillBtn").disabled = true;
  
  openModal("uploadBillModal");
}

let compressedBillBase64 = "";

function previewBillImage(event) {
  const file = event.target.files[0];
  if (!file) return;

  // Validate image
  if (!file.type.startsWith('image/')) {
      showNotification("Vui lòng chọn một tệp hình ảnh hợp lệ", "error");
      return;
  }

  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = function (e) {
    const rawBase64 = e.target.result;
    
    // Resize Image via Canvas to reduce Firestore size
    const img = new Image();
    img.src = rawBase64;
    img.onload = function() {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
            if (width > MAX_WIDTH) {
                height *= MAX_WIDTH / width;
                width = MAX_WIDTH;
            }
        } else {
            if (height > MAX_HEIGHT) {
                width *= MAX_HEIGHT / height;
                height = MAX_HEIGHT;
            }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        // Compress
        compressedBillBase64 = canvas.toDataURL("image/jpeg", 0.7);
        
        // Show Preview
        const preview = document.getElementById("billPreview");
        preview.src = compressedBillBase64;
        preview.style.display = "block";
        document.getElementById("uploadPlaceholder").style.display = "none";
        document.getElementById("submitBillBtn").disabled = false;
    }
  };
}

async function submitVipRequest() {
    if (!currentUser) return;
    if (!compressedBillBase64) {
        showNotification("Vui lòng tải ảnh bill lên", "error");
        return;
    }

    try {
        showLoading(true, "Đang xử lý. Vui lòng đợi...");
        
        // 1. Kiểm tra giới hạn 5 phút và xóa các yêu cầu "pending" cũ
        const existingRequests = await db.collection("upgrade_requests")
            .where("userId", "==", currentUser.uid)
            .where("status", "==", "pending")
            .get();

        if (!existingRequests.empty) {
            let latestTime = 0;
            
            existingRequests.forEach(doc => {
                const data = doc.data();
                if (data.createdAt) {
                    // Firebase timestamp to JS time
                    const time = data.createdAt.toDate ? data.createdAt.toDate().getTime() : new Date(data.createdAt).getTime();
                    if (time > latestTime) latestTime = time;
                }
            });
            
            const now = new Date().getTime();
            // 5 phút = 5 * 60 * 1000 ms = 300000 ms
            if (now - latestTime < 300000) {
                showLoading(false);
                await customAlert("⏳ Bạn vừa gửi yêu cầu trước đó. Vui lòng đợi 5 phút trước khi gửi lại hoá đơn mới tránh bị spam nhé!", { title: "Vui lòng chờ", type: "warning" });
                return;
            }

            // Xoá các yêu cầu pending cũ nếu đủ điều kiện cho qua
            const batch = db.batch();
            existingRequests.forEach(doc => {
                batch.delete(doc.ref);
            });
            await batch.commit();
        }

        // 2. Thêm yêu cầu mới
        const amountEl = document.getElementById("paymentAmount");
        const currentAmountText = amountEl.textContent.replace(/[,đ]/g, '');
        const amount = parseInt(currentAmountText);
        
        const packageType = amount >= 499000 ? "lifetime" : "vip";

        const requestData = {
            userId: currentUser.uid,
            userEmail: currentUser.email,
            package: packageType,
            amount: amount,
            billImageBase64: compressedBillBase64,
            status: "pending", // pending, approved, rejected
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        await db.collection("upgrade_requests").add(requestData);

        // Bắn thông báo cho Admin
        if (typeof sendNotification === "function") {
            await sendNotification("admin", "Yêu cầu VIP mới", `Có yêu cầu nâng cấp gói ${packageType.toUpperCase()} từ ${currentUser.email}.`, "vip_request");
            // Bắn thông báo cho User thao tác
            await sendNotification(currentUser.uid, "Gửi yêu cầu thành công", `Yêu cầu nâng gói ${packageType.toUpperCase()} của bạn đã được gửi tới Admin. Vui lòng chờ kiểm duyệt.`, "system");
        }

        showLoading(false);
        closeModal("uploadBillModal");
        
        await customAlert("🎉 Yêu cầu của bạn đã được gửi thành công! Admin sẽ duyệt và phản hồi trong thời gian sớm nhất.", { title: "Gửi thành công", type: "success" });
        showNotification("Đã gửi yêu cầu nâng cấp", "success");
    } catch (error) {
        console.error("Lỗi khi gửi yêu cầu nâng VIP:", error);
        showLoading(false);
        showNotification("Có lỗi xảy ra, vui lòng thử lại sau", "error");
    }
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text);
  showNotification("Đã sao chép số tài khoản", "info");
}
