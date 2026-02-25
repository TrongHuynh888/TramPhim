/**
 * ============================================
 * TRANG DIỄN VIÊN (Actors Page)
 * Trích xuất danh sách diễn viên từ trường cast của allMovies
 * ============================================
 */

/**
 * Render trang danh sách diễn viên
 * Quét allMovies, tách cast (split dấu phẩy), loại trùng, render grid
 */
function renderActorsPage() {
  const container = document.getElementById("actorsGrid");
  if (!container) return;

  // Trích xuất tất cả tên diễn viên unique từ allMovies
  const actorMap = {};
  allMovies.forEach(movie => {
    if (!movie.cast) return;
    const names = movie.cast.split(",").map(n => n.trim()).filter(n => n);
    names.forEach(name => {
      if (!actorMap[name]) {
        actorMap[name] = { name: name, movieCount: 0 };
      }
      actorMap[name].movieCount++;
    });
  });

  const actors = Object.values(actorMap).sort((a, b) => b.movieCount - a.movieCount);

  if (actors.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px; color: var(--text-muted);">
        <i class="fas fa-users" style="font-size: 48px; margin-bottom: 15px; display: block; opacity: 0.3;"></i>
        <p>Chưa có dữ liệu diễn viên nào.</p>
      </div>`;
    return;
  }

  // Render grid thẻ diễn viên - tra cứu ảnh từ allActors nếu có
  container.innerHTML = actors.map(actor => {
    const dbActor = findActorInDB(actor.name);
    const avatarUrl = (dbActor && dbActor.avatar)
        ? dbActor.avatar
        : `https://ui-avatars.com/api/?name=${encodeURIComponent(actor.name)}&background=random&color=fff&size=200&bold=true&font-size=0.35`;
    return `
      <div class="actor-card" onclick="viewActorDetail('${actor.name.replace(/'/g, "\\\'")}')">
        <div class="actor-card-avatar">
          <img src="${avatarUrl}" alt="${actor.name}" loading="lazy">
        </div>
        <div class="actor-card-name">${actor.name}</div>
      </div>`;
  }).join("");
}

/**
 * Tìm diễn viên trong allActors theo tên chính hoặc altNames
 */
function findActorInDB(name) {
    if (typeof allActors === 'undefined' || !allActors) return null;
    const q = name.toLowerCase().trim();
    return allActors.find(a => {
        if (a.name.toLowerCase() === q) return true;
        if (a.altNames && a.altNames.some(alt => alt.toLowerCase() === q)) return true;
        return false;
    }) || null;
}

/**
 * Xem chi tiết diễn viên
 * Hiển thị thông tin + danh sách phim đã tham gia
 */
function viewActorDetail(actorName) {
  const container = document.getElementById("actorDetailContent");
  if (!container) return;

  // Chuyển sang trang chi tiết
  showPage("actorDetail", true);

  // Tra cứu thông tin diễn viên từ database
  const dbActor = findActorInDB(actorName);

  // Lọc phim mà diễn viên tham gia (bao gồm cả tên gọi khác)
  const searchNames = [actorName.toLowerCase()];
  if (dbActor && dbActor.altNames) {
      dbActor.altNames.forEach(alt => searchNames.push(alt.toLowerCase()));
  }
  
  const actorMovies = allMovies.filter(movie => {
    if (!movie.cast) return false;
    const names = movie.cast.split(",").map(n => n.trim().toLowerCase());
    return names.some(n => searchNames.includes(n));
  });

  // Sắp xếp phim theo năm giảm dần
  actorMovies.sort((a, b) => (b.year || 0) - (a.year || 0));

  // Sử dụng ảnh từ DB nếu có, nếu không thì dùng placeholder
  const avatarUrl = (dbActor && dbActor.avatar)
      ? dbActor.avatar
      : `https://ui-avatars.com/api/?name=${encodeURIComponent(actorName)}&background=random&color=fff&size=300&bold=true&font-size=0.35`;

  // Thông tin từ DB
  const displayName = (dbActor && dbActor.name) ? dbActor.name : actorName;
  const bio = (dbActor && dbActor.bio) ? dbActor.bio : null;
  const gender = (dbActor && dbActor.gender) ? dbActor.gender : null;
  const dob = (dbActor && dbActor.dob) ? new Date(dbActor.dob).toLocaleDateString('vi-VN') : null;
  const altNames = (dbActor && dbActor.altNames && dbActor.altNames.length > 0) ? dbActor.altNames.join(", ") : null;

  container.innerHTML = `
    <!-- Nút quay lại -->
    <div class="actor-detail-topbar">
      <button class="btn-back-square" onclick="showPage('actors')">
        <i class="fas fa-chevron-left"></i>
      </button>
      <span class="actor-detail-page-title">${displayName}</span>
    </div>

    <div class="actor-detail-body">
      <!-- Cột trái: Thông tin diễn viên -->
      <div class="actor-info-sidebar">
        <div class="actor-info-avatar">
          <img src="${avatarUrl}" alt="${displayName}">
        </div>
        <h2 class="actor-info-name">${displayName}</h2>
        ${altNames ? `<p style="color: var(--text-muted); font-size: 0.85rem; margin-top: -5px; margin-bottom: 10px;"><strong>Tên gọi khác:</strong> ${altNames}</p>` : ''}

        <div class="actor-info-actions">
          <button class="btn-actor-action" onclick="showNotification('Đã thêm vào yêu thích!', 'success')">
            <i class="fas fa-heart"></i> Yêu thích
          </button>
          <button class="btn-actor-action" onclick="shareActor('${actorName.replace(/'/g, "\\\'")}')">
            <i class="fas fa-share-alt"></i> Chia sẻ
          </button>
        </div>

        <div class="actor-info-meta">
          ${bio ? `<div class="actor-meta-item">
            <span class="meta-label">Giới thiệu:</span>
            <span class="meta-value" style="font-style: italic; opacity: 0.85;">${bio}</span>
          </div>` : ''}
          <div class="actor-meta-item">
            <span class="meta-label"><strong>Giới tính:</strong></span>
            <span class="meta-value">${gender || 'Đang cập nhật'}</span>
          </div>
          <div class="actor-meta-item">
            <span class="meta-label"><strong>Ngày sinh:</strong></span>
            <span class="meta-value">${dob || 'Đang cập nhật'}</span>
          </div>
          <div class="actor-meta-item">
            <span class="meta-label"><strong>Số phim:</strong></span>
            <span class="meta-value">${actorMovies.length} phim</span>
          </div>
        </div>
      </div>

      <!-- Cột phải: Danh sách phim -->
      <div class="actor-movies-section">
        <div class="actor-movies-header">
          <h3>Các phim đã tham gia</h3>
          <div class="actor-view-toggle">
            <button class="actor-toggle-btn active" id="actorViewAll" onclick="toggleActorView('all')">Tất cả</button>
            <button class="actor-toggle-btn" id="actorViewTimeline" onclick="toggleActorView('timeline')">Thời gian</button>
          </div>
        </div>

        <!-- Chế độ xem Tất cả (Grid) -->
        <div class="actor-movies-grid movie-grid" id="actorMoviesAll">
          ${renderActorMoviesGrid(actorMovies)}
        </div>

        <!-- Chế độ xem Thời gian (Timeline) -->
        <div class="actor-movies-timeline hidden" id="actorMoviesTimeline">
          ${renderActorMoviesTimeline(actorMovies)}
        </div>
      </div>
    </div>
  `;
}

