# Spain & Portugal Weather Map

An interactive map application that displays historical weather data for municipalities in both Spain and Portugal.

## Features

- Interactive map showing municipalities from both Spain and Portugal
- Historical weather data for each municipality with timezone-aware calculations
- Search functionality across both countries
- Filter by month and year
- Country identification with flags and province information

## Technologies Used

- Cursor as AI code generator
- Vue.js 3 with TypeScript
- Leaflet for map visualization
- Axios for API requests
- OpenDataSoft API for Spanish and Portuguese municipality data
- Open-Meteo API for historical weather data

## Getting Started

### Prerequisites

- Node.js (v14 or later)
- npm or yarn

### Installation

1. Clone the repository
```bash
git clone <repository-url>
cd spain-weather-map
```

2. Install dependencies
```bash
npm install
# or
yarn install
```

3. Start the development server
```bash
npm run dev
# or
yarn dev
```

4. Open your browser and navigate to `http://localhost:5173`

## API Usage

This application uses two main APIs:

1. **OpenDataSoft API** - For retrieving Spanish municipality data
   - Endpoint: `https://public.opendatasoft.com/api/records/1.0/search/`
   - Dataset: `georef-spain-municipio`

2. **Open-Meteo API** - For historical weather data
   - Endpoint: `https://archive-api.open-meteo.com/v1/archive`

## Building for Production

```bash
npm run build
# or
yarn build
```

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- OpenDataSoft for providing the municipality data
- Open-Meteo for the weather data API
- OpenStreetMap contributors for the map tiles
- [Spain icons created by amoghdesign - Flaticon](https://www.flaticon.com/free-icons/spain)
