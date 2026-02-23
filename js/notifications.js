// js/notifications.js

let notificationsUnsubscribeUser = null;
let notificationsUnsubscribeAdmin = null;

let allNotifications = []; // Lưu trữ mảng notifs hiện tại

/**
 * Khởi tạo listener thông báo
 * @param {Object} user Firebase user object
 * @param {boolean} isAdmin Cờ kiểm tra Admin
 */
function initNotifications(user, isAdmin) {
    if (!db || !user) return;
    
    console.log("🔔 Bắt đầu lắng nghe thông báo cho UID:", user.uid, "| Cờ Admin:", isAdmin);

    // 1. Lắng nghe thông báo cá nhân của User
    const userNotifsRef = db.collection("notifications")
                            .where("userId", "==", user.uid);
                            
    notificationsUnsubscribeUser = userNotifsRef.onSnapshot((snapshot) => {
        handleNotificationsSnapshot(snapshot, "user");
    }, (error) => {
        console.error("Lỗi realtime notifications (User):", error);
    });

    // 2. Nếu là Admin, lắng nghe thông báo hệ thống (dành cho Admin)
    if (isAdmin) {
        const adminNotifsRef = db.collection("notifications")
                                .where("isForAdmin", "==", true);
                                
        notificationsUnsubscribeAdmin = adminNotifsRef.onSnapshot((snapshot) => {
            handleNotificationsSnapshot(snapshot, "admin");
        }, (error) => {
            console.error("Lỗi realtime notifications (Admin):", error);
        });
    }

    // 3. Bắt đầu checker ngầm kiểm tra lịch hẹn thông báo tự động
    // Chạy silent cho MỌI user - không cần admin treo máy
    startSilentScheduleChecker();
}

/**
 * Dừng lắng nghe thông báo (khi logout)
 */
function stopNotifications() {
    if (notificationsUnsubscribeUser) {
        notificationsUnsubscribeUser();
        notificationsUnsubscribeUser = null;
    }
    if (notificationsUnsubscribeAdmin) {
        notificationsUnsubscribeAdmin();
        notificationsUnsubscribeAdmin = null;
    }
    // Hủy schedule checker khi logout
    if (_schedCheckerTimer) {
        clearInterval(_schedCheckerTimer);
        _schedCheckerTimer = null;
    }
    // FIX: Reset tất cả mảng thông báo để tránh data admin cũ tràn sang user mới
    userNotifs = [];
    adminNotifs = [];
    allNotifications = [];
    renderNotifications(); // Giao diện rỗng
}

/**
 * Xử lý dữ liệu từ Snapshot
 */
let userNotifs = [];
let adminNotifs = [];

function handleNotificationsSnapshot(snapshot, source) {
    const newNotifs = [];
    snapshot.forEach(doc => {
        newNotifs.push({
            id: doc.id,
            ...doc.data()
        });
    });

    if (source === "user") {
        // Lọc bỏ thông báo dành cho admin (VIP request...) — user thường không được thấy
        userNotifs = newNotifs.filter(n => !n.isForAdmin && n.type !== "vip_request");
    }
    if (source === "admin") adminNotifs = newNotifs;

    // Gộp và sắp xếp theo thời gian mới nhất (giảm dần)
    allNotifications = [...userNotifs, ...adminNotifs].sort((a, b) => {
        const timeA = a.createdAt ? a.createdAt.toMillis() : 0;
        const timeB = b.createdAt ? b.createdAt.toMillis() : 0;
        return timeB - timeA;
    });

    renderNotifications();
}

/**
 * Render danh sách ra UI
 */
