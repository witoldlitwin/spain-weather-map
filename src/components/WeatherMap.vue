<script setup lang="ts">
import { onMounted, ref, watch, computed } from "vue";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import axios from "axios";
import { useI18n } from "vue-i18n";
import LanguageSwitcher from './LanguageSwitcher.vue';
import {
    Municipality,
    COUNTRY_CONFIGS,
    COMBINED_MAP_CENTER,
    COMBINED_MAP_ZOOM,
    getTimezoneForMunicipality
} from '../config/countries';

// Cookie utility functions
function setCookie(name: string, value: string, days: number = 365): void {
    const date = new Date();
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
    const expires = `expires=${date.toUTCString()}`;
    document.cookie = `${name}=${value};${expires};path=/`;
}

function getCookie(name: string): string | null {
    const nameEQ = `${name}=`;
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1);
        if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
}

// Data processing helper functions
function processApiRecord(record: any, countryKey: string): Municipality {
    const config = COUNTRY_CONFIGS[countryKey];
    let coordinates: [number, number] = [0, 0];

    if (record.fields && record.fields[config.fieldMappings.coordinates]) {
        const coordData = record.fields[config.fieldMappings.coordinates];
        if (Array.isArray(coordData)) {
            coordinates = [coordData[0], coordData[1]] as [number, number];
        } else if (typeof coordData === "object") {
            coordinates = [coordData.lat || 0, coordData.lon || 0] as [number, number];
        }
    }

    return {
        id: record.recordid,
        name: record.fields[config.fieldMappings.municipalityName] || "Unknown",
        coordinates,
        province: record.fields[config.fieldMappings.provinceName] || "Unknown",
        country: countryKey as 'spain' | 'portugal',
        countryCode: config.countryCode
    };
}

async function fetchMunicipalitiesForCountry(countryKey: string, bounds?: L.LatLngBounds): Promise<Municipality[]> {
    const config = COUNTRY_CONFIGS[countryKey];

    try {
        let params: any = {
            dataset: config.dataset,
            rows: 100,
        };

        // Add geographic filtering if bounds are provided
        if (bounds) {
            const polygonCoords = `(${bounds.getNorthWest().lat}, ${bounds.getNorthWest().lng}), (${bounds.getNorthEast().lat}, ${bounds.getNorthEast().lng}), (${bounds.getSouthEast().lat}, ${bounds.getSouthEast().lng}), (${bounds.getSouthWest().lat}, ${bounds.getSouthWest().lng})`;
            params["geofilter.polygon"] = polygonCoords;
        } else {
            // Fallback to country code filter
            params.q = `country_code:${config.countryCode}`;
        }

        const response = await axios.get(
            "https://public.opendatasoft.com/api/records/1.0/search/",
            { params }
        );

        return response.data.records.map((record: any) => processApiRecord(record, countryKey));
    } catch (error) {
        console.error(`Error fetching municipalities for ${countryKey}:`, error);

        // Return fallback cities for this country
        return config.fallbackCities;
    }
}



const map = ref<L.Map | null>(null);
const currentDate = new Date();
const currentYear = currentDate.getFullYear();
const currentMonth = currentDate.getMonth() + 1; // 1-indexed month

// Get saved values from cookies or use defaults
const getSavedMonth = (): number => {
    const savedMonth = getCookie('selectedMonth');
    if (savedMonth) {
        const month = parseInt(savedMonth);
        // Validate the month is within range
        if (month >= 1 && month <= 12) {
            // For current year, ensure month is not in the future
            if (parseInt(getCookie('selectedYear') || `${currentYear}`) === currentYear) {
                return month < currentMonth ? month : Math.max(1, currentMonth - 1);
            }
            return month;
        }
    }
    return Math.min(currentMonth - 1, 12) || 12; // Default to previous month (or December)
};

const getSavedYear = (): number => {
    const savedYear = getCookie('selectedYear');
    if (savedYear) {
        const year = parseInt(savedYear);
        // Validate the year is within range (current year to 4 years back)
        if (year >= currentYear - 4 && year <= currentYear) {
            return year;
        }
    }
    return currentMonth === 1 ? currentYear - 1 : currentYear;
};

const selectedMonth = ref(getSavedMonth());
const selectedYear = ref(getSavedYear());
const loading = ref(false);
const error = ref("");
const municipalities = ref<Municipality[]>([]);
const markerLayer = ref<L.LayerGroup | null>(null);
const activePopup = ref<L.Popup | null>(null);

