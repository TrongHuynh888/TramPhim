/**
 * Toggle hiện/ẩn mật khẩu
 */
function togglePassword(inputId, iconElement) {
    const passwordInput = document.getElementById(inputId);
    if (passwordInput.type === "password") {
        passwordInput.type = "text";
        iconElement.classList.remove("fa-eye");
        iconElement.classList.add("fa-eye-slash");
    } else {
        passwordInput.type = "password";
        iconElement.classList.remove("fa-eye-slash");
        iconElement.classList.add("fa-eye");
    }
}

/**
 * Xử lý đăng nhập
 */
async function handleLogin(event) {
  event.preventDefault();

  const email = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginPassword").value;

  if (!auth) {
    showNotification(
      "Firebase chưa được cấu hình. Vui lòng kiểm tra firebase-config.js",
      "error",
    );
    return;
  }

  try {
    showLoading(true, "Đang đăng nhập...");

    // 1. Đăng nhập vào Firebase Auth
    const userCredential = await auth.signInWithEmailAndPassword(
      email,
      password,
    );
    const user = userCredential.user;

    // 👇 2. THÊM ĐOẠN KIỂM TRA BỊ XÓA NGAY TẠI ĐÂY 👇
    const userDoc = await db.collection("users").doc(user.uid).get();

    if (userDoc.exists && userDoc.data().isDeleted === true) {
      // Nếu bị xóa -> Đăng xuất ngay lập tức
      await auth.signOut();
      throw new Error("account-deleted"); // Ném lỗi tự tạo
    }
    showNotification("Đăng nhập thành công!", "success");
    closeModal("authModal");

    // Reset form
    document.getElementById("loginForm").reset();
  } catch (error) {
    console.error("Lỗi đăng nhập:", error);
    let errorMessage = "Đăng nhập thất bại!";

    // 👇 XỬ LÝ LỖI TÀI KHOẢN BỊ XÓA 👇
    if (error.message === "account-deleted") {
      errorMessage =
        "❌ Tài khoản này đã bị Admin xóa vĩnh viễn! Vui lòng đăng ký tài khoản mới.";
    }
    // Các lỗi cũ của Firebase
    else
      switch (error.code) {
        case "auth/user-not-found":
          errorMessage = "Email không tồn tại trong hệ thống";
          break;
        case "auth/wrong-password":
          errorMessage = "Mật khẩu không chính xác";
          break;
        case "auth/invalid-email":
          errorMessage = "Email không hợp lệ";
          break;
        case "auth/too-many-requests":
          errorMessage = "Quá nhiều lần thử. Vui lòng thử lại sau";
          break;
      }

    showNotification(errorMessage, "error");
  } finally {
    showLoading(false);
  }
}
/**
 * Xử lý đăng ký
 */
async function handleRegister(event) {
  event.preventDefault();

  const name = document.getElementById("registerName").value;
  const email = document.getElementById("registerEmail").value;
  const password = document.getElementById("registerPassword").value;
  const confirmPassword = document.getElementById(
    "registerConfirmPassword",
  ).value;
  const avatarUrl =
    document.getElementById("registerAvatar").value ||
    "https://ui-avatars.com/api/?name=" +
      encodeURIComponent(name) +
      "&background=random";
  // Validate
  if (password !== confirmPassword) {
    showNotification("Mật khẩu xác nhận không khớp!", "error");
    return;
  }

  if (password.length < 6) {
    showNotification("Mật khẩu phải có ít nhất 6 ký tự!", "error");
    return;
  }

  if (!auth) {
    showNotification(
      "Firebase chưa được cấu hình. Vui lòng kiểm tra firebase-config.js",
      "error",
    );
    return;
  }

  try {
    showLoading(true, "Đang tạo tài khoản...");

    // Tạo tài khoản
    const userCredential = await auth.createUserWithEmailAndPassword(
      email,
      password,
    );

    // Cập nhật display name
    await userCredential.user.updateProfile({
      displayName: name,
      photoURL: avatarUrl, // Lưu link ảnh vào Firebase Auth
    });

    showNotification(
      "Đăng ký thành công! Chào mừng bạn đến với Trạm Phim!",
      "success",
    );
    closeModal("authModal");

    // Reset form
    document.getElementById("registerForm").reset();
  } catch (error) {
    console.error("Lỗi đăng ký:", error);
    let errorMessage = "Đăng ký thất bại!";

    switch (error.code) {
      case "auth/email-already-in-use":
        errorMessage =
          "Email này đã được đăng ký (hoặc tài khoản cũ đã bị xóa). Vui lòng dùng Email khác!";
        break;
      case "auth/invalid-email":
        errorMessage = "Email không hợp lệ";
        break;
      case "auth/weak-password":
        errorMessage = "Mật khẩu quá yếu";
        break;
    }

    showNotification(errorMessage, "error");
  } finally {
    showLoading(false);
  }
}
/**
 * Xử lý đăng xuất
 */
