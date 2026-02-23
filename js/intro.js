/**
 * LOGIC TRANG GIỚI THIỆU PHIM (INTRO PAGE)
 */

let currentIntroMovieId = null;

/**
 * Hiển thị trang giới thiệu phim
 */
// Thêm tham số updateHistory = true (Mặc định là có push history)
async function viewMovieIntro(movieId, updateHistory = true) {
    currentIntroMovieId = movieId;
    console.log("🎬 Đang mở trang giới thiệu phim:", movieId, "| updateHistory:", updateHistory);

    // 1. Tải HTML nếu chưa có
    const introContainer = document.getElementById("movieIntroPage");
    if (!introContainer) {
        console.error("❌ Không tìm thấy container #movieIntroPage");
        return;
    }
    
    console.log("📄 Container innerHTML trước khi load:", introContainer.innerHTML.length, "chars");
    
    // Kiểm tra xem đã load chưa, nếu chưa thì load
    if (introContainer.innerHTML.trim().length < 10) {
        console.log("📥 Đang load intro.html...");
        await loadComponent("movieIntroPage", "./components/intro.html");
        console.log("✅ Đã load intro.html, container content length:", document.getElementById("movieIntroPage")?.innerHTML.length);
    
    // Gán sự kiện cho nút quay lại sau khi load HTML
    setTimeout(() => {
        const backBtn = document.getElementById('introBackBtn');
        if (backBtn) {
            backBtn.onclick = function(e) {
                e.preventDefault();
                goBackFromIntro();
            };
            console.log("✅ Đã gán sự kiện cho nút quay lại");
        }
    }, 100);
    } else {
        console.log("✅ Intro.html đã được load sẵn");
    }

    // 2. Lấy dữ liệu phim
    console.log("🔍 Tìm phim trong allMovies, số lượng:", allMovies.length);
    let movie = allMovies.find((m) => m.id === movieId);
    console.log("🔍 Phim tìm thấy trong allMovies:", movie ? movie.title : "KHÔNG TÌM THẤY");
    
    if (!movie && db) {
        try {
            console.log("🔍 Đang tìm trong Firestore...");
            const doc = await db.collection("movies").doc(movieId).get();
            if (doc.exists) {
                movie = { id: doc.id, ...doc.data() };
                console.log("✅ Tìm thấy trong Firestore:", movie.title);
            }
        } catch (e) {
            console.error("❌ Lỗi Firestore:", e);
        }
    }

    if (!movie) {
        showNotification("Không tìm thấy phim!", "error");
        console.error("❌ KHÔNG TÌM THẤY PHIM với ID:", movieId);
        return;
    }

    console.log("✅ Đang hiển thị thông tin phim:", movie.title);

    // 3. Populate dữ liệu vào giao diện Intro
    
    // -- Background & Poster
    const bgImage = document.getElementById("introBgImage");
    const poster = document.getElementById("introPoster");
    // Nếu có ảnh nền riêng thì dùng, không thì dùng Poster, hoặc ảnh mặc định
    const bgUrl = movie.backgroundUrl || movie.posterUrl || "https://placehold.co/1920x1080/1a1a1a/FFF";
    
    if (bgImage) bgImage.style.backgroundImage = `url('${bgUrl}')`;
    if (poster) poster.src = movie.posterUrl;

    // -- Info Basic
    setTextContent("introTitle", movie.title);
    // Hiển thị tên tiếng Anh bên dưới (nếu có)
    const introOriginEl = document.getElementById("introOriginTitle");
    if (introOriginEl) {
        if (movie.originTitle) {
            introOriginEl.textContent = movie.originTitle;
            introOriginEl.style.display = "";
        } else {
            introOriginEl.style.display = "none";
        }
    }
    setTextContent("introYear", movie.year || "2024");
    setTextContent("introDuration", movie.duration || "N/A");
    setTextContent("introAge", movie.ageLimit || "T13");
    setTextContent("introQuality", movie.quality || "HD");
    setTextContent("introCountry", movie.country || "Quốc tế");
    setTextContent("introCategory", (movie.categories && movie.categories.length > 0) ? movie.categories.join(', ') : (movie.category || "Phim lẻ"));
    setTextContent("introRating", movie.rating || "N/A");
    
    // -- Info New Fields (Cast, Version)
    setTextContent("introCast", movie.cast || "Đang cập nhật...");
    
    // -- Versions (Dynamic Buttons)
    const versionContainer = document.getElementById("introVersionList");
    if (versionContainer) {
        versionContainer.innerHTML = "";
        let sources = [];
        
        // Lấy sources từ tập đầu tiên (giả định các tập giống nhau về versions)
        if (movie.episodes && movie.episodes.length > 0) {
            const firstEp = movie.episodes[0];
            if (firstEp.sources && Array.isArray(firstEp.sources) && firstEp.sources.length > 0) {
                sources = firstEp.sources;
            } else {
                // Dữ liệu cũ -> Coi là Mặc định
                 sources = [{ label: "Mặc định", type: "mixed", source: "" }];
            }
        }
        
        if (sources.length === 0) {
             versionContainer.innerHTML = '<span class="info-value">Đang cập nhật...</span>';
        } else {
            // Render buttons
            sources.forEach((src, index) => {
                const btn = document.createElement("button");
                btn.className = "btn btn-sm version-btn";
                btn.style.cssText = "margin-right: 5px; margin-bottom: 5px; background: #2a2a3a; color: #fff; border: 2px solid #3a3a4a; border-radius: 20px; padding: 6px 16px; font-weight: 600; font-size: 13px; cursor: pointer; transition: all 0.3s;";
                btn.textContent = src.label;
                btn.onclick = () => selectIntroVersion(src.label, index);
                versionContainer.appendChild(btn);
            });
            
            // Chọn mặc định (ưu tiên cái đã lưu)
            const savedLabel = localStorage.getItem("preferredSourceLabel");
            let defaultIndex = sources.findIndex(s => s.label === savedLabel);
            if (defaultIndex === -1) defaultIndex = 0;
            
            // Delay 1 chút để đảm bảo DOM đã render
            setTimeout(() => {
                selectIntroVersion(sources[defaultIndex].label, defaultIndex);
            }, 50);
        }
    }
    
    // -- Description
    setTextContent("introDesc", movie.description || "Chưa có mô tả cho bộ phim này.");

    // -- Tags
    const tagsContainer = document.getElementById("introTags");
    if (tagsContainer) {
        tagsContainer.innerHTML = (movie.tags || [])
            .map(tag => `<span class="intro-tag">${tag}</span>`)
            .join("");
    }

    // -- Nút Like (Update trạng thái)
    const introLikeBtn = document.getElementById("introLikeBtn");
    if (introLikeBtn) {
        // Xóa các class like cũ để tránh bị trùng ID khi chuyển phim
        introLikeBtn.classList.forEach(cls => {
            if (cls.startsWith('btn-like-')) introLikeBtn.classList.remove(cls);
        });
        introLikeBtn.classList.add(`btn-like-${movieId}`);
    }
    updateIntroLikeButton(movieId);

    // 4. Load Bình luận Intro
    loadIntroComments(movieId);

    // 5. Chuyển trang
    console.log("📌 Đang gọi showPage('movieIntro')...");
    showPage("movieIntro", false); // Không push state ở đây để tránh duplicate
    
    // Thay đổi URL sử dụng History API (Chỉ làm khi updateHistory = true)
    if (movie && movie.title && updateHistory) {
        const slug = createSlug(movie.title);
        let basePath = window.APP_BASE_PATH || "";
        const cleanBase = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;
        const newUrl = `${cleanBase}#/intro/${slug}-${movieId}`;
        history.pushState({ movieId: movieId, page: 'intro' }, movie.title, newUrl);
        console.log("✅ Đã thay đổi URL thành:", newUrl);
    }
    
    // Kiểm tra xem page đã active chưa
    const movieIntroPage = document.getElementById("movieIntroPage");
    console.log("📌 movieIntroPage class:", movieIntroPage?.className);
    console.log("✅ Đã chuyển sang trang movieIntro");
    
    // Cuộn lên đầu
    window.scrollTo(0, 0);
}

