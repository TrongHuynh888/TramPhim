// Thêm vào đầu file admin.js
let editingUserId = null;
let selectedActorIds = []; // Danh sách IDs diễn viên đang được chọn
// Khởi tạo danh sách ID diễn viên mới nhất từ localStorage (để bền vững qua reload)
window.latestAddedActorIds = JSON.parse(localStorage.getItem('latestAddedActorIds') || '[]');
// Danh sách diễn viên tự động tạo từ Quản lý Phim
window.latestAutoActorIds = JSON.parse(localStorage.getItem('latestAutoAutoIds') || '[]');

/**
 * Cập nhật danh sách ID diễn viên mới nhất
 * @param {Array|string} ids - ID hoặc mảng IDs mới
 * @param {boolean} append - Nếu true, cộng dồn vào danh sách hiện tại. Nếu false, thay thế hoàn toàn.
 */
window.setLatestActorIds = function(ids, append = false) {
    const newIds = Array.isArray(ids) ? ids : [ids];
    if (append) {
        // Gom các ID lại, loại bỏ trùng lặp
        window.latestAddedActorIds = Array.from(new Set([...(window.latestAddedActorIds || []), ...newIds]));
    } else {
        window.latestAddedActorIds = newIds;
    }
    // Lưu vào localStorage
    localStorage.setItem('latestAddedActorIds', JSON.stringify(window.latestAddedActorIds));
};

/**
 * Cập nhật danh sách ID diễn viên tự động tạo mới nhất
 */
window.setLatestAutoActorIds = function(ids, append = false) {
    const newIds = Array.isArray(ids) ? ids : [ids];
    if (append) {
        window.latestAutoActorIds = Array.from(new Set([...(window.latestAutoActorIds || []), ...newIds]));
    } else {
        window.latestAutoActorIds = newIds;
    }
    localStorage.setItem('latestAutoAutoIds', JSON.stringify(window.latestAutoActorIds));
};

/**
 * Load dữ liệu cho Admin
 */
async function loadAdminData() {
  if (!isAdmin) return;

  try {
    // Load categories & countries first (to ensure badges have data)
    if (typeof loadCategories === "function") await loadCategories();
    if (typeof loadCountries === "function") await loadCountries();

    // Load movies for admin
    await loadAdminMovies();

    // Load users
    await loadAdminUsers();

    // Load comments
    await loadAdminComments();

    // Load transactions
    await loadAdminTransactions();

    // Populate movie select for episodes
    //populateMovieSelect();

    // Load categories, countries, and actors tables
    renderAdminCategories();
    renderAdminCountries();
    
    // Đảm bảo load xong diễn viên từ DB trước khi render
    if (typeof loadActors === "function") await loadActors();
    renderAdminActors();


    // Load VIP Requests
    await loadAdminVipRequests();

    // Load Notifications (Realtime)
    loadAdminNotifications();

    // Load Scheduled Notifications (Realtime + Timer checker)
    loadScheduledNotifications();

    // Load RapChieuPhim API Key
    loadRapApiKey();
  } catch (error) {
    console.error("Lỗi load admin data:", error);
  }
}

/**
 * Hàm kiểm tra thông báo VIP cũ đã bị xóa (Chuyển sang notifications.js)
 */

let allVipRequests = [];

/**
 * Load dữ liệu yêu cầu VIP
 */
async function loadAdminVipRequests() {
    if(!db) return;
    try {
        const snapshot = await db.collection("upgrade_requests")
            .orderBy("createdAt", "desc")
            .get();
            
        // Group by userId to keep only the latest request per user
        const latestRequestsMap = new Map();
        snapshot.docs.forEach(doc => {
            const data = { id: doc.id, ...doc.data() };
            // Since we ordered by desc, the first time we see a userId, it is the latest
            if (!latestRequestsMap.has(data.userId)) {
                latestRequestsMap.set(data.userId, data);
            }
        });
            
        allVipRequests = Array.from(latestRequestsMap.values());
        
        filterAdminVipRequests();
    } catch (err) {
        console.error("Lỗi tải yêu cầu VIP:", err);
    }
}

/**
 * Lọc và sắp xếp yêu cầu VIP
 */
function filterAdminVipRequests() {
    const searchEmail = document.getElementById("adminSearchVip")?.value.toLowerCase().trim() || "";
    const startDate = document.getElementById("vipFilterStartDate")?.value;
    const endDate = document.getElementById("vipFilterEndDate")?.value;
    const sortOrder = document.getElementById("vipSortOrder")?.value || "desc";
    const status = document.getElementById("vipFilterStatus")?.value || "";

    let filtered = [...allVipRequests];

    // Lọc theo Email
    if (searchEmail) {
        filtered = filtered.filter(req => req.userEmail && req.userEmail.toLowerCase().includes(searchEmail));
    }

    // Lọc theo Status
    if (status) {
        filtered = filtered.filter(req => req.status === status);
    }

    // Lọc theo Thời gian (Từ - Đến)
    if (startDate) {
        const start = new Date(startDate).setHours(0,0,0,0);
        filtered = filtered.filter(req => {
            const reqDate = req.createdAt?.toDate ? req.createdAt.toDate() : new Date(req.createdAt);
            return reqDate.getTime() >= start;
        });
    }
    
    if (endDate) {
        const end = new Date(endDate).setHours(23,59,59,999);
        filtered = filtered.filter(req => {
            const reqDate = req.createdAt?.toDate ? req.createdAt.toDate() : new Date(req.createdAt);
            return reqDate.getTime() <= end;
        });
    }

    // Sắp xếp
    filtered.sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
        return sortOrder === "desc" ? dateB - dateA : dateA - dateB;
    });

    renderAdminVipRequests(filtered);
}

/**
 * Hiển thị bảng Yêu cầu VIP
 */
