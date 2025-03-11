<script setup lang="ts">
import { onMounted, ref, watch, computed } from "vue";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import axios from "axios";
import { useI18n } from "vue-i18n";
import LanguageSwitcher from './LanguageSwitcher.vue';

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

interface Municipality {
    id: string;
    name: string;
    coordinates: [number, number];
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
                    m.coordinates[0] === popupLatLng.lat &&
                    m.coordinates[1] === popupLatLng.lng
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
        const polygonCoords = `(${bounds.getNorthWest().lat}, ${
            bounds.getNorthWest().lng
        }), (${bounds.getNorthEast().lat}, ${bounds.getNorthEast().lng}), (${
            bounds.getSouthEast().lat
        }, ${bounds.getSouthEast().lng}), (${bounds.getSouthWest().lat}, ${
            bounds.getSouthWest().lng
        })`;

        let response;
        try {
            response = await axios.get(
                "https://public.opendatasoft.com/api/records/1.0/search/",
                {
                    params: {
                        dataset: "georef-spain-municipio",
                        rows: 100,
                        "geofilter.polygon": polygonCoords,
                    },
                }
            );
        } catch (polygonError) {
            console.error(
                "Polygon filter failed, trying bounding box:",
                polygonError
            );
            response = await axios.get(
                "https://public.opendatasoft.com/api/records/1.0/search/",
                {
                    params: {
                        dataset: "georef-spain-municipio",
                        rows: 100,
                        q: `country_code:ESP`,
                    },
                }
            );
        }

        if (markerLayer.value) {
            markerLayer.value.clearLayers();
        }

        municipalities.value = response.data.records.map((record: any) => {
            let coordinates: [number, number] = [0, 0];
            if (record.fields && record.fields.geo_point_2d) {
                if (Array.isArray(record.fields.geo_point_2d)) {
                    coordinates = [
                        record.fields.geo_point_2d[0],
                        record.fields.geo_point_2d[1],
                    ] as [number, number];
                } else if (typeof record.fields.geo_point_2d === "object") {
                    coordinates = [
                        record.fields.geo_point_2d.lat || 0,
                        record.fields.geo_point_2d.lon || 0,
                    ] as [number, number];
                }
            }
            return {
                id: record.recordid,
                name: record.fields.mun_name || "Unknown",
                coordinates,
            };
        });

        municipalities.value.forEach((municipality) => {
            const marker = L.marker(municipality.coordinates)
                .bindTooltip(municipality.name)
                .on("click", () => showMunicipalityWeather(municipality));
            markerLayer.value?.addLayer(marker);
        });
    } catch (e) {
        error.value = "Error fetching municipalities";
        console.error("Error fetching municipalities:", e);
    } finally {
        loading.value = false;
    }
}

async function fetchWeatherData(
    coordinates: [number, number]
): Promise<string> {
    try {
        const [lat, lon] = coordinates;
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
                    timezone: "Europe/Madrid",
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

    // Create and open a new popup
    activePopup.value = L.popup({
        className: 'weather-popup', // Add custom class for styling
        maxWidth: 350 // Increase max width for better readability
    }).setLatLng(municipality.coordinates)
        .setContent(`
      <div class="popup-content">
        <h3>${municipality.name}</h3>
        <p>${t("weather.loadingData")}</p>
      </div>
    `) as L.Popup;
    activePopup.value.openOn(map.value as L.Map);

    // Fetch and update weather data
    const weatherData = await fetchWeatherData(municipality.coordinates);
    if (activePopup.value) {
        activePopup.value.setContent(`
      <div class="popup-content">
        <h3>${municipality.name}</h3>
        ${weatherData}
        <p><i>${t("weather.month", { month: months.value[selectedMonth.value - 1], year: selectedYear.value })}</i></p>
      </div>
    `);
    }
}

onMounted(() => {
    // Initialize map
    map.value = L.map("map").setView([40.4, -3.7], 6);

    // Create tile layer and add it to the map
    const tileLayer = L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            maxZoom: 19,
            attribution: "© OpenStreetMap contributors",
        }
    );
    tileLayer.addTo(map.value as L.Map);

    // Initialize and add marker layer
    markerLayer.value = L.layerGroup();
    (markerLayer.value as L.LayerGroup).addTo(map.value as L.Map);

    // Initial fetch of municipalities
    fetchMunicipalities();
    // Refresh municipalities when map moves
    map.value.on("moveend", fetchMunicipalities);
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
            <div class="controls-spacer"></div>
            <LanguageSwitcher />
        </div>

        <div id="map"></div>

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
}

.controls {
    padding: 1rem;
    background: white;
    display: flex;
    gap: 1rem;
    border-bottom: 1px solid #eee;
    z-index: 1000;
    font-family: 'Lato', sans-serif;
    align-items: center;
    flex-wrap: wrap; /* Allow items to wrap on smaller screens */
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

#map {
    flex: 1;
    width: 100%;
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
    
    .select-container {
        width: 100%;
        justify-content: space-between;
    }
    
    select {
        flex: 1;
        max-width: calc(100% - 100px); /* Give space for the label */
    }
    
    .controls-spacer {
        display: none; /* Hide the spacer on mobile */
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