// Search functionality
const searchQuery = ref("");
const isSearching = ref(false);
const allMunicipalities = ref<Municipality[]>([]);
const searchTimeout = ref<number | null>(null);

// Function to search for municipalities by name in both countries
async function searchMunicipalities(query: string) {
    if (!query.trim()) return;

    try {
        isSearching.value = true;

        console.log(`Searching for municipalities with query: ${query}`);

        // Search both countries in parallel
        const searchPromises = Object.keys(COUNTRY_CONFIGS).map(async (countryKey) => {
            const config = COUNTRY_CONFIGS[countryKey];

            try {
                // Try direct search first
                const response = await axios.get(
                    "https://public.opendatasoft.com/api/records/1.0/search/",
                    {
                        params: {
                            dataset: config.dataset,
                            rows: 5, // Limit per country
                            q: query,
                            refine: {
                                country_code: config.countryCode
                            }
                        }
                    }
                );

                return response.data.records.map((record: any) => processApiRecord(record, countryKey));
            } catch (error) {
                console.error(`Error searching ${countryKey}:`, error);

                // Fallback to client-side filtering of fallback cities
                return config.fallbackCities.filter((municipality: Municipality) =>
                    municipality.name.toLowerCase().includes(query.toLowerCase())
                ).slice(0, 3);
            }
        });

        const results = await Promise.all(searchPromises);
        const combinedResults = results.flat().slice(0, 10); // Limit total results

        console.log(`Found ${combinedResults.length} municipalities across both countries`);
        allMunicipalities.value = combinedResults;

    } catch (e) {
        console.error("Error searching municipalities:", e);
        error.value = "Error searching municipalities";
    } finally {
        isSearching.value = false;
    }
}

// Debounce search input to prevent excessive API calls
watch(searchQuery, (newQuery) => {
    if (searchTimeout.value) {
        clearTimeout(searchTimeout.value);
    }
    
    if (newQuery.trim().length > 0) {
        // Set a timeout to avoid making API calls on every keystroke
        searchTimeout.value = window.setTimeout(() => {
            searchMunicipalities(newQuery.trim());
        }, 300); // 300ms debounce
    }
});

const filteredMunicipalities = computed(() => {
    if (!searchQuery.value.trim()) return [];
    
    // No need to filter here as we're already getting filtered results from the API
    return allMunicipalities.value;
});

// Function to handle municipality selection from search
function selectMunicipality(municipality: Municipality) {
    if (!map.value) return;
    
    console.log("Selected municipality:", municipality);
    
    // Clear search
    searchQuery.value = "";
    
    // Zoom to the selected municipality
    map.value.setView(municipality.coordinates, 12);
    
    // Show the weather popup
    showMunicipalityWeather(municipality);
}

const { t, locale } = useI18n();

// Replace the months array with a computed property that uses translations
const months = computed(() => [
    t("months.january"),
    t("months.february"),
    t("months.march"),
    t("months.april"),
    t("months.may"),
    t("months.june"),
    t("months.july"),
    t("months.august"),
    t("months.september"),
    t("months.october"),
    t("months.november"),
    t("months.december"),
]);

// Generate available years (current year and 4 years back)
const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

// Compute available months based on selected year
const availableMonths = computed(() => {
    const monthNames = months.value;
    if (selectedYear.value === currentYear) {
        // For current year, only show months up to one month before current
        return Array.from({ length: currentMonth - 1 }, (_, i) => ({
            name: monthNames[i],
            value: i + 1,
        }));
    } else {
        return Array.from({ length: 12 }, (_, i) => ({
            name: monthNames[i],
            value: i + 1,
        }));
    }
});

// Watch for year changes to adjust month if needed
watch(selectedYear, (newYear) => {
    if (newYear === currentYear && selectedMonth.value >= currentMonth) {
        selectedMonth.value = currentMonth - 1;
    }
});

// Watch for locale changes to update the UI
watch(locale, async () => {
    // If there's an active popup, update it with the new language
    if (activePopup.value && map.value) {
        const popupLatLng = activePopup.value.getLatLng();
        if (popupLatLng) {
            const activeMunicipality = municipalities.value.find(
                (m) =>
                    m.coordinates[0] === popupLatLng.lat &&
                    m.coordinates[1] === popupLatLng.lng
            );
            if (activeMunicipality) {
                await showMunicipalityWeather(activeMunicipality);
            }
        }
    }
});