/**
 * Render danh sách phim dạng Grid (dùng createMovieCard từ home.js để có popup)
 */
function renderActorMoviesGrid(movies) {
  if (movies.length === 0) {
    return `<div style="text-align: center; padding: 40px; color: var(--text-muted); grid-column: 1/-1;">
      <p>Chưa có phim nào.</p>
    </div>`;
  }

  // Tận dụng hàm createMovieCard toàn cục để có popup như trang chủ
  if (typeof createMovieCard === "function") {
    return movies.map(movie => createMovieCard(movie)).join("");
  }

  // Fallback nếu createMovieCard chưa tải
  return movies.map(movie => `
    <div class="movie-card-wrapper" onclick="viewMovieDetail('${movie.id}')">
      <div class="card movie-card movie-card-static">
        <div class="card-image">
          <img src="${movie.posterUrl}" alt="${movie.title}" loading="lazy">
        </div>
        <div class="card-body">
          <h4 class="card-title">${movie.title}</h4>
        </div>
      </div>
    </div>
  `).join("");
}

/**
 * Render danh sách phim dạng Timeline (gom theo năm, dùng createMovieCard)
 */
function renderActorMoviesTimeline(movies) {
  if (movies.length === 0) {
    return `<div style="text-align: center; padding: 40px; color: var(--text-muted);">
      <p>Chưa có phim nào.</p>
    </div>`;
  }

  // Gom phim theo năm
  const yearGroups = {};
  movies.forEach(movie => {
    const year = movie.year || "Không rõ";
    if (!yearGroups[year]) yearGroups[year] = [];
    yearGroups[year].push(movie);
  });

  // Sắp xếp năm giảm dần
  const sortedYears = Object.keys(yearGroups).sort((a, b) => {
    if (a === "Không rõ") return 1;
    if (b === "Không rõ") return -1;
    return parseInt(b) - parseInt(a);
  });

  const useCard = typeof createMovieCard === "function";

  return sortedYears.map(year => `
    <div class="timeline-year-group">
      <div class="timeline-year-marker">
        <span class="timeline-dot"></span>
        <span class="timeline-year">${year}</span>
      </div>
      <div class="timeline-movies-row movie-grid">
        ${yearGroups[year].map(movie => {
          if (useCard) return createMovieCard(movie);
          return `
            <div class="movie-card-wrapper" onclick="viewMovieDetail('${movie.id}')">
              <div class="card movie-card movie-card-static">
                <div class="card-image"><img src="${movie.posterUrl}" alt="${movie.title}" loading="lazy"></div>
                <div class="card-body"><h4 class="card-title">${movie.title}</h4></div>
              </div>
            </div>`;
        }).join("")}
      </div>
    </div>
  `).join("");
}

/**
 * Chuyển đổi chế độ xem: "all" (grid) hoặc "timeline"
 */
function toggleActorView(mode) {
  const gridView = document.getElementById("actorMoviesAll");
  const timelineView = document.getElementById("actorMoviesTimeline");
  const btnAll = document.getElementById("actorViewAll");
  const btnTimeline = document.getElementById("actorViewTimeline");

  if (!gridView || !timelineView) return;

  if (mode === "all") {
    gridView.classList.remove("hidden");
    timelineView.classList.add("hidden");
    btnAll.classList.add("active");
    btnTimeline.classList.remove("active");
  } else {
    gridView.classList.add("hidden");
    timelineView.classList.remove("hidden");
    btnAll.classList.remove("active");
    btnTimeline.classList.add("active");
  }
}

/**
 * Chia sẻ link diễn viên
 */
function shareActor(actorName) {
  const url = window.location.href;
  if (navigator.share) {
    navigator.share({ title: actorName + " - Trạm Phim", url: url });
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(url);
    showNotification("Đã sao chép link!", "success");
  }
}
