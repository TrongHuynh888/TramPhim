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
    const genreSelect = document.getElementById("filterSingleGenre");
    if (genreSelect && genreSelect.options.length <= 1) {
        // Use global allCategories if available, else derive from movies
        let genres = [];
        if (typeof allCategories !== 'undefined' && allCategories.length > 0) {
            genres = allCategories.map(c => c.name);
        } else {
             const set = new Set();
             source.forEach(m => { if(m.category) set.add(m.category) });
             genres = [...set].sort();
        }
        
        genres.forEach(g => {
            const opt = document.createElement("option");
            opt.value = g;
            opt.textContent = g;
            genreSelect.appendChild(opt);
        });
    }

    // Countries
    const countrySelect = document.getElementById("filterSingleCountry");
    if (countrySelect && countrySelect.options.length <= 1) {
         let countries = [];
         if (typeof allCountries !== 'undefined' && allCountries.length > 0) {
             countries = allCountries.map(c => c.name);
         } else {
             const set = new Set();
             source.forEach(m => { if(m.country) set.add(m.country) });
             countries = [...set].sort();
         }
         countries.forEach(c => {
            const opt = document.createElement("option");
            opt.value = c;
            opt.textContent = c;
            countrySelect.appendChild(opt);
         });
    }

    // Years (Extract from single movies)
    const yearSelect = document.getElementById("filterSingleYear");
    if (yearSelect && yearSelect.options.length <= 1) {
        const years = new Set();
        source.forEach(m => {
            if (m.type === 'single' && m.year) years.add(m.year);
        });
        [...years].sort((a,b) => b-a).forEach(y => {
            const opt = document.createElement("option");
            opt.value = y;
            opt.textContent = y;
            yearSelect.appendChild(opt);
        });
    }
}

// --- FILTER FUNCTION ---
window.filterSingleMovies = function() {
    const container = document.getElementById("singleMoviesGrid");
    if (!container) return;

    // Get Filter Values
    const genreVal = document.getElementById("filterSingleGenre")?.value || "";
    const countryVal = document.getElementById("filterSingleCountry")?.value || "";
    const yearVal = document.getElementById("filterSingleYear")?.value || "";
    const searchVal = document.getElementById("searchSingleMovies")?.value.toLowerCase().trim() || "";

    let source = (typeof allMovies !== 'undefined') ? allMovies : [];
    if (!Array.isArray(source)) source = [];
    
    // Filter
    const filtered = source.filter(m => {
        // 1. Must be Single
        if (m.type !== 'single') return false;

        // 2. Genre
        if (genreVal && m.category !== genreVal) return false;

        // 3. Country
        if (countryVal && m.country !== countryVal) return false;

        // 4. Year
        if (yearVal && m.year && m.year.toString() !== yearVal) return false;

        // 5. Search (Title OR Cast)
        if (searchVal) {
            const titleMatch = m.title.toLowerCase().includes(searchVal);
            const castMatch = m.cast && m.cast.toLowerCase().includes(searchVal);
            return titleMatch || castMatch;
        }

        return true;
    });

    // Render
    if (filtered.length === 0) {
        container.innerHTML = '<p class="text-center text-muted">Không tìm thấy phim phù hợp.</p>';
        return;
    }
    
    container.innerHTML = filtered.map(m => createMovieCard(m)).join("");
};

// Deprecated wrapper
window.searchSingleMoviesPage = window.filterSingleMovies;
