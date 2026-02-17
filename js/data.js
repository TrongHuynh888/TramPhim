/**
 * Load dữ liệu ban đầu
 */
async function loadInitialData() {
  try {
    // Load categories
    await loadCategories();

    // Load countries
    await loadCountries();

    // Load movies
    await loadMovies();

    // Populate filter dropdowns
    populateFilters();
    
    // Cập nhật watch progress nếu đã đăng nhập
    if (currentUser) {
      await updateAllWatchProgress();
    }
  } catch (error) {
    console.error("Lỗi load dữ liệu:", error);
  }
}
/**
 * Load danh sách thể loại
 */
async function loadCategories() {
  try {
    if (db) {
      const snapshot = await db.collection("categories").get();
      if (!snapshot.empty) {
        allCategories = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
      } else {
        // Sử dụng sample data và tạo trong Firestore
        allCategories = SAMPLE_CATEGORIES;
        await initializeSampleCategories();
      }
    } else {
      allCategories = SAMPLE_CATEGORIES;
    }
  } catch (error) {
    console.error("Lỗi load categories:", error);
    allCategories = SAMPLE_CATEGORIES;
  }
}
/**
 * Load danh sách quốc gia
 */
async function loadCountries() {
  try {
    if (db) {
      const snapshot = await db.collection("countries").get();
      if (!snapshot.empty) {
        allCountries = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
      } else {
        allCountries = SAMPLE_COUNTRIES;
        await initializeSampleCountries();
      }
    } else {
      allCountries = SAMPLE_COUNTRIES;
    }
  } catch (error) {
    console.error("Lỗi load countries:", error);
    allCountries = SAMPLE_COUNTRIES;
  }
}

/**
 * Load danh sách phim
 */
async function loadMovies() {
  try {
    if (db) {
      const snapshot = await db
        .collection("movies")
        .where("status", "==", "public")
        .orderBy("createdAt", "desc")
        .get();

      if (!snapshot.empty) {
        allMovies = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      } else {
        allMovies = SAMPLE_MOVIES;
        await initializeSampleMovies();
      }
    } else {
      allMovies = SAMPLE_MOVIES;
    }

    // Render movies
    renderFeaturedMovies();
    renderNewMovies();
    renderAllMovies();
  } catch (error) {
    console.error("Lỗi load movies:", error);
    allMovies = SAMPLE_MOVIES;
    renderFeaturedMovies();
    renderNewMovies();
    renderAllMovies();
  }
}

/**
 * Khởi tạo sample categories trong Firestore
 */
async function initializeSampleCategories() {
  if (!db) return;

  try {
    const batch = db.batch();
    SAMPLE_CATEGORIES.forEach((cat) => {
      const ref = db.collection("categories").doc(cat.id);
      batch.set(ref, cat);
    });
    await batch.commit();
    console.log("✅ Đã khởi tạo sample categories");
  } catch (error) {
    console.error("Lỗi khởi tạo categories:", error);
  }
}

/**
 * Khởi tạo sample countries trong Firestore
 */
async function initializeSampleCountries() {
  if (!db) return;

  try {
    const batch = db.batch();
    SAMPLE_COUNTRIES.forEach((country) => {
      const ref = db.collection("countries").doc(country.id);
      batch.set(ref, country);
    });
    await batch.commit();
    console.log("✅ Đã khởi tạo sample countries");
  } catch (error) {
    console.error("Lỗi khởi tạo countries:", error);
  }
}

/**
 * Khởi tạo sample movies trong Firestore
 */
async function initializeSampleMovies() {
  if (!db) return;

  try {
    const batch = db.batch();
    SAMPLE_MOVIES.forEach((movie) => {
      const ref = db.collection("movies").doc(movie.id);
      batch.set(ref, {
        ...movie,
        createdAt: firebase.firestore.Timestamp.fromDate(movie.createdAt),
      });
    });
    await batch.commit();
    console.log("✅ Đã khởi tạo sample movies");
  } catch (error) {
    console.error("Lỗi khởi tạo movies:", error);
  }
}

/**
 * Cập nhật thanh watch progress cho tất cả phim đã xem
 * Gọi hàm này sau khi đăng nhập và sau khi load movies
 */
async function updateAllWatchProgress() {
  if (!currentUser || !db) {
    console.log("⏳ updateAllWatchProgress: Chưa đăng nhập hoặc chưa có DB");
    return;
  }
  
  if (!allMovies || allMovies.length === 0) {
    console.log("⏳ updateAllWatchProgress: Chưa có movies");
    return;
  }
  
  try {
    // Lấy tất cả watch progress của user từ collection "watchProgress" (có duration chính xác)
    const snapshot = await db
      .collection("users")
      .doc(currentUser.uid)
      .collection("watchProgress")
      .get();
    
    if (snapshot.empty) {
      console.log("⏳ updateAllWatchProgress: Không có watch progress");
      return;
    }
    
    console.log("📊 Tìm thấy", snapshot.size, "watch progress từ Firestore");
    
    snapshot.forEach((doc) => {
      const data = doc.data();
      const movieId = data.movieId;
      const percentage = data.percentage || 0;
      const currentTime = data.currentTime || 0;
      const duration = data.duration || 0;
      
      // Chỉ hiển thị thanh progress khi đã xem > 0
      if (percentage <= 0 && currentTime <= 0) return;
      
      // Sử dụng percentage từ watchProgress (đã tính dựa trên duration thực tế của video)
      // Nếu không có thì tính lại từ movie data
      let finalPercentage = percentage;
      
      if (finalPercentage <= 0 && currentTime > 0) {
        const movie = allMovies.find(m => m.id === movieId);
        if (movie && movie.duration) {
          const durationMinutes = parseInt(movie.duration.replace(/\D/g, '')) || 60;
          finalPercentage = Math.min(Math.round((currentTime / 60 / durationMinutes) * 100), 100);
        }
      }
      
      console.log(`🎬 MovieID: ${movieId}, Time: ${Math.round(currentTime)}s, Duration: ${Math.round(duration)}s, Percentage: ${finalPercentage}%`);
      
      updateMovieProgressUI(movieId, finalPercentage);
    });
    
    console.log("✅ Hoàn tất cập nhật watch progress");
  } catch (error) {
    console.error("Lỗi cập nhật watch progress:", error);
  }
}

/**
 * Cập nhật UI progress bar cho một phim cụ thể
 * @param {string} movieId - ID của phim
 * @param {number} percentage - Phần trăm đã xem (0-100)
 */
function updateMovieProgressUI(movieId, percentage) {
  if (!movieId || percentage <= 0) return;
  
  // Tìm progress bar
  const progressBar = document.getElementById(`progress-${movieId}`);
  if (!progressBar) return;
  
  const bar = progressBar.querySelector('.watch-progress-bar');
  if (!bar) return;
  
  // Cập nhật width
  bar.style.width = `${percentage}%`;
  progressBar.style.display = 'block';
  
  // Thêm class has-watched
  const movieCard = progressBar.closest('.movie-card');
  if (movieCard) {
    movieCard.classList.add('has-watched');
  }
  
  console.log(`✅ Đã cập nhật progress UI cho ${movieId}: ${percentage}%`);
}