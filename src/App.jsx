import { useState, useEffect } from "react";
import "./App.css";


const GEO_URL = "https://geocoding-api.open-meteo.com/v1/search";
const WEATHER_URL = "https://api.open-meteo.com/v1/forecast";


function describe(code, isDay) {
  if (code === 0) return { text: "Clear sky", icon: isDay ? "☀️" : "🌙", sky: isDay ? "clear-day" : "clear-night" };
  if (code <= 2) return { text: "Partly cloudy", icon: isDay ? "⛅" : "☁️", sky: isDay ? "clear-day" : "clear-night" };
  if (code === 3) return { text: "Overcast", icon: "☁️", sky: "cloudy" };
  if (code <= 48) return { text: "Foggy", icon: "🌫️", sky: "fog" };
  if (code <= 57) return { text: "Drizzle", icon: "🌦️", sky: "rain" };
  if (code <= 67) return { text: "Rain", icon: "🌧️", sky: "rain" };
  if (code <= 77) return { text: "Snow", icon: "❄️", sky: "snow" };
  if (code <= 82) return { text: "Rain showers", icon: "🌧️", sky: "rain" };
  if (code <= 86) return { text: "Snow showers", icon: "🌨️", sky: "snow" };
  return { text: "Thunderstorm", icon: "⛈️", sky: "storm" };
}


async function fetchWeather(query) {
  const geoRes = await fetch(`${GEO_URL}?name=${encodeURIComponent(query)}&count=1&language=en`);
  if (!geoRes.ok) throw new Error("network");
  const geo = await geoRes.json();

  
  if (!geo.results || geo.results.length === 0) throw new Error("not-found");
  const place = geo.results[0];

  const params = new URLSearchParams({
    latitude: place.latitude,
    longitude: place.longitude,
    current: "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,is_day",
    daily: "weather_code,temperature_2m_max,temperature_2m_min",
    timezone: "auto",
  });
  const weatherRes = await fetch(`${WEATHER_URL}?${params}`);
  if (!weatherRes.ok) throw new Error("network");
  const weather = await weatherRes.json();

  return { place, weather };
}

const convert = (c, unit) => Math.round(unit === "C" ? c : (c * 9) / 5 + 32);



function SearchBar({ onSearch, loading }) {
  const [text, setText] = useState("");

  function handleSubmit(e) {
    e.preventDefault(); 
    if (text.trim()) onSearch(text.trim());
  }

  return (
    <form className="search" onSubmit={handleSubmit} role="search">
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Search a city or country"
        aria-label="City or country name"
        autoComplete="off"
      />
      <button type="submit" disabled={loading}>Search</button>
    </form>
  );
}

function Message({ icon, title, text, isError, loading }) {
  return (
    <section className={`message ${isError ? "error" : ""}`} aria-live="polite">
      {loading ? <div className="spinner" /> : <div className="big">{icon}</div>}
      <h2>{title}</h2>
      <p>{text}</p>
    </section>
  );
}

function Forecast({ daily, unit }) {
  return (
    <div className="forecast" aria-label="5 day forecast">
      {daily.time.slice(0, 5).map((date, i) => (
        <div className="day" key={date}>
          <div className="name">
            {i === 0 ? "Today" : new Date(date + "T00:00").toLocaleDateString("en", { weekday: "short" })}
          </div>
          <div className="emoji">{describe(daily.weather_code[i], 1).icon}</div>
          <div className="hi">{convert(daily.temperature_2m_max[i], unit)}°</div>
          <div className="lo">{convert(daily.temperature_2m_min[i], unit)}°</div>
        </div>
      ))}
    </div>
  );
}

function WeatherCard({ data, unit, setUnit }) {
  const { place, weather } = data;
  const now = weather.current;
  const info = describe(now.weather_code, now.is_day);

  return (
   
    <section className="card" key={place.id}>
      <div className="place">
        <div>
          <h1>{place.name}</h1>
          <p>{[place.admin1, place.country].filter(Boolean).join(", ")}</p>
        </div>
        <div className="unit-toggle" role="group" aria-label="Temperature unit">
          {["C", "F"].map((u) => (
            <button key={u} type="button" aria-pressed={unit === u} onClick={() => setUnit(u)}>
              °{u}
            </button>
          ))}
        </div>
      </div>

      <div className="now">
        <div className="icon" aria-hidden="true">{info.icon}</div>
        <div className="temp">
          {convert(now.temperature_2m, unit)}
          <sup>°{unit}</sup>
        </div>
      </div>
      <p className="condition">{info.text}</p>

      <div className="stats">
        <div className="stat"><span>Feels like</span><strong>{convert(now.apparent_temperature, unit)}°</strong></div>
        <div className="stat"><span>Humidity</span><strong>{now.relative_humidity_2m}%</strong></div>
        <div className="stat"><span>Wind</span><strong>{Math.round(now.wind_speed_10m)} km/h</strong></div>
      </div>

      <Forecast daily={weather.daily} unit={unit} />
    </section>
  );
}



export default function App() {
  const [status, setStatus] = useState("idle"); // idle | loading | success | not-found | network
  const [data, setData] = useState(null);
  const [unit, setUnit] = useState("C");
  const [lastQuery, setLastQuery] = useState("");

  async function handleSearch(query) {
    setStatus("loading");
    setLastQuery(query);
    try {
      const result = await fetchWeather(query);
      setData(result);
      setStatus("success");
    } catch (err) {
      setStatus(err.message === "not-found" ? "not-found" : "network");
    }
  }

  
  useEffect(() => {
    let sky = "clear-day";
    if (status === "success") {
      sky = describe(data.weather.current.weather_code, data.weather.current.is_day).sky;
    } else if (status === "not-found" || status === "network") {
      sky = "cloudy";
    }
    document.body.dataset.sky = sky;
  }, [status, data]);

  return (
    <main className="app">
      <SearchBar onSearch={handleSearch} loading={status === "loading"} />

      {status === "idle" && (
        <Message icon="🌤️" title="Where's the weather?" text="Type any city or country above to see the temperature right now." />
      )}
      {status === "loading" && <Message loading title="Checking the sky…" text={lastQuery} />}
      {status === "not-found" && (
        <Message isError icon="🧭" title="Country not exist" text="We couldn't find that place. Check the spelling and try again." />
      )}
      {status === "network" && (
        <Message isError icon="📡" title="Can't reach the weather service" text="Check your internet connection and try again." />
      )}
      {status === "success" && <WeatherCard data={data} unit={unit} setUnit={setUnit} />}
    </main>
  );
}
