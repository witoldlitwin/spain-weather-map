<script setup lang="ts">
import { onMounted, ref, watch, computed } from "vue";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import axios from "axios";

interface Municipality {
    id: string;
    name: string;
    coordinates: [number, number];
}

const map = ref<L.Map | null>(null);
const currentDate = new Date();
const currentYear = currentDate.getFullYear();
const currentMonth = currentDate.getMonth() + 1; // 1-indexed month

const selectedMonth = ref(Math.min(currentMonth - 1, 12) || 12); // Default to previous month or December
const selectedYear = ref(currentMonth === 1 ? currentYear - 1 : currentYear); // If current month is January, default to previous year
const loading = ref(false);
const error = ref("");
const municipalities = ref<Municipality[]>([]);
const markerLayer = ref<L.LayerGroup | null>(null);
const activePopup = ref<L.Popup | null>(null);

const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
];

// Generate available years (current year and 4 years back)
const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

// Compute available months based on selected year
const availableMonths = computed(() => {
    if (selectedYear.value === currentYear) {
        // For current year, only show months up to one month before current
        return months.slice(0, currentMonth - 1).map((name, index) => ({
            name,
            value: index + 1,
        }));
    } else {
        // For past years, show all months
        return months.map((name, index) => ({
            name,
            value: index + 1,
        }));
    }
});

// Watch for year changes to adjust month if needed
watch(selectedYear, (newYear) => {
    if (newYear === currentYear) {
        // If new year is current year and selected month is not available,
        // set to the last available month
        if (selectedMonth.value >= currentMonth) {
            selectedMonth.value = currentMonth - 1;
        }
    }
});

async function fetchMunicipalities() {
    if (!map.value) return;

    try {
        loading.value = true;
        error.value = "";

        const bounds = map.value.getBounds();
        // Format the polygon coordinates according to the API documentation
        const polygonCoords = `(${bounds.getNorthWest().lat}, ${
            bounds.getNorthWest().lng
        }), (${bounds.getNorthEast().lat}, ${bounds.getNorthEast().lng}), (${
            bounds.getSouthEast().lat
        }, ${bounds.getSouthEast().lng}), (${bounds.getSouthWest().lat}, ${
            bounds.getSouthWest().lng
        })`;

        let response;
        try {
            // Try with polygon filter first
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
                "Polygon filter failed, trying with bounding box:",
                polygonError
            );

            // Fallback to a simpler query without geo filtering
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

        // Process the data from the OpenDataSoft API format
        municipalities.value = response.data.records.map((record: any) => {
            // Check if geo_point_2d exists and has the expected format
            let coordinates: [number, number] = [0, 0];

            if (record.fields && record.fields.geo_point_2d) {
                // The geo_point_2d field might be an array [lat, lon] or an object with lat/lon properties
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
                    timezone: "Europe/Madrid",
                },
            }
        );

        const maxTemps = response.data.daily.temperature_2m_max;
        const minTemps = response.data.daily.temperature_2m_min;
        const maxNightTemps = response.data.daily.apparent_temperature_max;
        const minNightTemps = response.data.daily.apparent_temperature_min;
        const precipitation = response.data.daily.precipitation_sum;
        const cloudCover = response.data.daily.cloud_cover_mean;

        // Calculate temperature statistics
        const maxTemp = Math.max(...maxTemps);
        const minTemp = Math.min(...minTemps);
        const maxNightTemp = Math.max(...maxNightTemps);
        const minNightTemp = Math.min(...minNightTemps);

        // Count days over specific temperature thresholds
        const daysOver30 = maxTemps.filter((temp: number) => temp >= 30).length;
        const daysOver35 = maxTemps.filter((temp: number) => temp >= 35).length;
        const daysOver40 = maxTemps.filter((temp: number) => temp >= 40).length;

        // Count rainy and cloudy days
        const rainyDays = precipitation.filter((rain: number) => rain > 0.1).length;
        const cloudyDays = cloudCover.filter((cover: number) => cover > 70).length;

        return `
      <strong>Temperature Data for ${months[selectedMonth.value - 1]}:</strong>
      <ul>
        <li><strong>Maximum Temperature:</strong> ${maxTemp.toFixed(1)}°C</li>
        <li><strong>Minimum Temperature:</strong> ${minTemp.toFixed(1)}°C</li>
        <li><strong>Night Temperatures:</strong><br />
            Min: ${minNightTemp.toFixed(1)}°C / Max: ${maxNightTemp.toFixed(1)}°C</li>
        <li>Days over 30°C: ${daysOver30}</li>
        <li>Days over 35°C: ${daysOver35}</li>
        <li>Days over 40°C: ${daysOver40}</li>
      </ul>
      <strong>Precipitation & Cloud Data:</strong>
      <ul>
        <li>Rainy Days (>0.1mm): ${rainyDays}</li>
        <li>Cloudy Days (>70%): ${cloudyDays}</li>
      </ul>
    `;
    } catch (e) {
        console.error("Error fetching weather data:", e);
        return "Error fetching weather data";
    }
}

