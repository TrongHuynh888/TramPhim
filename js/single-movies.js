/**
 * SINGLE MOVIES PAGE LOGIC
 * Overrides standard functions to filter for single movies only.
 */

window.renderSingleMoviesPage = function() {
    console.log("🎬 Rendering Single Movies Page...");
    const container = document.getElementById("singleMoviesGrid");
    if (!container) return;

    // Use global allMovies
    let source = (typeof allMovies !== 'undefined') ? allMovies : [];
    if (!Array.isArray(source)) source = [];
    
    // 1. Populate filters if empty
    populateSingleFilters(source);

    // 2. Apply filters (Initial render)
    filterSingleMovies();
};

// --- POPULATE FILTERS ---
function populateSingleFilters(source) {
    // Genres
    const catList = document.getElementById("listSingleCategory");
    const catInput = document.getElementById("inputSingleCategory");
    if (catList && catInput) {
        let genres = [];
        if (typeof allCategories !== 'undefined' && allCategories.length > 0) {
            genres = allCategories.map(c => c.name);
        } else {
            const set = new Set();
            source.forEach(m => { if(m.type === 'single' && m.category) set.add(m.category) });
            genres = [...set].sort();
        }
        const categories = ['Tất cả thể loại', ...genres];
        initFilterBox("boxSingleCategory", catInput, catList, categories, 'filterSingleMovies');
    }

    // Countries
    const countryList = document.getElementById("listSingleCountry");
    const countryInput = document.getElementById("inputSingleCountry");
    if (countryList && countryInput) {
         let countriesList = [];
         if (typeof allCountries !== 'undefined' && allCountries.length > 0) {
             countriesList = allCountries.map(c => c.name);
         } else {
             const set = new Set();
             source.forEach(m => { if(m.type === 'single' && m.country) set.add(m.country) });
             countriesList = [...set].sort();
         }
         const countries = ['Tất cả quốc gia', ...countriesList];
         initFilterBox("boxSingleCountry", countryInput, countryList, countries, 'filterSingleMovies');
    }

    // Years (Extract from single movies)
    const yearList = document.getElementById("listSingleYear");
    const yearInput = document.getElementById("inputSingleYear");
    if (yearList && yearInput) {
        const yearsSet = new Set();
        source.forEach(m => {
            if (m.type === 'single' && m.year) yearsSet.add(m.year);
        });
        const yearArray = [...yearsSet].sort((a,b) => b-a);
        const years = ['Tất cả năm', ...yearArray];
        initFilterBox("boxSingleYear", yearInput, yearList, years, 'filterSingleMovies');
    }
}

// --- FILTER FUNCTION ---
window.filterSingleMovies = function() {
    const container = document.getElementById("singleMoviesGrid");
    if (!container) return;

    // Get Filter Values from custom inputs
    const genreStr = document.getElementById("inputSingleCategory")?.value.trim() || "";
    const countryStr = document.getElementById("inputSingleCountry")?.value.trim() || "";
    const yearStr = document.getElementById("inputSingleYear")?.value.trim() || "";
    const searchVal = document.getElementById("searchSingleMovies")?.value.toLowerCase().trim() || "";

    const genres = genreStr.split(',').map(s => s.trim()).filter(Boolean);
    const countries = countryStr.split(',').map(s => s.trim()).filter(Boolean);
    const years = yearStr.split(',').map(s => s.trim()).filter(Boolean);

    let source = (typeof allMovies !== 'undefined') ? allMovies : [];
    if (!Array.isArray(source)) source = [];
    
    // Filter
    const filteredData = source.map(m => {
        // 1. Phải là Phim Lẻ
        if (m.type !== 'single') return null;

        // 2. Ô tìm kiếm (Luôn là AND - để thu hẹp kết quả)
        if (searchVal) {
            const titleMatch = m.title.toLowerCase().includes(searchVal);
            const castMatch = m.cast && m.cast.toLowerCase().includes(searchVal);
            if (!(titleMatch || castMatch)) return null;
        }

        // Nếu không có bất kỳ bộ lọc nhãn nào (Genres, Countries, Years) thì chỉ lọc theo Search/Type
        if (genres.length === 0 && countries.length === 0 && years.length === 0) {
            return { movie: m, matchedTags: [] };
        }

        // 3. Logic Union (OR) cho các bộ lọc nhãn
        let matchedTags = [];
        
        // Kiểm tra Thể loại
        let movieCats = (m.categories || (m.category ? [m.category] : [])).map(c => c.toLowerCase());
        const matchedGenresSet = genres.filter(g => movieCats.includes(g.toLowerCase()));
        matchedGenresSet.forEach(cat => matchedTags.push({ type: 'category', icon: 'tag', label: cat }));
        
        // Kiểm tra Quốc gia
        const matchedCountriesSet = countries.filter(c => m.country && c.toLowerCase() === m.country.toLowerCase());
        matchedCountriesSet.forEach(cty => matchedTags.push({ type: 'country', icon: 'globe', label: cty }));
        
        // Kiểm tra Năm
        const matchedYearsSet = years.filter(y => m.year && y.toString() === m.year.toString());
        matchedYearsSet.forEach(y => matchedTags.push({ type: 'year', icon: 'calendar-alt', label: y }));

        // Kết hợp: Khớp bất kỳ tiêu chí nào trong bộ nhãn
        if (matchedTags.length > 0) {
            return { movie: m, matchedTags };
        }
        return null;
    }).filter(Boolean);

    // Render
    if (filteredData.length === 0) {
        container.innerHTML = '<p class="text-center text-muted">Không tìm thấy phim phù hợp.</p>';
        updateFilterSummary(genres, countries, years, source.filter(m => m.type === 'single'), "filterResultSummary");
        return;
    }
    
    container.innerHTML = filteredData.map(item => createMovieCard(item.movie, item.matchedTags)).join("");
    
    // Hiển thị tóm tắt kết quả (Categories, Countries, Years)
    if (typeof updateFilterSummary === 'function') {
        updateFilterSummary(genres, countries, years, source.filter(m => m.type === 'single'), "filterResultSummary");
    }
};

// Deprecated wrapper
window.searchSingleMoviesPage = window.filterSingleMovies;
