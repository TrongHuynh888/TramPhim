/**
 * BANNER SLIDER - Slider ảnh phim nổi bật trên trang chủ
 * Hỗ trợ: Vuốt cảm ứng, kéo chuột, tự động chuyển slide, keyboard
 */

// Biến lưu trạng thái slider
let bannerCurrentIndex = 0;
let bannerAutoPlayTimer = null;
let bannerSlides = [];
let bannerTouchStartX = 0;
let bannerTouchEndX = 0;
let bannerIsDragging = false;
let bannerStartX = 0;
let bannerDragOffset = 0;

/**
 * Render banner slider từ danh sách phim nổi bật
 * Gọi sau khi allMovies đã load xong
 */
function renderBannerSlider() {
  const container = document.getElementById('heroBanner');
  const track = document.getElementById('bannerTrack');
  const dotsContainer = document.getElementById('bannerDots');
  const thumbsContainer = document.getElementById('bannerThumbs');

  if (!container || !track) return;

  // Lấy top 6 phim rating cao nhất có poster
  bannerSlides = [...allMovies]
    .filter(m => m.posterUrl && m.posterUrl.trim() !== '')
    .sort((a, b) => (b.rating || 0) - (a.rating || 0))
    .slice(0, 6);

  if (bannerSlides.length === 0) return;

  const fallbackImage = 'https://placehold.co/1920x800/1a1a2e/FFFFFF?text=MOVIE';

  // Render các slide
  track.innerHTML = bannerSlides.map((movie, index) => {
    // Dùng ảnh nền ngang (backgroundUrl) từ trang giới thiệu, fallback sang posterUrl
    const bannerBgImage = movie.backgroundUrl || movie.posterUrl || fallbackImage;
    // Cắt mô tả ngắn gọn (~120 ký tự)
    const shortDesc = (movie.description || 'Đang cập nhật mô tả...').substring(0, 120) + '...';
    const ratingDisplay = movie.rating ? `IMDb ${movie.rating}` : '';
    const categories = (movie.categories && movie.categories.length > 0)
      ? movie.categories.slice(0, 3).join(' • ')
      : (movie.category || '');

    // Kiểm tra trạng thái yêu thích
    let isLiked = false;
    if (typeof currentUser !== 'undefined' && currentUser && currentUser.favorites) {
      isLiked = currentUser.favorites.includes(movie.id);
    }
    const likeIcon = isLiked ? 'fas fa-heart' : 'far fa-heart';
    const likeClass = isLiked ? 'liked' : '';

    return `
      <div class="banner-slide ${index === 0 ? 'active' : ''}" data-index="${index}">
        <div class="banner-bg" style="background-image: url('${bannerBgImage}')" 
             onerror="this.style.backgroundImage='url(${fallbackImage})'"></div>
        <div class="banner-overlay"></div>
        <div class="banner-content">
          <h1 class="banner-title">${movie.title}</h1>
          ${movie.originalTitle ? `<p class="banner-subtitle">${movie.originalTitle}</p>` : ''}
          <div class="banner-meta">
            ${ratingDisplay ? `<span class="banner-badge"><i class="fas fa-star"></i> ${ratingDisplay}</span>` : ''}
            <span>${movie.year || '2025'}</span>
            ${movie.duration ? `<span>${movie.duration}</span>` : ''}
            ${movie.quality ? `<span class="banner-quality">${movie.quality}</span>` : ''}
          </div>
          ${categories ? `<div class="banner-genres">${categories}</div>` : ''}
          <p class="banner-desc">${shortDesc}</p>
          <div class="banner-actions">
            <button class="btn-banner-play" onclick="event.stopPropagation(); viewMovieIntro('${movie.id}')">
              <i class="fas fa-play"></i> Xem ngay
            </button>
            <button class="btn-banner-icon ${likeClass} btn-like-${movie.id}" onclick="event.stopPropagation(); toggleFavorite('${movie.id}')">
              <i class="${likeIcon}"></i>
            </button>
            <button class="btn-banner-icon" onclick="event.stopPropagation(); viewMovieIntro('${movie.id}')">
              <i class="fas fa-info-circle"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Render dot indicators
  if (dotsContainer) {
    dotsContainer.innerHTML = bannerSlides.map((_, i) =>
      `<button class="banner-dot ${i === 0 ? 'active' : ''}" onclick="goToBannerSlide(${i})"></button>`
    ).join('');
  }

  // Render thumbnails nhỏ (góc phải dưới)
  if (thumbsContainer) {
    thumbsContainer.innerHTML = bannerSlides.map((movie, i) =>
      `<div class="banner-thumb ${i === 0 ? 'active' : ''}" onclick="goToBannerSlide(${i})">
        <img src="${movie.posterUrl}" alt="${movie.title}" onerror="this.src='${fallbackImage}'">
      </div>`
    ).join('');
  }

  // Khởi tạo sự kiện
  initBannerEvents(container, track);
  // Bắt đầu auto-play
  startBannerAutoPlay();
}

/**
 * Chuyển tới slide chỉ định
 */
function goToBannerSlide(index) {
  if (index < 0) index = bannerSlides.length - 1;
  if (index >= bannerSlides.length) index = 0;
  bannerCurrentIndex = index;

  const track = document.getElementById('bannerTrack');
  if (!track) return;

  // Di chuyển track (translateX)
  track.style.transform = `translateX(-${index * 100}%)`;

  // Cập nhật class active cho slide
  document.querySelectorAll('.banner-slide').forEach((slide, i) => {
    slide.classList.toggle('active', i === index);
  });

  // Cập nhật dot
  document.querySelectorAll('.banner-dot').forEach((dot, i) => {
    dot.classList.toggle('active', i === index);
  });

  // Cập nhật thumbnail
  document.querySelectorAll('.banner-thumb').forEach((thumb, i) => {
    thumb.classList.toggle('active', i === index);
  });

  // Reset auto-play timer
  resetBannerAutoPlay();
}

/**
 * Slide tiếp theo
 */
function nextBannerSlide() {
  goToBannerSlide(bannerCurrentIndex + 1);
}

/**
 * Slide trước đó
 */
function prevBannerSlide() {
  goToBannerSlide(bannerCurrentIndex - 1);
}

/**
 * Auto-play: Tự chuyển slide mỗi 6 giây
 */
function startBannerAutoPlay() {
  stopBannerAutoPlay();
  bannerAutoPlayTimer = setInterval(() => {
    nextBannerSlide();
  }, 6000);
}

/**
 * Dừng auto-play
 */
function stopBannerAutoPlay() {
  if (bannerAutoPlayTimer) {
    clearInterval(bannerAutoPlayTimer);
    bannerAutoPlayTimer = null;
  }
}

/**
 * Reset lại auto-play (dùng khi user tương tác)
 */
function resetBannerAutoPlay() {
  stopBannerAutoPlay();
  startBannerAutoPlay();
}

/**
 * Khởi tạo tất cả sự kiện cho banner
 */
function initBannerEvents(container, track) {
  // --- Nút prev/next ---
  const prevBtn = document.getElementById('bannerPrev');
  const nextBtn = document.getElementById('bannerNext');
  if (prevBtn) prevBtn.addEventListener('click', prevBannerSlide);
  if (nextBtn) nextBtn.addEventListener('click', nextBannerSlide);

  // --- Pause on hover (Chỉ PC) ---
  container.addEventListener('mouseenter', stopBannerAutoPlay);
  container.addEventListener('mouseleave', startBannerAutoPlay);

  // --- Swipe cảm ứng (Mobile/Tablet) ---
  track.addEventListener('touchstart', (e) => {
    bannerTouchStartX = e.changedTouches[0].screenX;
    stopBannerAutoPlay();
  }, { passive: true });

  track.addEventListener('touchend', (e) => {
    bannerTouchEndX = e.changedTouches[0].screenX;
    handleBannerSwipe();
    startBannerAutoPlay();
  }, { passive: true });

  // --- Kéo chuột (PC) ---
  track.addEventListener('mousedown', (e) => {
    bannerIsDragging = true;
    bannerStartX = e.clientX;
    track.style.cursor = 'grabbing';
    track.style.transition = 'none';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!bannerIsDragging) return;
    bannerDragOffset = e.clientX - bannerStartX;
  });

  document.addEventListener('mouseup', () => {
    if (!bannerIsDragging) return;
    bannerIsDragging = false;
    track.style.cursor = '';
    track.style.transition = '';

    // Nếu kéo đủ xa (>80px) thì chuyển slide
    if (bannerDragOffset < -80) {
      nextBannerSlide();
    } else if (bannerDragOffset > 80) {
      prevBannerSlide();
    } else {
      // Snap lại vị trí cũ
      goToBannerSlide(bannerCurrentIndex);
    }
    bannerDragOffset = 0;
  });

  // --- Keyboard (Mũi tên trái/phải) ---
  document.addEventListener('keydown', (e) => {
    // Chỉ xử lý khi đang ở trang home
    const homePage = document.getElementById('homePage');
    if (!homePage || !homePage.classList.contains('active')) return;

    if (e.key === 'ArrowLeft') {
      prevBannerSlide();
    } else if (e.key === 'ArrowRight') {
      nextBannerSlide();
    }
  });
}

/**
 * Xử lý vuốt (swipe gesture)
 */
function handleBannerSwipe() {
  const diff = bannerTouchStartX - bannerTouchEndX;
  const threshold = 50; // Ngưỡng vuốt tối thiểu (px)

  if (diff > threshold) {
    // Vuốt sang trái → slide tiếp theo
    nextBannerSlide();
  } else if (diff < -threshold) {
    // Vuốt sang phải → slide trước
    prevBannerSlide();
  }
}
