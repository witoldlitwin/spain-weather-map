# Cursor Context

## Current Implementation Status
- **Weather Map**: Implemented with Leaflet.js and Open-Meteo API
- **Internationalization**: Added with Vue I18n (English and Polish)
- **Night Temperature**: Fixed to show actual night temperatures (22:00-05:00) using hourly data
- **UI Improvements**: Enhanced popup styling with better readability and font size
- **User Preferences**: Added cookie storage for month and year selections
- **Weather Emojis**: Added dynamic emojis that change based on weather conditions and positioned next to their corresponding values
- **Popup Layout**: Optimized for single-line display of each data point with two-column layout and refined icon placement
- **Typography**: Standardized with Lato font family throughout the application
- **Popup Sizing**: Increased popup width for better content display

## What's Working
- Weather data fetching from Open-Meteo API
- Map display with municipality markers
- Temperature data display in popups with improved styling and layout
- Language switching between English and Polish
- Night temperature calculation using hourly data
- Browser language detection for initial language
- Persistence of user's month and year selections via cookies
- Dynamic weather emojis that reflect actual weather conditions, positioned appropriately
- Compact, single-line display of weather data points with optimized spacing
- Consistent typography with Lato font family across all UI elements

## What's Broken
- None currently known

## Current Blockers
- None currently

## Next Features to Implement
- Consider adding more languages
- Potentially add more weather data visualization options
- Mobile responsiveness improvements
- Additional UI enhancements for better user experience
- Save additional user preferences (map position, zoom level)
- Add tooltips to explain what each emoji represents
- Consider color coding for temperature values
- Add compact mode for very small screens

## Notes
- The language preference is saved to localStorage
- Night temperatures are calculated by filtering hourly data for hours between 22:00 and 05:00
- Popup styling uses global CSS with the :global() selector to target Leaflet-generated elements
- Month and year preferences are stored in cookies with a 365-day expiration
- Cookie values are validated on retrieval to ensure they're within valid ranges
- Weather emojis are dynamically selected based on temperature ranges and weather conditions
- Emoji selection logic is contained in the getWeatherEmojis function
- Emojis are positioned to the left of their corresponding data values
- Popup layout uses flexbox for two-column alignment of labels and values
- Text labels have been shortened in both languages for better space efficiency
- Precipitation section uses a 60/40 column split to accommodate longer text
- Left padding has been reduced to 0.5rem for more compact display
- Lato font is loaded from Google Fonts with multiple weights (300, 400, 700, 900) and styles (normal, italic)
- Font weights are used consistently: semi-bold (600) for labels, regular (400) for content, bold (700) for important data
- Popup width has been increased from 300px to 350px with a minimum width of 320px 