function renderAdminVipRequests(requests) {
    const tbody = document.getElementById("adminVipRequestsTable");
    if (!tbody) return;

    if (requests.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">Không có yêu cầu nào phù hợp</td></tr>';
        return;
    }

    tbody.innerHTML = requests.map(req => {
        const date = req.createdAt?.toDate ? req.createdAt.toDate() : new Date(req.createdAt);
        const statusClass = req.status === "pending" ? "warning" : req.status === "approved" ? "success" : "danger";
        const statusText = req.status === "pending" ? "Đang chờ duyệt" : req.status === "approved" ? "Đã duyệt" : "Đã từ chối";
        
        // Disable buttons if not pending
        const disabledAttr = req.status !== "pending" ? "disabled" : "";
        const opcStyle = req.status !== "pending" ? "opacity: 0.5; cursor: not-allowed;" : "";

        return `
            <tr>
                <td><strong>${req.userEmail}</strong><br><small class="text-muted">UID: ${req.userId.substring(0,8)}...</small></td>
                <td><span style="color: var(--warning-color); font-weight: bold; text-transform: uppercase;">${req.package}</span></td>
                <td>${formatNumber(req.amount)}đ</td>
                <td>
                   <img src="${req.billImageBase64 || 'https://placehold.co/100x150'}" 
                        style="width: 60px; height: 80px; object-fit: cover; border-radius: 4px; cursor: pointer; border: 1px solid rgba(255,255,255,0.2);" 
                        onclick="openBillViewport('${req.billImageBase64}')"
                        title="Bấm để xem lớn" />
                </td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                <td>${formatDateTime(date)}</td>
                <td style="text-align: center;">
                    <button class="btn btn-sm btn-success" style="margin-right: 5px; ${opcStyle}" ${disabledAttr} onclick="approveVipRequest('${req.id}', '${req.userId}', '${req.package}')" title="Duyệt nâng cấp">
                        <i class="fas fa-check"></i> Duyệt
                    </button>
                    <button class="btn btn-sm btn-danger" style="margin-right: 5px; ${opcStyle}" ${disabledAttr} onclick="rejectVipRequest('${req.id}')" title="Từ chối yêu cầu">
                        <i class="fas fa-times"></i> Từ chối
                    </button>
                    <!-- Nút Xóa có thể click mọi lúc -->
                    <button class="btn btn-sm" style="background: rgba(255,255,255,0.1); color: var(--text-muted); border: 1px solid rgba(255,255,255,0.2);" onclick="deleteVipRequest('${req.id}')" title="Xóa yêu cầu">
                        <i class="fas fa-trash"></i> Xóa
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

/**
 * Xem ảnh Bill Lớn
 */
window.openBillViewport = function(base64Str) {
    if(!base64Str) return;
    document.getElementById("billViewportImage").src = base64Str;
    openModal("billViewportModal");
}

/**
 * Duyệt Yêu Cầu VIP
 */
window.approveVipRequest = async function(requestId, userId, packageType) {
    if (!await customConfirm("Xác nhận duyệt cho yêu cầu VIP này? Tài khoản người dùng sẽ được nâng cấp ngay lập tức.", { title: "Duyệt VIP", type: "info", confirmText: "Duyệt" })) return;
    
    let durationDays = 30; // Mặc định 30 ngày
    if (packageType !== 'lifetime') {
        const inputDays = await customPrompt("Nhập số ngày VIP cấp cho user này (VD: 30, 90, 365, hoặc -1 cho Vĩnh Viễn):", { title: "Số ngày VIP", defaultValue: "30" });
        if (inputDays === null) return; // Nhấn Hủy
        durationDays = parseInt(inputDays, 10);
        
        // Cho phép số ngày dương hoặc -1
        if (isNaN(durationDays) || (durationDays <= 0 && durationDays !== -1)) {
            showNotification("Số ngày không hợp lệ!", "error");
            return;
        }

        // Nếu admin nhập -1, coi như là gói trọn đời
        if (durationDays === -1) {
            packageType = 'lifetime';
        }
    }

    try {
        showLoading(true, "Đang xử lý nâng cấp...");
        
        let vipUntil = null;
        if (packageType !== 'lifetime') {
            vipUntil = new Date();
            vipUntil.setDate(vipUntil.getDate() + durationDays);
        }

        // 1. Cập nhật role cho User
        await db.collection("users").doc(userId).update({
            isVip: true,
            vipType: packageType, // vip hoặc lifetime
            vipSince: firebase.firestore.FieldValue.serverTimestamp(),
            vipExpiresAt: vipUntil ? firebase.firestore.Timestamp.fromDate(vipUntil) : null
        });

        // 2. Cập nhật trạng thái request thành approved
        await db.collection("upgrade_requests").doc(requestId).update({
            status: "approved",
            processedAt: firebase.firestore.FieldValue.serverTimestamp(),
            processedBy: currentUser.email
        });

        // 3. Gửi thông báo cho User (Chuông) - Kèm thông tin số ngày VIP
        if (typeof sendNotification === "function") {
            const durationText = packageType === 'lifetime' ? "Vĩnh Viễn ♾️" : `${durationDays} ngày`;
            await sendNotification(userId, "Yêu cầu VIP đã được duyệt ✅", `Tài khoản của bạn đã được nâng cấp VIP (${durationText}). Chúc bạn có những giây phút xem phim giải trí vui vẻ!`, "vip_approved");
        }

        showNotification("Đã duyệt thành công, người dùng đã được nâng VIP!", "success");
        await loadAdminVipRequests(); // Reload lại bảng
        if (typeof loadAdminUsers === "function") await loadAdminUsers(); // Tự động load lại bảng Users
    } catch (err) {
        console.error("Lỗi duyệt VIP:", err);
        showNotification("Lỗi khi duyệt VIP", "error");
    } finally {
        showLoading(false);
    }
}

/**
 * Từ chối Yêu Cầu VIP
 */
window.rejectVipRequest = async function(requestId) {
    if (!await customConfirm("Bạn có chắc chắn muốn TỪ CHỐI yêu cầu này không? Biên lai chưa hợp lệ?", { title: "Từ chối VIP", type: "danger", confirmText: "Từ chối" })) return;
    
    try {
        showLoading(true, "Đang từ chối...");
        
        await db.collection("upgrade_requests").doc(requestId).update({
            status: "rejected",
            processedAt: firebase.firestore.FieldValue.serverTimestamp(),
            processedBy: currentUser.email
        });

        showNotification("Đã từ chối yêu cầu VIP", "success");
        await loadAdminVipRequests(); // Reload bảng
    } catch (err) {
        console.error("Lỗi từ chối VIP:", err);
        showNotification("Lỗi khi từ chối", "error");
    } finally {
        showLoading(false);
    }
}

/**
 * Xóa Yêu Cầu VIP Khỏi Bảng (Xóa luôn trong Database)
 */
window.deleteVipRequest = async function(requestId) {
    if (!await customConfirm("Hành động này sẽ XÓA VĨNH VIỄN yêu cầu này khỏi hệ thống. Bạn có chắc không?", { title: "Xóa yêu cầu", type: "danger", confirmText: "Xóa" })) return;
    
    try {
        showLoading(true, "Đang xóa...");
        
        await db.collection("upgrade_requests").doc(requestId).delete();

        showNotification("Đã xóa yêu cầu thành công!", "success");
        await loadAdminVipRequests(); // Reload bảng
    } catch (err) {
        console.error("Lỗi xóa yêu cầu VIP:", err);
        showNotification("Lỗi khi xóa", "error");
    } finally {
        showLoading(false);
    }
}

/**
 * Load thống kê Admin
 */
async function loadAdminStats() {
  try {
    // Tổng số phim
    document.getElementById("statTotalMovies").textContent = allMovies.length;

    // Tổng lượt xem
    const totalViews = allMovies.reduce((sum, m) => sum + (m.views || 0), 0);
    document.getElementById("statTotalViews").textContent =
      formatNumber(totalViews);

    // Doanh thu ước tính
    let totalRevenue = 0;
    if (db) {
      const txSnapshot = await db
        .collection("transactions")
        .where("status", "==", "completed")
        .get();
      totalRevenue = txSnapshot.docs.reduce(
        (sum, doc) => sum + (doc.data().amount || 0),
        0,
      );
    }
    document.getElementById("statTotalRevenue").textContent =
      `${formatNumber(totalRevenue)} CRO`;

    // Tổng users
    let totalUsers = 0;
    if (db) {
      const usersSnapshot = await db.collection("users").get();
      totalUsers = usersSnapshot.size;
    }
    document.getElementById("statTotalUsers").textContent =
      formatNumber(totalUsers);

    // Recent movies
    renderRecentMovies();
  } catch (error) {
    console.error("Lỗi load stats:", error);
  }
}

/**
 * Render phim gần đây trong dashboard
 */
function renderRecentMovies() {
  const tbody = document.getElementById("recentMoviesTable");

  const recent = [...allMovies]
    .sort((a, b) => {
      const dateA = a.createdAt?.toDate
        ? a.createdAt.toDate()
        : new Date(a.createdAt);
      const dateB = b.createdAt?.toDate
        ? b.createdAt.toDate()
        : new Date(b.createdAt);
      return dateB - dateA;
    })
    .slice(0, 5);

  tbody.innerHTML = recent
    .map((movie) => {
      const date = movie.createdAt?.toDate
        ? movie.createdAt.toDate()
        : new Date(movie.createdAt);
      return `
            <tr>
                <td><img src="${movie.posterUrl}" alt="${movie.title}" onerror="this.src='https://placehold.co/50x75'"></td>
                <td>${movie.title}</td>
                <td>${movie.price} CRO</td>
                <td><span class="status-badge ${movie.status}">${getStatusText(movie.status)}</span></td>
                <td>${formatDate(date)}</td>
            </tr>
        `;
    })
    .join("");
}

/**
 * Load danh sách phim cho Admin
 */
/**
 * Tải form edit phim
 */
function loadEditMovieForm() {
    const editSearchInput = document.getElementById("editMovieSearchInput");
    const editSelect = document.getElementById("editMovieSelect");

    if (editSearchInput && editSelect) {
        // Set event listener for search input
        editSearchInput.addEventListener("input", function() {
            filterEditMovieDropdown(editSearchInput, editSelect);
        });

        // Tải danh sách phim vào Select
        const moviesToLoad = allMovies;
        let html = '<option value="">-- Chọn Phim --</option>';
        moviesToLoad.forEach(m => {
            html += `<option value="${m.id}">${m.title} (${m.publishYear})</option>`;
        });
        editSelect.innerHTML = html;

        console.log("Đã tải dữ liệu vào Form Sửa Phim (Select)", moviesToLoad.length, "phim");
    }
}

/* ============================================
   QUẢN LÝ BÁO LỖI (ERROR REPORTS)
   ============================================ */

let allErrorReports = []; // Mảng chứa dữ liệu error_reports realtime
let errorReportsUnsubscribe = null;

/**
 * Load dữ liệu báo lỗi từ Firestore
 */
function loadErrorReports() {
    if (!db) return;

    if (errorReportsUnsubscribe) {
        errorReportsUnsubscribe();
    }

    errorReportsUnsubscribe = db.collection("error_reports")
        .orderBy("createdAt", "desc")
        .onSnapshot((snapshot) => {
            allErrorReports = [];
            snapshot.forEach(doc => {
                allErrorReports.push({ id: doc.id, ...doc.data() });
            });
            filterErrorReports(); // Render
        }, (err) => {
            console.error("Lỗi load error reports:", err);
        });
}

/**
 * Lọc và tìm kiếm
 */
window.filterErrorReports = function() {
    const searchInput = document.getElementById("adminSearchError");
    const statusSelect = document.getElementById("errorFilterStatus");
    const typeSelect = document.getElementById("errorFilterType"); // Tùy chọn mới

    const searchText = searchInput ? searchInput.value.toLowerCase().trim() : "";
    const statusVal = statusSelect ? statusSelect.value : "";
    const typeVal = typeSelect ? typeSelect.value : "";

    let filtered = allErrorReports;

    if (statusVal) {
        filtered = filtered.filter(item => item.status === statusVal);
    }
    
    if (typeVal) {
        filtered = filtered.filter(item => item.errorType === typeVal);
    }

    if (searchText) {
        filtered = filtered.filter(item => {
            const mTitle = (item.movieTitle || "").toLowerCase();
            const epName = (item.episodeName || "").toLowerCase();
            const uName = (item.userName || "").toLowerCase();
            return mTitle.includes(searchText) || epName.includes(searchText) || uName.includes(searchText);
        });
    }

    renderErrorReports(filtered);
};

/**
 * Render bảng
 */
function renderErrorReports(list) {
    const tbody = document.getElementById("errorReportsTable");
    if (!tbody) return;

    if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center" style="padding: 20px; color: #888;">Không có báo lỗi nào.</td></tr>';
        return;
    }

    tbody.innerHTML = list.map(item => {
        const timeStr = item.createdAt && item.createdAt.toDate 
            ? item.createdAt.toDate().toLocaleString('vi-VN') 
            : "—";
            
        const isResolved = item.status === "resolved";
        const statusHtml = isResolved 
            ? '<span style="color: #4ade80; font-weight: bold;"><i class="fas fa-check-circle"></i> Đã xử lý</span>' 
            : '<span style="color: #f87171; font-weight: bold;"><i class="fas fa-exclamation-circle"></i> Chưa xử lý</span>';
            
        // Map label hiển thị Badge trên Admin với màu sắc tường minh
        const typeLabels = {
            "load_slow": { label: "Video giật lag", bg: "#ff9800", text: "#fff" },
            "broken_link": { label: "Hỏng link", bg: "#f44336", text: "#fff" },
            "subtitle_error": { label: "Lỗi phụ đề", bg: "#2196f3", text: "#fff" },
            "audio_error": { label: "Lỗi âm thanh", bg: "#9c27b0", text: "#fff" },
            "wrong_movie": { label: "Sai phim/Tập", bg: "#4caf50", text: "#fff" },
            "other": { label: "Khác", bg: "#607d8b", text: "#fff" }
        };
        const typeBadge = typeLabels[item.errorType] || typeLabels["other"];
            
        return `
            <tr style="${isResolved ? 'opacity: 0.7;' : ''}">
                <td>
                    <div style="font-weight: 500;">${item.userName || "Ẩn danh"}</div>
                    <div style="font-size: 11px; color: #888;">${(item.userId || "").substring(0,8)}...</div>
                </td>
                <td>
                    <div style="font-weight: 500; color: #4db8ff;">${item.movieTitle || "—"}</div>
                    <div style="font-size: 12px; color: #aaa;">${item.episodeName || "Phim lẻ"}</div>
                </td>
                <td>
                    <span style="font-size: 0.75rem; padding: 4px 8px; border-radius: 4px; display: inline-block; background-color: ${typeBadge.bg}; color: ${typeBadge.text}; font-weight: bold; white-space: nowrap;">${typeBadge.label}</span>
                </td>
                <td style="max-width: 250px; white-space: pre-wrap; word-break: break-word;">
                    ${item.description || "—"}
                </td>
                <td style="font-size: 0.9rem;">${timeStr}</td>
                <td>${statusHtml}</td>
                <td style="text-align: center;">
                    ${!isResolved ? `
                        <button class="btn btn-sm btn-success" onclick="resolveErrorReport('${item.id}')" title="Đánh dấu đã xử lý" style="margin-right: 4px;">
                            <i class="fas fa-check"></i>
                        </button>
                    ` : ''}
                    <button class="btn btn-sm btn-danger" onclick="deleteErrorReport('${item.id}')" title="Xóa">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join("");
}

/**
 * Đánh dấu báo lỗi là Đã Xử Lý
 */
window.resolveErrorReport = async function(id) {
    if (!await customConfirm("Đánh dấu lỗi này là đã giải quyết?", { title: "Xử lý lỗi", type: "info", confirmText: "Đồng ý" })) return;

    try {
        await db.collection("error_reports").doc(id).update({
            status: "resolved",
            resolvedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        showNotification("Đã cập nhật trạng thái!", "success");
    } catch (err) {
        console.error(err);
        showNotification("Lỗi cập nhật!", "error");
    }
};

/**
 * Xóa báo lỗi
 */
window.deleteErrorReport = async function(id) {
    if (!await customConfirm("Bạn có chắc muốn xóa vĩnh viễn báo lỗi này?", { title: "Xóa báo lỗi", type: "danger", confirmText: "Xóa" })) return;

    try {
        await db.collection("error_reports").doc(id).delete();
        showNotification("Đã xóa báo lỗi!", "success");
    } catch (err) {
        console.error(err);
        showNotification("Lỗi xóa!", "error");
    }
};
/**
 * Lọc danh sách phim (Admin)
 */
function filterAdminMovies() {
  const searchInput = document.getElementById("adminSearchMovies");
  const statusSelect = document.getElementById("adminFilterStatus");
  const typeSelect = document.getElementById("adminFilterMovieType");
  const categorySelect = document.getElementById("adminFilterMovieCategory");
  const countrySelect = document.getElementById("adminFilterCountry");
  const sortSelect = document.getElementById("adminSortMovies");
  
  if (!searchInput) return;

  const searchText = searchInput.value.toLowerCase().trim();
  const statusFilter = statusSelect ? statusSelect.value : "";
  const typeFilter = typeSelect ? typeSelect.value : "";
  const categoryFilter = categorySelect ? categorySelect.value : "";
  const countryFilter = countrySelect ? countrySelect.value : "";
  const sortOrder = sortSelect ? sortSelect.value : "newest";

  // Lọc phim từ biến toàn cục allAdminMovies (chứa đủ mọi trạng thái)
  const filteredMovies = allAdminMovies.filter(m => {
    const matchText = (m.title && m.title.toLowerCase().includes(searchText)) ||
                      (m.originTitle && m.originTitle.toLowerCase().includes(searchText));
    
    const matchStatus = statusFilter === "" || m.status === statusFilter;
    const matchType = typeFilter === "" || m.type === typeFilter;
    const matchCountry = countryFilter === "" || m.country === countryFilter;
    
    // Lọc theo thể loại (hỗ trợ cả mảng categories và chuỗi category cũ)
    let matchCategory = true;
    if (categoryFilter !== "") {
        const movieCats = m.categories || (m.category ? [m.category] : []);
        matchCategory = movieCats.includes(categoryFilter);
    }

    return matchText && matchStatus && matchType && matchCategory && matchCountry;
  });

  // Xử lý Sắp xếp
  filteredMovies.sort((a, b) => {
    const timeA = a.createdAt ? (a.createdAt.seconds || new Date(a.createdAt).getTime() / 1000 || 0) : 0;
    const timeB = b.createdAt ? (b.createdAt.seconds || new Date(b.createdAt).getTime() / 1000 || 0) : 0;
    
    if (sortOrder === "newest") return timeB - timeA;
    if (sortOrder === "oldest") return timeA - timeB;
    return 0;
  });

  renderAdminMoviesList(filteredMovies);

  // Cập nhật Thống kê
  updateAdminMovieStats(filteredMovies);
}

/**
 * Cập nhật thanh thống kê số lượng phim
 */
function updateAdminMovieStats(moviesList) {
    const totalEl = document.getElementById("statMoviesTotal");
    const singleEl = document.getElementById("statMoviesSingle");
    const seriesEl = document.getElementById("statMoviesSeries");

    if (!totalEl || !singleEl || !seriesEl) return;

    const total = moviesList.length;
    const singleCount = moviesList.filter(m => m.type === "single").length;
    const seriesCount = moviesList.filter(m => m.type === "series").length;

    totalEl.textContent = `Tổng: ${total}`;
    singleEl.textContent = `Phim lẻ: ${singleCount}`;
    seriesEl.textContent = `Phim bộ: ${seriesCount}`;
}

/**
 * Tự động nạp các thể loại thực tế có phim vào bộ lọc
 */
function populateAdminMovieFilters() {
    const categorySelect = document.getElementById("adminFilterMovieCategory");
    const countrySelect = document.getElementById("adminFilterCountry");
    if (!allAdminMovies) return;

    // 1. Xử lý Thể loại
    if (categorySelect) {
        const usedCategories = new Set();
        allAdminMovies.forEach(m => {
            if (m.categories && Array.isArray(m.categories)) {
                m.categories.forEach(c => usedCategories.add(c));
            } else if (m.category) {
                usedCategories.add(m.category);
            }
        });
        const sortedCategories = Array.from(usedCategories).sort();
        categorySelect.innerHTML = '<option value="">Tất cả thể loại</option>' + 
            sortedCategories.map(cat => `<option value="${cat}">${cat}</option>`).join("");
    }

    // 2. Xử lý Quốc gia
    if (countrySelect) {
        const countryStats = {}; // { "Việt Nam": 10, "Mỹ": 5 }
        allAdminMovies.forEach(m => {
            if (m.country) {
                countryStats[m.country] = (countryStats[m.country] || 0) + 1;
            }
        });
        
        const sortedCountries = Object.keys(countryStats).sort();
        countrySelect.innerHTML = '<option value="">Tất cả quốc gia</option>' + 
            sortedCountries.map(c => {
                const info = getCountryInfo(c);
                return `<option value="${c}">${info.icon} ${c} (${countryStats[c]})</option>`;
            }).join("");
    }
}

/**
 * Render danh sách <option> cho dropdown chọn phim trong Quản lý Tập
 * Kèm theo Badge: Chưa có tập, Đang cập nhật (x/y)
 */
function renderEpisodeMovieOptions(moviesList) {
    if (!moviesList) return '<option value="">-- Chọn phim --</option>';
    
    return '<option value="">-- Chọn phim --</option>' + 
        moviesList.map(m => {
            const currentEps = (m.episodes || []).length;
            const totalEps = parseInt(m.totalEpisodes) || 0;
            let badge = "";

            if (currentEps === 0) {
                badge = "🔴 [Chưa có tập] ";
            } else if (m.type === 'series' && currentEps < totalEps) {
                badge = `🟠 [Đang cập nhật ${currentEps}/${totalEps}] `;
            }

            return `<option value="${m.id}">${badge}${m.title}</option>`;
        }).join("");
}

/**
 * Lấy thông tin trang trí cho Quốc gia (Icon + Màu sắc)
 */
function getCountryInfo(countryName) {
    if (!countryName) return { icon: '🌐', bg: 'rgba(255,255,255,0.05)', color: '#ccc' };
    
    const name = countryName.toLowerCase().trim();
    
    const countries = {
        'việt nam': { icon: '🇻🇳', code: 'vn', bg: 'rgba(229, 9, 20, 0.15)', color: '#ff4d4d' },
        'hàn quốc': { icon: '🇰🇷', code: 'kr', bg: 'rgba(77, 171, 247, 0.15)', color: '#4dabf7' },
        'trung quốc': { icon: '🇨🇳', code: 'cn', bg: 'rgba(253, 126, 20, 0.15)', color: '#fd7e14' },
        'mỹ': { icon: '🇺🇸', code: 'us', bg: 'rgba(51, 154, 240, 0.15)', color: '#339af0' },
        'nhật bản': { icon: '🇯🇵', code: 'jp', bg: 'rgba(255, 255, 255, 0.15)', color: '#fff' },
        'thái lan': { icon: '🇹🇭', code: 'th', bg: 'rgba(81, 207, 102, 0.15)', color: '#51cf66' },
        'âu mỹ': { icon: '🇪🇺', code: 'eu', bg: 'rgba(132, 94, 247, 0.15)', color: '#845ef7' },
        'đài loan': { icon: '🇹🇼', code: 'tw', bg: 'rgba(20, 184, 166, 0.15)', color: '#14b8a6' },
        'ấn độ': { icon: '🇮🇳', code: 'in', bg: 'rgba(245, 159, 0, 0.15)', color: '#f59f00' },
        'pháp': { icon: '🇫🇷', code: 'fr', bg: 'rgba(45, 201, 255, 0.12)', color: '#2dc9ff' },
        'anh': { icon: '🇬🇧', code: 'gb', bg: 'rgba(77, 171, 247, 0.12)', color: '#4dabf7' }
    };

    // 1. Tìm kiếm trong danh sách được cấu hình sẵn màu sắc đẹp
    for (const key in countries) {
        if (name.includes(key)) return countries[key];
    }

    // 2. Nếu không có trong danh sách cứng, tra cứu từ dữ liệu quốc gia thực tế (allCountries)
    if (typeof allCountries !== 'undefined') {
        const found = allCountries.find(c => c.name.toLowerCase() === name || (c.id && c.id.toLowerCase() === name));
        if (found && found.code) {
            return { 
                icon: '🏳️', 
                code: found.code.toLowerCase(), 
                bg: 'rgba(255,255,255,0.08)', 
                color: '#eee' 
            };
        }
    }

    // Mặc định cho quốc gia lạ
    return { icon: '🏳️', bg: 'rgba(255,255,255,0.08)', color: '#eee' };
}

/**
 * Render bảng phim
 */
function renderAdminMoviesList(movies) {
  const tbody = document.getElementById("adminMoviesTable");
  if (!tbody) return;

  if (movies.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" class="text-center">Không tìm thấy phim nào</td></tr>';
    return;
  }

  tbody.innerHTML = movies
      .map(
        (movie) => {
            const currentEps = (movie.episodes || []).length;
            const totalEps = movie.totalEpisodes || "??";
            const statusColor = currentEps > 0 && currentEps >= totalEps ? '#51cf66' : '#ff922b';
            
            const countryInfo = getCountryInfo(movie.country);
            
            return `
                <tr>
                    <td><img src="${movie.posterUrl}" alt="${movie.title}" width="40" height="60" style="width: 40px; height: 60px; object-fit: cover;" onerror="this.onerror=null; this.src='https://placehold.co/40x60/2a2a3a/FFFFFF?text=NO'"></td>
                    <td class="movie-title-cell">
                        <div style="font-weight: 600;">${movie.title}</div>
                        <div style="font-size: 0.8rem; color: var(--text-muted);">${movie.originTitle || ''}</div>
                    </td>
                    <td>
                        <span class="country-badge-v2" style="background: ${countryInfo.bg}; color: ${countryInfo.color}; border-color: ${countryInfo.color}33;">
                            ${countryInfo.code ? `<img src="https://flagcdn.com/w40/${countryInfo.code}.png" class="flag-icon-img" alt="${movie.country}">` : `<span class="flag-icon">${countryInfo.icon}</span>`}
                            ${movie.country || 'N/A'}
                        </span>
                    </td>
                    <td><span style="font-size: 11px; padding: 3px 8px; border-radius: 4px; background: ${movie.type === 'single' ? '#4d638c' : '#da77f2'}; color: #fff; white-space: nowrap; display: inline-block;">${movie.type === 'single' ? 'Phim Lẻ' : 'Phim Bộ'}</span></td>
                    <td>${movie.categories || movie.category || "N/A"}</td>
                    <td>
                        <span style="font-weight: 600; color: ${statusColor};">
                            ${currentEps}/${totalEps} tập
                        </span>
                    </td>
                    <td>${movie.price}</td>
                    <td>${formatNumber(movie.views || 0)}</td>
                    <td><span class="status-badge ${movie.status}">${getStatusText(movie.status)}</span></td>
                    <td>
                        <button class="btn btn-sm btn-secondary" onclick="editMovie('${movie.id}')" title="Sửa">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="deleteMovie('${movie.id}')" title="Xóa">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        }
      )
      .join("");
}

/**
 * Biến toàn cục lưu danh sách phim cho Admin (Bao gồm cả ẩn/chờ duyệt)
 */
let allAdminMovies = [];

/**
 * Load danh sách phim cho Admin
 */
async function loadAdminMovies() {
  const tbody = document.getElementById("adminMoviesTable");

  try {
    let movies = [];

    // 1. Lấy TẤT CẢ phim từ Firestore (Mới nhất lên đầu)
    if (db) {
      const snapshot = await db
        .collection("movies")
        .orderBy("createdAt", "desc")
        .get();
      movies = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    } else {
      movies = allMovies; // Dữ liệu mẫu nếu chưa có DB
    }
    
    // Lưu vào biến toàn cục để dùng cho lọc
    allAdminMovies = movies;

    // 2. Render Bảng Quản lý Phim Chính
    // Nạp các thể loại thực tế vào bộ lọc
    if (typeof populateAdminMovieFilters === 'function') populateAdminMovieFilters();
    
    // Render lần đầu thông qua hàm lọc (để áp dụng sắp xếp Mới nhất)
    filterAdminMovies();
    
    // ... (Code cập nhật dropdown/dashboard giữ nguyên bên dưới)



    // =======================================================
    // 👇 ĐOẠN CODE MỚI THÊM ĐỂ FIX LỖI CỦA BẠN 👇
    // =======================================================

    // 3. Cập nhật ngay Menu chọn phim (Tab Quản lý Tập)
    const select = document.getElementById("selectMovieForEpisodes");
    if (select) {
        select.innerHTML = renderEpisodeMovieOptions(allAdminMovies);
    }

    // 4. Cập nhật ngay Bảng "Phim mới thêm gần đây" (Dashboard)
    const recentTbody = document.getElementById("recentMoviesTable");
    if (recentTbody) {
      const recent = movies.slice(0, 5); // Lấy 5 phim mới nhất
      recentTbody.innerHTML = recent
        .map((movie) => {
          const date = movie.createdAt?.toDate
            ? movie.createdAt.toDate()
            : new Date(movie.createdAt);
          return `
                <tr>
                    <td><img src="${movie.posterUrl}" alt="${movie.title}" onerror="this.src='https://placehold.co/50x75'"></td>
                    <td>${movie.title}</td>
                    <td>${movie.price} CRO</td>
                    <td><span class="status-badge ${movie.status}">${getStatusText(movie.status)}</span></td>
                    <td>${formatDate(date)}</td>
                </tr>
             `;
        })
        .join("");
    }

    // 5. Cập nhật Thống kê Tổng số phim (Dashboard)
    const statTotal = document.getElementById("statTotalMovies");
    if (statTotal) statTotal.textContent = movies.length;

    // =======================================================
  } catch (error) {
    console.error("Lỗi load admin movies:", error);
  }
}

/**
 * Helper: Parse chuỗi thời lượng (VD: "1 giờ 30 phút" hoặc "120 phút") thành {h, m}
 */
function parseDuration(str) {
    let hours = 0;
    let minutes = 0;
    
    if (!str) return { h: 0, m: 0 };
    
    // Regex tìm giờ và phút
    const hourMatch = str.match(/(\d+)\s*giờ/i);
    const minuteMatch = str.match(/(\d+)\s*phút/i);
    
    if (hourMatch) hours = parseInt(hourMatch[1]);
    if (minuteMatch) minutes = parseInt(minuteMatch[1]);
    
    // Nếu không có cả 2 mà chỉ có số (trường hợp dữ liệu cũ thô)
    if (!hourMatch && !minuteMatch) {
        const onlyNum = str.match(/(\d+)/);
        if (onlyNum) minutes = parseInt(onlyNum[1]);
    }
    
    return { h: hours, m: minutes };
}

/**
 * Helper: Format {h, m} thành chuỗi "X giờ Y phút"
 */
function formatDuration(h, m) {
    let result = [];
    if (h > 0) result.push(`${h} giờ`);
    if (m > 0) result.push(`${m} phút`);
    return result.join(" ") || "";
}
/**
 * Mở modal thêm/sửa phim
 */
// Thêm hàm này vào trước openMovieModal
/**
 * Cập nhật UI nhập Phần/Mùa dựa trên Type
 */
function updateMoviePartUI() {
    const type = document.getElementById("moviePartType").value;
    const groupNumber = document.getElementById("groupPartNumber"); // Chứa Input Number + Buttons
    const inputCustom = document.getElementById("moviePartCustom");

    if (type === "custom") {
        // Hiện ô nhập text, ẩn ô nhập số
        groupNumber.style.display = "none";
        inputCustom.style.display = "block";
        inputCustom.focus();
    } else if (type === "") {
        // Ẩn cả 2
        groupNumber.style.display = "none";
        inputCustom.style.display = "none";
    } else {
        // Hiện ô nhập số, ẩn ô text
        groupNumber.style.display = "flex";
        inputCustom.style.display = "none";
    }
}

/**
 * Tăng giảm số phần
 */
function adjustPartNumber(delta) {
    const input = document.getElementById("moviePartNumber");
    let current = parseInt(input.value) || 1;
    current += delta;
    if (current < 1) current = 1;
    input.value = current;
}

/**
 * Chuyển đổi chế độ nhập giá
 */
function toggleMoviePrice(type) {
  const priceInput = document.getElementById("moviePrice");
  if (!priceInput) return;

  if (type === "free") {
    priceInput.value = 0;
    priceInput.disabled = true;
    priceInput.style.backgroundColor = "#e9ecef"; // Màu xám nhạt
    priceInput.style.color = "#6c757d"; // Màu chữ xám
  } else {
    // Nếu chuyển sang Paid mà giá đang là 0 thì set mặc định 1
    if (parseFloat(priceInput.value) === 0) {
        priceInput.value = 1;
    }
    priceInput.disabled = false;
    priceInput.style.backgroundColor = "";
    priceInput.style.color = "";
  }
}

/**
 * [NEW] FETCH THÔNG TIN PHIM TỪ OPHIM BẰNG LINK API
 */
async function fetchMovieFromAPI() {
    const urlInput = document.getElementById("apiCloneUrl");
    const url = urlInput ? urlInput.value.trim() : "";
    if (!url) {
        showNotification("Vui lòng dán link API OPhim vào ô trống!", "error");
        return;
    }

    try {
        showLoading(true, "Đang tải dữ liệu phim từ OPhim...");
        
        let response = await fetch(url);
        // Kiểm tra Status
        if (!response.ok) {
            throw new Error(`Mã lỗi mạng: ${response.status}`);
        }

        const resData = await response.json();
        
        // Hỗ trợ cả 2 chuẩn API: KKPhim (resData.data.item) và OPhim/PhimAPI (resData.movie)
        let movieData = null;
        let episodesData = null;
        
        if (resData.movie) {
            movieData = resData.movie;
            episodesData = resData.episodes; // OPhim/PhimAPI để episodes ở ngoài
        } else if (resData.data && resData.data.item) {
            movieData = resData.data.item;
            episodesData = movieData.episodes || (resData.data && resData.data.episodes);
        }

        if (!movieData) {
             throw new Error("Dữ liệu API không đúng chuẩn hoặc phim không tồn tại!");
        }

        // --- 1. FILL TÊN PHIM ---
        document.getElementById("movieTitle").value = movieData.name || "";
        // Tên tiếng Anh (origin_name từ API)
        document.getElementById("movieOriginTitle").value = movieData.origin_name || "";
        
        // --- 2. FILL HÌNH ẢNH ---
        let thumbUrl = movieData.thumb_url || "";
        let posterUrl = movieData.poster_url || "";
        
        // Cdn Domain cho trường hợp trả về link tương đối
        let cdnDomain = resData.APP_DOMAIN_CDN_IMAGE || (resData.data && resData.data.APP_DOMAIN_CDN_IMAGE) || resData.pathImage || "https://img.ophim.live/uploads/movies";
        cdnDomain = cdnDomain.replace(/\/$/, "");

        if (thumbUrl && !thumbUrl.startsWith("http")) {
             thumbUrl = `${cdnDomain}/${thumbUrl.replace(/^\//, "")}`;
        }
        if (posterUrl && !posterUrl.startsWith("http")) {
             posterUrl = `${cdnDomain}/${posterUrl.replace(/^\//, "")}`;
        }

        document.getElementById("moviePoster").value = thumbUrl;
        document.getElementById("movieBackground").value = posterUrl;
        
        // Gán preview luôn cho sinh động
        const pPreview = document.getElementById('posterPreview');
        if (pPreview) { pPreview.querySelector('img').src = thumbUrl; pPreview.style.display = "block"; }
        
        const bPreview = document.getElementById('bgPreview');
        if (bPreview) { bPreview.querySelector('img').src = posterUrl; bPreview.style.display = "block"; }

        // --- 3. FILL MÔ TẢ & CHẤT LƯỢNG ---
        let contentDesc = movieData.content || "";
        // Content ophim trả về thường bọc thẻ <p>. Xóa mã html đi cho đẹp:
        contentDesc = contentDesc.replace(/<[^>]*>?/gm, ''); 
        document.getElementById("movieDescription").value = contentDesc;
        
        // Chất lượng
        const qualityStr = (movieData.quality || "").toUpperCase();
        if (["HD", "FHD", "2K", "4K", "SD"].includes(qualityStr)) {
             document.getElementById("movieQuality").value = qualityStr;
        } else if (qualityStr.includes("1080")) {
             document.getElementById("movieQuality").value = "FHD";
        }

        // Năm phát hành, thời lượng
        if (movieData.year) document.getElementById("movieYear").value = movieData.year;
        
        // Bóc số phút
        const timeStr = movieData.time || ""; 
        const matchTime = timeStr.match(/(\d+)\s*(phút|Phút|min)/);
        if (matchTime) {
            document.getElementById("movieDurationMinute").value = matchTime[1];
        }

        // --- 4. MAP THỂ LOẠI (CATEGORIES) ---
        // Tick chọn tự động các thể loại giống OPhim
        if (movieData.category && Array.isArray(movieData.category)) {
            const opCategories = movieData.category.map(c => c.name.toLowerCase());
            const checkboxes = document.querySelectorAll('input[name="movieCategoryCheckbox"]');
            
            checkboxes.forEach(cb => {
                cb.checked = false; // Reset
                const catName = cb.value.toLowerCase();
                // Check nếu tên thể loại OPhim chứa tên thể loại Web (VD: Tình Cảm Lãng Mạn -> "Tình Cảm")
                const isMatch = opCategories.some(opCat => opCat.includes(catName) || catName.includes(opCat));
                if (isMatch) cb.checked = true;
            });
        }

        // --- 5. MAP QUỐC GIA ---
        if (movieData.country && Array.isArray(movieData.country) && movieData.country.length > 0) {
            const opCountry = movieData.country[0].name.toLowerCase();
            const countrySelect = document.getElementById("movieCountry");
            for (let i = 0; i < countrySelect.options.length; i++) {
                const optionText = countrySelect.options[i].text.toLowerCase();
                if (opCountry.includes(optionText) || optionText.includes(opCountry)) {
                    countrySelect.selectedIndex = i;
                    break;
                }
            }
        }

        // --- 6. KIỂU PHIM BỘ HAY PHIM LẺ ---
        if (movieData.type === "series") {
            document.getElementById("movieType").value = "series";
        } else {
            document.getElementById("movieType").value = "single";
        }
        
        // --- 8. PHÂN TÍCH DIỄN VIÊN TỪ API ---
        if (movieData.actor && Array.isArray(movieData.actor)) {
            const actorNames = movieData.actor.filter(n => n.toLowerCase() !== "đang cập nhật");
            if (typeof initSmartActorsFromCastString === "function") {
                initSmartActorsFromCastString(actorNames.join(", "));
            } else {
                document.getElementById("movieCast").value = actorNames.join(", ");
            }
        }
        
        // --- 7. TẠO TỰ ĐỘNG DANH SÁCH TẬP PHIM SERVER DATA (Trick Save API) ---
        let svData = null;
        if (episodesData && episodesData.length > 0) {
            svData = episodesData[0].server_data;
        } else if (movieData.episodes && movieData.episodes.length > 0) {
            svData = movieData.episodes[0].server_data;
        }

        if (svData && svData.length > 0) {
            // Lưu tạm mảng tập phim OPhim vào Input Ẩn để Admin bấm lưu nó tự save theo!
            // Do Admin form chưa hỗ trợ Save Episdoes cùng lúc với Create Movie. 
            // Tốt nhất là hiện Alert nhắc Admin lấy List Link M3U8 để thêm sau
            
            showNotification(`Đã tự động điền Form! Phim này có ${svData.length} tập. Vui lòng bấm LƯU để tạo phim trước, sau đó chép Link thủ công sang nút THÊM TẬP!`, "success", 8000);
            
            // Lưu tạm list server_data raw vào bộ nhớ window cho phép copy paste nếu cần
            window.tempOphimEpisodes = svData; 
            console.log("📺[OPhim/PhimAPI] Dữ liệu tập:", svData);
        } else {
             showNotification("Tải dữ liệu thông tin phim thành công!", "success");
        }
        
        // --- 9. COPY LINK TỪ FETCH XUỐNG DỰ PHÒNG ---
        document.getElementById("movieApiUrlBackup").value = url;
            
        
    } catch (err) {
        console.error("Lỗi Fetch Data OPhim:", err);
        showNotification("Lỗi gọi API: " + err.message, "error");
    } finally {
        showLoading(false);
    }
}

/**
 * Mở modal thêm/sửa phim
 */
function openMovieModal(movieId = null) {
  const modal = document.getElementById("movieModal");
  const title = document.getElementById("movieModalTitle");
  const form = document.getElementById("movieForm");

  // Populate category and country selects
  // Populate category checkboxes
  const categoryContainer = document.getElementById("movieCategoryContainer");
  categoryContainer.innerHTML = allCategories
      .map((c) => `
        <div class="checkbox-item" style="margin-bottom: 5px;">
            <label style="cursor: pointer; display: flex; align-items: center;">
                <input type="checkbox" name="movieCategoryCheckbox" value="${c.name}" style="margin-right: 8px;">
                ${c.name}
            </label>
        </div>
      `)
      .join("");

  const countrySelect = document.getElementById("movieCountry");
  countrySelect.innerHTML =
    '<option value="">Chọn quốc gia</option>' +
    allCountries
      .map((c) => `<option value="${c.name}">${c.name}</option>`)
      .join("");

  if (movieId) {
    // Edit mode
    title.textContent = "Sửa Phim";
    const movie = allMovies.find((m) => m.id === movieId);

    if (movie) {
      document.getElementById("movieId").value = movieId;
      document.getElementById("movieTitle").value = movie.title;
      // document.getElementById("moviePart").value = movie.part || ""; // Code cũ
      
      // Xử lý Phần/Mùa (Parse dữ liệu cũ)
      const partStr = movie.part || "";
      const partTypeSelect = document.getElementById("moviePartType");
      const partNumberInput = document.getElementById("moviePartNumber");
      const partCustomInput = document.getElementById("moviePartCustom");

      // Regex check: "Phần 1", "Season 2", "Chapter 10"
      const match = partStr.match(/^(Phần|Season|Chapter|Quyển|Tập)\s+(\d+)$/);

      if (match) {
          // Khớp mẫu -> Chọn Type và điền Number
          partTypeSelect.value = match[1];
          partNumberInput.value = match[2];
          partCustomInput.value = "";
      } else if (partStr.trim() === "") {
          // Trống
          partTypeSelect.value = "";
          partNumberInput.value = "1";
          partCustomInput.value = "";
      } else {
          // Không khớp (VD: "Tập Đặc Biệt") -> Chọn Custom
          partTypeSelect.value = "custom";
          partNumberInput.value = "1";
          partCustomInput.value = partStr;
      }
      updateMoviePartUI(); // Cập nhật UI ẩn hiện

      document.getElementById("moviePoster").value = movie.posterUrl;
      // Cập nhật preview cho poster
      if (movie.posterUrl) {
          const posterPreview = document.getElementById('posterPreview');
          if (posterPreview) {
              posterPreview.querySelector('img').src = movie.posterUrl;
              posterPreview.style.display = "block";
          }
      }

      // New fields
      document.getElementById("movieBackground").value = movie.backgroundUrl || "";
      // Cập nhật preview cho background
      if (movie.backgroundUrl) {
          const bgPreview = document.getElementById('bgPreview');
          if (bgPreview) {
              bgPreview.querySelector('img').src = movie.backgroundUrl;
              bgPreview.style.display = "block";
          }
      }
      document.getElementById("movieCast").value = movie.cast || "";
      if (typeof initSmartActorsFromCastString === "function") {
          initSmartActorsFromCastString(movie.cast || "", movie.castData || []);
      }
      document.getElementById("movieOriginTitle").value = movie.originTitle || "";
      document.getElementById("movieApiUrlBackup").value = movie.apiUrlBackup || "";
      
      // Xử lý Versions (Checkboxes + Custom)
      const versionsStr = movie.versions || "";
      const currentVersions = versionsStr.split(",").map(v => v.trim()).filter(v => v);
      const defaultVersions = ["Vietsub", "Thuyết minh", "Lồng tiếng"];
      const vCheckboxes = document.querySelectorAll('input[name="movieVersionCheckbox"]');
      let customVersions = [];

      vCheckboxes.forEach(cb => {
          if (currentVersions.includes(cb.value)) {
              cb.checked = true;
          } else {
              cb.checked = false;
          }
      });

      // Tìm các version không thuộc mặc định
      currentVersions.forEach(v => {
          if (!defaultVersions.includes(v)) {
              customVersions.push(v);
          }
      });
      document.getElementById("movieVersionsCustom").value = customVersions.join(", ");

      // Xử lý Thời lượng (Smart Input)
      const dur = parseDuration(movie.duration || "");
      document.getElementById("movieDurationHour").value = dur.h || "";
      document.getElementById("movieDurationMinute").value = dur.m || "";

      document.getElementById("movieAgeLimit").value = movie.ageLimit || "P";
      document.getElementById("movieQuality").value = movie.quality || "HD";

      // Xử lý Mult-Genre Checkboxes
      const savedCategories = movie.categories || (movie.category ? [movie.category] : []);
      const checkboxes = document.querySelectorAll('input[name="movieCategoryCheckbox"]');
      checkboxes.forEach(cb => {
          if (savedCategories.includes(cb.value)) {
              cb.checked = true;
          }
      });

      // document.getElementById("movieCategory").value = movie.category || ""; // Code cũ (đã bỏ)
      document.getElementById("movieCountry").value = movie.country || "";
      document.getElementById("movieYear").value = movie.year || "";
      document.getElementById("moviePrice").value = movie.price || 0;
      document.getElementById("movieDescription").value =
        movie.description || "";
      document.getElementById("movieType").value = movie.type || "series";
      document.getElementById("movieTags").value = (movie.tags || []).join(
        ", ",
      );
      document.getElementById("movieStatus").value = movie.status || "public";
      
      // Xử lý Radio Button Free/Paid
      const priceVal = parseFloat(movie.price || 0);
      if (priceVal === 0) {
          document.querySelector('input[name="movieFeeType"][value="free"]').checked = true;
          toggleMoviePrice('free');
      } else {
          document.querySelector('input[name="movieFeeType"][value="paid"]').checked = true;
          toggleMoviePrice('paid');
      }
    }
  } else {
    // Add mode
    title.textContent = "Thêm Phim Mới";
    form.reset();
    
    // Reset previews
    const posterPrev = document.getElementById('posterPreview');
    const bgPrev = document.getElementById('bgPreview');
    if (posterPrev) {
        posterPrev.style.display = "none";
        posterPrev.querySelector('img').src = "";
    }
    if (bgPrev) {
        bgPrev.style.display = "none";
        bgPrev.querySelector('img').src = "";
    }
    
    // Reset file inputs
    const posterInp = document.getElementById('posterInput');
    const bgInp = document.getElementById('bgInput');
    if (posterInp) posterInp.value = "";
    if (bgInp) bgInp.value = "";

    document.getElementById("movieId").value = "";
    document.getElementById("movieYear").value = new Date().getFullYear();
    document.getElementById("movieType").value = "series";
    
    // Mặc định Phần/Mùa: Chọn Trống
    document.getElementById("moviePartType").value = "";
    document.getElementById("moviePartNumber").value = "1";
    document.getElementById("moviePartCustom").value = "";
    updateMoviePartUI();

    // Reset new fields default
    document.getElementById("movieBackground").value = "";
    document.getElementById("movieCast").value = "";
    document.getElementById("movieApiUrlBackup").value = "";
    if (typeof initSmartActorsFromCastString === "function") {
        initSmartActorsFromCastString("");
    }
    
    // Reset Versions mặc định Vietsub
    const vCheckboxes = document.querySelectorAll('input[name="movieVersionCheckbox"]');
    vCheckboxes.forEach(cb => {
        cb.checked = (cb.value === "Vietsub");
    });
    document.getElementById("movieVersionsCustom").value = "";

    // Reset Thời lượng
    document.getElementById("movieDurationHour").value = "";
    document.getElementById("movieDurationMinute").value = "";

    document.getElementById("movieAgeLimit").value = "P";
    document.getElementById("movieQuality").value = "HD";

    // Mặc định là Miễn phí
    document.querySelector('input[name="movieFeeType"][value="free"]').checked = true;
    toggleMoviePrice("free");
  }

  window.pendingUploads = {};
  openModal("movieModal");
}

/**
 * Xử lý submit form phim
 */
async function handleMovieSubmit(event) {
  event.preventDefault();

  if (!db) {
    showNotification("Firebase chưa được cấu hình!", "error");
    return;
  }

  // Chờ tải ảnh lên Cloudinary nếu có (Deduplicate)
  if (typeof window.uploadPendingImages === "function") {
      const uploadSuccess = await window.uploadPendingImages();
      if (!uploadSuccess) return; 
  }

  const movieId = document.getElementById("movieId").value;
  
  // Thu thập Categories
  const selectedCategories = Array.from(document.querySelectorAll('input[name="movieCategoryCheckbox"]:checked'))
                                  .map(cb => cb.value);
  
  if (selectedCategories.length === 0) {
      showNotification("Vui lòng chọn ít nhất 1 thể loại!", "error");
      return;
  }

  const movieData = {
    title: document.getElementById("movieTitle").value,
    originTitle: document.getElementById("movieOriginTitle").value || "",
    posterUrl: document.getElementById("moviePoster").value,
    // Lưu cả 2 trường để tương thích ngược
    categories: selectedCategories, 
    category: selectedCategories[0], // Lấy cái đầu tiên làm chính
    country: document.getElementById("movieCountry").value,
    year: parseInt(document.getElementById("movieYear").value),
    // Logic giá vé mới
    price: document.querySelector('input[name="movieFeeType"]:checked').value === 'free' 
           ? 0 
           : parseFloat(document.getElementById("moviePrice").value || 0),
    description: document.getElementById("movieDescription").value,
    type: document.getElementById("movieType").value,
    
    // New fields
    backgroundUrl: document.getElementById("movieBackground").value,
    cast: document.getElementById("movieCast").value,
    apiUrlBackup: document.getElementById("movieApiUrlBackup").value.trim(),
    
    // Xử lý thu thập Versions
    versions: (() => {
        let vels = Array.from(document.querySelectorAll('input[name="movieVersionCheckbox"]:checked')).map(cb => cb.value);
        const custom = document.getElementById("movieVersionsCustom").value.trim();
        if (custom) vels.push(...custom.split(",").map(s => s.trim()));
        return Array.from(new Set(vels)).join(", ");
    })(),

    // Xử lý thu thập Thời lượng
    duration: (() => {
        const h = parseInt(document.getElementById("movieDurationHour").value) || 0;
        const m = parseInt(document.getElementById("movieDurationMinute").value) || 0;
        return formatDuration(h, m);
    })(),

    ageLimit: document.getElementById("movieAgeLimit").value,
    quality: document.getElementById("movieQuality").value,

    // Logic gộp Phần/Mùa
    part: (() => {
        const type = document.getElementById("moviePartType").value;
        if (!type) return ""; // Trống
        if (type === "custom") return document.getElementById("moviePartCustom").value.trim();
        return `${type} ${document.getElementById("moviePartNumber").value}`;
    })(),
    tags: document
      .getElementById("movieTags")
      .value.split(",")
      .map((t) => t.trim())
      .filter((t) => t),
    status: document.getElementById("movieStatus").value,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  };

  try {
    showLoading(true, "Đang lưu...");

    // Tự động tạo diễn viên mới vào kho nếu chưa có và lấy danh sách IDs để lưu vào phim
    const castData = await autoCreateNewActors(movieData.cast);
    movieData.castData = castData; // Lưu mảng [{id, name}, ...] bền vững

    if (movieId) {
      // Update
      await db.collection("movies").doc(movieId).update(movieData);
      showNotification("Đã cập nhật phim!", "success");
    } else {
      // Create
      movieData.views = 0;
      movieData.rating = 0;
      movieData.episodes = [];
      movieData.createdAt = firebase.firestore.FieldValue.serverTimestamp();

      await db.collection("movies").add(movieData);
      showNotification("Đã thêm phim mới!", "success");

      // Gửi thông báo phim mới tới tất cả users (chạy nền, không block UI)
      const movieTitle = movieData.title || "Phim không tên";
      const movieCategory = movieData.categories ? movieData.categories.join(", ") : "";
      sendNotificationToAllUsers(
        "🎬 Phim mới: " + movieTitle,
        `Trạm Phim vừa cập nhật "${movieTitle}"${movieCategory ? " - " + movieCategory : ""}. Xem ngay!`,
        "new_movie"
      );
    }

    closeModal("movieModal");

    // (Đã dời autoCreateNewActors lên trên để lưu vào phim)


    // Reload data
    await loadMovies();
    await loadAdminMovies();
  } catch (error) {
    console.error("Lỗi lưu phim:", error);
    showNotification("Không thể lưu phim!", "error");
  } finally {
    showLoading(false);
  }
}

/**
 * Sửa phim
 */
function editMovie(movieId) {
  openMovieModal(movieId);
}

/**
 * Xóa phim
 */
async function deleteMovie(movieId) {
  if (!await customConfirm("Bạn có chắc muốn xóa phim này? Hành động này không thể hoàn tác!", { title: "Xóa phim", type: "danger", confirmText: "Xóa" }))
    return;

  if (!db) return;

  try {
    showLoading(true, "Đang xóa...");

    await db.collection("movies").doc(movieId).delete();

    showNotification("Đã xóa phim!", "success");

    // Reload data
    await loadMovies();
    await loadAdminMovies();
  } catch (error) {
    console.error("Lỗi xóa phim:", error);
    showNotification("Không thể xóa phim!", "error");
  } finally {
    showLoading(false);
  }
}
/**
 * Lọc phim trong dropdown chọn phim (Quản lý Tập)
 */
function filterEpisodeMovies() {
  const searchInput = document.getElementById("episodeMovieSearch");
  const select = document.getElementById("selectMovieForEpisodes");
  const sortSelect = document.getElementById("episodeMovieSort");
  const alphabetSelect = document.getElementById("episodeMovieAlphabet");
  
  if (!searchInput || !select) return;

  const searchText = searchInput.value.toLowerCase().trim();
  const sortOrder = sortSelect ? sortSelect.value : "newest";
  const alphabetFilter = alphabetSelect ? alphabetSelect.value : "";
  
  // Lọc phim từ allAdminMovies (đầy đủ nhất)
  let filteredMovies = (allAdminMovies || []).filter(m => {
    // 1. Lọc theo text
    const matchText = m.title.toLowerCase().includes(searchText);
    
    // 2. Lọc theo chữ cái
    let matchAlphabet = true;
    if (alphabetFilter) {
        const firstChar = m.title.trim().charAt(0).toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (alphabetFilter === "A-D") matchAlphabet = "ABCD".includes(firstChar);
        else if (alphabetFilter === "E-H") matchAlphabet = "EFGH".includes(firstChar);
        else if (alphabetFilter === "I-L") matchAlphabet = "IJKL".includes(firstChar);
        else if (alphabetFilter === "M-P") matchAlphabet = "MNOP".includes(firstChar);
        else if (alphabetFilter === "Q-T") matchAlphabet = "QRST".includes(firstChar);
        else if (alphabetFilter === "U-Z") matchAlphabet = "UVWXYZ".includes(firstChar);
        else if (alphabetFilter === "others") matchAlphabet = !/^[A-Z]$/.test(firstChar);
    }

    return matchText && matchAlphabet;
  });

  // 3. Sắp xếp
  filteredMovies.sort((a, b) => {
    const timeA = a.createdAt ? (a.createdAt.seconds || new Date(a.createdAt).getTime() / 1000 || 0) : 0;
    const timeB = b.createdAt ? (b.createdAt.seconds || new Date(b.createdAt).getTime() / 1000 || 0) : 0;
    
    if (sortOrder === "newest") return timeB - timeA;
    if (sortOrder === "oldest") return timeA - timeB;
    return 0;
  });

  // Render lại dropdown
  if (filteredMovies.length === 0) {
    select.innerHTML = '<option value="">-- Không tìm thấy phim --</option>';
    select.size = 1;
  } else {
    // Luôn sử dụng hàm helper để có Badge
    select.innerHTML = renderEpisodeMovieOptions(filteredMovies);
    
    if (searchText || alphabetFilter) {
      select.size = Math.min(filteredMovies.length + 1, 10);
      
      // Tự động chọn kết quả đầu tiên để load dữ liệu ngay khi tìm kiếm
      if (filteredMovies.length > 0) {
          select.value = filteredMovies[0].id;
          loadEpisodesForMovie();
      }
    } else {
      select.size = 1;
    }
  }
}

/**
 * Load tập phim cho phim đã chọn
 */
async function loadEpisodesForMovie() {
  const movieId = document.getElementById("selectMovieForEpisodes").value;
  const management = document.getElementById("episodesManagement");
  const tbody = document.getElementById("adminEpisodesTable");

  if (!movieId) {
    management.classList.add("hidden");
    return;
  }

  selectedMovieForEpisodes = movieId;
  management.classList.remove("hidden");

  // Fetch fresh data from Firebase to ensure episode count is correct
  try {
      const doc = await db.collection("movies").doc(movieId).get();
      if (doc.exists) {
          const freshMovie = { id: doc.id, ...doc.data() };
          
          // Update global allMovies
          const index = allMovies.findIndex(m => m.id === movieId);
          if (index !== -1) {
              allMovies[index] = freshMovie;
          } else {
              allMovies.push(freshMovie);
          }
          
          const episodes = freshMovie.episodes || [];
          
          // Load tổng số tập
          const totalEpisodesInput = document.getElementById("totalEpisodesInput");
          if (totalEpisodesInput) {
              totalEpisodesInput.value = freshMovie.totalEpisodes || "";
          }
          updateEpisodeStatusBadge(episodes.length, freshMovie.totalEpisodes);

          if (episodes.length === 0) {
            tbody.innerHTML =
              '<tr><td colspan="6" class="text-center">Chưa có tập nào</td></tr>';
            return;
          }

          tbody.innerHTML = episodes
            .map(
              (ep, index) => `
                <tr>
                    <td>${ep.episodeNumber}</td>
                    <td>${ep.youtubeId || (ep.sources ? ep.sources.length + " sources" : "N/A")}</td>
                    <td>${ep.duration || "N/A"}</td>
                    <td>${ep.quality || "HD"}</td>
                    <td>
                        <button class="btn btn-sm btn-secondary" onclick="editEpisode(${index})" title="Sửa">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="deleteEpisode(${index})" title="Xóa">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `,
            )
            .join("");
      }
  } catch (error) {
      console.error("Error loading episodes:", error);
      showNotification("Lỗi tải danh sách tập phim", "error");
  }
}

/**
 * Lưu tổng số tập vào Firestore
 */
async function saveTotalEpisodes() {
  const movieId = document.getElementById("selectMovieForEpisodes").value;
  if (!movieId || !db) return;
  
  const input = document.getElementById("totalEpisodesInput");
  const totalEpisodes = parseInt(input.value) || 0;
  
  try {
    await db.collection("movies").doc(movieId).update({
      totalEpisodes: totalEpisodes,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    // Cập nhật global allMovies
    const movie = allMovies.find(m => m.id === movieId);
    if (movie) {
      movie.totalEpisodes = totalEpisodes;
      const currentEps = (movie.episodes || []).length;
      updateEpisodeStatusBadge(currentEps, totalEpisodes);
    }
    
    showNotification(`Đã lưu tổng số tập: ${totalEpisodes}`, "success");
  } catch (err) {
    console.error("Lỗi lưu tổng số tập:", err);
    showNotification("Lỗi khi lưu tổng số tập!", "error");
  }
}

/**
 * Cập nhật badge trạng thái tập hiện tại trong admin
 */
function updateEpisodeStatusBadge(currentCount, totalEpisodes) {
  const badge = document.getElementById("episodeStatusBadge");
  if (!badge) return;
  
  if (!totalEpisodes || totalEpisodes <= 0) {
    badge.textContent = `Đã có ${currentCount} tập (chưa set tổng)`;
    badge.style.color = "#aaa";
    badge.style.background = "rgba(255,255,255,0.05)";
  } else if (currentCount >= totalEpisodes) {
    badge.textContent = `✅ Hoàn Tất (${currentCount}/${totalEpisodes})`;
    badge.style.color = "#51cf66";
    badge.style.background = "rgba(81, 207, 102, 0.12)";
  } else {
    badge.textContent = `⏳ ${currentCount}/${totalEpisodes} tập`;
    badge.style.color = "#ffc107";
    badge.style.background = "rgba(255, 193, 7, 0.12)";
  }
}
/**
 * Xử lý hiển thị gợi ý khi chọn loại video
 */
/**
 * [NEW] Mở modal Import Nhiều Tập (API)
 */
function openImportEpisodesModal() {
  const movieId = document.getElementById("selectMovieForEpisodes").value;
  if (!movieId) {
    showNotification("Vui lòng chọn phim trước khi thao tác!", "error");
    return;
  }
  
  document.getElementById("apiBatchEpisodesUrl").value = "";
  clearImportBatchTable();
  const modal = document.getElementById("importEpisodesModal");
  if (modal) modal.classList.add("active");
}

/**
 * [NEW] Lấy danh sách Tập từ API (Ví dụ: OPhim) hiển thị vào Bảng Preview
 */
async function fetchBatchEpisodesFromAPI() {
    const url = document.getElementById("apiBatchEpisodesUrl").value.trim();
    if (!url) {
        showNotification("Vui lòng nhập Link API!", "error");
        return;
    }

    const tbody = document.getElementById("previewImportTable");
    const statusText = document.getElementById("importBatchStatus");
    const clrBtn = document.getElementById("btnClearBatchTable");

    try {
        statusText.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Đang tải dữ liệu...`;
        statusText.style.color = "var(--warning-color)";
        
        let response = await fetch(url);
        if (!response.ok) throw new Error("Lỗi mạng: " + response.status);

        const resData = await response.json();
        
        let episodesData = null;
        let movieData = null;
        
        // Hỗ trợ cả 2 chuẩn API: KKPhim (resData.data.item) và OPhim/PhimAPI (resData.movie)
        if (resData.movie) {
            movieData = resData.movie;
            episodesData = resData.episodes; // OPhim/PhimAPI
        } else if (resData.data && resData.data.item) {
            movieData = resData.data.item;
            episodesData = movieData.episodes || (resData.data && resData.data.episodes);
        }

        if (!movieData) {
             throw new Error("Dữ liệu không đúng cấu trúc Phim của OPhim/KKPhim.");
        }

        if (!episodesData || episodesData.length === 0) {
            throw new Error("Phim này chưa có tập nào được cập nhật trên API!");
        }

        const serverData = episodesData[0].server_data;
        if (!serverData || serverData.length === 0) {
            throw new Error("Không tìm thấy server_data (Link Video) hợp lệ!");
        }

        // Render lên bảng
        tbody.innerHTML = ""; 
        serverData.forEach((ep) => {
            let m3u8Clean = typeof ep.link_m3u8 === 'string' && ep.link_m3u8.includes("http") && !ep.link_m3u8.startsWith("http")
                ? ep.link_m3u8.substring(ep.link_m3u8.indexOf("http")).trim()
                : (ep.link_m3u8 || '');
                
            let embedClean = typeof ep.link_embed === 'string' && ep.link_embed.includes("http") && !ep.link_embed.startsWith("http")
                ? ep.link_embed.substring(ep.link_embed.indexOf("http")).trim()
                : (ep.link_embed || '');

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>
                   <input type="text" class="form-input batch-ep-name" value="${ep.name || 'Tập ' + (serverData.indexOf(ep) + 1)}" placeholder="Tập..." />
                </td>
                <td>
                   <select class="form-select batch-ep-hls-label" style="margin-bottom: 5px; font-size: 0.9em; padding: 4px;">
                       <option value="Bản gốc" selected style="color: #2ecc71;">🟢 Bản gốc</option>
                       <option value="Vietsub" style="color: #3498db;">🔵 Vietsub</option>
                       <option value="Thuyết minh" style="color: #e67e22;">🟠 Thuyết minh</option>
                       <option value="Lồng tiếng" style="color: #9b59b6;">🟣 Lồng tiếng</option>
                       <option value="Dự phòng" style="color: #e74c3c;">🔴 Dự phòng</option>
                   </select>
                   <input type="text" class="form-input batch-ep-hls" value="${m3u8Clean}" placeholder="Link .m3u8..." />
                </td>
                <td>
                   <select class="form-select batch-ep-embed-label" style="margin-bottom: 5px; font-size: 0.9em; padding: 4px;">
                       <option value="Bản gốc" style="color: #2ecc71;">🟢 Bản gốc</option>
                       <option value="Vietsub" style="color: #3498db;">🔵 Vietsub</option>
                       <option value="Thuyết minh" style="color: #e67e22;">🟠 Thuyết minh</option>
                       <option value="Lồng tiếng" style="color: #9b59b6;">🟣 Lồng tiếng</option>
                       <option value="Dự phòng" selected style="color: #e74c3c;">🔴 Dự phòng</option>
                   </select>
                   <input type="text" class="form-input batch-ep-embed" value="${embedClean}" placeholder="Link Iframe (Tùy chọn)" />
                </td>
                <td style="text-align: center;">
                    <button class="btn btn-sm btn-danger" onclick="this.closest('tr').remove()"><i class="fas fa-trash"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        statusText.innerHTML = `<i class="fas fa-check-circle"></i> Đã tải thành công <b>${serverData.length}</b> tập.`;
        statusText.style.color = "var(--success-color)";
        clrBtn.style.display = "inline-block";

    } catch (err) {
        console.error("Batch Import Fetch Error:", err);
        statusText.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Lỗi: ${err.message}`;
        statusText.style.color = "var(--danger-color)";
    }
}

/**
 * [NEW] Đổi nhãn hàng loạt cho cả cột
 */
function changeAllLabels(type, value) {
    if (!value) return; // Nếu chọn dòng "-- Đổi Nhãn --" thì không làm gì
    
    // Xác định class name của các select dựa vào loại cột (hls hay embed)
    const selectClass = type === 'hls' ? '.batch-ep-hls-label' : '.batch-ep-embed-label';
    
    // Lấy tất cả các thẻ select thuộc cột đó
    const selectElements = document.querySelectorAll(`#previewImportTable ${selectClass}`);
    
    if (selectElements.length === 0) return;
    
    // Duyệt qua và gán giá trị mới
    selectElements.forEach(select => {
        select.value = value;
    });
    
    // Báo nhẹ cho người dùng biết
    showNotification(`Đã đổi đồng loạt ${selectElements.length} tập thành nhãn: ${value}`, "success");
}

/**
 * [NEW] Xóa sạch bảng Preview
 */
function clearImportBatchTable() {
    document.getElementById("previewImportTable").innerHTML = `<tr><td colspan="4" class="text-center text-muted" style="padding: 30px;">Dán Link API và bấm "Lấy Danh Sách" để xem trước các tập.</td></tr>`;
    
    // Đặt lại luôn 2 cái Header Select All về trạng thái mặc định
    const selectHeaders = document.querySelectorAll("#importEpisodesModal th select");
    selectHeaders.forEach(select => select.value = "");
    const statusText = document.getElementById("importBatchStatus");
    statusText.innerText = "Chưa có dữ liệu...";
    statusText.style.color = "var(--text-secondary)";
    document.getElementById("btnClearBatchTable").style.display = "none";
}

/**
 * [NEW] Lưu danh sách các tập từ Bảng Preview Lên Hệ Thống Database
 */
async function saveBatchImportedEpisodes() {
    const movieId = selectedMovieForEpisodes || document.getElementById("selectMovieForEpisodes").value;
    if (!movieId) {
        showNotification("Lỗi: Không xác định được Phim đang tương tác!", "error");
        return;
    }

    const rows = document.querySelectorAll("#previewImportTable tr");
    if (rows.length === 0 || rows[0].querySelector("td[colspan]")) {
        showNotification("Bảng tập phim trống! Vui lòng Lấy dữ liệu trước.", "error");
        return;
    }

    const movie = allMovies.find(m => m.id === movieId);
    if (!movie) return;

    let targetEpisodesArray = [...(movie.episodes || [])];
    let addedCount = 0;

    // Duyệt qua từng hàng trong bảng
    for (let row of rows) {
        const nameInput = row.querySelector(".batch-ep-name");
        const hlsInput = row.querySelector(".batch-ep-hls");
        const hlsLabelInput = row.querySelector(".batch-ep-hls-label");
        const embedInput = row.querySelector(".batch-ep-embed");
        const embedLabelInput = row.querySelector(".batch-ep-embed-label");

        if (!nameInput || !hlsInput) continue; // Bỏ qua nếu dòng không hợp lệ
        
        let labelName = nameInput.value.trim();
        let m3u8Link = hlsInput.value.trim();
        let m3u8Label = hlsLabelInput ? hlsLabelInput.value : "Bản gốc";
        let embedLink = embedInput ? embedInput.value.trim() : "";
        let embedLabel = embedLabelInput ? embedLabelInput.value : "Dự phòng";

        if (!m3u8Link) continue; // Phải có link M3U8

        // Tạo cục Source
        const sources = [];
        sources.push({
            label: m3u8Label,
            type: "hls", 
            source: m3u8Link
        });
        
        // Nếu API có embed dự phòng thì nhét vào 
        if (embedLink) {
              sources.push({
                label: embedLabel, // API Tích hợp iFrame web khác
                type: "embed", // Link embed dự phòng
                source: embedLink 
            });
        }

        // Tạo Episode Object chuẩn tương tự cách tạo 1 tập thủ công
        const epData = {
             episodeNumber: labelName,
             duration: "0 giờ 45 phút", 
             quality: "1080p",
             sources: sources,
             videoType: sources.length > 0 ? sources[0].type : "hls",
             videoSource: sources.length > 0 ? sources[0].source : "",
             youtubeId: "", // HLS không dùng youtube id
             updatedAt: new Date()
        };

        targetEpisodesArray.push(epData);
        addedCount++;
    }

    if (addedCount === 0) {
        showNotification("Không có dòng dữ liệu hợp lệ nào để lưu!", "error");
        return;
    }

    try {
        showLoading(true, `Đang xử lý thêm ${addedCount} tập phim...`);
        
        // Lưu lên Firestore
        await db.collection("movies").doc(movieId).update({
            episodes: targetEpisodesArray,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        showNotification("Import thành công " + addedCount + " tập!", "success");
        closeModal("importEpisodesModal");
        
        // Reload lại list phim trong JS
        await loadMovies();
        await loadAdminMovies();
        // Load lại danh sách Episodes trên màn Quản Lý Tập UI
        loadEpisodesForMovie();

    } catch (err) {
        console.error("Save Batch Episodes Error: ", err);
        showNotification("Không lưu được: " + err.message, "error");
    } finally {
        showLoading(false);
    }
}

/**
 * Thêm một dòng nhập source video
 */
function addSourceInput(type = "hls", source = "", label = "") {
  const container = document.getElementById("sourceListContainer");
  const id = new Date().getTime() + Math.random().toString(36).substr(2, 9);

  // Khởi tạo các nhãn mặc định
  const standardLabels = [
      { value: "Bản gốc", emoji: "🟢", color: "#2ecc71" },
      { value: "Vietsub", emoji: "🔵", color: "#3498db" },
      { value: "Thuyết minh", emoji: "🟠", color: "#e67e22" },
      { value: "Lồng tiếng", emoji: "🟣", color: "#9b59b6" },
      { value: "Dự phòng", emoji: "🔴", color: "#e74c3c" }
  ];
  let defaultLabel = label || "Bản gốc";
  
  let labelOptions = standardLabels.map(l => `<option value="${l.value}" ${defaultLabel === l.value ? 'selected' : ''} style="color: ${l.color};">${l.emoji} ${l.value}</option>`).join('');
  
  // Tránh mất Data cũ nếu Phim đang có Nhãn nào khác chuỗi Standard Mặc Định
  if (defaultLabel && !standardLabels.some(l => l.value === defaultLabel)) {
      labelOptions += `<option value="${defaultLabel}" selected>⚪ ${defaultLabel}</option>`;
  }

  const html = `
    <div class="source-item" id="source-${id}" style="display: grid; grid-template-columns: 180px 100px 1fr auto; gap: 10px; align-items: center; background: #f8f9fa; padding: 10px; border-radius: 4px; border: 1px solid #ddd;">
        <div>
            <select class="form-select source-label">
                ${labelOptions}
            </select>
        </div>
        <div>
            <select class="form-select source-type" onchange="updateSourcePlaceholder('${id}')">
                <option value="youtube" ${type === "youtube" ? "selected" : ""}>YouTube</option>
                <option value="hls" ${type === "hls" ? "selected" : ""}>HLS</option>
                <option value="mp4" ${type === "mp4" ? "selected" : ""}>MP4</option>
                <option value="embed" ${type === "embed" ? "selected" : ""}>Embed</option>
            </select>
        </div>
        <div>
            <input type="text" class="form-input source-url" placeholder="Nhập ID hoặc URL" value="${source}" required
                oninput="autoDetectSourceType('${id}')"
                onpaste="setTimeout(() => autoDetectSourceType('${id}'), 50)">
        </div>
        <button type="button" class="btn btn-danger btn-sm" onclick="removeSourceInput('${id}')">
            <i class="fas fa-trash"></i>
        </button>
    </div>
  `;
  container.insertAdjacentHTML("beforeend", html);
  updateSourcePlaceholder(id);
}

function removeSourceInput(id) {
  document.getElementById(`source-${id}`)?.remove();
}

function updateSourcePlaceholder(id) {
  const item = document.getElementById(`source-${id}`);
  if (!item) return;
  const type = item.querySelector(".source-type").value;
  const input = item.querySelector(".source-url");
  
  if (type === "youtube") input.placeholder = "ID YouTube (VD: dQw4...)";
  else if (type === "hls") input.placeholder = "Link .m3u8";
  else if (type === "embed") input.placeholder = "Link embed (iframe URL)";
  else input.placeholder = "Link .mp4";
}

/**
 * Tự động nhận diện loại link khi admin nhập/paste URL
 * Hỗ trợ: YouTube, HLS (.m3u8), MP4, Embed (iframe/player URL)
 */
function autoDetectSourceType(id) {
  const item = document.getElementById(`source-${id}`);
  if (!item) return;
  const input = item.querySelector(".source-url");
  const typeSelect = item.querySelector(".source-type");
  if (!input || !typeSelect) return;
  
  const url = input.value.trim().toLowerCase();
  if (!url) return;
  
  let detected = null;
  
  // 1. YouTube: chứa youtube.com, youtu.be, hoặc chỉ là ID ngắn (11 kí tự)
  if (url.includes("youtube.com") || url.includes("youtu.be")) {
    detected = "youtube";
  }
  // 2. HLS: chứa .m3u8
  else if (url.includes(".m3u8")) {
    detected = "hls";
  }
  // 3. MP4: chứa .mp4
  else if (url.includes(".mp4")) {
    detected = "mp4";
  }
  // 4. Embed: link có iframe, player, share, hoặc các trang embed video thông dụng
  else if (
    url.includes("<iframe") ||
    url.includes("/player") ||
    url.includes("/share/") ||
    url.includes("/embed/") ||
    url.includes("player.phimapi.com") ||
    url.includes("ok.ru") ||
    url.includes("drive.google.com") ||
    url.includes("dailymotion.com") ||
    url.includes("vimeo.com") ||
    (url.startsWith("http") && !url.includes(".m3u8") && !url.includes(".mp4") && !url.includes("youtube"))
  ) {
    detected = "embed";
  }
  
  // Chỉ thay đổi nếu phát hiện được và khác giá trị hiện tại
  if (detected && typeSelect.value !== detected) {
    typeSelect.value = detected;
    updateSourcePlaceholder(id);
  }
}

/**
 * Mở modal thêm/sửa tập (Hỗ trợ Multi-Source)
 */
function openEpisodeModal(index = null) {
  const title = document.getElementById("episodeModalTitle");
  const form = document.getElementById("episodeForm");
  const epNumGroup = document.getElementById("episodeNumberGroup");
  const indexInput = document.getElementById("episodeIndex");
  const sourceContainer = document.getElementById("sourceListContainer");

  // Reset form
  form.reset();
  sourceContainer.innerHTML = ""; // Xóa các source cũ

  const movieId = document.getElementById("selectMovieForEpisodes").value;
  const movie = allMovies.find((m) => m.id === movieId);
  const isSingle = movie && movie.type === "single";

  if (epNumGroup) epNumGroup.style.display = isSingle ? "none" : "block";

  if (index !== null) {
    // === EDIT ===
    title.textContent = isSingle ? "Cập Nhật Link Phim" : "Sửa Tập Phim";
    indexInput.value = index;

    const episode = movie?.episodes?.[index];

    if (episode) {
      // Đổ dữ liệu vào modal
      if (document.getElementById("episodeNumber")) {
          document.getElementById("episodeNumber").value = episode.episodeNumber || (isSingle ? "1" : "");
      }
      
      // Xử lý tự động thêm "Tập" khi nhập số
      const epNumInput = document.getElementById("episodeNumber");
      if (epNumInput) {
          epNumInput.onblur = function() {
              const val = this.value.trim();
              if (val && !isNaN(val)) {
                  this.value = "Tập " + val;
              }
          };
      }
      
      // Xử lý Thời lượng (Smart Input)
      const dur = parseDuration(episode.duration || "");
      document.getElementById("episodeDurationHour").value = dur.h || "";
      document.getElementById("episodeDurationMinute").value = dur.m || "";

      document.getElementById("episodeQuality").value = episode.quality || "1080p60";

      // Load Sources
      if (episode.sources && Array.isArray(episode.sources) && episode.sources.length > 0) {
        // Dữ liệu mới (Multi-source)
        episode.sources.forEach(src => {
            addSourceInput(src.type, src.source, src.label);
        });
      } else {
        // Dữ liệu cũ (Single source) -> Convert sang 1 dòng source
        const oldType = episode.videoType || "youtube";
        const oldSource = episode.videoSource || episode.youtubeId || "";
        addSourceInput(oldType, oldSource, "Mặc định");
      }
    }
  } else {
    // === ADD NEW ===
    title.textContent = isSingle ? "Cập Nhật Link Phim" : "Thêm Tập Mới";
    indexInput.value = "";

    if (isSingle) {
      document.getElementById("episodeNumber").value = "1";
    } else {
      // FIX: Tìm số tập lớn nhất thay vì đếm số lượng (tránh trùng khi xóa tập giữa)
      let maxEp = 0;
      if (movie && movie.episodes && movie.episodes.length > 0) {
          maxEp = Math.max(...movie.episodes.map(e => {
              const num = parseInt(String(e.episodeNumber).replace(/\D/g, ''));
              return isNaN(num) ? 0 : num;
          }));
      }
      const nextEp = maxEp + 1;
      document.getElementById("episodeNumber").value = "Tập " + nextEp;
    }

    // Xử lý tự động thêm "Tập" khi nhập số cho add mới
    const epNumInput = document.getElementById("episodeNumber");
    if (epNumInput) {
        epNumInput.onblur = function() {
            const val = this.value.trim();
            if (val && !isNaN(val)) {
                this.value = "Tập " + val;
            }
        };
    }

    document.getElementById("episodeQuality").value = "1080p60";
    
    // Reset Thời lượng
    document.getElementById("episodeDurationHour").value = "";
    document.getElementById("episodeDurationMinute").value = "";
    
    // Thêm 1 dòng source mặc định
    addSourceInput("hls", "", "Bản gốc");
  }

  // Define openModal locally or assume it exists globally. The user's code used openModal("episodeModal").
  // However, earlier in the same function (line 789 in original) it used openModal.
  // Wait, I see `const modal = new bootstrap.Modal(...)` in my previous failed attempt, but the original code uses `openModal("episodeModal")`.
  // I should stick to the original code style or available functions.
  // Looking at the context, line 789 is `openModal("episodeModal");`.
  // I will just return the control to that line.
  
  // Actually, I am replacing lines 771-787.
  // The original code calls `openModal("episodeModal")` at line 789.
  // I don't need to include line 789 in my replacement if I stop before it.
  
  // Wait, the `addSourceInput` call at line 786 in original code was:
  // `addSourceInput("youtube", "", "Bản gốc");`
  // I should keep it or ensure it's called.


  openModal("episodeModal");
}

/**
 * Xử lý submit form tập phim
 */
async function handleEpisodeSubmit(event) {
  event.preventDefault();

  if (!db || !selectedMovieForEpisodes) return;

  const index = document.getElementById("episodeIndex").value;
  
  // Thu thập sources từ UI
  const sourceItems = document.querySelectorAll(".source-item");
  const sources = [];
  
  sourceItems.forEach(item => {
      sources.push({
          label: item.querySelector(".source-label").value,
          type: item.querySelector(".source-type").value,
          source: item.querySelector(".source-url").value
      });
  });

  if (sources.length === 0) {
      showNotification("Phải có ít nhất 1 nguồn video!", "warning");
      return;
  }

  // Tương thích ngược: Lấy source đầu tiên làm default
  const primarySource = sources[0];
  const youtubeId = primarySource.type === "youtube" ? primarySource.source : "";

  const episodeData = {
    episodeNumber: document.getElementById("episodeNumber").value,
    
    // Xử lý Thời lượng
    duration: (() => {
        const h = parseInt(document.getElementById("episodeDurationHour").value) || 0;
        const m = parseInt(document.getElementById("episodeDurationMinute").value) || 0;
        return formatDuration(h, m);
    })(),

    quality: document.getElementById("episodeQuality").value,
    sources: sources,
    // Giữ lại videoType/videoSource/youtubeId cho tương thích ngược (lấy từ source đầu tiên)
    videoType: sources.length > 0 ? sources[0].type : "youtube",
    videoSource: sources.length > 0 ? sources[0].source : "",
    youtubeId: sources.length > 0 && sources[0].type === "youtube" ? sources[0].source : "",
    updatedAt: new Date()
  };

  try {
    showLoading(true, "Đang lưu...");

    const movieRef = db.collection("movies").doc(selectedMovieForEpisodes);
    const movieDoc = await movieRef.get();
    let episodes = movieDoc.data()?.episodes || [];

    if (index !== "") {
      episodes[parseInt(index)] = episodeData;
    } else {
      episodes.push(episodeData);
    }

    episodes.sort((a, b) => {
        return String(a.episodeNumber).localeCompare(String(b.episodeNumber), undefined, { numeric: true, sensitivity: 'base' });
    });

    await movieRef.update({ episodes });

    showNotification("Đã lưu tập phim!", "success");
    closeModal("episodeModal");

    await loadMovies();
    loadEpisodesForMovie();
  } catch (error) {
    console.error("Lỗi lưu episode:", error);
    showNotification("Không thể lưu tập phim!", "error");
  } finally {
    showLoading(false);
  }
}

/**
 * Sửa tập phim
 */
function editEpisode(index) {
  openEpisodeModal(index);
}

/**
 * Xóa tập phim
 */
async function deleteEpisode(index) {
  if (!await customConfirm("Bạn có chắc muốn xóa tập này?", { title: "Xóa tập phim", type: "danger", confirmText: "Xóa" })) return;

  if (!db || !selectedMovieForEpisodes) return;

  try {
    showLoading(true, "Đang xóa...");

    const movieRef = db.collection("movies").doc(selectedMovieForEpisodes);
    const movieDoc = await movieRef.get();
    let episodes = movieDoc.data()?.episodes || [];

    episodes.splice(index, 1);

    await movieRef.update({ episodes });

    showNotification("Đã xóa tập phim!", "success");

    // Reload
    await loadMovies();
    loadEpisodesForMovie();
  } catch (error) {
    console.error("Lỗi xóa episode:", error);
    showNotification("Không thể xóa tập phim!", "error");
  } finally {
    showLoading(false);
  }
}

/**
 * Xóa tất cả tập phim
 */
async function deleteAllEpisodes() {
  if (!selectedMovieForEpisodes) {
    showNotification("Vui lòng chọn một phim trước!", "warning");
    return;
  }

  if (!await customConfirm("Bạn có chắc muốn xóa TẤT CẢ các tập của phim này? Hành động này không thể hoàn tác!", { title: "Xóa tất cả tập phim", type: "danger", confirmText: "Xóa tất cả" })) return;

  if (!db) return;

  try {
    showLoading(true, "Đang xóa tất cả tập...");

    const movieRef = db.collection("movies").doc(selectedMovieForEpisodes);
    
    // Set episodes to empty array
    await movieRef.update({ episodes: [] });

    showNotification("Đã xóa tất cả tập phim!", "success");

    // Reload
    await loadMovies();
    loadEpisodesForMovie();
  } catch (error) {
    console.error("Lỗi xóa tất cả episodes:", error);
    showNotification("Không thể xóa các tập phim!", "error");
  } finally {
    showLoading(false);
  }
}
/**
 * Populate movie select cho quản lý tập
 */
function populateMovieSelect() {
  const select = document.getElementById("selectMovieForEpisodes");
  select.innerHTML =
    '<option value="">-- Chọn phim --</option>' +
    allMovies
      .map((m) => `<option value="${m.id}">${m.title}</option>`)
      .join("");
}
/**
 * Load danh sách users cho Admin (Đã sửa: Hiện ảnh Avatar thật)
 */
/**
 * Biến toàn cục lưu danh sách users để tìm kiếm
 */
let allAdminUsers = [];

/**
 * Load danh sách users cho Admin (Đã sửa: Hiện ảnh Avatar thật + Tách hàm render)
 */
async function loadAdminUsers() {
  if (!db) return;

  try {
    const snapshot = await db
      .collection("users")
      .orderBy("createdAt", "desc")
      .get();
    
    // Lưu vào biến toàn cục
    allAdminUsers = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    // Render toàn bộ lần đầu
    renderAdminUsersList(allAdminUsers);

    // Gắn sự kiện tìm kiếm nếu chưa gắn
    const searchInput = document.getElementById("adminSearchUsers");
    const filterRole = document.getElementById("adminFilterRole");

    if (searchInput) {
      searchInput.oninput = filterAdminUsers;
    }
    if (filterRole) {
      filterRole.onchange = filterAdminUsers;
    }

  } catch (error) {
    console.error(error);
  }
}

/**
 * Hàm lọc user theo tên/email và vai trò
 */
function filterAdminUsers() {
  const searchText = document.getElementById("adminSearchUsers").value.toLowerCase().trim();
  const roleFilter = document.getElementById("adminFilterRole").value;

  const filtered = allAdminUsers.filter(user => {
    const matchName = (user.displayName || "").toLowerCase().includes(searchText);
    const matchEmail = (user.email || "").toLowerCase().includes(searchText);
    const matchRole = roleFilter ? user.role === roleFilter : true;

    return (matchName || matchEmail) && matchRole;
  });

  renderAdminUsersList(filtered);
}

/**
 * Hàm render UI danh sách user (Tách ra để tái sử dụng)
 */
function renderAdminUsersList(users) {
  const tbody = document.getElementById("adminUsersTable");
  if (!tbody) return;

  if (users.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="text-center">Không tìm thấy người dùng nào</td></tr>`;
    return;
  }

  tbody.innerHTML = users
    .map((user) => {
      const date = user.createdAt?.toDate
        ? formatDate(user.createdAt.toDate())
        : "N/A";
      const initial = (user.displayName ||
        user.email ||
        "U")[0].toUpperCase();

      // Avatar Logic
      let avatarHtml =
        user.avatar && user.avatar.startsWith("http")
          ? `<img src="${user.avatar}" style="width:40px; height:40px; border-radius:50%; object-fit:cover;">`
          : `<div class="comment-avatar" style="width:40px;height:40px;font-size:14px;">${initial}</div>`;

      // 👇 LOGIC TÍNH THỜI HẠN VIP 👇
      const isVip = user.isVip === true;
      let expiryText = "-";

      if (isVip) {
        if (user.vipExpiresAt) {
          // TRƯỜNG HỢP CÓ THỜI HẠN
          const expiryDate = user.vipExpiresAt.toDate 
             ? user.vipExpiresAt.toDate() 
             : new Date(user.vipExpiresAt);
             
          const now = new Date();
          const diffTime = expiryDate - now;
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          if (diffDays > 0) {
            expiryText = `<span style="color: #00d4ff; font-weight:bold;">Còn ${diffDays} ngày</span>`;
          } else {
            expiryText = `<span style="color: #ff4444; font-weight:bold;">Đã hết hạn</span>`;
          }
        } else {
          // TRƯỜNG HỢP VĨNH VIỄN (vipExpiresAt là null)
          expiryText = `<span class="tag" style="background: linear-gradient(45deg, #00d4ff, #00ff88); color: #000; font-weight:800;">♾️ VĨNH VIỄN</span>`;
        }
      }
      // 👆 HẾT LOGIC TÍNH HẠN 👆

      const vipBadge = isVip
        ? `<span class="status-badge vip"><i class="fas fa-crown"></i> VIP</span>`
        : `<span class="status-badge free">Free</span>`;
      const vipBtnClass = isVip ? "btn-secondary" : "btn-vip-action";
      const vipIcon = isVip ? "fa-ban" : "fa-crown";
      
      const roleClass = user.role === "admin" ? "public" : (user.role === "editor" ? "pending" : "");

      return `
          <tr>
              <td>${avatarHtml}</td>
              <td>${user.email}</td>
              <td>${user.displayName || "N/A"}</td>
              <td><span class="status-badge ${roleClass}">${user.role || "user"}</span></td>
              <td><span class="status-badge ${user.isActive ? "active" : "blocked"}">${user.isActive ? "Hoạt động" : "Bị khóa"}</span></td>
              <td>${vipBadge}</td>
              
              <td style="font-size: 13px;">${expiryText}</td>
              
              <td>${date}</td>
              <td>
                  <button class="btn btn-sm ${vipBtnClass}" onclick="toggleUserVip('${user.id}', ${!isVip})" title="Cấp/Hủy VIP">
                      <i class="fas ${vipIcon}"></i>
                  </button>
                  <button class="btn btn-sm btn-secondary" onclick="openUserRoleModal('${user.id}', '${user.email}', '${user.role}')" title="Phân quyền"><i class="fas fa-user-cog"></i></button>
                  <button class="btn btn-sm ${user.isActive ? "btn-danger" : "btn-success"}" onclick="toggleUserStatus('${user.id}', ${!user.isActive})" title="${user.isActive ? "Khóa" : "Mở khóa"}"><i class="fas fa-${user.isActive ? "lock" : "unlock"}"></i></button>
              <button class="btn btn-sm btn-danger" onclick="deleteUser('${user.id}', '${user.email}')" title="Xóa vĩnh viễn">
                      <i class="fas fa-trash-alt"></i>
                  </button>
                  </td>
          </tr>
      `;
    })
    .join("");
}
// 👇 HÀM MỚI: CẤP VIP CÓ THỜI HẠN 👇
// 👇 HÀM CẤP VIP (ĐÃ CÓ TÙY CHỌN VĨNH VIỄN) 👇
async function toggleUserVip(userId, setVip) {
  if (!db) return;

  let expiryDate = null; // Mặc định là null (Vĩnh viễn hoặc Hủy)
  let days = 0;
  let message = "";

  if (setVip) {
    // Hướng dẫn Admin nhập -1 để set vĩnh viễn
    const input = await customPrompt("Nhập số ngày VIP (Ví dụ: 30). Nhập -1 để cấp VĨNH VIỄN.", { title: "Cấp VIP", defaultValue: "30" });

    if (input === null) return; // Nếu bấm hủy

    days = parseInt(input);

    if (isNaN(days)) {
      await customAlert("Vui lòng nhập số!", { type: "warning" });
      return;
    }

    if (days === -1) {
      // TRƯỜNG HỢP VĨNH VIỄN
      expiryDate = null; // Không có ngày hết hạn
      message = "Đã cấp VIP VĨNH VIỄN! ♾️";
    } else if (days > 0) {
      // TRƯỜNG HỢP CÓ THỜI HẠN
      const now = new Date();
      expiryDate = new Date(now.setDate(now.getDate() + days));
      message = `Đã cấp VIP ${days} ngày!`;
    } else {
      await customAlert("Số ngày không hợp lệ!", { type: "warning" });
      return;
    }
  } else {
    // HỦY VIP
    if (!await customConfirm("Bạn có chắc muốn HỦY VIP của người dùng này?", { title: "Hủy VIP", type: "danger", confirmText: "Hủy VIP" })) return;
    message = "Đã hủy VIP thành công!";
  }

  try {
    showLoading(true, "Đang cập nhật...");

    // Cập nhật vào Firestore
    await db
      .collection("users")
      .doc(userId)
      .update({
        isVip: setVip,
        vipSince: setVip
          ? firebase.firestore.FieldValue.serverTimestamp()
          : null,
        vipExpiresAt: expiryDate, // Lưu ngày hết hạn (hoặc null nếu vĩnh viễn)
      });

    showNotification(message, "success");
    await loadAdminUsers();
  } catch (error) {
    console.error("Lỗi cập nhật VIP:", error);
    showNotification("Lỗi cập nhật!", "error");
  } finally {
    showLoading(false);
  }
}
/**
 * Khóa/mở khóa user
 */
async function toggleUserStatus(userId, newStatus) {
  if (!db) return;

  const action = newStatus ? "mở khóa" : "khóa";
  if (!await customConfirm(`Bạn có chắc muốn ${action} tài khoản này?`, { title: action === 'khóa' ? 'Khóa tài khoản' : 'Mở khóa', type: action === 'khóa' ? 'danger' : 'warning', confirmText: action.charAt(0).toUpperCase() + action.slice(1) })) return;

  try {
    showLoading(true, "Đang cập nhật...");

    await db.collection("users").doc(userId).update({
      isActive: newStatus,
    });

    showNotification(`Đã ${action} tài khoản!`, "success");

    await loadAdminUsers();
  } catch (error) {
    console.error("Lỗi toggle user status:", error);
    showNotification("Không thể cập nhật trạng thái!", "error");
  } finally {
    showLoading(false);
  }
}
/**
 * Xóa tài khoản người dùng vĩnh viễn
 */
async function deleteUser(userId, userEmail) {
  // 1. Xác nhận hành động (Vì xóa là mất luôn)
  const confirmMsg = `Bạn có chắc chắn muốn XÓA VĨNH VIỄN tài khoản: ${userEmail}? Hành động này sẽ xóa toàn bộ dữ liệu và KHÔNG THỂ khôi phục.`;

  if (!await customConfirm(confirmMsg, { title: "⚠️ XÓA TÀI KHOẢN", type: "danger", confirmText: "Xóa vĩnh viễn" })) return;

  if (!db) return;

  try {
    showLoading(true, "Đang xóa tài khoản...");

    // ✅ CODE MỚI: Chỉ đánh dấu là đã xóa (Soft Delete)
    // Để hệ thống còn nhận diện được là "thằng này đã bị xóa" mà chặn lại
    await db.collection("users").doc(userId).update({
      isDeleted: true, // Cờ đánh dấu đã xóa
      isActive: false, // Khóa luôn cho chắc
      deletedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });

    showNotification("Đã xóa tài khoản thành công!", "success");

    // Tải lại bảng
    await loadAdminUsers();
    await loadAdminStats();
  } catch (error) {
    console.error("Lỗi xóa user:", error);
    showNotification("Lỗi: " + error.message, "error");
  } finally {
    showLoading(false);
  }
}
/**
 * Mở modal phân quyền user
 */
function openUserRoleModal(userId, email, currentRole) {
  editingUserId = userId;
  document.getElementById("userRoleEmail").textContent = `Email: ${email}`;
  document.getElementById("userRoleSelect").value = currentRole || "user";
  openModal("userRoleModal");
}

/**
 * Cập nhật role user
 */
async function updateUserRole() {
  if (!editingUserId || !db) return;

  const newRole = document.getElementById("userRoleSelect").value;

  try {
    showLoading(true, "Đang cập nhật...");

    await db.collection("users").doc(editingUserId).update({
      role: newRole,
    });

    showNotification("Đã cập nhật quyền người dùng!", "success");
    closeModal("userRoleModal");

    await loadAdminUsers();
  } catch (error) {
    console.error("Lỗi cập nhật role:", error);
    showNotification("Không thể cập nhật quyền!", "error");
  } finally {
    showLoading(false);
  }
}
/**
 * Hiển thị bảng Thể loại (Đã cập nhật nút Sửa/Xóa)
 */
function renderAdminCategories() {
  const tbody = document.getElementById("adminCategoriesTable");
  const searchInput = document.getElementById("adminSearchCategory");
  
  if (!tbody) return;

  let categoriesToRender = allCategories;

  // Lọc nếu có từ khóa tìm kiếm
  if (searchInput) {
    const searchText = searchInput.value.toLowerCase().trim();
    if (searchText) {
      categoriesToRender = allCategories.filter(c => 
        (c.name && c.name.toLowerCase().includes(searchText)) || 
        (c.slug && c.slug.toLowerCase().includes(searchText)) ||
        (c.id && c.id.toLowerCase().includes(searchText))
      );
    }
  }

  if (categoriesToRender.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="5" class="text-center">Không tìm thấy thể loại nào</td></tr>';
    return;
  }

  tbody.innerHTML = categoriesToRender
    .map((cat, index) => {
      return `
            <tr>
                <td>${index + 1}</td>
                <td>${cat.id}</td>
                <td>${cat.name}</td>
                <td>${cat.slug || "N/A"}</td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="editCategory('${cat.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteCategory('${cat.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    })
    .join("");
}

// ==========================================
// LOGIC QUẢN LÝ THỂ LOẠI (CATEGORY)
// ==========================================

// 1. Mở Modal Thêm/Sửa Thể loại
function openCategoryModal(categoryId = null) {
  const modalTitle = document.getElementById("categoryModalTitle");
  const idInput = document.getElementById("categoryId");
  const nameInput = document.getElementById("categoryName");
  const slugInput = document.getElementById("categorySlug");

  // Reset form
  document.getElementById("categoryForm").reset();

  if (categoryId) {
    // Chế độ Sửa: Điền dữ liệu cũ vào
    const category = allCategories.find((c) => c.id === categoryId);
    if (category) {
      modalTitle.textContent = "Cập nhật Thể Loại";
      idInput.value = category.id;
      nameInput.value = category.name;
      slugInput.value = category.slug || "";
    }
  } else {
    // Chế độ Thêm mới
    modalTitle.textContent = "Thêm Thể Loại Mới";
    idInput.value = "";
  }

  openModal("categoryModal");
}

// 2. Hàm gọi từ nút Sửa
function editCategory(categoryId) {
  openCategoryModal(categoryId);
}

// 3. Xử lý nút Lưu (Submit Form)
async function handleCategorySubmit(event) {
  event.preventDefault(); // Chặn load lại trang

  const categoryId = document.getElementById("categoryId").value;
  const name = document.getElementById("categoryName").value;
  let slug = document.getElementById("categorySlug").value;

  // Nếu không nhập slug thì tự tạo từ tên
  if (!slug) slug = createSlug(name);

  const categoryData = { name, slug };

  try {
    showLoading(true, "Đang lưu...");

    if (categoryId) {
      // Update
      await db.collection("categories").doc(categoryId).update(categoryData);
      showNotification("Đã cập nhật thể loại!", "success");
    } else {
      // Create new (Dùng slug làm ID luôn cho đẹp)
      const newId = slug;
      await db
        .collection("categories")
        .doc(newId)
        .set({ id: newId, ...categoryData });
      showNotification("Đã thêm thể loại mới!", "success");
    }

    closeModal("categoryModal");

    // Load lại dữ liệu mới nhất
    await loadCategories();
    renderAdminCategories();
    populateFilters(); // Cập nhật luôn ô lọc bên ngoài
  } catch (error) {
    console.error("Lỗi lưu category:", error);
    showNotification("Lỗi: " + error.message, "error");
  } finally {
    showLoading(false);
  }
}

// 4. Xử lý Xóa
async function deleteCategory(categoryId) {
  if (!await customConfirm("Bạn có chắc muốn xóa thể loại này?", { title: "Xóa thể loại", type: "danger", confirmText: "Xóa" })) return;

  try {
    showLoading(true, "Đang xóa...");
    await db.collection("categories").doc(categoryId).delete();

    showNotification("Đã xóa thể loại!", "success");

    await loadCategories();
    renderAdminCategories();
    populateFilters();
  } catch (error) {
    console.error("Lỗi xóa category:", error);
    showNotification("Không thể xóa thể loại!", "error");
  } finally {
    showLoading(false);
  }
}

// ============================================
// ADMIN CRUD - COUNTRIES
// ============================================

// ==========================================
// LOGIC QUẢN LÝ QUỐC GIA (COUNTRY)
// ==========================================
/**
 * Hiển thị bảng Quốc gia (Admin) - CÓ NÚT SỬA/XÓA
 */
function renderAdminCountries() {
  const tbody = document.getElementById("adminCountriesTable");
  const searchInput = document.getElementById("adminSearchCountry");
  if (!tbody) return;

  // Nếu không có dữ liệu thì báo trống
  let countriesToRender = allCountries;

  if (searchInput) {
    const searchText = searchInput.value.toLowerCase().trim();
    if (searchText) {
      countriesToRender = allCountries.filter(c => 
        (c.name && c.name.toLowerCase().includes(searchText)) || 
        (c.id && c.id.toLowerCase().includes(searchText))
      );
    }
  }

  if (countriesToRender.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="5" class="text-center">Không tìm thấy quốc gia nào</td></tr>';
    return;
  }

  // Vẽ từng dòng
  tbody.innerHTML = countriesToRender
    .map((country, index) => {
      const countryInfo = getCountryInfo(country.name);
      
      return `
            <tr>
                <td>${index + 1}</td>
                <td>${country.id}</td>
                <td>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span class="country-badge-v2" style="background: ${countryInfo.bg}; color: ${countryInfo.color}; border-color: ${countryInfo.color}33;">
                            ${countryInfo.code ? `<img src="https://flagcdn.com/w40/${countryInfo.code}.png" class="flag-icon-img" alt="${country.name}">` : `<span class="flag-icon">${countryInfo.icon}</span>`}
                        </span>
                        <strong>${country.name}</strong>
                    </div>
                </td>
                <td><span class="badge badge-primary">${country.code || "N/A"}</span></td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="editCountry('${country.id}')" title="Sửa">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteCountry('${country.id}')" title="Xóa">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    })
    .join("");
}

function openCountryModal(countryId = null) {
  const modalTitle = document.getElementById("countryModalTitle");
  const idInput = document.getElementById("countryId");
  const nameInput = document.getElementById("countryName");
  const codeInput = document.getElementById("countryCode");

  document.getElementById("countryForm").reset();

  if (countryId) {
    const country = allCountries.find((c) => c.id === countryId);
    if (country) {
      modalTitle.textContent = "Cập nhật Quốc Gia";
      idInput.value = country.id;
      nameInput.value = country.name;
      codeInput.value = country.code || country.id.toUpperCase();
      codeInput.disabled = true; // Không cho sửa mã khi cập nhật
    }
  } else {
    modalTitle.textContent = "Thêm Quốc Gia Mới";
    idInput.value = "";
    codeInput.disabled = false;
    
    // Tự động gợi ý mã khi nhập tên (chỉ khi thêm mới)
    nameInput.oninput = function() {
        if (!idInput.value) { // Chỉ tự động khi đang thêm mới
            const name = this.value;
            // Lấy thông tin từ bộ quy tắc getCountryInfo nếu có
            const info = getCountryInfo(name);
            if (info.code && info.code !== 'un') {
                codeInput.value = info.code.toUpperCase();
            } else if (name.length >= 2) {
                // Nếu không có trong bộ quy tắc, lấy 2 chữ cái đầu của các từ
                const words = name.split(' ');
                let suggested = '';
                if (words.length >= 2) {
                    suggested = (words[0][0] + words[1][0]).toUpperCase();
                } else {
                    suggested = name.substring(0, 2).toUpperCase();
                }
                codeInput.value = suggested;
            }
        }
    };
  }

  openModal("countryModal");
}

function editCountry(countryId) {
  openCountryModal(countryId);
}

async function handleCountrySubmit(event) {
  event.preventDefault();

  const countryId = document.getElementById("countryId").value;
  const name = document.getElementById("countryName").value.trim();
  let code = document.getElementById("countryCode").value.toUpperCase().trim();

  // Nếu code trống, cố gắng lấy từ name
  if (!code && name) {
      const info = getCountryInfo(name);
      code = info.code && info.code !== 'un' ? info.code.toUpperCase() : name.substring(0, 2).toUpperCase();
  }

  if (!code) {
      showNotification("Vui lòng nhập mã quốc gia!", "warning");
      return;
  }

  // Chống trùng lặp (chỉ kiểm tra khi thêm mới)
  if (!countryId) {
      const isDuplicateName = allCountries.some(c => c.name.toLowerCase() === name.toLowerCase());
      const isDuplicateCode = allCountries.some(c => (c.code || '').toUpperCase() === code || c.id.toUpperCase() === code);
      
      if (isDuplicateName) {
          showNotification(`Quốc gia "${name}" đã tồn tại!`, "warning");
          return;
      }
      if (isDuplicateCode) {
          showNotification(`Mã quốc gia "${code}" đã được sử dụng!`, "warning");
          return;
      }
  }

  const countryData = { name, code };

  try {
    showLoading(true, "Đang lưu...");

    if (countryId) {
      await db.collection("countries").doc(countryId).update(countryData);
    } else {
      const newId = code.toLowerCase(); // ID là mã quốc gia viết thường (vn, us, kr...)
      await db
        .collection("countries")
        .doc(newId)
        .set({ id: newId, ...countryData });
    }

    showNotification("Đã lưu quốc gia!", "success");
    closeModal("countryModal");

    await loadCountries();
    renderAdminCountries();
    populateFilters();
    if (typeof populateAdminMovieFilters === 'function') populateAdminMovieFilters(); // Cập nhật cả bộ lọc bên quản lý phim
  } catch (error) {
    console.error("Lỗi lưu country:", error);
    showNotification("Lỗi: " + error.message, "error");
  } finally {
    showLoading(false);
  }
}

async function deleteCountry(countryId) {
  if (!await customConfirm("Bạn có chắc muốn xóa quốc gia này?", { title: "Xóa quốc gia", type: "danger", confirmText: "Xóa" })) return;

  try {
    showLoading(true, "Đang xóa...");
    await db.collection("countries").doc(countryId).delete();
    showNotification("Đã xóa quốc gia!", "success");
    await loadCountries();
    renderAdminCountries();
    populateFilters();
  } catch (error) {
    showNotification("Lỗi xóa!", "error");
  } finally {
    showLoading(false);
  }
}

// ============================================
// ADMIN CRUD - ACTORS (DIỄN VIÊN)
// ============================================

/**
 * Hiển thị bảng Diễn Viên (Admin)
 */
function renderAdminActors() {
  const tbody = document.getElementById("adminActorsTable");
  const searchInput = document.getElementById("adminSearchActor");
  if (!tbody) return;

  let actorsToRender = allActors || [];

  if (searchInput) {
    const searchText = searchInput.value.toLowerCase().trim();
    if (searchText) {
      actorsToRender = actorsToRender.filter(a => 
        (a.name && a.name.toLowerCase().includes(searchText)) || 
        (a.id && a.id.toLowerCase().includes(searchText))
      );
    }
  }

  // Sắp xếp diễn viên
  const sortSelect = document.getElementById("adminSortActor");
  if (sortSelect) {
    const sortVal = sortSelect.value;
    actorsToRender.sort((a, b) => {
      if (sortVal === "az") return (a.name || "").localeCompare(b.name || "");
      if (sortVal === "za") return (b.name || "").localeCompare(a.name || "");
      
      // Sắp xếp theo thời gian (createdAt)
      const timeA = a.createdAt ? (a.createdAt.seconds || new Date(a.createdAt).getTime() / 1000 || 0) : 0;
      const timeB = b.createdAt ? (b.createdAt.seconds || new Date(b.createdAt).getTime() / 1000 || 0) : 0;
      
      if (sortVal === "newest") return timeB - timeA;
      if (sortVal === "oldest") return timeA - timeB;
      
      return 0;
    });
  }

  if (actorsToRender.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="6" class="text-center">Không tìm thấy diễn viên nào.</td></tr>';
    return;
  }

  tbody.innerHTML = actorsToRender
    .map((actor, index) => {
      const avatarUrl = actor.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(actor.name)}&background=random&color=fff&size=100`;
      const isSelected = selectedActorIds.includes(actor.id);
      
      return `
            <tr>
                <td>
                  <input type="checkbox" class="actor-checkbox" value="${actor.id}" 
                    ${isSelected ? 'checked' : ''} 
                    onchange="toggleActorSelection('${actor.id}', this.checked)" />
                </td>
                <td>${index + 1}</td>
                <td>
                  <img src="${avatarUrl}" alt="${actor.name}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;">
                </td>
                <td>
                  <strong>${actor.name}</strong>
                  ${(window.latestAutoActorIds || []).includes(actor.id) 
                    ? '<span class="badge-new" style="background: var(--warning-color, #ffc107); color: #000;">Mới (Từ Phim)</span>' 
                    : (window.latestAddedActorIds || []).includes(actor.id) ? '<span class="badge-new">NEW</span>' : ''}
                  <br><small class="text-muted">ID: ${actor.id}</small>
                </td>
                <td><span style="font-size: 0.75rem; padding: 3px 6px; border-radius: 4px; font-weight: bold; background: ${actor.role === 'director' ? '#9c27b0' : '#4dabf7'}; color: #fff;">${actor.role === 'director' ? 'Đạo diễn' : 'Diễn viên'}</span></td>
                <td>${actor.gender || "Không rõ"}</td>
                <td>${actor.dob ? new Date(actor.dob).toLocaleDateString('vi-VN') : "Không rõ"}</td>
                <td>${actor.country || "Không rõ"}</td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="editActor('${actor.id}')" title="Sửa">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteActor('${actor.id}')" title="Xóa">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    })
    .join("");
}

/**
 * Mở modal Thêm/Sửa Diễn Viên
 */
function openActorModal(actorId = null) {
  const modalTitle = document.getElementById("actorModalTitle");
  const idInput = document.getElementById("actorId");
  const nameInput = document.getElementById("actorName");
  const avatarInput = document.getElementById("actorAvatar");
  const roleInput = document.getElementById("actorRole");
  const genderInput = document.getElementById("actorGender");
  const dobInput = document.getElementById("actorDob");
  const bioInput = document.getElementById("actorBio");

  document.getElementById("actorForm").reset();
  if (typeof updateActorPreview === 'function') updateActorPreview();

  if (actorId) {
    const actor = allActors.find((a) => a.id === actorId);
    if (actor) {
      modalTitle.textContent = "Cập nhật Thông tin";
      idInput.value = actor.id;
      nameInput.value = actor.name || "";
      avatarInput.value = actor.avatar || "";
      roleInput.value = actor.role || "actor";
      genderInput.value = actor.gender || "";
      dobInput.value = actor.dob || "";
      document.getElementById("actorCountry").value = actor.country || "";
      bioInput.value = actor.bio || "";
      document.getElementById("actorAltNames").value = (actor.altNames || []).join(", ");
      if (typeof updateActorPreview === 'function') updateActorPreview();
    }
  } else {
    modalTitle.textContent = "Thêm Mới Người Năng Khiếu";
    idInput.value = "";
    roleInput.value = "actor";
  }

  window.pendingUploads = {};
  openModal("actorModal");
}

function editActor(actorId) {
  openActorModal(actorId);
}

/**
 * Tạo ID thân thiện từ tên (Tương tự slug)
 */
function createActorIdFromName(name) {
  return name.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/([^0-9a-z-\s])/g, '')
    .replace(/(\s+)/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Cập nhật ảnh Preview khi gõ tên hoặc dán link ảnh
 */
window.updateActorPreview = function() {
  const nameInput = document.getElementById("actorName");
  const avatarInput = document.getElementById("actorAvatar");
  const previewImg = document.getElementById("actorAvatarPreview");
  
  if (!previewImg) return;

  const defaultName = nameInput && nameInput.value.trim() ? encodeURIComponent(nameInput.value.trim()) : "Actor";
  const defaultAvatar = `https://ui-avatars.com/api/?name=${defaultName}&background=random&color=fff&size=120`;
  
  const customAvatar = avatarInput && avatarInput.value.trim() ? avatarInput.value.trim() : "";
  
  previewImg.src = customAvatar || defaultAvatar;
}

/**
 * Bật/tắt khung Import diễn viên từ API
 */
window.toggleActorApiImport = function() {
    const oBox = document.getElementById("actorApiImportBox");
    const rBox = document.getElementById("rapActorApiImportBox");
    const display = (oBox && oBox.style.display === "none") ? "block" : "none";
    
    if (oBox) oBox.style.display = display;
    if (rBox) rBox.style.display = display;
}

/**
 * Quét và import diễn viên từ OPhim peoples API
 */
window.fetchActorsFromAPI = async function() {
    const slugInput = document.getElementById("actorApiSlugInput");
    const resultsDiv = document.getElementById("actorApiImportResults");
    let slug = (slugInput ? slugInput.value.trim() : "");
    
    if (!slug) {
        showNotification("Vui lòng nhập slug phim!", "error");
        return;
    }
    
    // Hỗ trợ dán cả URL đầy đủ, tự bóc slug
    const urlMatch = slug.match(/phim\/([^\/\?]+)/);
    if (urlMatch) slug = urlMatch[1];
    
    const API_URL = `https://ophim1.com/v1/api/phim/${slug}/peoples`;
    
    try {
        showLoading(true, "Đang quét danh sách diễn viên & đạo diễn từ OPhim...");
        
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error(`Mã lỗi: ${response.status}`);
        
        const result = await response.json();
        if (!result.success || !result.data || !result.data.peoples) {
            throw new Error("API không trả về dữ liệu diễn viên!");
        }
        
        const peoples = result.data.peoples;
        const profileSizes = result.data.profile_sizes || {};
        const imgBase = profileSizes.w185 || "https://image.tmdb.org/t/p/w185";
        
        let imported = 0;
        let skipped = 0;
        let updatesAvailable = [];
        let importedNames = [];
        let newActorIds = []; // Mảng tạm lưu ID mới của đợt này
        
        for (const person of peoples) {
            // Chỉ lấy Acting và Directing
            if (person.known_for_department !== "Acting" && person.known_for_department !== "Directing") continue;
            
            // Tên chính: ưu tiên tên tiếng Anh trong also_known_as, nếu không thì dùng name
            const allNames = person.also_known_as || [];
            const englishName = allNames.find(n => /^[A-Za-z\s\-\.]+$/.test(n.trim()));
            const displayName = englishName ? englishName.trim() : person.name.trim();
            
            // Chuẩn bị dữ liệu từ API để so sánh
            const avatarUrl = person.profile_path ? `${imgBase}${person.profile_path}` : "";
            const gender = person.gender_name === "Male" ? "Nam" : (person.gender_name === "Female" ? "Nữ" : "");
            const altNamesSet = new Set(allNames.map(n => n.trim()).filter(n => n));
            altNamesSet.add(person.name.trim());
            altNamesSet.delete(displayName);

            const incomingData = {
                name: displayName,
                avatar: avatarUrl,
                gender: gender,
                altNames: Array.from(altNamesSet),
                bio: "", 
                dob: "",
                country: ""
            };

            // Kiểm tra trùng lặp
            const allSearchNames = [person.name.trim(), ...allNames.map(n => n.trim())].map(n => n.toLowerCase());
            const existingActor = (allActors || []).find(a => {
                if (allSearchNames.includes(a.name.toLowerCase())) return true;
                if (a.altNames && a.altNames.some(alt => allSearchNames.includes(alt.toLowerCase()))) return true;
                return false;
            });
            
            if (existingActor) {
                // KIỂM TRA XEM CÓ CẢI THIỆN DỮ LIỆU KHÔNG
                const improvements = checkActorDataImprovement(existingActor, incomingData);
                if (improvements) {
                    updatesAvailable.push({ current: existingActor, incoming: incomingData, improvements });
                } else {
                    skipped++;
                }
                continue;
            }
            
            // Tạo ID và lưu mới
            const baseId = createActorIdFromName(displayName);
            const newId = `${baseId}-${Date.now().toString().slice(-4)}`;
            const role = person.known_for_department === "Directing" ? "director" : "actor";
            
            const actorData = {
                id: newId,
                ...incomingData,
                role: role,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            await db.collection("actors").doc(newId).set(actorData);
            imported++;
            importedNames.push(displayName);
            // Fix sorting: Dùng Date thực tế cho local copy
            const localActor = { ...actorData, createdAt: new Date() };
            allActors.push(localActor); 
            newActorIds.push(newId); // Lưu ID mới
        }
        
        // Cập nhật danh sách ID mới nhất toàn cục
        if (newActorIds.length > 0) {
            window.setLatestActorIds(newActorIds, false); // Nạp từ API OPhim: reset batch mới
            const sortSelect = document.getElementById("adminSortActor");
            if (sortSelect) sortSelect.value = "newest";
        }
        
        // Reload lại kho diễn viên
        await loadActors();
        renderAdminActors();
        
        // Hiển thị kết quả
        let resultHtml = `
            <div style="background: var(--bg-tertiary); border-radius: 8px; padding: 12px; font-size: 0.9rem; border: 1px solid rgba(77,171,247,0.3);">
                <div style="color: #51cf66; font-weight: 600; margin-bottom: 5px;">✅ Đã thêm mới: ${imported}</div>
                ${imported > 0 ? `<div style="color: var(--text-muted); font-size: 0.8rem; margin-bottom: 10px;">(${importedNames.join(", ")})</div>` : ""}
                <div style="color: #aaa; margin-bottom: ${updatesAvailable.length > 0 ? '10px' : '0'};">⏭️ Đã bỏ qua (đã đầy đủ): ${skipped}</div>
                ${updatesAvailable.length > 0 ? `
                    <div style="border-top: 1px solid rgba(255,255,255,0.05); padding-top: 10px; margin-top: 5px;">
                        <div style="color: var(--accent-secondary); font-weight: 600; margin-bottom: 8px;">✨ Có ${updatesAvailable.length} diễn viên có thể bổ sung thông tin!</div>
                        <button class="btn btn-primary btn-sm" onclick='showImportComparison(${JSON.stringify(updatesAvailable).replace(/'/g, "&apos;")})' style="width: 100%; font-size: 0.8rem; padding: 6px;">
                            Xem & Duyệt bổ sung ngay
                        </button>
                    </div>
                ` : ""}
            </div>
        `;
        
        if (resultsDiv) resultsDiv.innerHTML = resultHtml;
        showNotification(`Đã quét xong! Thêm mới: ${imported}, Chờ duyệt bổ sung: ${updatesAvailable.length}`, "success");
        
    } catch (err) {
        console.error("Lỗi fetch actors:", err);
        showNotification("Lỗi khi quét API: " + err.message, "error");
    } finally {
        showLoading(false);
    }
}

/**
 * Lưu thông tin diễn viên (Submit form)
 */
async function handleActorSubmit(event) {
  event.preventDefault();

  // Chờ tải ảnh lên Cloudinary nếu có (Deduplicate)
  if (typeof window.uploadPendingImages === "function") {
      const uploadSuccess = await window.uploadPendingImages();
      if (!uploadSuccess) return; 
  }

  const idInput = document.getElementById("actorId").value;
  const name = document.getElementById("actorName").value.trim();
  const avatar = document.getElementById("actorAvatar").value.trim();
  const role = document.getElementById("actorRole").value;
  const gender = document.getElementById("actorGender").value;
  const dob = document.getElementById("actorDob").value;
  const bio = document.getElementById("actorBio").value.trim();

  if (!name) {
    showNotification("Vui lòng nhập tên!", "warning");
    return;
  }

  // Kiểm tra trùng lặp khi THÊM MỚI (chưa có idInput)
  if (!idInput) {
    const duplicate = (allActors || []).find(a => a.name.toLowerCase() === name.toLowerCase());
    if (duplicate) {
        showNotification(`Diễn viên "${name}" đã tồn tại! Hệ thống đã chuyển sang chế độ chỉnh sửa.`, "warning");
        selectDuplicateActor(duplicate.id);
        return;
    }
  }

  // Thu thập tên gọi khác
  const altNamesRaw = document.getElementById("actorAltNames").value.trim();
  const altNames = altNamesRaw ? altNamesRaw.split(",").map(n => n.trim()).filter(n => n) : [];

  const actorData = {
    name,
    avatar,
    role,
    gender,
    dob,
    country: document.getElementById("actorCountry").value.trim(),
    bio,
    altNames,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  try {
    showLoading(true, "Đang lưu diễn viên...");

    if (idInput) {
      // Cập nhật
      await db.collection("actors").doc(idInput).update(actorData);
    } else {
      // Thêm mới
      const baseId = createActorIdFromName(name);
      // Tạo id độc nhất để tránh trùng admin
      const newId = `${baseId}-${Date.now().toString().slice(-4)}`;
      
      actorData.id = newId;
      actorData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      
      await db.collection("actors").doc(newId).set(actorData);
      
      // Đánh dấu đây là ID mới nhất vừa thêm (Reset batch mới khi thêm thủ công)
      window.setLatestActorIds(newId, false);
      
      // Tự động chuyển bộ lọc về "Mới nhất" để Admin thấy ngay người vừa thêm
      const sortSelect = document.getElementById("adminSortActor");
      if (sortSelect) sortSelect.value = "newest";
    }

    showNotification("Đã lưu thông tin!", "success");
    closeModal("actorModal");

    await loadActors();
    renderAdminActors();
    
    // Auto sync with actors UI if available
    if (typeof renderActorsPage === 'function' && document.getElementById("actorsGrid")) {
       renderActorsPage();
    }
  } catch (error) {
    console.error("Lỗi lưu actor:", error);
    showNotification("Lỗi: " + error.message, "error");
  } finally {
    showLoading(false);
  }
}

/**
 * XỬ LÝ GỢI Ý QUỐC GIA THÔNG MINH (SMART COUNTRY SUGGESTIONS)
 */
let currentSuggestionIndex = -1;

function handleCountryInput(query) {
    const suggestionsDiv = document.getElementById("actorCountrySuggestions");
    if (!suggestionsDiv) return;

    query = query.trim().toLowerCase();
    
    if (!query) {
        suggestionsDiv.innerHTML = "";
        suggestionsDiv.style.display = "none";
        return;
    }

    // Lọc từ mảng allCountries (đã có sẵn trong hệ thống)
    const filtered = allCountries.filter(c => 
        (c.name && c.name.toLowerCase().includes(query)) || 
        (c.id && c.id.toLowerCase().includes(query))
    );

    if (filtered.length === 0) {
        suggestionsDiv.innerHTML = "";
        suggestionsDiv.style.display = "none";
        return;
    }

    currentSuggestionIndex = -1;
    suggestionsDiv.innerHTML = filtered.map((c, index) => `
        <div class="suggestion-item" onclick="selectCountrySuggestion('${c.name}')" data-index="${index}">
            <i class="fas fa-globe-asia" style="margin-right: 8px; opacity: 0.6;"></i>
            <span>${c.name}</span>
        </div>
    `).join("");
    
    suggestionsDiv.style.display = "block";
}

function handleCountryKeydown(event) {
    const suggestionsDiv = document.getElementById("actorCountrySuggestions");
    if (!suggestionsDiv || suggestionsDiv.style.display === "none") return;

    const items = suggestionsDiv.querySelectorAll(".suggestion-item");
    
    if (event.key === "ArrowDown") {
        event.preventDefault();
        currentSuggestionIndex = (currentSuggestionIndex + 1) % items.length;
        updateSuggestionFocus(items);
    } else if (event.key === "ArrowUp") {
        event.preventDefault();
        currentSuggestionIndex = (currentSuggestionIndex - 1 + items.length) % items.length;
        updateSuggestionFocus(items);
    } else if (event.key === "Enter") {
        if (currentSuggestionIndex >= 0) {
            event.preventDefault();
            const selectedName = items[currentSuggestionIndex].querySelector("span").textContent;
            selectCountrySuggestion(selectedName);
        }
    } else if (event.key === "Escape") {
        suggestionsDiv.style.display = "none";
    }
}

function updateSuggestionFocus(items) {
    items.forEach((item, index) => {
        if (index === currentSuggestionIndex) {
            item.classList.add("active");
            item.scrollIntoView({ block: "nearest" });
        } else {
            item.classList.remove("active");
        }
    });
}

function selectCountrySuggestion(name) {
    const input = document.getElementById("actorCountry");
    const suggestionsDiv = document.getElementById("actorCountrySuggestions");
    
    if (input) {
        input.value = name;
        // Trigger potential validation or other logic
        input.dispatchEvent(new Event('change'));
    }
    
    if (suggestionsDiv) {
        suggestionsDiv.style.display = "none";
    }
}

// Click ra ngoài để ẩn gợi ý
document.addEventListener("click", function(e) {
    const suggestionsDiv = document.getElementById("actorCountrySuggestions");
    const input = document.getElementById("actorCountry");
    
    if (suggestionsDiv && input && !suggestionsDiv.contains(e.target) && e.target !== input) {
        suggestionsDiv.style.display = "none";
    }
});

/**
 * LOGIC HÀNH ĐỘNG HÀNG LOẠT (BULK ACTIONS)
 */

window.toggleActorSelection = function(actorId, isChecked) {
    if (isChecked) {
        if (!selectedActorIds.includes(actorId)) {
            selectedActorIds.push(actorId);
        }
    } else {
        selectedActorIds = selectedActorIds.filter(id => id !== actorId);
    }
    updateBulkActionsBar();
}

window.toggleSelectAllActors = function(isChecked) {
    const checkboxes = document.querySelectorAll(".actor-checkbox");
    selectedActorIds = [];
    
    checkboxes.forEach(cb => {
        cb.checked = isChecked;
        if (isChecked) {
            selectedActorIds.push(cb.value);
        }
    });
    
    updateBulkActionsBar();
}

window.clearActorSelection = function() {
    selectedActorIds = [];
    const selectAllCb = document.getElementById("selectAllActors");
    if (selectAllCb) selectAllCb.checked = false;
    
    const checkboxes = document.querySelectorAll(".actor-checkbox");
    checkboxes.forEach(cb => cb.checked = false);
    
    updateBulkActionsBar();
}

function updateBulkActionsBar() {
    const bar = document.getElementById("actorBulkActionsBar");
    const countSpan = document.getElementById("selectedActorsCount");
    
    if (selectedActorIds.length > 0) {
        bar.classList.add("active");
        countSpan.textContent = selectedActorIds.length;
    } else {
        bar.classList.remove("active");
    }
}

window.deleteSelectedActors = async function() {
    if (selectedActorIds.length === 0) return;
    
    const confirm = await customConfirm(`Bạn có chắc chắn muốn xóa ${selectedActorIds.length} diễn viên đã chọn không?`, {
        title: "Xóa hàng loạt",
        type: "danger",
        confirmText: "Xóa ngay"
    });
    if (!confirm) return;
    
    try {
        showLoading(true, `Đang xóa ${selectedActorIds.length} diễn viên...`);
        
        const batch = db.batch();
        selectedActorIds.forEach(id => {
            batch.delete(db.collection("actors").doc(id));
        });
        
        await batch.commit();
        
        showNotification(`Đã xóa thành công ${selectedActorIds.length} diễn viên!`, "success");
        
        selectedActorIds = [];
        updateBulkActionsBar();
        await loadActors();
        renderAdminActors();
        
    } catch (error) {
        console.error("Lỗi xóa hàng loạt:", error);
        showNotification("Lỗi khi xóa hàng loạt: " + error.message, "error");
    } finally {
        showLoading(false);
    }
}

window.openBulkUpdateModal = function(field) {
    if (!selectedActorIds || selectedActorIds.length === 0) {
        showNotification("Vui lòng chọn ít nhất một diễn viên!", "warning");
        return;
    }
    
    const modal = document.getElementById("bulkUpdateActorModal");
    const title = document.getElementById("bulkUpdateModalTitle");
    const fieldInput = document.getElementById("bulkUpdateField");
    const countLabel = document.getElementById("bulkUpdateCount");
    
    if (!modal || !fieldInput) {
        console.error("Không tìm thấy modal hoặc input trường cập nhật hàng loạt!");
        return;
    }

    fieldInput.value = field;
    if (countLabel) countLabel.textContent = selectedActorIds.length;
    
    // Reset fields
    const genderField = document.getElementById("bulkGenderField");
    const countryField = document.getElementById("bulkCountryField");
    
    if (genderField) genderField.classList.add("hidden");
    if (countryField) countryField.classList.add("hidden");
    
    if (field === 'gender') {
        if (title) title.textContent = "Cập nhật giới tính hàng loạt";
        if (genderField) genderField.classList.remove("hidden");
    } else if (field === 'country') {
        if (title) title.textContent = "Cập nhật Nơi sống hàng loạt";
        if (countryField) countryField.classList.remove("hidden");
        const countryInput = document.getElementById("bulkActorCountry");
        if (countryInput) countryInput.value = "";
    }
    
    openModal("bulkUpdateActorModal");
}

window.handleBulkUpdateSubmit = async function(e) {
    if (e) e.preventDefault();
    const field = document.getElementById("bulkUpdateField").value;
    let newValue = "";
    
    if (field === 'gender') {
        newValue = document.getElementById("bulkActorGender").value;
    } else if (field === 'country') {
        newValue = document.getElementById("bulkActorCountry").value.trim();
    }
    
    if (field === 'country' && !newValue) {
        showNotification("Vui lòng nhập nơi sống mới!", "warning");
        return;
    }
    
    const confirm = await customConfirm(`Cập nhật ${field === 'gender' ? 'giới tính' : 'nơi sống'} cho ${selectedActorIds.length} diễn viên?`, {
        title: "Xác nhận cập nhật",
        type: "info"
    });
    if (!confirm) return;
    
    try {
        showLoading(true, "Đang cập nhật hàng loạt...");
        
        const batch = db.batch();
        const updateData = {};
        updateData[field] = newValue;
        updateData.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
        
        selectedActorIds.forEach(id => {
            batch.update(db.collection("actors").doc(id), updateData);
        });
        
        await batch.commit();
        
        showNotification("Cập nhật hàng loạt thành công!", "success");
        closeModal("bulkUpdateActorModal");
        
        selectedActorIds = [];
        updateBulkActionsBar();
        await loadActors();
        renderAdminActors();
        
    } catch (error) {
        console.error("Lỗi cập nhật hàng loạt:", error);
        showNotification("Lỗi khi cập nhật: " + error.message, "error");
    } finally {
        showLoading(false);
    }
}

window.handleBulkCountryInput = function(query) {
    const suggestionsDiv = document.getElementById("bulkActorCountrySuggestions");
    if (!suggestionsDiv) return;

    query = query.trim().toLowerCase();
    
    if (!query) {
        suggestionsDiv.innerHTML = "";
        suggestionsDiv.style.display = "none";
        return;
    }

    const filtered = allCountries.filter(c => 
        (c.name && c.name.toLowerCase().includes(query)) || 
        (c.id && c.id.toLowerCase().includes(query))
    );

    if (filtered.length === 0) {
        suggestionsDiv.innerHTML = "";
        suggestionsDiv.style.display = "none";
        return;
    }

    suggestionsDiv.innerHTML = filtered.map(c => `
        <div class="suggestion-item" onclick="selectBulkCountrySuggestion('${c.name}')">
            <i class="fas fa-globe-asia" style="margin-right: 8px; opacity: 0.6;"></i>
            <span>${c.name}</span>
        </div>
    `).join("");
    
    suggestionsDiv.style.display = "block";
}

window.selectBulkCountrySuggestion = function(name) {
    document.getElementById("bulkActorCountry").value = name;
    document.getElementById("bulkActorCountrySuggestions").style.display = "none";
}

/**
 * Xóa diễn viên
 */
async function deleteActor(actorId) {
  if (!await customConfirm("Chắc chắn xóa diễn viên này?", { title: "Xóa diễn viên", type: "danger", confirmText: "Xóa" })) return;

  try {
    showLoading(true, "Đang xóa...");
    await db.collection("actors").doc(actorId).delete();
    showNotification("Đã xóa diễn viên!", "success");
    await loadActors();
    renderAdminActors();
  } catch (error) {
    console.error("Lỗi xóa actor:", error);
    showNotification("Lỗi xóa diễn viên!", "error");
  } finally {
    showLoading(false);
  }
}

/**
 * Load danh sách bình luận (Đã sửa lỗi ID để xóa được ngay)
 */
async function loadAdminComments() {
  const tbody = document.getElementById("adminCommentsTable");
  if (!tbody || !db) return;

  if (!db) return;

  try {
    const snapshot = await db
      .collection("comments")
      .orderBy("createdAt", "desc")
      .get();
    
    // Lưu vào biến toàn cục
    allAdminComments = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    // Render toàn bộ
    renderAdminCommentsList(allAdminComments);

  } catch (error) {
    console.error(error);
  }
}

/**
 * Hàm lọc comment theo nội dung và đánh giá
 */
function filterAdminComments() {
  const searchText = document.getElementById("adminSearchComments").value.toLowerCase().trim();
  const ratingFilter = document.getElementById("adminFilterCommentRating").value;

  const filtered = allAdminComments.filter(comment => {
    // Resolve tên phim chuẩn từ ID (giống logic render)
    let movieName = comment.movieTitle || "";
    if (comment.movieId && typeof allMovies !== 'undefined') {
        const foundMovie = allMovies.find(m => m.id === comment.movieId);
        if (foundMovie) movieName = foundMovie.title;
    }

    const matchContent = (comment.content || "").toLowerCase().includes(searchText);
    const matchUser = (comment.userName || "").toLowerCase().includes(searchText);
    const matchMovie = (movieName || "").toLowerCase().includes(searchText);
    
    const matchRating = ratingFilter ? parseInt(comment.rating) === parseInt(ratingFilter) : true;

    return (matchContent || matchUser || matchMovie) && matchRating;
  });

  renderAdminCommentsList(filtered);
}

/**
 * Render danh sách comment (UI)
 */
function renderAdminCommentsList(comments) {
  const tbody = document.getElementById("adminCommentsTable");
  if (!tbody) return;

  if (comments.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center">Không tìm thấy bình luận nào</td></tr>`;
    return;
  }

  tbody.innerHTML = comments
    .map((comment) => {
      const date = comment.createdAt?.toDate
        ? formatDate(comment.createdAt.toDate())
        : "N/A";
      
      // FIX: Tìm tên phim từ allMovies nếu comment không có sẵn movieTitle
      let movieDisplay = comment.movieTitle || "N/A";
      if (comment.movieId && typeof allMovies !== 'undefined') {
          const foundMovie = allMovies.find(m => m.id === comment.movieId);
          if (foundMovie) {
              movieDisplay = foundMovie.title;
          }
      }

      const ratingStars = Array(5)
        .fill(0)
        .map(
          (_, i) =>
            `<i class="fas fa-star ${i < comment.rating ? "text-warning" : "text-muted"}"></i>`,
        )
        .join("");

      // Avatar User (Giả lập from name)
      const initial = (comment.userName || "U")[0].toUpperCase();
      const avatarHtml = comment.userAvatar
        ? `<img src="${comment.userAvatar}" class="comment-avatar-small" style="width:30px;height:30px;border-radius:50%">`
        : `<div class="comment-avatar-small" style="width:30px;height:30px;background:#E50914;color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;">${initial}</div>`;

      return `
          <tr>
              <td>
                  <div style="display:flex;align-items:center;gap:10px;">
                      ${avatarHtml}
                      <span>${comment.userName || "Ẩn danh"}</span>
                  </div>
              </td>
              <td>${movieDisplay}</td>
              <td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${comment.content}">${comment.content}</td>
              <td style="color:#ffaa00; font-size:12px;">⭐ ${comment.rating}</td>
              <td>${date}</td>
              <td>
                  <button class="btn btn-sm btn-danger" onclick="deleteComment('${comment.id}')">
                      <i class="fas fa-trash"></i>
                  </button>
              </td>
          </tr>
      `;
    })
    .join("");
}
/**
 * Xóa bình luận Admin (Xóa dòng ngay lập tức)
 */
async function deleteAdminComment(commentId) {
  if (!await customConfirm("Bạn có chắc muốn xóa bình luận này vĩnh viễn?", { title: "Xóa bình luận", type: "danger", confirmText: "Xóa" })) return;

  try {
    showLoading(true, "Đang xóa...");

    // 1. Xóa trong Database
    await db.collection("comments").doc(commentId).delete();

    // 2. Xóa dòng đó trên giao diện NGAY LẬP TỨC
    const row = document.getElementById(`row-comment-${commentId}`);
    if (row) {
      // Hiệu ứng mờ dần cho đẹp
      row.style.transition = "all 0.5s ease";
      row.style.opacity = "0";
      row.style.backgroundColor = "#ffcccc"; // Nháy đỏ nhẹ

      // Đợi 0.5s rồi xóa hẳn khỏi HTML
      setTimeout(() => row.remove(), 500);
    }

    showNotification("Đã xóa bình luận!", "success");
  } catch (error) {
    console.error("Lỗi xóa comment:", error);
    showNotification("Lỗi xóa!", "error");
  } finally {
    showLoading(false);
  }
}
/**
 * Load lịch sử giao dịch (Đã cập nhật hiện giờ chi tiết)
 */
async function loadAdminTransactions() {
  const tbody = document.getElementById("adminTransactionsTable");
  if (!tbody) return;

  if (!db) return;

  try {
    tbody.innerHTML =
      '<tr><td colspan="6" class="text-center">Đang tải...</td></tr>';

    const snapshot = await db
      .collection("transactions")
      .orderBy("createdAt", "desc")
      .limit(20)
      .get();

    if (snapshot.empty) {
      tbody.innerHTML =
        '<tr><td colspan="6" class="text-center">Chưa có giao dịch nào</td></tr>';
      return;
    }

    tbody.innerHTML = snapshot.docs
      .map((doc) => {
        const tx = doc.data();

        // 👇 SỬA DÒNG NÀY: Dùng formatDateTime thay vì formatDate
        const date = tx.createdAt ? formatDateTime(tx.createdAt) : "N/A";

        // Format trạng thái màu sắc
        let statusBadge = "";
        if (tx.status === "completed")
          statusBadge = '<span class="status-badge active">Thành công</span>';
        else if (tx.status === "pending")
          statusBadge = '<span class="status-badge warning">Đang chờ</span>';
        else
          statusBadge = `<span class="status-badge blocked">${tx.status}</span>`;

        return `
            <tr>
                <td>
                    <a href="https://cronoscan.com/tx/${tx.txHash}" target="_blank" style="color:var(--accent-primary); text-decoration:none;">
                        ${tx.txHash ? tx.txHash.substring(0, 10) + "..." : "N/A"} <i class="fas fa-external-link-alt" style="font-size:10px;"></i>
                    </a>
                </td>
                <td title="${tx.userId}">${tx.userId ? tx.userId.substring(0, 8) + "..." : "N/A"}</td>
                <td><span style="font-weight:bold; color:#fff;">${tx.package || "VIP"}</span></td>
                <td style="color:#00ff88; font-weight:bold;">${formatNumber(tx.amount || 0)} CRO</td>
                <td>${statusBadge}</td>
                
                <td style="font-size: 13px;">${date}</td>
            </tr>
        `;
      })
      .join("");
  } catch (error) {
    console.error("Lỗi load transactions:", error);
    tbody.innerHTML =
      '<tr><td colspan="6" class="text-center text-danger">Lỗi tải dữ liệu</td></tr>';
  }
}

/**
 * Cập nhật ảnh xem trước khi dán link online
 */
window.updateImagePreview = function(url, previewId) {
    const previewContainer = document.getElementById(previewId);
    if (!previewContainer) return;

    // Nếu người dùng xóa trống input, ẩn ảnh đi
    if (!url || url.trim() === "") {
        previewContainer.style.display = "none";
        const img = previewContainer.querySelector('img');
        if (img) img.src = "";
        return;
    }

    // Nếu là file chọn từ máy (đang chờ), preview đã được set qua uploadMovieImage()
    if (url.startsWith("[File chờ tải lên]")) return;

    // Nếu là link ảnh online, hiển thị luôn
    const img = previewContainer.querySelector('img');
    if (img) {
        img.src = url;
        previewContainer.style.display = "block";
    }
}

/**
 * Tải ảnh lên Cloudinary và cập nhật URL vào input tương ứng
 * @param {HTMLInputElement} input - Input file vừa chọn
 * @param {string} targetUrlId - ID của ô input nhận URL ảnh
 * @param {string} previewId - ID của vùng chứa ảnh xem trước
 */
window.pendingUploads = window.pendingUploads || {};

window.uploadMovieImage = async function(input, targetUrlId, previewId) {
  const file = input.files[0];
  if (!file) return;

  // 1. Kiểm tra định dạng
  if (!file.type.startsWith('image/')) {
    showNotification("Vui lòng chọn file hình ảnh!", "error");
    return;
  }

  // 2. Hiển thị Preview cục bộ ngay lập tức
  const previewContainer = document.getElementById(previewId);
  if (previewContainer) {
    const previewImg = previewContainer.querySelector('img');
    const reader = new FileReader();
    reader.onload = (e) => {
      previewImg.src = e.target.result;
      previewContainer.style.display = "block";
    };
    reader.readAsDataURL(file);
  }

  // 3. Lưu vào pendingUploads và hiển thị trạng thái chờ
  window.pendingUploads[targetUrlId] = file;
  
  const targetInput = document.getElementById(targetUrlId);
  if (targetInput) {
    targetInput.value = `[File chờ tải lên] ${file.name}`;
    targetInput.type = "text"; // Bỏ qua validate URL tạm thời
    
    // Nếu user sửa tay URL, tự động xoá ảnh khỏi hàng đợi
    targetInput.oninput = () => {
        if (!targetInput.value.startsWith("[File chờ tải lên]")) {
            delete window.pendingUploads[targetUrlId];
            targetInput.oninput = null; // Xóa listener
        }
    };
  }

  input.value = ""; // Reset để có thể chọn lại cùng 1 file
}

/**
 * Tải các ảnh đang chờ lên Cloudinary, có kiểm tra trùng lặp để tiết kiệm request
 * @returns {Promise<boolean>} Trả về true nếu thành công tất cả
 */
window.uploadPendingImages = async function() {
  if (!window.pendingUploads || Object.keys(window.pendingUploads).length === 0) {
      return true; // Không có gì để tải
  }

  showLoading(true, "Đang tải ảnh và thông tin lên máy chủ...");

  const CLOUD_NAME = "drhr0h7dd";
  const UPLOAD_PRESET = "tramphim_preset";
  const API_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

  // Map file hash -> Cloudinary URL để tránh upload trùng nội dung
  const uploadedFilesMap = new Map();

  try {
      for (const [targetUrlId, file] of Object.entries(window.pendingUploads)) {
          // Tạo mã băm từ các thuộc tính của file
          const fileHash = `${file.name}_${file.size}_${file.lastModified}`;

          if (uploadedFilesMap.has(fileHash)) {
              // Đã upload file này trong đợt này, tái sử dụng URL
              const downloadURL = uploadedFilesMap.get(fileHash);
              const targetInput = document.getElementById(targetUrlId);
              if (targetInput) {
                  targetInput.value = downloadURL;
              }
              continue; // Bỏ qua đoạn code upload bên dưới
          }

          // Phân loại thư mục
          let targetFolder = "movie_assets";
          if (targetUrlId === 'actorAvatar') {
              targetFolder = "Dien_Vien";
          } else if (targetUrlId === 'moviePoster' || targetUrlId === 'movieBackground') {
              const typeSelect = document.getElementById("movieType");
              if (typeSelect && typeSelect.value === 'single') {
                  targetFolder = "Phim_Le";
              } else if (typeSelect && typeSelect.value === 'series') {
                  targetFolder = "Phim_Bo";
              }
          }

          const formData = new FormData();
          formData.append("file", file);
          formData.append("upload_preset", UPLOAD_PRESET);
          formData.append("folder", targetFolder);

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000);

          const response = await fetch(API_URL, {
              method: "POST",
              body: formData,
              signal: controller.signal
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error?.message || "Lỗi API Cloudinary");
          }

          const data = await response.json();
          const downloadURL = data.secure_url;

          // Lưu vào map để tái sử dụng
          uploadedFilesMap.set(fileHash, downloadURL);

          // Cập nhật lại input
          const targetInput = document.getElementById(targetUrlId);
          if (targetInput) {
              targetInput.value = downloadURL;
          }
      }

      // Xóa queue
      window.pendingUploads = {};
      return true;
  } catch (error) {
      console.error("Lỗi upload ảnh:", error);
      let msg = "Lỗi khi tải ảnh lên Cloudinary. Đã hủy lưu dữ liệu!";
      if (error.name === 'AbortError') {
          msg = "Quá thời gian tải lên (30s). Vui lòng kiểm tra mạng!";
      } else if (error.message.includes('preset')) {
          msg = "Lỗi Preset Cloudinary!";
      }
      showNotification(msg, "error");
      showLoading(false);
      return false;
  }
}

/* ============================================
   QUẢN LÝ THÔNG BÁO (ADMIN)
   ============================================ */

let allAdminNotifications = []; // Lưu mảng thông báo từ Firestore
let adminNotifUnsubscribe = null; // Listener realtime

/**
 * Load danh sách tất cả thông báo từ Firestore (Realtime)
 */
function loadAdminNotifications() {
    if (!db) return;

    // Hủy listener cũ nếu có
    if (adminNotifUnsubscribe) {
        adminNotifUnsubscribe();
    }

    // Lắng nghe realtime tất cả thông báo, sắp xếp mới nhất trước
    adminNotifUnsubscribe = db.collection("notifications")
        .orderBy("createdAt", "desc")
        .onSnapshot((snapshot) => {
            allAdminNotifications = [];
            snapshot.forEach(doc => {
                allAdminNotifications.push({ id: doc.id, ...doc.data() });
            });
            filterAdminNotifications(); // Render với bộ lọc hiện tại
        }, (error) => {
            console.error("Lỗi load admin notifications:", error);
        });
}

/**
 * Lọc và render danh sách thông báo
 */
function filterAdminNotifications() {
    const searchText = (document.getElementById("adminSearchNotif")?.value || "").toLowerCase().trim();
    const filterType = document.getElementById("adminFilterNotifType")?.value || "";

    let filtered = allAdminNotifications;

    // Lọc theo text
    if (searchText) {
        filtered = filtered.filter(n =>
            (n.title || "").toLowerCase().includes(searchText) ||
            (n.message || "").toLowerCase().includes(searchText)
        );
    }

    // Lọc theo loại
    if (filterType) {
        filtered = filtered.filter(n => n.type === filterType);
    }

    renderAdminNotifications(filtered);
}

// Mảng lưu danh sách thông báo đã gom nhóm để thao tác UI (Xóa, v.v.)
let currentGroupedNotifications = [];

/**
 * Render bảng thông báo
 */
function renderAdminNotifications(notifications) {
    const tbody = document.getElementById("adminNotificationsTable");
    if (!tbody) return;

    // Cập nhật thống kê
    const totalEl = document.getElementById("notifStatTotal");
    const unreadEl = document.getElementById("notifStatUnread");
    const readEl = document.getElementById("notifStatRead");
    const allTotal = allAdminNotifications.length;
    const allUnread = allAdminNotifications.filter(n => !n.isRead).length;
    if (totalEl) totalEl.textContent = allTotal;
    if (unreadEl) unreadEl.textContent = allUnread;
    if (readEl) readEl.textContent = allTotal - allUnread;

    // GOM NHÓM THÔNG BÁO GỬI HÀNG LOẠT
    let grouped = [];
    notifications.forEach(n => {
        let nTime = n.createdAt && n.createdAt.toDate ? n.createdAt.toDate().getTime() : 0;
        
        let foundGroup = grouped.find(g => {
            return g.type === n.type && 
                   g.title === n.title && 
                   g.message === n.message &&
                   (Math.abs(g.time - nTime) < 5 * 60 * 1000); // Các notif cách nhau tối đa 5 phút -> Cùng 1 lần gửi
        });

        if (foundGroup) {
            foundGroup.count += 1;
            foundGroup.readCount += n.isRead ? 1 : 0;
            if (n.isForAdmin) foundGroup.isForAdmin = true;
            foundGroup.ids.push(n.id);
        } else {
            grouped.push({
                id: n.id, // ID đại diện
                type: n.type,
                title: n.title,
                message: n.message,
                time: nTime,
                createdAt: n.createdAt,
                count: 1,
                readCount: n.isRead ? 1 : 0,
                isForAdmin: n.isForAdmin,
                userId: n.userId, // Cho trường hợp gửi cá nhân / hệ thống
                ids: [n.id]
            });
        }
    });

    currentGroupedNotifications = grouped; // Lưu ra biến global để dùng khi click

    if (grouped.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center" style="padding: 30px; color: var(--text-muted);">Không có thông báo nào</td></tr>';
        return;
    }

    // Map tên loại thông báo
    const typeMap = {
        system: { label: "🔔 Hệ thống", cls: "system" },
        new_movie: { label: "🎬 Phim mới", cls: "new_movie" },
        promotion: { label: "🎁 Khuyến mãi", cls: "promotion" },
        maintenance: { label: "🔧 Bảo trì", cls: "maintenance" },
        vip_request: { label: "⭐ VIP Request", cls: "vip_request" },
        vip_approved: { label: "✅ VIP Approved", cls: "vip_approved" }
    };

    tbody.innerHTML = grouped.map((g, index) => {
        // Loại thông báo
        const typeInfo = typeMap[g.type] || { label: g.type || "Khác", cls: "system" };

        // Người nhận
        let recipientHtml = "—";
        if (g.isForAdmin) {
            recipientHtml = '<span style="color: #ff6b6b;">Admin</span>';
        } else if (g.count > 1) {
            recipientHtml = `<span style="color: #4db8ff;">Tất cả Users (${g.count})</span>`;
        } else if (g.userId) {
            recipientHtml = `<span style="font-size: 0.8rem; color: var(--text-muted);" title="${g.userId}">User: ${g.userId.substring(0, 8)}...</span>`;
        }

        // Trạng thái đã đọc
        let statusHtml = "";
        if (g.count > 1) {
            statusHtml = `<span style="color: #51cf66; font-size: 0.85rem;">Đã đọc: ${g.readCount}/${g.count}</span>`;
        } else {
            statusHtml = g.readCount > 0
                ? '<span style="color: #51cf66; font-size: 0.85rem;">Đã đọc</span>'
                : '<span style="color: #ff6b6b; font-size: 0.85rem;">Chưa đọc</span>';
        }

        // Thời gian
        let timeStr = "—";
        if (g.createdAt && g.createdAt.toDate) {
            const date = g.createdAt.toDate();
            timeStr = date.toLocaleString('vi-VN', {
                hour: '2-digit', minute: '2-digit',
                day: '2-digit', month: '2-digit', year: 'numeric'
            });
        }

        return `
            <tr>
                <td><span class="notif-type-badge ${typeInfo.cls}">${typeInfo.label}</span></td>
                <td style="max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${(g.title || '').replace(/"/g, '&quot;')}">${g.title || '—'}</td>
                <td style="max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${(g.message || '').replace(/"/g, '&quot;')}">${g.message || '—'}</td>
                <td>${recipientHtml}</td>
                <td>${statusHtml}</td>
                <td style="white-space: nowrap; font-size: 0.85rem;">${timeStr}</td>
                <td>
                    ${g.isForAdmin ? '' : `
                    <button class="btn btn-sm btn-warning" onclick="adminRecallNotification('${g.id}', '${(g.title || '').replace(/'/g, "\\'")}', '${(g.type || '')}')" title="Thu hồi từ tất cả Users" style="margin-right: 4px;">
                        <i class="fas fa-undo"></i>
                    </button>
                    `}
                    <button class="btn btn-sm btn-danger" onclick="adminDeleteNotificationGroup(${index})" title="Xóa cá nhân (Ẩn khỏi bảng)">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join("");
}

/**
 * Admin gửi thông báo tùy chỉnh tới tất cả users
 */
async function adminSendNotifToAll() {
    const titleInput = document.getElementById("adminNotifTitle");
    const messageInput = document.getElementById("adminNotifMessage");
    const typeSelect = document.getElementById("adminNotifType");

    const title = titleInput?.value.trim();
    const message = messageInput?.value.trim();
    const type = typeSelect?.value || "system";

    if (!title) {
        showNotification("Vui lòng nhập tiêu đề thông báo!", "warning");
        return;
    }
    if (!message) {
        showNotification("Vui lòng nhập nội dung thông báo!", "warning");
        return;
    }

    if (!await customConfirm(`Bạn có chắc muốn gửi thông báo "${title}" tới TẤT CẢ người dùng?`, { title: "Gửi thông báo", type: "info", confirmText: "Gửi" })) {
        return;
    }

    try {
        showLoading(true, "Đang gửi thông báo...");
        await sendNotificationToAllUsers(title, message, type);
        showNotification("Đã gửi thông báo tới tất cả người dùng!", "success");

        // Reset form
        if (titleInput) titleInput.value = "";
        if (messageInput) messageInput.value = "";
        if (typeSelect) typeSelect.value = "system";
    } catch (err) {
        console.error("Lỗi gửi thông báo:", err);
        showNotification("Có lỗi xảy ra khi gửi thông báo!", "error");
    } finally {
        showLoading(false);
    }
}

/**
 * Admin xóa cá nhân một nhóm thông báo (Ẩn khỏi bảng của tài khoản Admin)
 */
async function adminDeleteNotificationGroup(groupIndex) {
    if (!db) return;

    const group = currentGroupedNotifications[groupIndex];
    if (!group || !group.ids || group.ids.length === 0) return;

    const count = group.ids.length;
    if (!await customConfirm(
        `Bạn có chắc muốn XÓA vĩnh viễn ${count} thông báo thuộc nhóm "${group.title}"?\n\nHành động này chỉ xóa thông báo ĐÃ LƯU TRONG LỊCH SỬ. Tuy nhiên do đây là thông báo gửi toàn hệ thống, nó sẽ xóa cả thông báo ở phía user do cùng chung ID database. Để thu hồi chính xác, vui lòng dùng nút Thu Hồi màu vàng!`, 
        { title: "Xóa Lịch Sử", type: "danger", confirmText: "Xóa" }
    )) {
        return;
    }

    try {
        showLoading(true, `Đang xóa ${count} thông báo...`);

        // Xóa theo batch
        let batch = db.batch();
        let deletedCount = 0;

        for (const notifId of group.ids) {
            batch.delete(db.collection("notifications").doc(notifId));
            deletedCount++;
            
            if (deletedCount % 499 === 0) {
                await batch.commit();
                batch = db.batch();
            }
        }
        await batch.commit();

        showNotification(`Đã xóa ${deletedCount} thông báo!`, "success");
        // Gọi loadAdminNotifications() để reload bảng sẽ tự động cập nhật
    } catch (err) {
        console.error("Lỗi xóa nhóm thông báo:", err);
        showNotification("Không thể xóa thông báo!", "error");
    } finally {
        showLoading(false);
    }
}

/**
 * Admin THU HỒI thông báo từ tất cả người dùng (dựa theo tiêu đề và loại)
 */
async function adminRecallNotification(notifId, title, type) {
    if (!db || !title) return;

    if (!await customConfirm(`Bạn có chắc muốn THU HỒI thông báo "${title}" từ TẤT CẢ người dùng? Hành động này sẽ xóa thông báo đó khỏi hộp thư của mọi user!`, { title: "Thu hồi thông báo", type: "warning", confirmText: "Thu hồi" })) {
        return;
    }

    try {
        showLoading(true, "Đang thu hồi thông báo...");

        // 1. Tìm tất cả các thông báo của user có cùng title và type (không phải của admin)
        const snapshot = await db.collection("notifications")
            .where("isForAdmin", "==", false)
            .where("title", "==", title)
            .where("type", "==", type)
            .get();

        if (snapshot.empty) {
            showNotification("Không tìm thấy thông báo nào ở phía user để thu hồi!", "info");
            return;
        }

        // 2. Xóa hàng loạt bằng batch write
        let batch = db.batch();
        let count = 0;

        snapshot.forEach(doc => {
            batch.delete(doc.ref);
            count++;
            if (count % 499 === 0) {
                batch.commit();
                batch = db.batch();
            }
        });

        await batch.commit();

        showNotification(`Đã thu hồi thành công ${count} thông báo từ người dùng!`, "success");
        
        // Load lại danh sách thông báo admin để UI update (vd nếu admin cũng bị xóa cái notif đó)
        if (typeof loadAdminNotifications === "function") {
            loadAdminNotifications();
        }
        
    } catch (err) {
        console.error("Lỗi thu hồi thông báo:", err);
        showNotification("Lỗi khi thu hồi thông báo!", "error");
    } finally {
        showLoading(false);
    }
}

/**
 * Admin xóa TẤT CẢ thông báo trong hệ thống
 */
async function adminDeleteAllNotifications() {
    if (!db || allAdminNotifications.length === 0) {
        showNotification("Không có thông báo nào để xóa!", "info");
        return;
    }

    if (!await customConfirm(`Bạn có chắc muốn xóa TẤT CẢ ${allAdminNotifications.length} thông báo? Hành động này không thể hoàn tác!`, { title: "Xóa tất cả thông báo", type: "danger", confirmText: "Xóa tất cả" })) {
        return;
    }

    try {
        showLoading(true, "Đang xóa thông báo...");

        // Xóa theo batch (max 500/batch)
        let batch = db.batch();
        let count = 0;

        for (const notif of allAdminNotifications) {
            batch.delete(db.collection("notifications").doc(notif.id));
            count++;
            if (count % 499 === 0) {
                await batch.commit();
                batch = db.batch();
            }
        }
        await batch.commit();

        showNotification(`Đã xóa ${count} thông báo!`, "success");
    } catch (err) {
        console.error("Lỗi xóa tất cả thông báo:", err);
        showNotification("Có lỗi xảy ra khi xóa!", "error");
    } finally {
        showLoading(false);
    }
}

/* ============================================
   LẬP LỊCH GỬI THÔNG BÁO TỰ ĐỘNG
   ============================================ */

let allScheduledNotifs = []; // Danh sách lịch hẹn
let scheduledNotifUnsubscribe = null; // Listener realtime


/**
 * Load danh sách lịch hẹn từ Firestore (Realtime)
 */
function loadScheduledNotifications() {
    if (!db) return;

    if (scheduledNotifUnsubscribe) {
        scheduledNotifUnsubscribe();
    }

    scheduledNotifUnsubscribe = db.collection("scheduled_notifications")
        .orderBy("scheduledAt", "asc")
        .onSnapshot((snapshot) => {
            allScheduledNotifs = [];
            snapshot.forEach(doc => {
                allScheduledNotifs.push({ id: doc.id, ...doc.data() });
            });
            renderScheduledNotifications();
        }, (error) => {
            console.error("Lỗi load scheduled notifications:", error);
        });

}

/**
 * Render bảng lịch hẹn
 */
function renderScheduledNotifications() {
    const tbody = document.getElementById("adminScheduledTable");
    if (!tbody) return;

    const statTotal = document.getElementById("schedStatTotal");
    if (statTotal) statTotal.textContent = allScheduledNotifs.length;

    // Map loại thông báo
    const typeMap = {
        system: { label: "🔔 Hệ thống", cls: "system" },
        new_movie: { label: "🎬 Phim mới", cls: "new_movie" },
        promotion: { label: "🎁 Khuyến mãi", cls: "promotion" },
        maintenance: { label: "🔧 Bảo trì", cls: "maintenance" }
    };

    // Map lặp lại
    const repeatMap = {
        once: "Một lần",
        daily: "Hàng ngày",
        weekly: "Hàng tuần",
        monthly: "Hàng tháng"
    };

    if (allScheduledNotifs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center" style="padding: 20px; color: var(--text-muted);">Chưa có lịch hẹn nào</td></tr>';
        return;
    }

    const now = new Date();

    tbody.innerHTML = allScheduledNotifs.map(s => {
        const typeInfo = typeMap[s.type] || { label: s.type || "Khác", cls: "system" };
        const repeatLabel = repeatMap[s.repeat] || s.repeat || "Một lần";

        // Thời gian gửi
        let timeStr = "—";
        let scheduledDate = null;
        if (s.scheduledAt && s.scheduledAt.toDate) {
            scheduledDate = s.scheduledAt.toDate();
            timeStr = scheduledDate.toLocaleString('vi-VN', {
                hour: '2-digit', minute: '2-digit',
                day: '2-digit', month: '2-digit', year: 'numeric'
            });
        }

        // Trạng thái
        let statusHtml = '';
        if (s.status === "paused") {
            statusHtml = '<span class="sched-status paused"><i class="fas fa-pause"></i> Tạm dừng</span>';
        } else if (s.status === "sent" && s.repeat === "once") {
            statusHtml = '<span class="sched-status sent"><i class="fas fa-check"></i> Đã gửi</span>';
        } else if (scheduledDate && scheduledDate > now) {
            statusHtml = '<span class="sched-status pending"><i class="fas fa-clock"></i> Đang chờ</span>';
        } else {
            statusHtml = '<span class="sched-status pending"><i class="fas fa-sync"></i> Hoạt động</span>';
        }

        // Nút thao tác
        const isPaused = s.status === "paused";
        const toggleIcon = isPaused ? "fa-play" : "fa-pause";
        const toggleTitle = isPaused ? "Kích hoạt" : "Tạm dừng";
        const toggleColor = isPaused ? "btn-success" : "btn-secondary";

        return `
            <tr>
                <td><span class="notif-type-badge ${typeInfo.cls}">${typeInfo.label}</span></td>
                <td style="max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${(s.title || '').replace(/"/g, '&quot;')}">${s.title || '—'}</td>
                <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${(s.message || '').replace(/"/g, '&quot;')}">${s.message || '—'}</td>
                <td style="white-space: nowrap; font-size: 0.85rem;">${timeStr}</td>
                <td><span style="font-size: 0.85rem;">${repeatLabel}</span></td>
                <td>${statusHtml}</td>
                <td style="white-space: nowrap;">
                    <button class="btn btn-sm ${toggleColor}" onclick="adminToggleScheduled('${s.id}')" title="${toggleTitle}" style="margin-right: 4px;">
                        <i class="fas ${toggleIcon}"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="adminDeleteScheduled('${s.id}')" title="Xóa">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join("");
}

/**
 * Tạo lịch hẹn thông báo mới
 */
async function adminCreateScheduledNotif() {
    const title = document.getElementById("schedNotifTitle")?.value.trim();
    const message = document.getElementById("schedNotifMessage")?.value.trim();
    const type = document.getElementById("schedNotifType")?.value || "system";
    const dateStr = document.getElementById("schedNotifDate")?.value;
    const timeStr = document.getElementById("schedNotifTime")?.value;
    const repeat = document.getElementById("schedNotifRepeat")?.value || "once";

    if (!title) {
        showNotification("Vui lòng nhập tiêu đề!", "warning");
        return;
    }
    if (!message) {
        showNotification("Vui lòng nhập nội dung!", "warning");
        return;
    }
    if (!dateStr || !timeStr) {
        showNotification("Vui lòng chọn ngày và giờ gửi!", "warning");
        return;
    }

    // Parse ngày giờ
    const scheduledDate = new Date(`${dateStr}T${timeStr}:00`);
    const now = new Date();

    if (scheduledDate <= now && repeat === "once") {
        showNotification("Thời gian gửi phải ở tương lai!", "warning");
        return;
    }

    try {
        showLoading(true, "Đang tạo lịch hẹn...");

        await db.collection("scheduled_notifications").add({
            title: title,
            message: message,
            type: type,
            scheduledAt: firebase.firestore.Timestamp.fromDate(scheduledDate),
            repeat: repeat,
            status: "pending", // pending | sent | paused
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            lastSentAt: null
        });

        showNotification("Đã tạo lịch hẹn thành công!", "success");

        // Reset form
        document.getElementById("schedNotifTitle").value = "";
        document.getElementById("schedNotifMessage").value = "";
        document.getElementById("schedNotifType").value = "system";
        document.getElementById("schedNotifDate").value = "";
        document.getElementById("schedNotifTime").value = "";
        document.getElementById("schedNotifRepeat").value = "once";
    } catch (err) {
        console.error("Lỗi tạo lịch hẹn:", err);
        showNotification("Không thể tạo lịch hẹn!", "error");
    } finally {
        showLoading(false);
    }
}

/**
 * Tạm dừng / Kích hoạt lịch hẹn
 */
async function adminToggleScheduled(schedId) {
    if (!db || !schedId) return;
    try {
        const doc = await db.collection("scheduled_notifications").doc(schedId).get();
        if (!doc.exists) return;

        const current = doc.data().status;
        const newStatus = (current === "paused") ? "pending" : "paused";

        await db.collection("scheduled_notifications").doc(schedId).update({
            status: newStatus
        });

        showNotification(newStatus === "paused" ? "Đã tạm dừng lịch hẹn" : "Đã kích hoạt lại lịch hẹn", "success");
    } catch (err) {
        console.error("Lỗi toggle scheduled:", err);
    }
}

/**
 * Xóa 1 lịch hẹn
 */
async function adminDeleteScheduled(schedId) {
    if (!db || !schedId) return;
    if (!await customConfirm("Bạn có chắc muốn xóa lịch hẹn này?", { title: "Xóa lịch hẹn", type: "danger", confirmText: "Xóa" })) return;
    try {
        await db.collection("scheduled_notifications").doc(schedId).delete();
        showNotification("Đã xóa lịch hẹn!", "success");
    } catch (err) {
        console.error("Lỗi xóa scheduled:", err);
        showNotification("Không thể xóa lịch hẹn!", "error");
    }
}

/**
 * Xóa tất cả lịch hẹn
 */
async function adminDeleteAllScheduled() {
    if (!db || allScheduledNotifs.length === 0) {
        showNotification("Không có lịch hẹn nào!", "info");
        return;
    }
    if (!await customConfirm(`Xóa tất cả ${allScheduledNotifs.length} lịch hẹn? Không thể hoàn tác!`, { title: "Xóa tất cả lịch", type: "danger", confirmText: "Xóa tất cả" })) return;

    try {
        showLoading(true, "Đang xóa...");
        let batch = db.batch();
        let count = 0;
        for (const s of allScheduledNotifs) {
            batch.delete(db.collection("scheduled_notifications").doc(s.id));
            count++;
            if (count % 499 === 0) {
                await batch.commit();
                batch = db.batch();
            }
        }
        await batch.commit();
        showNotification(`Đã xóa ${count} lịch hẹn!`, "success");
    } catch (err) {
        console.error("Lỗi xóa tất cả scheduled:", err);
        showNotification("Có lỗi xảy ra!", "error");
    } finally {
        showLoading(false);
    }
}

// Schedule checker đã chuyển sang notifications.js (chạy ngầm cho mọi user)

window.copyApiUrlBackup = function() {
    const input = document.getElementById("movieApiUrlBackup");
    if (!input || !input.value) {
        showNotification("Không có Link API để copy!", "info");
        return;
    }
    
    navigator.clipboard.writeText(input.value)
        .then(() => {
            showNotification("Đã copy Link API vào khay nhớ tạm!", "success");
        })
        .catch(err => {
            console.error("Lỗi copy clipboard:", err);
            // Fallback copy logic
            input.select();
            document.execCommand("copy");
            showNotification("Đã copy Link API vào khay nhớ tạm!", "success");
        });
}

// --- SMART ACTOR SELECTION LOGIC ---
window.selectedMovieActors = [];

window.initSmartActorsFromCastString = function(castString, castData = []) {
    window.selectedMovieActors = [];
    
    // 1. Ưu tiên sử dụng castData (nếu phim đã được đồng bộ ID)
    if (Array.isArray(castData) && castData.length > 0) {
        castData.forEach(item => {
            // Tìm thông tin mới nhất từ kho
            const dbActor = allActors.find(a => a.id === item.id);
            window.selectedMovieActors.push({
                id: item.id,
                name: item.name,
                avatar: dbActor ? dbActor.avatar : null,
                isFallback: !dbActor
            });
        });
    } 
    // 2. Dự phòng dùng chuỗi văn bản (cho phim cũ chưa sync)
    else if (castString) {
        const names = castString.split(",").map(n => n.trim()).filter(n => n);
        names.forEach(name => {
            const actorObj = allActors.find(a => 
                a.name.toLowerCase() === name.toLowerCase() ||
                (a.altNames || []).some(alt => alt.toLowerCase() === name.toLowerCase())
            );
            if (actorObj) {
                window.selectedMovieActors.push({
                    id: actorObj.id,
                    name: actorObj.name,
                    avatar: actorObj.avatar,
                    isFallback: false
                });
            } else {
                window.selectedMovieActors.push({
                    id: 'fallback-' + Date.now() + Math.random(),
                    name: name,
                    avatar: null,
                    isFallback: true
                });
            }
        });
    }
    
    // Luôn gọi render để cập nhật UI
    renderSelectedActors();
}

/**
 * Tự động tạo diễn viên mới vào collection actors nếu chưa tồn tại
 * Trả về mảng {id, name} của các diễn viên để lưu vào phim
 */
async function autoCreateNewActors(castString) {
    if (!castString || !db) return [];
    
    // Đảm bảo load diễn viên mới nhất để so sánh
    if (typeof loadActors === 'function' && (!allActors || allActors.length === 0)) {
        await loadActors();
    }
    
    const names = castString.split(",").map(n => n.trim()).filter(n => n);
    let createdCount = 0;
    let finalCastData = [];
    
    for (const name of names) {
        // Kiểm tra đã có trong allActors chưa
        const actorObj = allActors.find(a => 
            a.name.toLowerCase() === name.toLowerCase() ||
            (a.altNames || []).some(alt => alt.toLowerCase() === name.toLowerCase())
        );
        
        if (actorObj) {
            finalCastData.push({ id: actorObj.id, name: actorObj.name });
            continue;
        }
        
        // Tạo slug từ tên
        const slug = name.toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/đ/g, 'd').replace(/Đ/g, 'D')
            .replace(/[^a-z0-9\s]/g, '')
            .replace(/\s+/g, '-');
        const id = slug + '-' + Math.floor(Math.random() * 10000);
        
        try {
            const createdAt = firebase.firestore.FieldValue.serverTimestamp();
            const newActor = {
                name: name,
                id: id,
                avatar: '',
                birthday: '',
                gender: '',
                role: 'actor',
                altNames: [],
                bio: '',
                createdAt: createdAt,
                autoCreated: true // Đánh dấu tạo tự động
            };
            
            await db.collection("actors").doc(id).set(newActor);
            
            // Tạo bản sao local với Date thực tế để sort newest hoạt động ngay
            const localActor = { ...newActor, createdAt: new Date() };
            
            // Thêm vào allActors local
            allActors.push(localActor);
            finalCastData.push({ id: id, name: name });
            createdCount++;
        } catch (err) {
            console.error(`Lỗi tạo diễn viên mới "${name}":`, err);
            // Fallback nếu lỗi tạo
            finalCastData.push({ id: 'fallback-' + Date.now(), name: name });
        }
    }
    
    
    if (createdCount > 0) {
        // Cập nhật danh sách "Mới (Từ Phim)" - Reset mỗi đợt mới như user yêu cầu
        const createdIds = finalCastData.filter(a => !a.id.startsWith('fallback-')).map(a => a.id);
        if (createdIds.length > 0) {
            window.setLatestAutoActorIds(createdIds, false);
            
            // Đồng bộ luôn vào latestAddedActorIds để nó hiện lên đầu khi sort newest
            window.setLatestActorIds(createdIds, true); // Append vào list NEW chung
        }

        console.log(`✅ Đã tự động tạo ${createdCount} diễn viên mới vào kho`);
        showNotification(`Đã tự động thêm ${createdCount} diễn viên mới vào kho quản lý`, "info");
        
        // Refresh bảng diễn viên và bắt buộc sort Newest để hiện lên đầu
        const sortSelect = document.getElementById("adminSortActor");
        if (sortSelect) {
            sortSelect.value = "newest"; // Tự động chuyển sang mới nhất
        }
        
        if (typeof renderAdminActors === 'function') {
            renderAdminActors();
        }
    }
    
    return finalCastData;
}

/**
 * Đồng bộ hóa dữ liệu diễn viên cho tất cả các phim (Batch Update)
 * Quét toàn bộ phim, đối chiếu tên diễn viên với kho và cập nhật ID chính xác vào castData
 */
window.syncAllMoviesActors = async function() {
    if (!db || !confirm("Hệ thống sẽ quét toàn bộ phim để chuẩn hóa liên kết diễn viên. Bạn có chắc chắn muốn thực hiện?")) return;
    
    try {
        showLoading(true, "Đang chuẩn hóa liên kết Diễn viên - Phim...");
        
        // 1. Tải toàn bộ diễn viên mới nhất
        if (typeof loadActors === 'function') await loadActors();
        
        // 2. Lấy toàn bộ phim
        const movieSnapshot = await db.collection("movies").get();
        const movieDocs = movieSnapshot.docs;
        
        let updateCount = 0;
        let totalMovies = movieDocs.length;
        
        console.log(`🚀 Bắt đầu đồng bộ cho ${totalMovies} phim...`);
        
        for (let i = 0; i < totalMovies; i++) {
            const doc = movieDocs[i];
            const data = doc.data();
            const castString = data.cast || "";
            
            if (!castString) continue;
            
            // Xử lý lấy IDs cho danh sách tên trong cast
            const newCastData = await autoCreateNewActors(castString);
            
            // Chỉ cập nhật nếu castData thay đổi hoặc chưa có
            const currentCastDataJson = JSON.stringify(data.castData || []);
            const newCastDataJson = JSON.stringify(newCastData);
            
            if (currentCastDataJson !== newCastDataJson) {
                await db.collection("movies").doc(doc.id).update({
                    castData: newCastData,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                updateCount++;
                console.log(`✅ Đã đồng bộ phim: ${data.title}`);
            }
            
            // Cập nhật text loading
            const loadingText = document.getElementById("loadingText");
            if (loadingText) {
                loadingText.textContent = `Đang đồng bộ: ${i + 1}/${totalMovies} phim... (Đã cập nhật ${updateCount})`;
            }
        }
        
        showNotification(`Đồng bộ thành công! Đã chuẩn hóa dữ liệu cho ${updateCount} phim.`, "success");
        
        // Reload lại danh sách phim nếu đang ở trang quản lý
        if (typeof loadAdminMovies === 'function') await loadAdminMovies();
        
    } catch (err) {
        console.error("Lỗi khi đồng bộ Diễn viên - Phim:", err);
        showNotification("Có lỗi xảy ra trong quá trình đồng bộ!", "error");
    } finally {
        showLoading(false);
    }
}

window.renderSelectedActors = function() {
    const container = document.getElementById("actorPillsContainer");
    if (!container) return;
    
    container.innerHTML = window.selectedMovieActors.map(actor => {
        // --- REACTIVE LOOKUP: Luôn tìm thông tin mới nhất từ kho allActors ---
        let latestAvatar = actor.avatar;
        let isFallback = actor.isFallback;
        
        if (typeof allActors !== 'undefined' && allActors) {
            // Tìm theo ID (bền vững) hoặc Tên (dự phòng)
            const dbActor = allActors.find(a => 
                (actor.id && a.id === actor.id) || 
                a.name.toLowerCase() === actor.name.toLowerCase() ||
                (a.altNames || []).some(alt => alt.toLowerCase() === actor.name.toLowerCase())
            );
            
            if (dbActor) {
                latestAvatar = dbActor.avatar;
                isFallback = false; // "Nâng cấp" từ fallback lên chính quy nếu đã có trong kho
            }
        }

        const avatarHtml = isFallback 
            ? `<div style="width:24px;height:24px;border-radius:50%;background:#555;display:flex;align-items:center;justify-content:center;font-size:10px;"><i class="fas fa-user"></i></div>`
            : `<img src="${latestAvatar || 'https://ui-avatars.com/api/?name='+encodeURIComponent(actor.name)+'&background=random&color=fff'}" alt="${actor.name}">`;
            
        return `
            <div class="actor-pill ${isFallback ? 'fallback' : ''}">
                ${avatarHtml}
                <span>${actor.name}</span>
                <span class="actor-pill-remove" onclick="removeActorFromMovie('${actor.id}')"><i class="fas fa-times"></i></span>
            </div>
        `;
    }).join("");
    
    // Sync to hidden input
    document.getElementById("movieCast").value = window.selectedMovieActors.map(a => a.name).join(", ");
}

window.searchActorInput = function(query) {
    const dropdown = document.getElementById("actorSuggestionsDropdown");
    if (!dropdown) return;
    
    if (!query || query.trim() === "") {
        dropdown.style.display = "none";
        return;
    }
    
    const q = query.toLowerCase().trim();
    // Lọc diễn viên có tên hoặc tên gọi khác chứa query, và chưa được chọn
    const results = allActors.filter(a => {
        const nameMatch = a.name.toLowerCase().includes(q);
        const altMatch = (a.altNames || []).some(alt => alt.toLowerCase().includes(q));
        const isNotSelected = !window.selectedMovieActors.some(sel => sel.id === a.id);
        return (nameMatch || altMatch) && isNotSelected;
    }).slice(0, 10); // Lấy tối đa 10 kết quả
    
    if (results.length === 0) {
        dropdown.innerHTML = `<div style="padding: 10px 15px; color: var(--text-muted); font-size: 0.9rem;">Nhấn Enter để thêm "${query}"</div>`;
    } else {
        dropdown.innerHTML = results.map(actor => {
            const avatarUrl = actor.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(actor.name)}&background=random&color=fff`;
            return `
                <div class="actor-suggestion-item" onmousedown="addActorToMovie('${actor.id}', '${actor.name}', '${avatarUrl}')">
                    <img src="${avatarUrl}" alt="${actor.name}">
                    <div class="actor-suggestion-info">
                        <span class="actor-suggestion-name">${actor.name}</span>
                        <span class="actor-suggestion-id">ID: ${actor.id}</span>
                    </div>
                </div>
            `;
        }).join("");
    }
    
    dropdown.style.display = "block";
}

window.addActorToMovie = function(id, name, avatar) {
    // Check nếu đã có
    if (window.selectedMovieActors.some(a => a.id === id)) return;
    
    window.selectedMovieActors.push({ id, name, avatar, isFallback: false });
    renderSelectedActors();
    
    // Clear input
    const input = document.getElementById("smartActorInput");
    if (input) {
        input.value = "";
        input.focus();
    }
    closeActorSuggestions();
}

window.addFallbackActorToMovie = function(name) {
    const trimmed = name.trim();
    if (!trimmed) return;
    
    // Check nếu đã có tên này
    if (window.selectedMovieActors.some(a => a.name.toLowerCase() === trimmed.toLowerCase())) return;
    
    window.selectedMovieActors.push({
        id: 'fallback-' + Date.now() + Math.random(),
        name: trimmed,
        avatar: null,
        isFallback: true
    });
    renderSelectedActors();
    
    // Clear input
    const input = document.getElementById("smartActorInput");
    if (input) input.value = "";
    closeActorSuggestions();
}

window.removeActorFromMovie = function(id) {
    window.selectedMovieActors = window.selectedMovieActors.filter(a => a.id !== id);
    renderSelectedActors();
}

window.closeActorSuggestions = function() {
    const dropdown = document.getElementById("actorSuggestionsDropdown");
    if (dropdown) dropdown.style.display = "none";
}

window.handleSmartActorKeyDown = function(event) {
    if (event.key === "Enter") {
        event.preventDefault(); // Tránh submit form
        const input = document.getElementById("smartActorInput");
        if (input && input.value.trim() !== "") {
            addFallbackActorToMovie(input.value);
        }
    }
}

/**
 * Import diễn viên từ RapChieuPhim.com API
 */
window.fetchActorsFromRapChieuPhim = async function() {
    const apiKey = document.getElementById("rapApiKeyInput").value.trim();
    const page = document.getElementById("rapApiPageInput").value || 1;
    const resultsDiv = document.getElementById("rapActorApiImportResults");
    
    if (!apiKey) {
        showNotification("Vui lòng nhập API Key!", "warning");
        return;
    }
    
    const API_URL = `https://rapchieuphim.com/api/v1/actors?page=${page}`;
    
    try {
        showLoading(true, "Đang tải dữ liệu từ RapChieuPhim...");
        
        const response = await fetch(API_URL, {
            headers: {
                'x-api-key': apiKey
            }
        });
        
        if (!response.ok) throw new Error(`Lỗi kết nối: ${response.status}`);
        
        const actors = await response.json();
        if (!Array.isArray(actors)) {
            throw new Error("Dữ liệu trả về không phải mảng diễn viên!");
        }
        
        let imported = 0;
        let skipped = 0;
        let updatesAvailable = [];
        let importedNames = [];
        let newActorIds = [];
        
        for (const act of actors) {
            // ... (giữ nguyên logic bóc tách)
            if (existingActor) {
                // ...
                continue;
            }
            
            // Tạo ID từ slug
            const baseId = act.slug || createActorIdFromName(name);
            const newId = `${baseId}-${Math.floor(Math.random() * 1000)}`;
            
            const actorData = {
                id: newId,
                ...incomingData,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            await db.collection("actors").doc(newId).set(actorData);
            
            // Fix sorting: Dùng Date thực tế cho local copy
            const localActor = { ...actorData, createdAt: new Date() };
            allActors.push(localActor);
            imported++;
            importedNames.push(name);
            newActorIds.push(newId);
        }

        if (newActorIds.length > 0) {
            window.setLatestActorIds(newActorIds, false); // Nạp từ API RapChieuPhim: reset batch mới
            const sortSelect = document.getElementById("adminSortActor");
            if (sortSelect) sortSelect.value = "newest";
        }
        
        // Reload lại kho diễn viên
        await loadActors();
        renderAdminActors();
        
        // Hiển thị kết quả
        let resultHtml = `
            <div style="background: var(--bg-tertiary); border-radius: 8px; padding: 12px; font-size: 0.9rem; border: 1px solid rgba(255,107,107,0.3);">
                <div style="color: #51cf66; font-weight: 600; margin-bottom: 5px;">✅ Đã thêm mới: ${imported}</div>
                ${imported > 0 ? `<div style="color: var(--text-muted); font-size: 0.8rem; margin-bottom: 10px;">(${importedNames.join(", ")})</div>` : ""}
                <div style="color: #aaa; margin-bottom: ${updatesAvailable.length > 0 ? '10px' : '0'};">⏭️ Đã bỏ qua (đã đầy đủ): ${skipped}</div>
                ${updatesAvailable.length > 0 ? `
                    <div style="border-top: 1px solid rgba(255,255,255,0.05); padding-top: 10px; margin-top: 5px;">
                        <div style="color: var(--accent-secondary); font-weight: 600; margin-bottom: 8px;">✨ Có ${updatesAvailable.length} diễn viên có thể bổ sung thông tin!</div>
                        <button class="btn btn-primary btn-sm" onclick='showImportComparison(${JSON.stringify(updatesAvailable).replace(/'/g, "&apos;")})' style="width: 100%; font-size: 0.8rem; padding: 6px;">
                            Xem & Duyệt bổ sung ngay
                        </button>
                    </div>
                ` : ""}
            </div>
        `;
        
        if (resultsDiv) resultsDiv.innerHTML = resultHtml;
        showNotification(`Đã quét xong từ RapChieuPhim! Thêm mới: ${imported}, Chờ duyệt bổ sung: ${updatesAvailable.length}`, "success");
        
    } catch (error) {
        console.error("Lỗi RapChieuPhim API:", error);
        showNotification(error.message, "error");
    } finally {
        showLoading(false);
    }
}



/**
 * Lưu API Key RapChieuPhim vào Firestore
 */
window.saveRapApiKey = async function() {
    const apiKey = document.getElementById("rapApiKeyInput").value.trim();
    if (!apiKey) {
        showNotification("Vui lòng nhập API Key trước khi lưu!", "warning");
        return;
    }

    try {
        showLoading(true, "Đang lưu API Key...");
        await db.collection("settings").doc("api_keys").set({
            rapchieuphim: apiKey,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        
        showNotification("Đã lưu API Key RapChieuPhim thành công!", "success");
    } catch (error) {
        console.error("Lỗi lưu API Key:", error);
        showNotification("Lỗi khi lưu API Key: " + error.message, "error");
    } finally {
        showLoading(false);
    }
}

/**
 * Tải API Key RapChieuPhim từ Firestore
 */
window.loadRapApiKey = async function() {
    const input = document.getElementById("rapApiKeyInput");
    if (!input || !db) return;

    try {
        const doc = await db.collection("settings").doc("api_keys").get();
        if (doc.exists && doc.data().rapchieuphim) {
            input.value = doc.data().rapchieuphim;
        }
    } catch (error) {
        console.error("Lỗi tải API Key:", error);
    }
}

/**
 * Sao chép API Key RapChieuPhim vào khay nhớ tạm
 */
window.copyRapApiKey = function() {
    const input = document.getElementById("rapApiKeyInput");
    if (!input || !input.value) {
        showNotification("Không có Key để sao chép!", "warning");
        return;
    }

    input.select();
    input.setSelectionRange(0, 99999); // Cho mobile

    navigator.clipboard.writeText(input.value)
        .then(() => {
            showNotification("Đã sao chép API Key vào khay nhớ tạm!", "success");
        })
        .catch(err => {
            console.error("Lỗi copy:", err);
            showNotification("Lỗi khi sao chép!", "error");
        });

}

/**
 * Kiểm tra trùng lặp diễn viên thời gian thực
 */
window.checkActorDuplicate = function(name) {
    const suggestionsDiv = document.getElementById("actorDuplicateSuggestions");
    if (!suggestionsDiv) return;

    name = name.trim().toLowerCase();
    
    if (!name || name.length < 2) {
        suggestionsDiv.innerHTML = "";
        suggestionsDiv.style.display = "none";
        return;
    }

    // Tìm kiếm trong allActors (bao gồm cả tên gọi khác)
    const duplicates = (allActors || []).filter(a => {
        const primaryMatch = a.name && a.name.toLowerCase().includes(name);
        const altMatch = a.altNames && a.altNames.some(alt => alt.toLowerCase().includes(name));
        return primaryMatch || altMatch;
    }).slice(0, 5); // Giới hạn 5 kết quả gợi ý

    if (duplicates.length === 0) {
        suggestionsDiv.innerHTML = "";
        suggestionsDiv.style.display = "none";
        return;
    }

    suggestionsDiv.innerHTML = `
        <div style="padding: 10px 15px; font-size: 0.8rem; color: #ff4444; border-bottom: 1px solid rgba(255,255,255,0.05); background: rgba(255,68,68,0.05);">
            <i class="fas fa-exclamation-triangle"></i> Phát hiện diễn viên tương tự đã có:
        </div>
        ${duplicates.map(a => `
            <div class="suggestion-item warning-item" onclick="selectDuplicateActor('${a.id}')">
                <img src="${a.avatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(a.name)}" 
                     style="width: 24px; height: 24px; border-radius: 50%; margin-right: 10px; object-fit: cover;">
                <div style="flex:1">
                    <div style="font-weight: 600; font-size: 0.9rem;">${a.name}</div>
                    <div style="font-size: 0.75rem; opacity: 0.7;">${a.country || 'Nơi sống: Chưa rõ'} • ${a.gender || 'Giới tính: Chưa rõ'}</div>
                </div>
                <div style="color: var(--accent-secondary); font-size: 0.7rem; font-weight: bold; border: 1px solid currentColor; padding: 2px 6px; border-radius: 4px;">CHỌN ĐỂ SỬA</div>
            </div>
        `).join("")}
    `;
    
    suggestionsDiv.style.display = "block";
}

/**
 * Chọn diễn viên trùng để chuyển sang chế độ chỉnh sửa
 */
window.selectDuplicateActor = function(actorId) {
    const actor = (allActors || []).find(a => a.id === actorId);
    if (!actor) return;

    // Đóng danh sách gợi ý
    const suggestionsDiv = document.getElementById("actorDuplicateSuggestions");
    if (suggestionsDiv) suggestionsDiv.style.display = "none";

    // Điền thông tin vào form
    document.getElementById("actorId").value = actor.id;
    document.getElementById("actorName").value = actor.name;
    document.getElementById("actorAvatar").value = actor.avatar || "";
    document.getElementById("actorAltNames").value = (actor.altNames || []).join(", ");
    document.getElementById("actorRole").value = actor.role || "actor";
    document.getElementById("actorGender").value = actor.gender || "";
    document.getElementById("actorDob").value = actor.dob || "";
    document.getElementById("actorBio").value = actor.bio || "";
    document.getElementById("actorCountry").value = actor.country || "";

    // Cập nhật tiêu đề và preview
    const title = document.getElementById("actorModalTitle");
    if (title) title.textContent = "Chỉnh Sửa Diễn Viên (Trùng lặp)";
    
    if (typeof updateActorPreview === 'function') updateActorPreview();

    showNotification("Đã chuyển sang chế độ chỉnh sửa diễn viên đã có!", "info");
}

// --- LOGIC SO SÁNH & CẬP NHẬT DIỄN VIÊN TỪ API ---
let pendingActorUpdates = [];
let currentCompareIndex = 0;

/**
 * Kiểm tra xem dữ liệu mới có "đầy đủ" hoặc "tốt hơn" dữ liệu cũ không
 */
function checkActorDataImprovement(current, incoming) {
    let improvements = {};
    let hasImprovement = false;

    // Các trường cần so sánh
    const fields = [
        { key: 'avatar', label: 'Ảnh đại diện', type: 'image' },
        { key: 'gender', label: 'Giới tính', type: 'text' },
        { key: 'dob', label: 'Ngày sinh', type: 'text' },
        { key: 'country', label: 'Nơi sống', type: 'text' },
        { key: 'bio', label: 'Tiểu sử', type: 'longtext' }
    ];

    fields.forEach(f => {
        const valOld = (current[f.key] || "").toString().trim();
        const valNew = (incoming[f.key] || "").toString().trim();

        // Nếu bản cũ trống mà bản mới có dữ liệu -> Improvement
        if (!valOld && valNew) {
            improvements[f.key] = { old: valOld, new: valNew, label: f.label, type: f.type };
            hasImprovement = true;
        } 
        // Nếu là tiểu sử, bản mới dài hơn đáng kể (> 20 ký tự) -> Improvement
        else if (f.key === 'bio' && valNew.length > valOld.length + 20) {
            improvements[f.key] = { old: valOld, new: valNew, label: f.label, type: f.type };
            hasImprovement = true;
        }
    });

    // So sánh altNames (tên gọi khác) - bổ sung nếu chưa có
    const altOld = current.altNames || [];
    const altNew = incoming.altNames || [];
    const missingAlts = altNew.filter(n => !altOld.map(x => x.toLowerCase()).includes(n.toLowerCase()));
    
    if (missingAlts.length > 0) {
        improvements['altNames'] = { 
            old: altOld.join(", "), 
            new: [...new Set([...altOld, ...altNew])].join(", "), 
            label: 'Tên gọi khác', 
            type: 'text' 
        };
        hasImprovement = true;
    }

    return hasImprovement ? improvements : null;
}

/**
 * Hiển thị giao diện so sánh khi kết thúc quét API
 */
window.showImportComparison = function(updates) {
    if (!updates || updates.length === 0) return;
    
    pendingActorUpdates = updates;
    currentCompareIndex = 0;
    
    const modal = document.getElementById("actorImportCompareModal");
    if (!modal) return;
    
    renderCompareTable();
    openModal("actorImportCompareModal");
}

/**
 * Render dữ liệu so sánh của diễn viên hiện tại trong mảng pending
 */
function renderCompareTable() {
    const item = pendingActorUpdates[currentCompareIndex];
    if (!item) return;
    
    const tbody = document.getElementById("actorCompareList");
    const currentIndexLabel = document.getElementById("compareCurrentIndex");
    const totalLabel = document.getElementById("compareTotal");
    const totalAllLabel = document.getElementById("compareTotalAll");
    const countLabel = document.getElementById("compareCount");
    
    if (currentIndexLabel) currentIndexLabel.textContent = currentCompareIndex + 1;
    if (totalLabel) totalLabel.textContent = pendingActorUpdates.length;
    if (totalAllLabel) totalAllLabel.textContent = pendingActorUpdates.length;
    if (countLabel) countLabel.textContent = pendingActorUpdates.length;
    
    let html = `
        <tr style="background: rgba(255,255,255,0.02);">
            <td colspan="3" style="text-align: center; font-weight: bold; color: var(--accent-secondary);">
                Đối chiếu Diễn viên: ${item.current.name}
            </td>
        </tr>
    `;
    
    const improvements = item.improvements;
    Object.keys(improvements).forEach(key => {
        const info = improvements[key];
        
        let oldDisplay = info.old || '<span class="compare-empty">(Trống)</span>';
        let newDisplay = `<span class="compare-highlight">${info.new}</span>`;
        
        if (info.type === 'image') {
            oldDisplay = info.old ? `<img src="${info.old}" class="compare-avatar-img">` : '<span class="compare-empty">(Chưa có ảnh)</span>';
            newDisplay = `<img src="${info.new}" class="compare-avatar-img" style="border: 2px solid #51cf66;">`;
        } else if (info.type === 'longtext') {
            oldDisplay = `<div style="max-height: 100px; overflow-y: auto; font-size: 0.85rem;">${info.old || '(Trống)'}</div>`;
            newDisplay = `<div style="max-height: 100px; overflow-y: auto; font-size: 0.85rem;" class="compare-highlight">${info.new}</div>`;
        }
        
        html += `
            <tr>
                <td class="compare-label">${info.label}</td>
                <td class="compare-old">${oldDisplay}</td>
                <td class="compare-new">${newDisplay}</td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
    
    // Cập nhật trạng thái nút
    const btnPrev = document.getElementById("btnPrevCompare");
    const btnNext = document.getElementById("btnNextCompare");
    if (btnPrev) btnPrev.disabled = currentCompareIndex === 0;
    if (btnNext) btnNext.disabled = currentCompareIndex === pendingActorUpdates.length - 1;
}

/**
 * Điều hướng giữa các diễn viên chờ duyệt
 */
window.navigateCompare = function(dir) {
    const nextIdx = currentCompareIndex + dir;
    if (nextIdx >= 0 && nextIdx < pendingActorUpdates.length) {
        currentCompareIndex = nextIdx;
        renderCompareTable();
    }
}

/**
 * Duyệt cập nhật cho diễn viên hiện tại
 */
window.applyCurrentActorUpdate = async function() {
    const item = pendingActorUpdates[currentCompareIndex];
    if (!item) return;
    
    try {
        showLoading(true, "Đang cập nhật diễn viên...");
        
        // Trích xuất các giá trị mới từ improvements
        const updateData = {};
        Object.keys(item.improvements).forEach(key => {
            updateData[key] = item.improvements[key].new;
            // Nếu là altNames, ta đã join thành chuỗi ở logic so sánh, cần split lại thành mảng
            if (key === 'altNames') {
                updateData[key] = item.improvements[key].new.split(",").map(n => n.trim()).filter(n => n);
            }
        });
        updateData.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
        
        await db.collection("actors").doc(item.current.id).update(updateData);
        
        showNotification(`Đã bổ sung thông tin cho ${item.current.name}!`, "success");
        
        // Đánh dấu là diễn viên mới/vừa cập nhật để hiện Bage NEW và lên đầu
        // Cộng dồn vào danh sách "Mới" để không mất badge của các diễn viên nạp cùng đợt
        window.setLatestActorIds(item.current.id, true);
        const sortSelect = document.getElementById("adminSortActor");
        if (sortSelect) sortSelect.value = "newest";

        // Xóa khỏi danh sách chờ
        pendingActorUpdates.splice(currentCompareIndex, 1);
        
        if (pendingActorUpdates.length === 0) {
            closeModal("actorImportCompareModal");
            await loadActors();
            renderAdminActors();
        } else {
            if (currentCompareIndex >= pendingActorUpdates.length) {
                currentCompareIndex = pendingActorUpdates.length - 1;
            }
            renderCompareTable();
        }
    } catch (err) {
        console.error("Lỗi cập nhật diễn viên:", err);
        showNotification("Lỗi: " + err.message, "error");
    } finally {
        showLoading(false);
    }
}

/**
 * Duyệt cập nhật cho tất cả diễn viên trong danh sách chờ
 */
window.applyAllActorUpdates = async function() {
    if (pendingActorUpdates.length === 0) return;
    
    const confirmed = await customConfirm(`Bạn có chắc muốn cập nhật thông tin bổ sung cho TẤT CẢ ${pendingActorUpdates.length} diễn viên này không?`);
    if (!confirmed) return;
    
    try {
        showLoading(true, `Đang cập nhật ${pendingActorUpdates.length} diễn viên...`);
        
        const batch = db.batch();
        const updatedIds = []; // Thu thập các ID được cập nhật

        pendingActorUpdates.forEach(item => {
            const updateData = {};
            updatedIds.push(item.current.id);
            Object.keys(item.improvements).forEach(key => {
                updateData[key] = item.improvements[key].new;
                if (key === 'altNames') {
                    updateData[key] = item.improvements[key].new.split(",").map(n => n.trim()).filter(n => n);
                }
            });
            updateData.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
            
            const docRef = db.collection("actors").doc(item.current.id);
            batch.update(docRef, updateData);
        });
        
        await batch.commit();

        // Đánh dấu toàn bộ IDs vừa cập nhật để hiện Badge NEW và lên đầu
        if (updatedIds.length > 0) {
            // Cộng dồn tất cả IDs vừa được duyệt bổ sung
            window.setLatestActorIds(updatedIds, true);
            const sortSelect = document.getElementById("adminSortActor");
            if (sortSelect) sortSelect.value = "newest";
        }
        
        showNotification(`Đã hoàn tất bổ sung dữ liệu cho ${updatedIds.length} diễn viên!`, "success");
        pendingActorUpdates = [];
        closeModal("actorImportCompareModal");
        
        await loadActors();
        renderAdminActors();
    } catch (err) {
        console.error("Lỗi cập nhật hàng loạt:", err);
        showNotification("Lỗi: " + err.message, "error");
    } finally {
        showLoading(false);
    }
}
