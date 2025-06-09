# Spain & Portugal Weather Map Enhancement

## Project Goal
Extend the existing Spain weather map to simultaneously display municipalities from both Spain and Portugal:
1. Load and display municipalities from both countries on the same map
2. Maintain existing weather analysis functionality for both datasets
3. Provide unified search functionality across both countries
4. Ensure seamless user experience with combined data visualization

## Implementation Steps

### 1. Multi-Country Data Source Configuration

#### A. Create Country Configuration System
```typescript
interface CountryConfig {
    name: string;
    dataset: string;
    countryCode: string;
    fieldMappings: {
        municipalityName: string;
        provinceName: string;
        coordinates: string;
    };
    mapCenter: [number, number];
    timezone: string;
    fallbackCities: Municipality[];
}

const COUNTRY_CONFIGS = {
    spain: {
        name: "Spain",
        dataset: "georef-spain-municipio",
        countryCode: "ESP",
        fieldMappings: {
            municipalityName: "mun_name",
            provinceName: "prov_name",
            coordinates: "geo_point_2d"
        },
        mapCenter: [40.4, -3.7],
        timezone: "Europe/Madrid",
        fallbackCities: [/* existing Spanish cities */]
    },
    portugal: {
        name: "Portugal",
        dataset: "georef-portugal-concelho",
        countryCode: "PRT",
        fieldMappings: {
            municipalityName: "con_name",
            provinceName: "dis_name",
            coordinates: "geo_point_2d"
        },
        mapCenter: [39.5, -8.0],
        timezone: "Europe/Lisbon",
        fallbackCities: [/* Portuguese cities */]
    }
};
```

#### B. Update Municipality Interface
```typescript
interface Municipality {
    id: string;
    name: string;
    coordinates: [number, number];
    province: string;
    country: 'spain' | 'portugal';
    countryCode: string;
}
```

### 2. Enhanced Data Fetching Implementation

#### A. Parallel Municipality Loading
1. Modify `fetchMunicipalities()` to load from both datasets simultaneously
2. Use `Promise.all()` for concurrent API calls to both Spanish and Portuguese endpoints
3. Implement unified error handling for both data sources
4. Merge results into single municipality array with country identification

#### B. Update Data Processing Pipeline
1. Create data adapter functions to normalize different field structures
2. Add country identification to each municipality record
3. Implement unified coordinate extraction for both data formats
4. Handle different province/district naming conventions

### 3. Map Visualization Updates

#### A. Unified Map Bounds
1. Calculate combined bounding box for Spain and Portugal
2. Update initial map center to show both countries: approximately [39.8, -6.0]
3. Adjust default zoom level to encompass both countries (zoom level ~5)
4. Implement dynamic bounds calculation based on loaded data

#### B. Enhanced Marker System
1. Add country identification to marker data
2. Consider subtle visual differences for Spanish vs Portuguese municipalities
3. Update popup content to include country information
4. Ensure marker clustering works efficiently with increased data volume

### 4. Search and Filter Enhancements

#### A. Cross-Country Search
1. Update `searchMunicipalities()` to search both datasets
2. Implement parallel search across Spanish and Portuguese APIs
3. Merge and deduplicate search results
4. Add country indicators in search result display

#### B. Enhanced Search UI
1. Update search placeholder text to indicate multi-country support
2. Show country information in search results dropdown
3. Maintain existing search performance with larger dataset

### 5. Weather Data Integration

#### A. Timezone-Aware Weather Fetching
1. Update `fetchWeatherData()` to use appropriate timezone based on municipality country
2. Handle timezone differences between Spanish and Portuguese locations
3. Ensure weather API calls work correctly for Portuguese coordinates
4. Maintain existing weather data format and display

#### B. Enhanced Weather Display
1. Update popup content to show country-specific timezone information
2. Ensure weather data accuracy for both Spanish and Portuguese locations
3. Maintain existing temperature and precipitation display formats

### 6. Performance Optimization

#### A. Efficient Data Loading
1. Implement smart batching for dual-country data loading
2. Add loading indicators that show progress for both countries
3. Optimize memory usage with larger combined dataset
4. Implement efficient map bounds filtering for both countries

#### B. Error Handling and Fallbacks
1. Create Portuguese fallback city data similar to existing Spanish fallbacks
2. Handle partial failures (one country loads, other fails)
3. Implement graceful degradation for API unavailability
4. Add country-specific error messaging

## Success Criteria
1. Successful loading and display of municipalities from both Spain and Portugal
2. Unified search functionality working across both countries
3. Weather data retrieval working correctly for both Spanish and Portuguese locations
4. Map performance maintained with increased data volume (< 3 seconds initial load)
5. Seamless user experience with no indication of underlying complexity

## Timeline
- Week 1: Country configuration system and data structure updates
- Week 2: Parallel data loading and processing implementation
- Week 3: Map visualization and search functionality updates
- Week 4: Weather integration and timezone handling
- Week 5: Performance optimization and testing

## Resources Needed
1. OpenDataSoft API access for both Spanish and Portuguese datasets
2. Open-Meteo API for weather data (existing)
3. Testing with both Spanish and Portuguese municipality data
4. Performance testing with larger combined dataset
5. Cross-browser validation for enhanced functionality