async function showMunicipalityWeather(municipality: Municipality) {
    if (!map.value) return;

    // Close any existing popup
    if (activePopup.value) {
        map.value.closePopup();
    }

    // Create and show new popup
    activePopup.value = L.popup()
        .setLatLng(municipality.coordinates)
        .setContent(
            `
      <div>
        <h3>${municipality.name}</h3>
        <p>Loading weather data...</p>
      </div>
    `
        );
    
    // Open the popup on the map with type assertion
    activePopup.value.openOn(map.value as L.Map);

    // Fetch and update weather data
    const weatherData = await fetchWeatherData(municipality.coordinates);

    if (activePopup.value) {
        activePopup.value.setContent(`
      <div>
        <h3>${municipality.name}</h3>
        ${weatherData}
        <p><i>Month: ${months[selectedMonth.value - 1]} ${selectedYear.value}</i></p>
      </div>
    `);
    }
}

// Watch for date changes and update active popup
watch([selectedMonth, selectedYear], async () => {
    if (activePopup.value && map.value) {
        const popupLatLng = activePopup.value.getLatLng();
        if (popupLatLng) {
            const activeMunicipality = municipalities.value.find((m) => 
                m.coordinates[0] === popupLatLng.lat && 
                m.coordinates[1] === popupLatLng.lng
            );

            if (activeMunicipality) {
                await showMunicipalityWeather(activeMunicipality);
            }
        }
    }
});

onMounted(() => {
    // Initialize map
    map.value = L.map("map").setView([40.4, -3.7], 6);

    // Add OpenStreetMap tiles with type assertion
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap contributors",
    }).addTo(map.value as L.Map);

    // Initialize marker layer
    markerLayer.value = L.layerGroup();
    // Add to map with type assertion
    markerLayer.value.addTo(map.value as L.Map);

    // Initial fetch of municipalities
    fetchMunicipalities();

    // Update municipalities when map moves
    map.value.on("moveend", fetchMunicipalities);
});
</script>

<template>
    <div class="weather-map-container">
        <div class="controls">
            <div class="select-container">
                <label for="month">Month:</label>
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
                <label for="year">Year:</label>
                <select v-model="selectedYear" id="year">
                    <option v-for="year in years" :key="year" :value="year">
                        {{ year }}
                    </option>
                </select>
            </div>
        </div>

        <div id="map"></div>

        <div v-if="loading" class="loading">Loading municipalities...</div>
        <div v-if="error" class="error">{{ error }}</div>
    </div>
</template>

<style scoped>
.weather-map-container {
    width: 100%;
    height: 100vh;
    display: flex;
    flex-direction: column;
}

.controls {
    padding: 1rem;
    background: white;
    display: flex;
    gap: 1rem;
    z-index: 1000;
    border-bottom: 1px solid #eee;
}

.select-container {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

select {
    padding: 0.5rem;
    border: 1px solid #ccc;
    border-radius: 4px;
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
</style>