async function handleLogout() {
  if (!auth) return;

  try {
    await auth.signOut();

    // Dừng lắng nghe realtime thông báo
    if (typeof stopNotifications === "function") {
        stopNotifications();
    }

    // 👇 THÊM ĐOẠN NÀY ĐỂ ĐÓNG MENU & RESET GIAO DIỆN 👇
    const dropdown = document.getElementById("userDropdown");
    if (dropdown) dropdown.classList.remove("active"); // Đóng menu ngay lập tức
    
    // Đóng dropdown thông báo nếu đang mở
    const notifDropdown = document.getElementById("notificationDropdown");
    if (notifDropdown) notifDropdown.classList.add("hidden");

    // Đảm bảo nút Đăng nhập hiện lại ngay (phòng hờ updateAuthUI chạy chậm)
    const loginBtn = document.getElementById("loginBtn");
    const userMenuTrigger = document.getElementById("userMenuTrigger");
    if (loginBtn) loginBtn.classList.remove("hidden");
    if (userMenuTrigger) userMenuTrigger.classList.add("hidden");
    // 👆 HẾT PHẦN THÊM 👆

    showNotification("Đã đăng xuất!", "info");
    showPage("home");
  } catch (error) {
    console.error("Lỗi đăng xuất:", error);
    showNotification("Lỗi khi đăng xuất!", "error");
  }
}
/**
 * Xử lý gửi email quên mật khẩu
 */
async function handleForgotPassword(event) {
  event.preventDefault();

  const email = document.getElementById("forgotEmail").value.trim();

  if (!email) {
    showNotification("Vui lòng nhập email!", "warning");
    return;
  }

  try {
    showLoading(true, "Đang gửi email...");

    // Gọi hàm của Firebase
    await auth.sendPasswordResetEmail(email);

    // Thông báo thành công
    await customAlert("✅ Đã gửi email khôi phục! Vui lòng kiểm tra hộp thư (cả mục Spam) và làm theo hướng dẫn trong email để đặt lại mật khẩu.", { title: "Gửi thành công", type: "success" });

    // Quay về trang đăng nhập
    switchAuthTab("login");
  } catch (error) {
    console.error("Lỗi quên mật khẩu:", error);
    let msg = "Gửi thất bại!";

    if (error.code === "auth/user-not-found") {
      msg = "Email này chưa được đăng ký!";
    } else if (error.code === "auth/invalid-email") {
      msg = "Email không hợp lệ!";
    }

    showNotification(msg, "error");
  } finally {
    showLoading(false);
  }
}
/**
 * Xử lý khi trạng thái đăng nhập thay đổi (Đã sửa lỗi Avatar & updateProfile)
 */