// Watch for month and year changes to save to cookies
watch([selectedMonth, selectedYear], ([month, year]) => {
    setCookie('selectedMonth', month.toString());
    setCookie('selectedYear', year.toString());
    
    // Also update any active popup
    if (activePopup.value && map.value) {
        const popupLatLng = activePopup.value.getLatLng();
        if (popupLatLng) {
            const activeMunicipality = municipalities.value.find(
                (m) =>
                    Math.abs(m.coordinates[0] - popupLatLng.lat) < 0.001 &&
                    Math.abs(m.coordinates[1] - popupLatLng.lng) < 0.001
            );
            if (activeMunicipality) {
                showMunicipalityWeather(activeMunicipality);
            }
        }
    }
});

// Function to get appropriate weather emojis based on temperature values
function getWeatherEmojis(
  maxTemp: number,
  minTemp: number,
  maxNightTemp: number | null,
  minNightTemp: number | null,
  rainyDays: number,
  cloudyDays: number,
  totalDays: number
): { 
  maxTempEmoji: string, 
  minTempEmoji: string, 
  nightEmoji: string, 
  rainEmoji: string, 
  cloudEmoji: string 
} {
  // Max temperature emoji
  let maxTempEmoji = '🌡️';
  if (maxTemp >= 38) {
    maxTempEmoji = '🔥'; // Fire for extremely hot
  } else if (maxTemp >= 30) {
    maxTempEmoji = '☀️'; // Sun for very hot
  } else if (maxTemp >= 20) {
    maxTempEmoji = '😎'; // Cool face for warm
  } else if (maxTemp >= 15) {
    maxTempEmoji = '🌤️'; // Sun with cloud for mild
  } else if (maxTemp >= 0) {
    maxTempEmoji = '🧥'; // Coat for cold
  } else {
    maxTempEmoji = '❄️'; // Freezing face for very cold
  }

  // Min temperature emoji using same thresholds but for min temperature
  let minTempEmoji = '🌡️';
  if (minTemp >= 38) {
    minTempEmoji = '🔥'; // Fire for extremely hot
  } else if (minTemp >= 30) {
    minTempEmoji = '☀️'; // Sun for very hot
  } else if (minTemp >= 20) {
    minTempEmoji = '😎'; // Cool face for warm
  } else if (minTemp >= 15) {
    minTempEmoji = '🌤️'; // Sun with cloud for mild
  } else if (minTemp >= 0) {
    minTempEmoji = '🧥'; // Coat for cold
  } else {
    minTempEmoji = '❄️'; // Freezing face for very cold
  }

  // Night temperature emoji
  let nightEmoji = '🌙';
  if (maxNightTemp !== null && minNightTemp !== null) {
    if (maxNightTemp >= 25) {
      nightEmoji = '🌡️'; // Hot night
    } else if (minNightTemp <= 5) {
      nightEmoji = '❄️'; // Cold night
    }
  }

  // Rain emoji based on percentage of rainy days
  let rainEmoji = '☔';
  const rainPercentage = (rainyDays / totalDays) * 100;
  if (rainPercentage === 0) {
    rainEmoji = '🏜️'; // Desert for no rain
  } else if (rainPercentage < 10) {
    rainEmoji = '💧'; // Droplet for very little rain
  } else if (rainPercentage < 30) {
    rainEmoji = '🌂'; // Umbrella for some rain
  } else if (rainPercentage < 60) {
    rainEmoji = '☔'; // Umbrella with rain for moderate rain
  } else {
    rainEmoji = '🌧️'; // Rain cloud for lots of rain
  }

  // Cloud emoji based on percentage of cloudy days
  let cloudEmoji = '☁️';
  const cloudPercentage = (cloudyDays / totalDays) * 100;
  if (cloudPercentage < 10) {
    cloudEmoji = '☀️'; // Sun for clear skies
  } else if (cloudPercentage < 30) {
    cloudEmoji = '🌤️'; // Sun with small cloud for mostly clear
  } else if (cloudPercentage < 60) {
    cloudEmoji = '⛅'; // Sun behind cloud for partly cloudy
  } else if (cloudPercentage < 80) {
    cloudEmoji = '🌥️'; // Sun behind large cloud for mostly cloudy
  } else {
    cloudEmoji = '☁️'; // Cloud for very cloudy
  }

  return { maxTempEmoji, minTempEmoji, nightEmoji, rainEmoji, cloudEmoji };
}

