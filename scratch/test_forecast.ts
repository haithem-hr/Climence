import { fetchOpenMeteoHistory } from './backend/src/features/analytics/openMeteo';
import { computeForecast } from './backend/src/features/analytics/forecast';

async function test() {
  try {
    console.log("Fetching history from Open-Meteo...");
    const history = await fetchOpenMeteoHistory(24.7136, 46.6753);
    console.log(`Fetched ${history.length} points.`);
    
    const forecast = computeForecast(history, 168);
    console.log(`Generated ${forecast.length} forecast points.`);
    if (forecast.length > 0) {
      console.log("First forecast point:", forecast[0]);
      console.log("Last forecast point:", forecast[forecast.length - 1]);
    }
  } catch (err) {
    console.error("Test failed:", err);
  }
}

test();