async function handleAuthStateChange(user) {
  // Bước 1: Gán user gốc từ Auth
  currentUser = user;

  if (user) {
    // ============================================================
    // 1. LẤY DỮ LIỆU TỪ FIRESTORE & KIỂM TRA VIP
    // ============================================================
    if (db) {
      try {
        // Lần 1: Lấy dữ liệu thô lên để kiểm tra
        const userDoc = await db.collection("users").doc(user.uid).get();

        if (userDoc.exists) {
          const userData = userDoc.data();

          // 👇 A. GỌI HÀM KIỂM TRA HẾT HẠN NGAY TẠI ĐÂY 👇
          // Nếu hết hạn, hàm này sẽ âm thầm sửa DB thành Free
          await checkAndDowngradeVip(user, userData);

          // 👇 B. LẤY LẠI DỮ LIỆU MỚI NHẤT (QUAN TRỌNG) 👇
          // Phải lấy lại lần nữa để đảm bảo biến 'freshData' chứa trạng thái Free (nếu vừa bị hạ cấp)
          const freshDoc = await db.collection("users").doc(user.uid).get();
          const freshData = freshDoc.data();

          // 🛡️ Kiểm tra khóa tài khoản (Dùng dữ liệu mới)
          if (freshData.isActive === false) {
            await auth.signOut();
            await customAlert("⛔ TÀI KHOẢN CỦA BẠN ĐÃ BỊ KHÓA!", { title: "Tài khoản bị khóa", type: "danger" });
            window.location.reload();
            return;
          }

          // 👇 C. GÁN DỮ LIỆU MỚI VÀO CURRENT USER 👇
          currentUser.favorites = freshData.favorites || [];
          currentUser.role = freshData.role || "user";
          currentUser.isActive = freshData.isActive;

          currentUser.purchasedMovies = freshData.purchasedMovies || [];
          // Gán trạng thái VIP (Lúc này nếu hết hạn thì freshData.isVip đã là false)
          currentUser.isVip = freshData.isVip;
          // 👉 THÊM DÒNG NÀY ĐỂ LẤY NGÀY HẾT HẠN:
          currentUser.vipExpiresAt = userData.vipExpiresAt;
          if (freshData.avatar) {
            currentUser.photoURL = freshData.avatar;
          }

          isAdmin = freshData.role === "admin";
        }
      } catch (error) {
        console.error("Lỗi lấy dữ liệu user:", error);
      }
    }
    // ============================================================

    console.log("✅ Đã đăng nhập:", user.email);

    // 2. Cập nhật giao diện (Avatar, Viền vàng, Tên...)
    updateAuthUI(true);

    // 3. Cập nhật lần đăng nhập cuối
    createOrUpdateUserDoc(user);

    // Bắt đầu lắng nghe thông báo (Chờ tí để isAdmin chắc chắn được set)
    setTimeout(() => {
      if (typeof initNotifications === "function") {
          initNotifications(user, isAdmin);
      }
    }, 500);

    // 4. Load dữ liệu admin nếu cần
    if (isAdmin) {
      loadAdminData();
    }

    // 5. Vẽ lại danh sách phim
    renderFeaturedMovies();
    renderNewMovies();
    renderAllMovies();
    renderBannerSlider();
    
    // 6. Cập nhật watch progress cho các thẻ phim (đợi DOM cập nhật)
    if (typeof updateAllWatchProgress === 'function') {
        // Đợi một chút để DOM được cập nhật
        setTimeout(() => {
            updateAllWatchProgress();
        }, 100);
    }

    // Cập nhật trang chi tiết nếu đang xem
    if (currentMovieId) {
      const detailLikeBtn = document.querySelector(
        `.btn-like-${currentMovieId}`,
      );
      if (detailLikeBtn) viewMovieDetail(currentMovieId);
      checkAndUpdateVideoAccess();
    }
  } else {
    // --- CHƯA ĐĂNG NHẬP ---
    console.log("❌ Chưa đăng nhập");
    currentUser = null;
    isAdmin = false;
    updateAuthUI(false);

    renderFeaturedMovies();
    renderNewMovies();
    renderAllMovies();
    renderBannerSlider();
  }
}
/**
 * Tạo hoặc cập nhật user document trong Firestore
 */