async function fetchMunicipalities() {
    if (!map.value) return;

    try {
        loading.value = true;
        error.value = "";

        const bounds = map.value.getBounds();

        // Fetch municipalities from both countries in parallel
        const fetchPromises = Object.keys(COUNTRY_CONFIGS).map(countryKey =>
            fetchMunicipalitiesForCountry(countryKey, bounds)
        );

        const results = await Promise.all(fetchPromises);
        const combinedMunicipalities = results.flat();

        if (markerLayer.value) {
            markerLayer.value.clearLayers();
        }

        municipalities.value = combinedMunicipalities;

        municipalities.value.forEach((municipality) => {
            // Create different marker colors for different countries
            const marker = L.marker(municipality.coordinates)
                .bindTooltip(`${municipality.name} (${municipality.country === 'spain' ? '🇪🇸' : '🇵🇹'})`)
                .on("click", () => showMunicipalityWeather(municipality));
            markerLayer.value?.addLayer(marker);
        });

        console.log(`Loaded ${municipalities.value.length} municipalities from both countries`);
    } catch (e) {
        error.value = "Error fetching municipalities";
        console.error("Error fetching municipalities:", e);
    } finally {
        loading.value = false;
    }
}

async function fetchWeatherData(
    coordinates: [number, number],
    municipality: Municipality
): Promise<string> {
    try {
        const [lat, lon] = coordinates;
        const timezone = getTimezoneForMunicipality(municipality);

        const response = await axios.get(
            "https://archive-api.open-meteo.com/v1/archive",
            {
                params: {
                    latitude: lat,
                    longitude: lon,
                    start_date: `${selectedYear.value}-${String(
                        selectedMonth.value
                    ).padStart(2, "0")}-01`,
                    end_date: `${selectedYear.value}-${String(
                        selectedMonth.value
                    ).padStart(2, "0")}-28`,
                    daily: "temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,precipitation_sum,cloud_cover_mean",
                    hourly: "temperature_2m",
                    timezone: timezone,
                },
            }
        );

        const maxTemps = response.data.daily.temperature_2m_max;
        const minTemps = response.data.daily.temperature_2m_min;
        const maxApparentTemps = response.data.daily.apparent_temperature_max;
        const minApparentTemps = response.data.daily.apparent_temperature_min;
        const precipitation = response.data.daily.precipitation_sum;
        const cloudCover = response.data.daily.cloud_cover_mean;

        // Process hourly data to extract night temperatures (22:00-05:00)
        const hourlyTimes = response.data.hourly.time;
        const hourlyTemps = response.data.hourly.temperature_2m;
        
        // Array to store night temperatures
        const nightTemps: number[] = [];
        
        // Filter for night hours (22:00-05:00)
        hourlyTimes.forEach((timeString: string, index: number) => {
            const hour = parseInt(timeString.split('T')[1].split(':')[0]);
            if (hour >= 22 || hour <= 5) {
                nightTemps.push(hourlyTemps[index]);
            }
        });
        
        // Calculate night temperature statistics
        const maxNightTemp = nightTemps.length > 0 ? Math.max(...nightTemps) : null;
        const minNightTemp = nightTemps.length > 0 ? Math.min(...nightTemps) : null;

        const maxTemp = Math.max(...maxTemps);
        const minTemp = Math.min(...minTemps);
        const maxApparentTemp = Math.max(...maxApparentTemps);
        const minApparentTemp = Math.min(...minApparentTemps);

        const daysOver30 = maxTemps.filter((temp: number) => temp >= 30).length;
        const daysOver35 = maxTemps.filter((temp: number) => temp >= 35).length;
        const daysOver40 = maxTemps.filter((temp: number) => temp >= 40).length;

        const rainyDays = precipitation.filter(
            (rain: number) => rain > 0.1
        ).length;
        const cloudyDays = cloudCover.filter(
            (cover: number) => cover > 70
        ).length;

        // Get appropriate emojis based on weather data
        const totalDays = maxTemps.length;
        const { maxTempEmoji, minTempEmoji, nightEmoji, rainEmoji, cloudEmoji } = getWeatherEmojis(
            maxTemp,
            minTemp,
            maxNightTemp,
            minNightTemp,
            rainyDays,
            cloudyDays,
            totalDays
        );

        // Build the HTML for the popup with improved layout
        let temperaturesHtml = `
      <strong>${t("weather.temperatureData", { month: months.value[selectedMonth.value - 1] })}</strong>
      <ul class="weather-data-list">
        <li><span class="weather-label">${t("weather.maxTemperature")}</span> <span class="weather-value">${maxTempEmoji} ${maxTemp.toFixed(1)}°C</span></li>
        <li><span class="weather-label">${t("weather.minTemperature")}</span> <span class="weather-value">${minTempEmoji} ${minTemp.toFixed(1)}°C</span></li>`;
        
        // Add night temperature section if data is available
        if (maxNightTemp !== null && minNightTemp !== null) {
            temperaturesHtml += `
        <li><span class="weather-label">${t("weather.nightTemperatures")}</span> <span class="weather-value">${nightEmoji} ${minNightTemp.toFixed(1)}°C - ${maxNightTemp.toFixed(1)}°C</span></li>`;
        }
        
        // Add apparent temperature section
        temperaturesHtml += `
        <li><span class="weather-label">${t("weather.apparentTemperatures")}</span> <span class="weather-value">${minApparentTemp.toFixed(1)}°C - ${maxApparentTemp.toFixed(1)}°C</span></li>
        <li><span class="weather-label">${t("weather.daysOver", { temp: 30 })}</span> <span class="weather-value">${daysOver30}</span></li>
        <li><span class="weather-label">${t("weather.daysOver", { temp: 35 })}</span> <span class="weather-value">${daysOver35}</span></li>
        <li><span class="weather-label">${t("weather.daysOver", { temp: 40 })}</span> <span class="weather-value">${daysOver40}</span></li>
      </ul>
      <strong>${t("weather.precipitationData")}</strong>
      <ul class="weather-data-list precipitation-list">
        <li><span class="weather-label">${t("weather.rainyDays")}</span> <span class="weather-value">${rainEmoji} ${rainyDays}</span></li>
        <li><span class="weather-label">${t("weather.cloudyDays")}</span> <span class="weather-value">${cloudEmoji} ${cloudyDays}</span></li>
      </ul>
    `;
        
        return temperaturesHtml;
    } catch (e) {
        console.error("Error fetching weather data:", e);
        return t("weather.errorData");
    }
}