function renderNotifications() {
    const listEl = document.getElementById("notificationList");
    const badgeEl = document.getElementById("notificationBadge");
    
    if (!listEl) return;

    // Cập nhật badge
    const unreadCount = allNotifications.filter(n => !n.isRead).length;
    if (badgeEl) {
        if (unreadCount > 0) {
            badgeEl.textContent = unreadCount > 99 ? "99+" : unreadCount;
            badgeEl.style.display = "block";
        } else {
            badgeEl.style.display = "none";
        }
    }

    // Nếu không có thông báo
    if (allNotifications.length === 0) {
        listEl.innerHTML = `<li style="padding: 15px; text-align: center; color: var(--text-muted);">Không có thông báo mới</li>`;
        return;
    }

    listEl.innerHTML = "";
    allNotifications.forEach(notif => {
        const li = document.createElement("li");
        li.className = `notification-item ${notif.isRead ? "read" : "unread"}`;
        
        // Icon theo loại thông báo
        let iconHtml = '<i class="fas fa-bell text-info"></i>';
        if (notif.type === "vip_request") iconHtml = '<i class="fas fa-star text-warning"></i>';
        if (notif.type === "vip_approved") iconHtml = '<i class="fas fa-check-circle text-success"></i>';
        if (notif.type === "new_movie") iconHtml = '<i class="fas fa-film" style="color: #e50914;"></i>';

        // Format thời gian
        let timeStr = "Vừa xong";
        if (notif.createdAt) {
            const date = notif.createdAt.toDate();
            timeStr = date.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
        }

        // Xử lý action click
        const clickAction = `markAsRead('${notif.id}'); handleNotificationClick('${notif.type}')`;

        li.innerHTML = `
            <div class="notif-content" onclick="${clickAction}">
                <div class="notif-icon">${iconHtml}</div>
                <div class="notif-text">
                    <div class="notif-title">${notif.title}</div>
                    <div class="notif-message">${notif.message}</div>
                    <div class="notif-time">${timeStr}</div>
                </div>
            </div>
            <button class="notif-delete-btn" onclick="deleteNotification(event, '${notif.id}')" title="Xoá thông báo">
                <i class="fas fa-times"></i>
            </button>
        `;
        listEl.appendChild(li);
    });
}

/**
 * Xử lý click trên thông báo tuỳ theo type
 */
function handleNotificationClick(type) {
    const dropdown = document.getElementById("notificationDropdown");
    if (dropdown) dropdown.classList.add("hidden");

    // Chỉ cho Admin chuyển sang trang quản lý VIP, user thường bỏ qua
    if (type === "vip_request" && typeof isAdmin !== "undefined" && isAdmin && typeof showPage === "function" && typeof window.showAdminPanel === "function") {
        showPage('admin');
        setTimeout(() => {
            window.showAdminPanel('vipRequests');
        }, 100);
    }
}

/**
 * Đánh dấu 1 thông báo đã đọc
 */
async function markAsRead(notifId) {
    if (!db) return;
    try {
        await db.collection("notifications").doc(notifId).update({
            isRead: true
        });
    } catch(err) {
        console.error("Lỗi đánh dấu đã đọc:", err);
    }
}

/**
 * Đánh dấu TẤT CẢ đã đọc
 */
async function markAllAsRead() {
    if (!db) return;
    try {
        const unreadNotifs = allNotifications.filter(n => !n.isRead);
        if (unreadNotifs.length === 0) return;
        
        const batch = db.batch();
        unreadNotifs.forEach(notif => {
            const ref = db.collection("notifications").doc(notif.id);
            batch.update(ref, { isRead: true });
        });
        await batch.commit();
        showNotification("Đã đánh dấu tất cả là đã đọc", "success");
    } catch(err) {
        console.error("Lỗi đánh dấu tất cả đã đọc:", err);
    }
}

/**
 * Xóa 1 thông báo
 */
async function deleteNotification(event, notifId) {
    if (event) {
        event.stopPropagation(); // Ngăn click lan lên notif-content
    }
    if (!db) return;
    try {
        await db.collection("notifications").doc(notifId).delete();
    } catch(err) {
        console.error("Lỗi xóa thông báo:", err);
    }
}

/**
 * Xóa TẤT CẢ thông báo
 */
