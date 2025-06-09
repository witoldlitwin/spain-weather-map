export interface Municipality {
    id: string;
    name: string;
    coordinates: [number, number];
    province: string;
    country: 'spain' | 'portugal';
    countryCode: string;
}

export interface CountryConfig {
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

// Fallback cities for Spain
const spanishFallbackCities: Municipality[] = [
    {
        id: 'madrid-fallback',
        name: 'Madrid',
        coordinates: [40.4168, -3.7038],
        province: 'Madrid',
        country: 'spain',
        countryCode: 'ESP'
    },
    {
        id: 'barcelona-fallback',
        name: 'Barcelona',
        coordinates: [41.3851, 2.1734],
        province: 'Barcelona',
        country: 'spain',
        countryCode: 'ESP'
    },
    {
        id: 'valencia-fallback',
        name: 'Valencia',
        coordinates: [39.4699, -0.3763],
        province: 'Valencia',
        country: 'spain',
        countryCode: 'ESP'
    },
    {
        id: 'sevilla-fallback',
        name: 'Sevilla',
        coordinates: [37.3891, -5.9845],
        province: 'Sevilla',
        country: 'spain',
        countryCode: 'ESP'
    },
    {
        id: 'bilbao-fallback',
        name: 'Bilbao',
        coordinates: [43.2627, -2.9253],
        province: 'Bizkaia',
        country: 'spain',
        countryCode: 'ESP'
    }
];

// Fallback cities for Portugal
const portugueseFallbackCities: Municipality[] = [
    {
        id: 'lisboa-fallback',
        name: 'Lisboa',
        coordinates: [38.7223, -9.1393],
        province: 'Lisboa',
        country: 'portugal',
        countryCode: 'PRT'
    },
    {
        id: 'porto-fallback',
        name: 'Porto',
        coordinates: [41.1579, -8.6291],
        province: 'Porto',
        country: 'portugal',
        countryCode: 'PRT'
    },
    {
        id: 'coimbra-fallback',
        name: 'Coimbra',
        coordinates: [40.2033, -8.4103],
        province: 'Coimbra',
        country: 'portugal',
        countryCode: 'PRT'
    },
    {
        id: 'braga-fallback',
        name: 'Braga',
        coordinates: [41.5518, -8.4229],
        province: 'Braga',
        country: 'portugal',
        countryCode: 'PRT'
    },
    {
        id: 'faro-fallback',
        name: 'Faro',
        coordinates: [37.0194, -7.9322],
        province: 'Faro',
        country: 'portugal',
        countryCode: 'PRT'
    }
];

export const COUNTRY_CONFIGS: Record<string, CountryConfig> = {
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
        fallbackCities: spanishFallbackCities
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
        fallbackCities: portugueseFallbackCities
    }
};

// Combined map center to show both countries
export const COMBINED_MAP_CENTER: [number, number] = [39.8, -6.0];
export const COMBINED_MAP_ZOOM = 5;

// Helper function to get timezone for a municipality
export function getTimezoneForMunicipality(municipality: Municipality): string {
    return COUNTRY_CONFIGS[municipality.country].timezone;
}

// Helper function to get all fallback cities
export function getAllFallbackCities(): Municipality[] {
    return [
        ...spanishFallbackCities,
        ...portugueseFallbackCities
    ];
}