async function showMunicipalityWeather(municipality: Municipality) {
    if (!map.value) return;

    // Close any existing popup without passing it as an argument
    if (activePopup.value && map.value) {
        (map.value as L.Map).closePopup();
        activePopup.value = null;
    }

    const countryFlag = municipality.country === 'spain' ? '🇪🇸' : '🇵🇹';
    const countryName = COUNTRY_CONFIGS[municipality.country].name;

    // Create and open a new popup
    activePopup.value = L.popup({
        className: 'weather-popup', // Add custom class for styling
        maxWidth: 350 // Increase max width for better readability
    }).setLatLng(municipality.coordinates)
        .setContent(`
      <div class="popup-content">
        <h3>${municipality.name} ${countryFlag}</h3>
        <p><small>${municipality.province}, ${countryName}</small></p>
        <p>${t("weather.loadingData")}</p>
      </div>
    `) as L.Popup;
    activePopup.value.openOn(map.value as L.Map);

    // Fetch and update weather data
    const weatherData = await fetchWeatherData(municipality.coordinates, municipality);
    if (activePopup.value) {
        activePopup.value.setContent(`
      <div class="popup-content">
        <h3>${municipality.name} ${countryFlag}</h3>
        <p><small>${municipality.province}, ${countryName}</small></p>
        ${weatherData}
        <p><i>${t("weather.month", { month: months.value[selectedMonth.value - 1], year: selectedYear.value })}</i></p>
      </div>
    `);
    }
}

