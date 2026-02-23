// ============================================
// CẬP NHẬT HÀM KHỞI CHẠY (startTramPhimApp)
// ============================================
window.startTramPhimApp = async () => {
  console.log("🎬 Trạm Phim Starting...");

  auth.onAuthStateChanged(handleAuthStateChange);
  await loadInitialData();

  initializeUI();
  
  // Custom: Check URL Hash for deep linking (Fix lỗi F5)
  const hash = window.location.hash;
  if (hash) {
      console.log("🔗 Deep linking from Hash:", hash);
      handleHashRouting(hash);
  }
 
  initializeRatingStars();
  loadTheme();
  initNavbarScroll();
  initSmartPopupPositioning(); // Call new function
 
  // 👇 GỌI HÀM THỐNG KÊ MỚI TẠI ĐÂY 👇
  initVisitorStats();
 
  console.log("✅ App Ready!");
};

/**
 * Hàm xử lý điều hướng dựa trên Hash
 */
function handleHashRouting(hash) {
    if (!hash || hash === '#' || hash === '#/') {
        showPage('home', false);
        return;
    }

    // Phân tích hash (VD: #/watch/slug-id hoặc #/movies)
    const parts = hash.replace(/^#\/?/, '').split('/');
    const page = parts[0];
    const slugWithId = parts[1];

    if ((page === 'watch' || page === 'intro') && slugWithId) {
        const movieId = slugWithId.split('-').pop(); // Lấy ID ở cuối chuỗi
        if (movieId) {
            if (page === 'watch' && typeof viewMovieDetail === 'function') {
                setTimeout(() => viewMovieDetail(movieId, false), 100);
            } else if (page === 'intro' && typeof viewMovieIntro === 'function') {
                setTimeout(() => viewMovieIntro(movieId, false), 100);
            }
            return;
        }
    }

    // Xử lý các trang thông thường (movies, categories...)
    if (page) {
        setTimeout(() => showPage(page, false), 100);
    }
}

// ============================================
// HÀM THỐNG KÊ REALTIME (NGƯỜI THẬT)
// ============================================
function initVisitorStats() {
  const statVisits = document.getElementById("statVisits");
  const statOnline = document.getElementById("statOnline");
  const statTime = document.getElementById("statTime");

  // 1. TỔNG TRUY CẬP (Giữ nguyên logic cũ dùng Firestore)
  try {
    if (db) {
      const statsRef = db.collection("system").doc("stats");
      // Tăng view mỗi khi tải trang
      statsRef.set(
        {
          totalVisits: firebase.firestore.FieldValue.increment(1),
        },
        { merge: true },
      );

      // Lắng nghe thay đổi
      statsRef.onSnapshot((doc) => {
        if (doc.exists) {
          if (statVisits)
            statVisits.textContent = formatNumber(doc.data().totalVisits || 0);
        }
      });
    }
  } catch (e) {
    console.error(e);
  }

  // 2. NGƯỜI ĐANG ONLINE (Dùng Realtime Database)
  try {
    const rtdb = firebase.database();
    const onlineRef = rtdb.ref("online_users"); // Nơi lưu danh sách user online
    const connectedRef = rtdb.ref(".info/connected"); // Trạng thái kết nối của bản thân

    // Khi người dùng kết nối thành công
    connectedRef.on("value", (snap) => {
      if (snap.val() === true) {
        // Tạo một kết nối mới vào danh sách
        const myCon = onlineRef.push();

        // QUAN TRỌNG: Khi mất mạng hoặc tắt tab -> Tự động xóa kết nối này
        myCon.onDisconnect().remove();

        // Đánh dấu là đang online
        myCon.set(true);
      }
    });

    // Lắng nghe tổng số lượng kết nối đang có trong danh sách
    onlineRef.on("value", (snap) => {
      if (statOnline) {
        // Đếm số lượng con (số người đang online)
        const count = snap.numChildren();
        statOnline.textContent = count;

        // Hiệu ứng nháy xanh để báo hiệu số liệu sống
        statOnline.classList.add("highlight");
        setTimeout(() => statOnline.classList.remove("highlight"), 500);
      }
    });
  } catch (e) {
    console.error("Lỗi Realtime DB (Kiểm tra lại config):", e);
    if (statOnline) statOnline.textContent = "1"; // Fallback nếu lỗi
  }

  // 3. THỜI GIAN TRUNG BÌNH (Giữ nguyên random cho đơn giản)
  if (statTime) {
    // Chúng ta sẽ lấy số liệu từ Firestore (đã load ở phần 1) để tính
    const statsRef = db.collection("system").doc("stats");
    statsRef.get().then((doc) => {
      if (doc.exists) {
        const visits = doc.data().totalVisits || 0;

        // CÔNG THỨC: Mặc định 15 phút + (Cứ 100 views thì tăng thêm 0.5 phút)
        // Số này sẽ cố định với mọi người dùng, và tăng dần theo thời gian -> Rất thật!
        const baseTime = 15;
        const growth = (visits / 100) * 0.5;

        // Giới hạn max là 45 phút (để không bị ảo quá)
        let calculatedTime = baseTime + growth;
        if (calculatedTime > 45) calculatedTime = 45;

        statTime.textContent = `${calculatedTime.toFixed(1)} phút`;
      }
    });
  }
}

// ============================================
// XỬ LÝ NAVIGATE BACK/FORWARD (Browser Buttons)
// ============================================
window.addEventListener('popstate', function(event) {
    console.log("📍 Popstate triggered:", window.location.hash, event.state);
    
    if (window.location.hash) {
        handleHashRouting(window.location.hash);
    } else {
        showPage('home', false);
    }
});

/* ============================================
   HÀM XỬ LÝ VỊ TRÍ POPUP THÔNG MINH (CHO PC & ALL)
   ============================================ */
function initSmartPopupPositioning() {
  document.addEventListener("mouseover", function (e) {
    const wrapper = e.target.closest(".movie-card-wrapper");
    if (!wrapper) return;

    const popup = wrapper.querySelector(".movie-popup-nfx");
    if (!popup) return;

    // Lấy kích thước wrapper & màn hình
    const rect = wrapper.getBoundingClientRect();
    const screenWidth = window.innerWidth;
    
    // Reset position
    wrapper.classList.remove("popup-align-left", "popup-align-right");

    // Logic kiểm tra mép màn hình
    // Nếu mép trái < 150px (dư để popup mở sang phải không bị che)
    if (rect.left < 150) {
      wrapper.classList.add("popup-align-left");
    } 
    // Nếu mép phải sát lề ( > width - 150px)
    else if (rect.right > screenWidth - 150) {
      wrapper.classList.add("popup-align-right");
    }
  });
}

// ============================================
// HÀM XỬ LÝ DROPDOWN THÔNG BÁO VIP
// ============================================
window.toggleVipNotificationDropdown = function(event) {
    event.stopPropagation();
    const dropdown = document.getElementById("vipNotificationDropdown");
    const userDropdown = document.getElementById("userDropdown");
    
    // Đóng user dropdown nếu đang mở
    if (userDropdown && userDropdown.classList.contains("active")) {
        userDropdown.classList.remove("active");
    }
    
    dropdown.classList.toggle("hidden");
};

// Đóng dropdown thông báo khi click ngoài
document.addEventListener("click", function (event) {
    const dropdown = document.getElementById("vipNotificationDropdown");
    const notifBtn = document.getElementById("notificationBtn");
    
    // Nếu click ra ngoài dropdown VÀ ngoài cái nút chuông
    if (dropdown && notifBtn && !dropdown.classList.contains("hidden")) {
        if (!dropdown.contains(event.target) && !notifBtn.contains(event.target)) {
            dropdown.classList.add("hidden");
        }
    }
});