async function deleteAllNotifications() {
    if (!db || allNotifications.length === 0) return;
    
    if (await customConfirm("Bạn có chắc chắn muốn xoá TẤT CẢ thông báo không? Hành động này không thể hoàn tác.", { title: "Xóa thông báo", type: "danger", confirmText: "Xóa tất cả" })) {
        try {
            const batch = db.batch();
            allNotifications.forEach(notif => {
                const ref = db.collection("notifications").doc(notif.id);
                batch.delete(ref);
            });
            await batch.commit();
            showNotification("Đã xoá tất cả thông báo", "success");
            
            // Đóng dropdown nếu rỗng
            const dropdown = document.getElementById("notificationDropdown");
            if(dropdown) dropdown.classList.add("hidden");
        } catch(err) {
            console.error("Lỗi xóa tất cả thông báo:", err);
            showNotification("Có lỗi xảy ra khi xoá", "error");
        }
    }
}

/**
 * Thêm thông báo mới (hàm tiện ích gọi từ nơi khác)
 */
async function sendNotification(userId, title, message, type = "system") {
    if (!db) return;
    try {
        const isForAdmin = userId === "admin";
        await db.collection("notifications").add({
            userId: userId,
            isForAdmin: isForAdmin,
            title: title,
            message: message,
            type: type,
            isRead: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch(err) {
        console.error("Lỗi thêm thông báo:", err);
    }
}

/**
 * Gửi thông báo tới TẤT CẢ users (dùng khi admin đăng phim mới)
 * Sử dụng batch write để tối ưu hiệu suất
 * @param {string} title Tiêu đề thông báo
 * @param {string} message Nội dung thông báo
 * @param {string} type Loại thông báo (mặc định: "new_movie")
 */
async function sendNotificationToAllUsers(title, message, type = "new_movie") {
    if (!db) return;
    try {
        // Lấy danh sách tất cả users
        const usersSnapshot = await db.collection("users").get();
        if (usersSnapshot.empty) return;

        // Dùng batch write (tối đa 500 docs/batch theo giới hạn Firestore)
        let batch = db.batch();
        let count = 0;

        usersSnapshot.forEach(doc => {
            const notifRef = db.collection("notifications").doc();
            batch.set(notifRef, {
                userId: doc.id,
                isForAdmin: false,
                title: title,
                message: message,
                type: type,
                isRead: false,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            count++;

            // Firestore giới hạn 500 operations/batch → commit và tạo batch mới
            if (count % 499 === 0) {
                batch.commit();
                batch = db.batch();
            }
        });

        // Commit batch cuối cùng
        await batch.commit();
        console.log(`🔔 Đã gửi thông báo tới ${count} users`);
    } catch(err) {
        console.error("Lỗi gửi thông báo tới tất cả users:", err);
    }
}

/**
 * Toggle Dropdown Thông báo
 */
window.toggleNotificationDropdown = function(event) {
    if (event) event.stopPropagation();
    
    const dropdown = document.getElementById("notificationDropdown");
    if (!dropdown) return;

    dropdown.classList.toggle("hidden");

    if (!dropdown.classList.contains("hidden")) {
        // Đóng các dropdown khác nếu đang mở
        const userDropdown = document.getElementById("userDropdown");
        if (userDropdown) userDropdown.classList.remove("active");
    }
}

// Đóng dropdown khi click ra ngoài
document.addEventListener("click", function(event) {
    const dropdown = document.getElementById("notificationDropdown");
    const btn = document.getElementById("notificationBtn");
    
    if (dropdown && !dropdown.classList.contains("hidden")) {
        if (!dropdown.contains(event.target) && !btn.contains(event.target)) {
            dropdown.classList.add("hidden");
        }
    }
});

/* ============================================
   SILENT SCHEDULE CHECKER (CHẠY NGẦM CHO MỌI USER)
   Checker hoàn toàn ẩn - user không thấy bất kỳ dữ liệu lịch hẹn nào
   Chỉ tạo thông báo khi tới giờ đã hẹn
   ============================================ */

let _schedCheckerTimer = null;

/**
 * Bắt đầu checker ngầm - gọi bởi initNotifications
 * Chạy mỗi 30 giây, hoàn toàn invisible với user
 */
function startSilentScheduleChecker() {
    // Hủy timer cũ nếu có
    if (_schedCheckerTimer) clearInterval(_schedCheckerTimer);

    // Check ngay lần đầu (delay 5s để trang load xong)
    setTimeout(() => { _silentCheckScheduled(); }, 5000);

    // Lặp lại mỗi 30 giây
    _schedCheckerTimer = setInterval(() => {
        _silentCheckScheduled();
    }, 30000);
}

/**
 * Kiểm tra ngầm các lịch hẹn đã tới giờ và gửi thông báo
 * Hoàn toàn silent - không log ra console ở chế độ bình thường
 */
async function _silentCheckScheduled() {
    if (!db) return;

    try {
        const now = new Date();

        // Query chỉ theo status (tránh lỗi composite index Firestore)
        const snapshot = await db.collection("scheduled_notifications")
            .where("status", "==", "pending")
            .get();

        if (snapshot.empty) return;

        // Lọc client-side: chỉ lấy lịch đã tới giờ
        const dueDocs = snapshot.docs.filter(doc => {
            const data = doc.data();
            if (!data.scheduledAt) return false;
            const schedTime = data.scheduledAt.toDate();
            return schedTime <= now;
        });

        if (dueDocs.length === 0) return;

        for (const doc of dueDocs) {
            const schedRef = db.collection("scheduled_notifications").doc(doc.id);

            // Dùng Transaction để tránh 2 tab gửi trùng
            const shouldSend = await db.runTransaction(async (transaction) => {
                const freshDoc = await transaction.get(schedRef);
                if (!freshDoc.exists) return false;

                const freshData = freshDoc.data();

                // Nếu đã bị tab khác chuyển status → bỏ qua
                if (freshData.status !== "pending") return false;

                // Nếu tab khác vừa gửi < 2 phút trước → bỏ qua
                if (freshData.lastSentAt && freshData.lastSentAt.toDate) {
                    const lastSent = freshData.lastSentAt.toDate();
                    const diffMinutes = (now - lastSent) / (1000 * 60);
                    if (diffMinutes < 2) return false;
                }

                // Chiếm lock: set lastSentAt ngay trong transaction
                transaction.update(schedRef, {
                    lastSentAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                return true; // Được phép gửi
            });

            if (!shouldSend) continue;

            // Gửi thông báo SAU KHI transaction thành công (chỉ 1 tab duy nhất chạy tới đây)
            const sched = { id: doc.id, ...doc.data() };
            await sendNotificationToAllUsers(sched.title, sched.message, sched.type);
            console.log(`✅ Đã gửi thông báo hẹn giờ: "${sched.title}"`);

            // Cập nhật trạng thái sau khi gửi
            const updateData = {};

            if (sched.repeat === "once") {
                updateData.status = "sent";
            } else {
                const scheduledTime = sched.scheduledAt.toDate();
                const nextDate = new Date(scheduledTime);

                if (sched.repeat === "daily") {
                    nextDate.setDate(nextDate.getDate() + 1);
                } else if (sched.repeat === "weekly") {
                    nextDate.setDate(nextDate.getDate() + 7);
                } else if (sched.repeat === "monthly") {
                    nextDate.setMonth(nextDate.getMonth() + 1);
                }

                while (nextDate <= now) {
                    if (sched.repeat === "daily") nextDate.setDate(nextDate.getDate() + 1);
                    else if (sched.repeat === "weekly") nextDate.setDate(nextDate.getDate() + 7);
                    else if (sched.repeat === "monthly") nextDate.setMonth(nextDate.getMonth() + 1);
                }

                updateData.scheduledAt = firebase.firestore.Timestamp.fromDate(nextDate);
            }

            await schedRef.update(updateData);
        }
    } catch (err) {
        console.error("❌ Lỗi schedule checker:", err);
    }
}