onMounted(() => {
    // Wait a moment for the DOM to be fully rendered
    setTimeout(() => {
        // Initialize map with combined view for Spain and Portugal
        map.value = L.map("map").setView(COMBINED_MAP_CENTER, COMBINED_MAP_ZOOM);

        // Create tile layer and add it to the map
        const mapTileLayer = L.tileLayer(
            "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
            {
                maxZoom: 19,
                attribution: "© OpenStreetMap contributors",
            }
        );
        mapTileLayer.addTo(map.value as L.Map);

        // Initialize and add marker layer
        markerLayer.value = L.layerGroup();
        (markerLayer.value as L.LayerGroup).addTo(map.value as L.Map);

        // Initial fetch of municipalities
        fetchMunicipalities();
        
        // Refresh municipalities when map moves
        map.value.on("moveend", fetchMunicipalities);
        
        // Force a resize event to ensure the map renders correctly
        window.dispatchEvent(new Event('resize'));
    }, 100);
});
</script>

<template>
    <div class="weather-map-container">
        <div class="controls">
            <div class="select-container">
                <label for="month">{{ t("controls.month") }}</label>
                <select v-model="selectedMonth" id="month">
                    <option
                        v-for="month in availableMonths"
                        :key="month.value"
                        :value="month.value"
                    >
                        {{ month.name }}
                    </option>
                </select>
            </div>
            <div class="select-container">
                <label for="year">{{ t("controls.year") }}</label>
                <select v-model="selectedYear" id="year">
                    <option v-for="year in years" :key="year" :value="year">
                        {{ year }}
                    </option>
                </select>
            </div>
            
            <!-- Search box -->
            <div class="search-container">
                <label for="municipality-search">{{ t("controls.search") }}</label>
                <div class="search-input-container">
                    <input
                        type="text"
                        id="municipality-search"
                        v-model="searchQuery"
                        :placeholder="t('search.placeholder')"
                        autocomplete="off"
                    />
                    <button 
                        v-if="searchQuery.trim()" 
                        class="clear-search" 
                        @click="searchQuery = ''"
                        title="Clear search"
                    >
                        ×
                    </button>
                    <div v-if="searchQuery.trim() && (filteredMunicipalities.length > 0 || isSearching)" class="search-results">
                        <div v-if="isSearching" class="search-message">{{ t('search.searching') }}</div>
                        <div v-else-if="filteredMunicipalities.length === 0" class="search-message">{{ t('search.noResults') }}</div>
                        <ul v-else>
                            <li
                                v-for="municipality in filteredMunicipalities"
                                :key="municipality.id"
                                @click="selectMunicipality(municipality)"
                                class="search-result-item"
                            >
                                {{ municipality.name }} {{ municipality.country === 'spain' ? '🇪🇸' : '🇵🇹' }}
                                <small class="municipality-province">{{ municipality.province }}</small>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
            
            <div class="controls-spacer"></div>
            <LanguageSwitcher />
        </div>

        <div class="map-container">
            <div id="map"></div>
        </div>

        <div v-if="loading" class="loading">{{ t("weather.loading") }}</div>
        <div v-if="error" class="error">{{ t("weather.error") }}</div>
    </div>
</template>

<style scoped>
.weather-map-container {
    width: 100%;
    height: 100vh;
    display: flex;
    flex-direction: column;
    font-family: 'Lato', sans-serif;
    overflow: hidden; /* Prevent scrolling of the container */
}

.controls {
    padding: 1rem;
    background: white;
    display: flex;
    gap: 1rem;
    border-bottom: 1px solid #eee;
    z-index: 1001; /* Higher z-index to stay above map */
    font-family: 'Lato', sans-serif;
    align-items: center;
    flex-wrap: wrap; /* Allow items to wrap on smaller screens */
    position: fixed; /* Fixed position instead of sticky */
    top: 0;
    left: 0;
    right: 0;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); /* Add subtle shadow for visual separation */
}

.map-container {
    flex: 1;
    margin-top: 60px; /* Add margin to account for the fixed header height */
    position: relative;
    width: 100%;
    height: calc(100vh - 60px); /* Adjust height to account for the header */
}