/**
 * Hàm hỗ trợ gán text an toàn
 */
function setTextContent(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

/**
 * Xử lý nút "Xem Ngay" từ Intro
 */
function playMovieFromIntro() {
    if (currentIntroMovieId) {
        // Thay đổi URL trước khi chuyển trang
        const movie = allMovies.find(m => m.id === currentIntroMovieId);
        if (movie) {
            const slug = createSlug(movie.title || "video");
            let basePath = window.APP_BASE_PATH || "";
            const cleanBase = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;
            const newUrl = `${cleanBase}#/watch/${slug}-${currentIntroMovieId}`;
            history.pushState({ movieId: currentIntroMovieId, page: 'watch' }, movie.title, newUrl);
        }
        
        // Lưu phiên bản đã chọn (nếu có)
        const selectedBtn = document.querySelector(".version-btn.active");
        if (selectedBtn) {
            localStorage.setItem("preferredSourceLabel", selectedBtn.textContent);
        }

        // Chuyển sang trang Detail/Player cũ
        viewMovieDetail(currentIntroMovieId, false);
    }
}

/**
 * Chọn phiên bản phim (Vietsub/Thuyết minh)
 */
function selectIntroVersion(label, index) {
    const mapLabel = label || ""; // Fallback nếu label null
    
    // Update UI
    const buttons = document.querySelectorAll(".version-btn");
    buttons.forEach(btn => {
        if (btn.textContent === mapLabel) {
            btn.classList.add("active");
            btn.style.background = "var(--accent-primary, #e50914)";
            btn.style.borderColor = "var(--accent-primary, #e50914)";
            btn.style.color = "#fff";
        } else {
            btn.classList.remove("active");
            btn.style.background = "#2a2a3a";
            btn.style.borderColor = "#3a3a4a";
            btn.style.color = "#fff";
        }
    });
    
    console.log("🎬 Đã chọn phiên bản:", mapLabel);
    localStorage.setItem("preferredSourceLabel", mapLabel);
}

/**
 * Xử lý nút "Yêu thích" từ Intro
 */
async function toggleFavoriteFromIntro() {
    if (!currentUser) {
        showNotification("Vui lòng đăng nhập để lưu phim!", "warning");
        return;
    }
    if (currentIntroMovieId) {
        await toggleFavorite(currentIntroMovieId);
        updateIntroLikeButton(currentIntroMovieId);
    }
}

/**
 * Cập nhật giao diện nút Like tại Intro
 */
function updateIntroLikeButton(movieId) {
    const btn = document.getElementById("introLikeBtn");
    if (!btn) return;

    let isLiked = false;
    if (currentUser && currentUser.favorites) {
        isLiked = currentUser.favorites.includes(movieId);
    }

    if (isLiked) {
        btn.innerHTML = '<i class="fas fa-heart"></i> Đã thích';
        btn.classList.add("btn-success");
        btn.classList.add("liked");
        btn.style.color = "#fff";
    } else {
        btn.innerHTML = '<i class="far fa-heart"></i> Yêu thích';
        btn.classList.remove("btn-success");
        btn.classList.remove("liked");
        btn.style.color = "";
    }
}

/**
 * Chia sẻ phim
 */
function shareMovieIntro() {
    // Tạo link (Giả lập, thực tế cần routing server-side hoặc hash)
    const url = window.location.origin + "?movie=" + currentIntroMovieId;
    
    navigator.clipboard.writeText(url).then(() => {
        showNotification("Đã copy link phim!", "success");
    }).catch(() => {
        showNotification("Lỗi copy link", "error");
    });
}

/**
 * Load bình luận cho trang Intro
 * (Tái sử dụng logic comments của detail.js nhưng render vào chỗ khác)
 */
async function loadIntroComments(movieId) {
    const container = document.getElementById("introCommentsContainer");
    if (!container) return;

    // Reset
    container.innerHTML = '<div class="text-center text-muted">Đang tải bình luận...</div>';

    // Copy lại form bình luận từ Detail (nếu muốn) hoặc chỉ hiện danh sách
    // Ở đây ta sẽ clone lại Logic load comment từ Database
    // VÌ logic comment khá phức tạp, ta có thể gọi hàm loadComments(movieId) của detail.js 
    // NHƯNG cần sửa hàm đó để target đúng container.
    // -> GIẢI PHÁP: Ta sẽ Insert HTML Comment Form vào introCommentsContainer rồi gọi hàm cũ.
    
    const commentHTML = `
        <div class="comment-form" id="introCommentForm">
            <div class="rating-input">
                <label>Đánh giá:</label>
                <div class="rating-stars" id="introRatingStars">
                    <i class="fas fa-star" data-value="1"></i>
                    <i class="fas fa-star" data-value="2"></i>
                    <i class="fas fa-star" data-value="3"></i>
                    <i class="fas fa-star" data-value="4"></i>
                    <i class="fas fa-star" data-value="5"></i>
                    <i class="fas fa-star" data-value="6"></i>
                    <i class="fas fa-star" data-value="7"></i>
                    <i class="fas fa-star" data-value="8"></i>
                    <i class="fas fa-star" data-value="9"></i>
                    <i class="fas fa-star" data-value="10"></i>
                </div>
                <span class="rating-value" id="introRatingValue" style="margin-left: 10px; font-weight: bold; color: var(--accent-secondary);">0/10</span>
            </div>
            <textarea class="form-textarea" id="introCommentContent" placeholder="Viết cảm nghĩ của bạn về phim này..."></textarea>
            <button class="btn btn-primary" style="margin-top:10px;" onclick="submitIntroComment()">Gửi bình luận</button>
        </div>
        <div id="introCommentsList" class="comments-list"></div>
    `;
    
    container.innerHTML = commentHTML;
    
    // Init Star Rating cho Intro
    initStarRating("introRatingStars");
    
    // Load list comment
    await loadCommentsToContainer(movieId, "introCommentsList");
}

/**
 * Hàm mới: Load comments vào container cụ thể (Tách từ detail.js nếu cần)
 * Tạm thời ta dùng lại hàm loadComments của detail.js nhưng cần override ID 
 * -> Để đơn giản, ta sẽ copy logic loadComments sang đây và sửa ID target.
 */
async function loadCommentsToContainer(movieId, targetId) {
    if (!db) return;
    const list = document.getElementById(targetId);
    if (!list) return;
    
    try {
        let comments = [];
        const snapshot = await db.collection("comments")
            .where("movieId", "==", movieId)
            .orderBy("createdAt", "desc")
            .limit(50)
            .get();

        if (snapshot.empty) {
            list.innerHTML = '<p class="text-center text-muted" style="padding: 20px;">Chưa có bình luận nào. Hãy là người đầu tiên!</p>';
            return;
        }

        comments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // --- SẮP XẾP BÌNH LUẬN THEO CẤP CHA - CON ---
        const commentMap = {};
        comments.forEach(c => {
            c.children = [];
            commentMap[c.id] = c;
        });

        const rootComments = [];
        comments.forEach(c => {
            if (c.parentId && commentMap[c.parentId]) {
                commentMap[c.parentId].children.push(c);
                commentMap[c.parentId].children.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
            } else {
                rootComments.push(c);
            }
        });

        // Render
        list.innerHTML = rootComments.map(comment => createIntroCommentHtml(comment)).join("");
        
    } catch (e) {
        console.error("Lỗi load comment intro:", e);
        list.innerHTML = '<p class="text-center text-muted">Lỗi tải bình luận.</p>';
    }
}

/**
 * Tạo HTML cho bình luận Intro (Đồng bộ với detail.js)
 */
function createIntroCommentHtml(comment) {
    const initial = (comment.userName || "U")[0].toUpperCase();
    
    // Thời gian
    let timeDisplay = "Vừa xong";
    if (comment.createdAt?.toDate) {
        const dateObj = comment.createdAt.toDate();
        timeDisplay = `${formatTimeAgo(dateObj)} <span style="opacity: 0.6; font-size: 10px; margin-left: 5px;">• ${formatDateTime(dateObj)}</span>`;
    }

    // Nút xóa
    const deleteBtn = (isAdmin || (currentUser && currentUser.uid === comment.userId))
        ? `<button class="btn btn-sm btn-danger" onclick="deleteIntroComment('${comment.id}')">
               <i class="fas fa-trash"></i>
           </button>`
        : "";

    // Avatar
    const avatarHtml = (comment.userAvatar && comment.userAvatar.startsWith("http"))
        ? `<img src="${comment.userAvatar}" class="comment-avatar" style="object-fit: cover;" alt="${initial}" onerror="this.src='https://ui-avatars.com/api/?name=${initial}&background=random'">`
        : `<div class="comment-avatar">${initial}</div>`;

    // Stars & Rating Text
    const stars = Array(10).fill(0).map((_, i) => 
        `<i class="fas fa-star ${i < comment.rating ? 'text-warning' : 'text-muted'}" style="font-size: 12px;"></i>`
    ).join("");
    const ratingText = comment.rating ? `<span class="comment-rating-text" style="margin-left: 5px; font-weight: bold; color: var(--accent-secondary); font-size: 13px;">${comment.rating}/10</span>` : "";

    // Replies logic
    let childrenHtml = "";
    let showRepliesBtn = "";
    if (comment.children && comment.children.length > 0) {
        const renderedChildren = comment.children.map(child => 
            `<div class="reply-node hidden-reply">${createIntroCommentHtml(child)}</div>`
        ).join("");

        childrenHtml = `<div class="replies-list" id="intro-replies-list-${comment.id}">${renderedChildren}</div>`;

        showRepliesBtn = `
            <div class="replies-controls">
                <button class="btn-show-replies" id="intro-btn-show-${comment.id}" onclick="loadMoreIntroReplies('${comment.id}')">
                    <i class="fas fa-caret-down"></i> <span>Xem ${comment.children.length} câu trả lời</span>
                </button>
                <button class="btn-hide-replies" id="intro-btn-hide-${comment.id}" onclick="hideAllIntroReplies('${comment.id}')">
                    <i class="fas fa-eye-slash"></i> Ẩn tất cả
                </button>
            </div>
        `;
    }

    return `
        <div class="comment-item" id="intro-comment-${comment.id}">
            ${avatarHtml}
            <div class="comment-content">
                <div class="comment-header">
                    <span class="comment-author">${comment.userName || "Ẩn danh"}</span>
                    <div style="display: flex; align-items: center; gap: 2px;">
                        <span class="comment-stars">${stars}</span>
                        ${ratingText}
                    </div>
                </div>
                <p class="comment-text">${escapeHtml(comment.content)}</p>
                <div class="comment-actions">
                    <div class="comment-time">${timeDisplay}</div>
                    
                    <div class="comment-reaction-container">
                        <div class="reaction-picker" id="picker-${comment.id}">
                            <span class="reaction-emoji-item" onclick="toggleCommentReaction('${comment.id}', 'like', currentIntroMovieId, 'introCommentsList')">👍</span>
                            <span class="reaction-emoji-item" onclick="toggleCommentReaction('${comment.id}', 'heart', currentIntroMovieId, 'introCommentsList')">❤️</span>
                            <span class="reaction-emoji-item" onclick="toggleCommentReaction('${comment.id}', 'haha', currentIntroMovieId, 'introCommentsList')">😂</span>
                            <span class="reaction-emoji-item" onclick="toggleCommentReaction('${comment.id}', 'wow', currentIntroMovieId, 'introCommentsList')">😮</span>
                            <span class="reaction-emoji-item" onclick="toggleCommentReaction('${comment.id}', 'sad', currentIntroMovieId, 'introCommentsList')">😢</span>
                            <span class="reaction-emoji-item" onclick="toggleCommentReaction('${comment.id}', 'angry', currentIntroMovieId, 'introCommentsList')">😡</span>
                        </div>
                        <button class="btn-reaction-trigger ${((currentUser && comment.reactions && comment.reactions[currentUser.uid]) ? 'active' : '')}" 
                                onclick="toggleReactionPicker('${comment.id}')">
                            <i class="far fa-thumbs-up"></i> Thích
                        </button>
                    </div>

                    ${renderReactionSummaryHtml(comment.id, comment.reactionSummary)}

                    <button class="btn-reply" onclick="toggleIntroReplyForm('${comment.id}')">Trả lời</button>
                    <div style="margin-left:auto;">${deleteBtn}</div>
                </div>
                
                <div id="intro-reply-form-${comment.id}" class="reply-form-container">
                    <div class="reply-input-group">
                        <input type="text" id="intro-reply-input-${comment.id}" placeholder="Viết câu trả lời...">
                        <button class="btn btn-sm btn-primary" onclick="submitIntroReply('${comment.id}')"><i class="fas fa-paper-plane"></i></button>
                    </div>
                </div>

                ${showRepliesBtn}
                ${childrenHtml}
            </div>
        </div>
    `;
}

/**
 * Gửi comment từ Intro
 */
async function submitIntroComment() {
    if (!currentUser) {
        showNotification("Vui lòng đăng nhập để bình luận!", "warning");
        openAuthModal();
        return;
    }

    const content = document.getElementById("introCommentContent").value.trim();
    const stars = document.querySelectorAll("#introRatingStars .fa-star.active");
    const rating = stars.length; 

    if (!content) {
        showNotification("Vui lòng nhập nội dung bình luận!", "warning");
        return;
    }

    if (rating === 0) {
        showNotification("Vui lòng chọn đánh giá!", "warning");
        return;
    }

    if (!db) {
        showNotification("Lỗi kết nối database!", "error");
        return;
    }
    
    try {
        showLoading(true, "Đang gửi bình luận...");
        
        await db.collection("comments").add({
            movieId: currentIntroMovieId,
            userId: currentUser.uid,
            userName: currentUser.displayName || currentUser.email.split("@")[0],
            userAvatar: currentUser.photoURL || "",
            content: content,
            rating: rating,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });

        // Reset form
        document.getElementById("introCommentContent").value = "";
        const starsEl = document.querySelectorAll("#introRatingStars .fa-star");
        starsEl.forEach(s => s.classList.remove("active", "text-warning"));
        const valText = document.getElementById("introRatingValue");
        if (valText) valText.textContent = "0/10";
        
        // Reload
        await loadCommentsToContainer(currentIntroMovieId, "introCommentsList");
        
        // Cập nhật rating trung bình của phim (Tái sử dụng hàm từ detail.js nếu có sẵn)
        if (typeof updateMovieRating === "function") {
            await updateMovieRating(currentIntroMovieId);
        }

        showNotification("Đã gửi bình luận!", "success");
    } catch (error) {
        console.error("Lỗi gửi bình luận intro:", error);
        showNotification("Không thể gửi bình luận!", "error");
    } finally {
        showLoading(false);
    }
}

/**
 * Trả lời bình luận từ Intro
 */
async function submitIntroReply(parentId) {
    if (!currentUser) {
        showNotification("Vui lòng đăng nhập để trả lời!", "warning");
        openAuthModal();
        return;
    }

    const input = document.getElementById(`intro-reply-input-${parentId}`);
    const content = input.value.trim();

    if (!content) {
        showNotification("Vui lòng nhập nội dung!", "warning");
        return;
    }

    try {
        showLoading(true, "Đang gửi...");

        await db.collection("comments").add({
            movieId: currentIntroMovieId,
            parentId: parentId,
            userId: currentUser.uid,
            userName: currentUser.displayName || currentUser.email.split("@")[0],
            userAvatar: currentUser.photoURL || "",
            content: content,
            rating: 0,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });

        showNotification("Đã trả lời!", "success");
        input.value = "";
        toggleIntroReplyForm(parentId);

        // Reload danh sách bình luận
        await loadCommentsToContainer(currentIntroMovieId, "introCommentsList");
    } catch (error) {
        console.error("Lỗi gửi reply intro:", error);
        showNotification("Lỗi gửi trả lời!", "error");
    } finally {
        showLoading(false);
    }
}

/**
 * Xóa bình luận từ Intro
 */
async function deleteIntroComment(commentId) {
    if (!await customConfirm("Bạn có chắc chắn muốn xóa bình luận này?", { title: "Xóa bình luận", type: "danger", confirmText: "Xóa" })) return;

    try {
        showLoading(true, "Đang xóa...");
        await db.collection("comments").doc(commentId).delete();
        showNotification("Đã xóa bình luận!", "success");
        
        // Reload
        await loadCommentsToContainer(currentIntroMovieId, "introCommentsList");
        
        // Cập nhật rating phim
        if (typeof updateMovieRating === "function") {
            await updateMovieRating(currentIntroMovieId);
        }
    } catch (error) {
        console.error("Lỗi xóa bình luận intro:", error);
        showNotification("Lỗi khi xóa!", "error");
    } finally {
        showLoading(false);
    }
}

/**
 * Bật/Tắt form trả lời tại Intro
 */
function toggleIntroReplyForm(commentId) {
    if (!currentUser) {
        showNotification("Vui lòng đăng nhập để trả lời!", "warning");
        openAuthModal();
        return;
    }

    // Đóng tất cả các form khác
    document.querySelectorAll(".reply-form-container").forEach(el => el.classList.remove("active"));

    const form = document.getElementById(`intro-reply-form-${commentId}`);
    if (form) {
        form.classList.toggle("active");
        if (form.classList.contains("active")) {
            setTimeout(() => document.getElementById(`intro-reply-input-${commentId}`).focus(), 100);
        }
    }
}

/**
 * Hiện thêm replies
 */
function loadMoreIntroReplies(parentId) {
    const container = document.getElementById(`intro-replies-list-${parentId}`);
    const btn = document.getElementById(`intro-btn-show-${parentId}`);
    if (!container || !btn) return;

    const hiddenItems = Array.from(container.children).filter(node => node.classList.contains("hidden-reply"));

    if (hiddenItems.length === 0) {
        btn.style.display = "none";
        return;
    }

    let count = 0;
    hiddenItems.forEach((item, index) => {
        if (index < 5) {
            item.classList.remove("hidden-reply");
            item.style.animation = "fadeIn 0.5s ease";
            count++;
        }
    });

    const remaining = hiddenItems.length - count;
    if (remaining > 0) {
        btn.querySelector("span").textContent = `Xem thêm ${remaining} câu trả lời`;
    } else {
        btn.style.display = "none";
    }

    const hideBtn = document.getElementById(`intro-btn-hide-${parentId}`);
    if (hideBtn) hideBtn.style.display = "flex";
}

/**
 * Ẩn tất cả replies
 */
function hideAllIntroReplies(parentId) {
    const container = document.getElementById(`intro-replies-list-${parentId}`);
    const showBtn = document.getElementById(`intro-btn-show-${parentId}`);
    const hideBtn = document.getElementById(`intro-btn-hide-${parentId}`);

    if (!container) return;

    const allItems = container.querySelectorAll(".reply-node");
    allItems.forEach(item => item.classList.add("hidden-reply"));

    if (showBtn) {
        showBtn.style.display = "flex";
        const directCount = Array.from(container.children).length;
        showBtn.innerHTML = `<i class="fas fa-caret-down"></i> <span>Xem ${directCount} câu trả lời</span>`;
    }

    if (hideBtn) hideBtn.style.display = "none";
}

// Logic Star Rating riêng cho Intro
function initStarRating(containerId) {
    const container = document.getElementById(containerId);
    if(!container) return;
    
    const stars = container.querySelectorAll(".fa-star");
    const valText = document.getElementById("introRatingValue");
    
    stars.forEach((star, index) => {
        star.onclick = () => {
            const ratingValue = index + 1;
            // Reset hết
            stars.forEach(s => s.classList.remove("active", "text-warning"));
            // Active đến index chọn
            for(let i=0; i<=index; i++) {
                stars[i].classList.add("active", "text-warning");
            }
            // Cập nhật text value
            if (valText) {
                valText.textContent = `${ratingValue}/10`;
            }
        };
    });
}

/**
 * Quay lại từ trang giới thiệu
 */
function goBackFromIntro() {
    console.log("🔙 Đang xử lý nút quay lại...");
    console.log("🔙 History length:", history.length);
    console.log("🔙 Referrer:", document.referrer);
    
    // Kiểm tra xem có URL trước đó không
    const previousPage = document.referrer;
    
    // Nếu có trang trước và không phải là trang hiện tại
    if (previousPage && previousPage !== window.location.href && previousPage.includes(window.location.hostname)) {
        console.log("🔙 Quay lại trang trước:", previousPage);
        window.history.back();
        return;
    }
    
    // Nếu history có nhiều hơn 1 trang
    if (history.length > 1) {
        console.log("🔙 Dùng history.back()");
        history.back();
        return;
    }
    
    // Mặc định: quay về trang chủ
    console.log("🔙 Về trang chủ");
    showPage('home');
}

// Đảm bảo nút quay lại được gán sự kiện
function setupBackButton() {
    const backBtn = document.getElementById('introBackBtn');
    if (backBtn) {
        backBtn.onclick = function(e) {
            e.preventDefault();
            goBackFromIntro();
        };
    }
}