async function createOrUpdateUserDoc(user) {
  if (!db) return;

  try {
    const userRef = db.collection("users").doc(user.uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      // Tạo mới user document
      await userRef.set({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || user.email.split("@")[0],
        avatar: user.photoURL || "",
        role: user.email === ADMIN_EMAIL ? "admin" : "user",
        isActive: true,
        purchasedMovies: [],
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
      });
      console.log("✅ Đã tạo user document mới");
    } else {
      // Cập nhật lastLogin
      await userRef.update({
        lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
      });
    }
  } catch (error) {
    console.error("❌ Lỗi tạo/cập nhật user doc:", error);
  }
}
/**
 * Kiểm tra xem VIP còn hạn không. Nếu hết hạn -> Hạ xuống Free
 */
async function checkAndDowngradeVip(user, userData) {
  if (!userData.isVip || !userData.vipExpiresAt) return; // Không phải VIP hoặc VIP trọn đời cũ thì bỏ qua

  const expiryDate = userData.vipExpiresAt.toDate();
  const now = new Date();

  // Nếu Ngày hết hạn nhỏ hơn Ngày hiện tại -> Đã hết hạn
  if (expiryDate < now) {
    console.log("⚠️ VIP đã hết hạn! Đang hạ cấp tài khoản...");

    try {
      // 1. Cập nhật Firestore về Free
      await db.collection("users").doc(user.uid).update({
        isVip: false,
        vipExpiresAt: null,
      });

      // 2. Cập nhật biến cục bộ để giao diện đổi ngay lập tức
      currentUser.isVip = false;

      // 3. Thông báo cho người dùng biết
      showNotification(
        "Gói VIP của bạn đã hết hạn. Vui lòng gia hạn để tiếp tục xem.",
        "warning",
      );
    } catch (error) {
      console.error("Lỗi tự động hạ cấp VIP:", error);
    }
  }
}
/**
 * Cập nhật UI theo trạng thái đăng nhập (Đã thêm logic hiển thị VIP)
 */