.select-container {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.select-container label {
    font-weight: 500;
}

select {
    padding: 0.5rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-family: 'Lato', sans-serif;
    font-size: 1rem;
    min-width: 120px; /* Set minimum width to prevent tiny selects */
}

/* Search styles */
.search-container {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    position: relative;
    flex: 1;
    max-width: 300px;
}

.search-container label {
    font-weight: 500;
    white-space: nowrap;
}

.search-input-container {
    position: relative;
    flex: 1;
    width: 100%; /* Ensure container takes full width */
}

.search-input-container input {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-family: 'Lato', sans-serif;
    font-size: 1rem;
    padding-right: 30px; /* Make room for the clear button */
    box-sizing: border-box; /* Include padding and border in the width calculation */
}

.clear-search {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    font-size: 1.2rem;
    color: #999;
    cursor: pointer;
    padding: 0;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
}

.clear-search:hover {
    color: #333;
    background-color: #f0f0f0;
}

.search-results {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: white;
    border: 1px solid #ccc;
    border-radius: 0 0 4px 4px;
    max-height: 300px;
    overflow-y: auto;
    z-index: 1002;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.search-results ul {
    list-style: none;
    padding: 0;
    margin: 0;
}

.search-result-item {
    padding: 0.5rem 1rem;
    cursor: pointer;
    transition: background-color 0.2s;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.search-result-item:hover {
    background-color: #f0f0f0;
}

.municipality-province {
    color: #666;
    font-size: 0.85rem;
    margin-left: 0.5rem;
}

.search-message {
    padding: 0.5rem 1rem;
    color: #666;
    font-style: italic;
}

#map {
    width: 100%;
    height: 100%;
    z-index: 1;
}

.loading,
.error {
    position: fixed;
    bottom: 1rem;
    left: 50%;
    transform: translateX(-50%);
    padding: 0.5rem 1rem;
    border-radius: 4px;
    z-index: 1000;
}

.loading {
    background: rgba(255, 255, 255, 0.9);
}

.error {
    background: rgba(255, 0, 0, 0.1);
    color: red;
}

.controls-spacer {
    flex: 1;
    min-width: 20px; /* Ensure the spacer doesn't collapse completely on small screens */
}

/* Responsive adjustments for mobile */
@media (max-width: 640px) {
    .controls {
        padding: 0.75rem;
        flex-direction: column;
        align-items: flex-start;
        gap: 0.75rem;
    }
    
    .select-container, .search-container {
        width: 100%;
        display: flex;
        justify-content: space-between;
        max-width: none;
    }
    
    .select-container label, .search-container label {
        min-width: 70px; /* Fixed width for labels on mobile */
        width: 70px;
        text-align: right; /* Right-align labels */
        margin-right: 10px; /* Add some space between label and input */
    }
    
    select, .search-input-container {
        flex: 1;
        width: calc(100% - 80px); /* Consistent width for all inputs */
    }
    
    .controls-spacer {
        display: none; /* Hide the spacer on mobile */
    }
    
    .map-container {
        margin-top: 180px; /* Increase margin for mobile to account for taller header */
        height: calc(100vh - 180px); /* Adjust height for mobile */
    }
}

/* Add global styles for the popup */
:global(.weather-popup) {
    font-family: 'Lato', sans-serif;
    font-size: 1rem; /* Set base font size to 1rem (16px) */
    min-width: 320px; /* Set minimum width for the popup */
}

:global(.weather-popup .popup-content) {
    font-size: 1rem;
    line-height: 1.5;
    font-weight: 400;
    width: 100%; /* Ensure content takes full width of the popup */
}

:global(.weather-popup h3) {
    font-family: 'Lato', sans-serif;
    font-size: 1.25rem;
    font-weight: 700;
    margin-top: 0;
    margin-bottom: 0.75rem;
    color: #2b82cb;
}

:global(.weather-popup ul.weather-data-list) {
    margin: 0.5rem 0;
    padding-left: 0;
    list-style-type: none;
}

:global(.weather-popup li) {
    margin-bottom: 0.5rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

:global(.weather-popup .weather-label) {
    font-weight: 500;
    color: #333;
    flex: 0 0 45%;
}

:global(.weather-popup .weather-value) {
    font-weight: 300;
    text-align: right;
    flex: 0 0 55%;
}

:global(.weather-popup .precipitation-list .weather-label) {
    flex: 0 0 60%;
}

:global(.weather-popup .precipitation-list .weather-value) {
    flex: 0 0 40%;
}

:global(.weather-popup strong) {
    font-family: 'Lato', sans-serif;
    font-weight: 700;
    color: #2b82cb;
    display: block;
    margin-top: 1rem;
    border-bottom: 1px solid #eee;
    padding-bottom: 0.25rem;
}

:global(.weather-popup i) {
    font-family: 'Lato', sans-serif;
    font-style: italic;
    font-weight: 400;
    color: #666;
    font-size: 0.9rem;
}
</style>