function updateAuthUI(isLoggedIn) {
  // Lấy các phần tử giao diện
  const loginBtn = document.getElementById("loginBtn");
  const userMenuTrigger = document.getElementById("userMenuTrigger");
  const userAvatarSmall = document.getElementById("userAvatarSmall");

  const dropdownAvatar = document.getElementById("dropdownAvatar");
  const dropdownName = document.getElementById("dropdownName");

  // 👇 Lấy thêm phần tử hiển thị chữ "Free/VIP" 👇
  const roleBadge = document.querySelector(".dropdown-role");

  const adminNavLink = document.getElementById("adminNavLink");
  const commentForm = document.getElementById("commentForm");

  if (isLoggedIn && currentUser) {
    // 1. Ẩn nút đăng nhập, hiện Avatar
    if (loginBtn) loginBtn.classList.add("hidden");
    if (userMenuTrigger) userMenuTrigger.classList.remove("hidden");

    // 2. Lấy link ảnh
    const avatarUrl =
      currentUser.photoURL ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.displayName || "User")}&background=random`;

    // 3. Cập nhật ảnh và tên
    if (userAvatarSmall) userAvatarSmall.src = avatarUrl;
    if (dropdownAvatar) dropdownAvatar.src = avatarUrl;
    if (dropdownName)
      dropdownName.textContent = currentUser.displayName || "User";

    // ============================================================
    // 👇 LOGIC MỚI: XỬ LÝ GIAO DIỆN VIP 👇
    // ============================================================
    const isVip = currentUser.isVip === true;

    // A. Xử lý Viền Avatar
    if (isVip) {
      if (userAvatarSmall) userAvatarSmall.classList.add("vip-border");
      if (dropdownAvatar) dropdownAvatar.classList.add("vip-border");
    } else {
      if (userAvatarSmall) userAvatarSmall.classList.remove("vip-border");
      if (dropdownAvatar) dropdownAvatar.classList.remove("vip-border");
    }

    // B. Xử lý chữ Free -> VIP kèm Thời hạn
    if (roleBadge) {
      if (isVip) {
        // --- TÍNH TOÁN THỜI HẠN ---
        let durationText = "";

        if (currentUser.vipExpiresAt) {
          // Có ngày hết hạn -> Tính số ngày còn lại
          // Kiểm tra xem vipExpiresAt là Firestore Timestamp hay Date object
          const expiryDate = currentUser.vipExpiresAt.toDate
            ? currentUser.vipExpiresAt.toDate()
            : new Date(currentUser.vipExpiresAt);
          const now = new Date();
          const diffTime = expiryDate - now;
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          // Nếu còn ngày thì hiện số, hết thì hiện 0
          const daysLeft = diffDays > 0 ? diffDays : 0;
          durationText = `<span style="font-size: 9px; margin-left: 4px; opacity: 0.9;">(${daysLeft} ngày)</span>`;
        } else {
          // Không có ngày hết hạn -> Vĩnh viễn
          durationText = `<span style="font-size: 10px; margin-left: 4px;">♾️</span>`;
        }

        // Hiển thị ra HTML
        roleBadge.innerHTML = `<i class="fas fa-crown"></i> VIP ${durationText}`;
        roleBadge.classList.add("vip-badge");
        roleBadge.classList.remove("dropdown-role");
        roleBadge.classList.add("dropdown-role");
      } else {
        // Tài khoản thường
        if (isAdmin) {
          roleBadge.textContent = "Admin";
          roleBadge.classList.remove("vip-badge");
        } else {
          roleBadge.textContent = "Free";
          roleBadge.classList.remove("vip-badge");
        }
      }
    }
    // ============================================================

    // 4. Hiện link Admin nếu là admin
    if (isAdmin && adminNavLink) adminNavLink.classList.remove("hidden");

    // 5. Hiện form bình luận
    if (commentForm) commentForm.style.display = "block";
  } else {
    // --- CHƯA ĐĂNG NHẬP ---
    if (loginBtn) loginBtn.classList.remove("hidden");
    if (userMenuTrigger) userMenuTrigger.classList.add("hidden");

    // Reset viền khi đăng xuất
    if (userAvatarSmall) userAvatarSmall.classList.remove("vip-border");

    if (adminNavLink) adminNavLink.classList.add("hidden");
    if (commentForm) commentForm.style.display = "none";
  }
}
/**
 * Mở modal Đổi mật khẩu
 */
function openChangePasswordModal() {
  if (!currentUser) return;
  
  // Đóng dropdown trước khi mở modal
  const dropdown = document.getElementById("userDropdown");
  if (dropdown) dropdown.classList.remove("active");
  
  document.getElementById("changePasswordForm").reset();
  openModal("changePasswordModal");
}

/**
 * Xử lý đổi mật khẩu
 */
async function handleChangePassword(event) {
  event.preventDefault();

  const oldPassword = document.getElementById("oldPassword").value;
  const newPassword = document.getElementById("newPassword").value;
  const confirmNewPassword = document.getElementById("confirmNewPassword").value;

  if (newPassword !== confirmNewPassword) {
    showNotification("Mật khẩu xác nhận không khớp!", "warning");
    return;
  }

  if (newPassword.length < 6) {
    showNotification("Mật khẩu mới phải có ít nhất 6 ký tự!", "warning");
    return;
  }

  try {
    showLoading(true, "Đang xử lý...");

    // Xác thực lại người dùng bằng mật khẩu cũ
    const credential = firebase.auth.EmailAuthProvider.credential(
      currentUser.email,
      oldPassword
    );

    // Dùng reauthenticateWithCredential vì reauthenticateWithPopup/Redirect không tốt trên giao diện này
    // Firebase Web v8
    await currentUser.reauthenticateWithCredential(credential);

    // Cập nhật mật khẩu mới
    await currentUser.updatePassword(newPassword);

    showNotification("Đổi mật khẩu thành công!", "success");
    closeModal("changePasswordModal");
  } catch (error) {
    console.error("Lỗi đổi mật khẩu:", error);
    let msg = "Đổi mật khẩu thất bại!";
    if (error.code === "auth/wrong-password") {
      msg = "Mật khẩu hiện tại không đúng!";
    } else if (error.code === "auth/too-many-requests") {
      msg = "Thử quá nhiều lần, vui lòng thử lại sau!";
    } else if (error.code === "auth/requires-recent-login") {
      msg = "Khuôn khổ bảo mật: Vui lòng đăng xuất và đăng nhập lại trước khi đổi mật khẩu!";
    }
    showNotification(msg, "error");
  } finally {
    showLoading(false);
  }
}

/**
 * Hàm xử lý click bên trong dropdown (Tách ra để tránh duplicate event)
 */
function handleDropdownItemClick(e) {
  const dropdown = document.getElementById("userDropdown");
  if (!dropdown) return;

  // Nếu click vào thẻ li, a, hoặc button bên trong menu
  if (e.target.closest(".dropdown-item") || e.target.closest("button")) {
      dropdown.classList.remove("active");
      dropdown.removeEventListener("click", handleDropdownItemClick);
      // Gỡ sự kiện click-outside nếu có (nếu sau này thêm vào)
      document.removeEventListener("click", closeDropdownOutside);
  }
}

/**
 * Hàm đóng dropdown khi click ra ngoài
 */
function closeDropdownOutside(e) {
    const dropdown = document.getElementById("userDropdown");
    const trigger = document.getElementById("userMenuTrigger");
    
    // Nếu click ra ngoài dropdown VÀ không click vào nút mở (trigger)
    if (dropdown && 
        dropdown.classList.contains("active") && 
        !dropdown.contains(e.target) && 
        !trigger.contains(e.target)) {
        
        dropdown.classList.remove("active");
        dropdown.removeEventListener("click", handleDropdownItemClick);
        document.removeEventListener("click", closeDropdownOutside);
    }
}

/**
 * Bật/tắt Menu User (Đã sửa lỗi xung đột click & Auto-close)
 */
function toggleUserDropdown(event) {
  // 1. Chặn sự kiện click lan ra ngoài (QUAN TRỌNG NHẤT)
  if (event) {
    event.stopPropagation();
  }

  const dropdown = document.getElementById("userDropdown");
  const vipNotif = document.getElementById("vipNotificationDropdown");
  
  // Đóng dropdown thông báo VIP nếu nó đang mở
  if (vipNotif && !vipNotif.classList.contains("hidden")) {
      vipNotif.classList.add("hidden");
  }

  if (dropdown) {
    // Toggle trạng thái
    const isActive = dropdown.classList.toggle("active");

    if (isActive) {
        // Mở -> Thêm sự kiện lắng nghe click bên trong & click bên ngoài
        dropdown.addEventListener("click", handleDropdownItemClick);
        
        // Thêm timeout nhỏ để tránh sự kiện click hiện tại kích hoạt luôn hàm close
        setTimeout(() => {
            document.addEventListener("click", closeDropdownOutside);
        }, 0);
    } else {
        // Đóng bằng nút toggle -> Gỡ bỏ sự kiện
        dropdown.removeEventListener("click", handleDropdownItemClick);
        document.removeEventListener("click", closeDropdownOutside);
    }
  }
}

/**
 * Mở modal đăng nhập/đăng ký
 */
function openAuthModal() {
  if (typeof openModal === "function") {
    openModal("authModal");
  } else {
    console.error("Lỗi: Hàm openModal chưa được tải từ utils.js");
  }
}
