class WeatherDashboard {
    constructor() {
        this.currentCity = 'Tokyo';
        this.weatherData = null;

        this.canvas = document.getElementById('weather-canvas');
        this.ctx = this.canvas?.getContext('2d');

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupCanvas();
        this.updateTimeOfDay();
        this.loadWeatherData(this.currentCity);
        setInterval(() => this.updateTimeOfDay(), 60000);
    }

    setupEventListeners() {
        const searchInput = document.getElementById('city-search');
        const searchBtn = document.getElementById('search-btn');
        const retryBtn = document.getElementById('retry-btn');

        if (searchBtn && searchInput) {
            const searchHandler = () => {
                const city = searchInput.value.trim();
                if (city) {
                    this.currentCity = city;
                    searchInput.value = '';
                    this.loadWeatherData(city);
                } else this.showError('Please enter a valid city name');
            };
            searchBtn.addEventListener('click', searchHandler);
            searchInput.addEventListener('keypress', e => { if (e.key === 'Enter') searchHandler(); });
        }

        if (retryBtn) retryBtn.addEventListener('click', () => this.loadWeatherData(this.currentCity));
    }

    setupCanvas() {
        if (!this.canvas) return;
        const resizeCanvas = () => { this.canvas.width = window.innerWidth; this.canvas.height = window.innerHeight; };
        window.addEventListener('resize', resizeCanvas);
        resizeCanvas();
    }

    updateTimeOfDay() {
        const timeLabelEl = document.getElementById('time-label');
        if (!timeLabelEl) return;

        const hour = new Date().getHours();
        let timeLabel = '', timeClass = '';
        if (hour >= 6 && hour < 9) { timeLabel = 'Morning 🌅'; timeClass = 'morning'; }
        else if (hour >= 9 && hour < 16) { timeLabel = 'Noon ☀️'; timeClass = 'noon'; }
        else if (hour >= 16 && hour < 19) { timeLabel = 'Evening 🌇'; timeClass = 'evening'; }
        else { timeLabel = 'Night 🌙'; timeClass = 'night'; }

        timeLabelEl.textContent = timeLabel;
        document.body.className = timeClass;
    }

    async loadWeatherData(city) {
        this.showLoading();
        try {
            const coords = await this.getCoords(city);
            const data = await this.fetchWeatherData(coords.latitude, coords.longitude);

            this.weatherData = {
                city: { name: coords.name, country: coords.country || 'Unknown' },
                current: data.current_weather,
                hourly: data.hourly,
                hourlyTime: data.hourly.time
            };

            this.updateUI();
            this.startBackgroundAnimation();
            this.hideLoading();
        } catch (err) {
            this.showError(err.message);
            console.error('Weather API error:', err);
        }
    }

    async getCoords(city) {
        const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to fetch coordinates');
        const geoData = await res.json();
        if (!geoData.results || geoData.results.length === 0) throw new Error('City not found');
        return geoData.results[0];
    }

    async fetchWeatherData(lat, lon) {
        // Fetch current + hourly weather with timezone auto
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=temperature_2m,apparent_temperature,weathercode&timezone=auto`;
        console.log("Fetching weather from URL:", url);
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Weather API error: ${res.status}`);
        return await res.json();
    }

    updateUI() {
        if (!this.weatherData) return;

        const { city, current } = this.weatherData;
        const safeSetText = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };

        safeSetText('city-name', `${city.name}, ${city.country}`);
        safeSetText('current-date', new Date().toLocaleString());
        safeSetText('current-temp', Math.round(current.temperature));
        safeSetText('feels-like', Math.round(current.apparent_temperature));
        safeSetText('weather-desc', this.weatherCodeToDesc(current.weathercode));
        safeSetText('weather-icon', this.weatherCodeToEmoji(current.weathercode));

        // 5-day forecast
        const forecastContainer = document.getElementById('forecast-container');
        if (forecastContainer && this.weatherData.hourly) {
            forecastContainer.innerHTML = '';
            for (let i = 0; i < 5; i++) {
                const index = i * 24;
                const temp = this.weatherData.hourly.temperature_2m[index] || 0;
                const code = this.weatherData.hourly.weathercode[index] || 0;
                const card = document.createElement('div');
                card.className = 'forecast-card';
                card.innerHTML = `
                    <p class="forecast-date">${new Date(Date.now() + i*86400000).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</p>
                    <div class="forecast-icon">${this.weatherCodeToEmoji(code)}</div>
                    <p class="forecast-temp">${Math.round(temp)}°C</p>
                    <p class="forecast-desc">${this.weatherCodeToDesc(code)}</p>
                `;
                card.addEventListener('click', () => this.showHourlyForDay(i));
                forecastContainer.appendChild(card);
            }
        }
    }

  showHourlyForDay(dayIndex) {
    if (!this.weatherData || !this.weatherData.hourly) return;
    const hourlyEl = document.getElementById('hourly-weather');
    if (!hourlyEl) return;

    // Clear previous hourly data
    hourlyEl.innerHTML = `<h3>Hourly Forecast</h3>`;

    // Create a horizontal scroll container
    const container = document.createElement('div');
    container.className = 'hourly-container';
    container.style.display = 'flex';
    container.style.overflowX = 'auto';
    container.style.gap = '10px';
    container.style.padding = '10px 0';

    const start = dayIndex * 24;
    const end = start + 24;

    for (let i = start; i < end; i++) {
        const temp = this.weatherData.hourly.temperature_2m[i];
        const code = this.weatherData.hourly.weathercode[i];
        const timeStr = this.weatherData.hourlyTime[i];
        const hour = new Date(timeStr).getHours();

        // Create a horizontal card for each hour
        const hourDiv = document.createElement('div');
        hourDiv.className = 'hour-card';
        hourDiv.style.minWidth = '70px';
        hourDiv.style.padding = '10px';
        hourDiv.style.border = '1px solid #ccc';
        hourDiv.style.borderRadius = '8px';
        hourDiv.style.background = 'rgba(255, 255, 255, 0.8)';
        hourDiv.style.textAlign = 'center';
        hourDiv.style.flexShrink = '0';

        hourDiv.innerHTML = `
            <p>${hour}:00</p>
            <p>${Math.round(temp)}°C</p>
            <p>${this.weatherCodeToEmoji(code)}</p>
        `;

        container.appendChild(hourDiv);
    }

    hourlyEl.appendChild(container);
}


    weatherCodeToEmoji(code) {
        if ([0].includes(code)) return '☀️';
        if ([1,2,3].includes(code)) return '⛅';
        if ([45,48].includes(code)) return '🌫️';
        if ([51,53,55,61,63,65].includes(code)) return '🌧️';
        if ([71,73,75,77,85,86].includes(code)) return '❄️';
        if ([95,96,99].includes(code)) return '⛈️';
        return '❓';
    }

    weatherCodeToDesc(code) {
        if ([0].includes(code)) return 'Clear';
        if ([1,2,3].includes(code)) return 'Clouds';
        if ([45,48].includes(code)) return 'Fog';
        if ([51,53,55,61,63,65].includes(code)) return 'Rain';
        if ([71,73,75,77,85,86].includes(code)) return 'Snow';
        if ([95,96,99].includes(code)) return 'Thunderstorm';
        return 'Unknown';
    }

    showLoading() { document.getElementById('loading-overlay')?.classList.remove('hidden'); document.getElementById('error-overlay')?.classList.add('hidden'); }
    hideLoading() { document.getElementById('loading-overlay')?.classList.add('hidden'); }
    showError(msg) { const overlay = document.getElementById('error-overlay'); const errorMsg = document.getElementById('error-message'); overlay?.classList.remove('hidden'); if (errorMsg) errorMsg.textContent = msg; this.hideLoading(); }

    startBackgroundAnimation() {
        if (!this.canvas || !this.ctx || !this.weatherData) return;
        const code = this.weatherData.current.weathercode;
        let color = "#87CEEB"; // default clear

        if ([51,53,55,61,63,65].includes(code)) color = "#5F9EA0"; // Rain
        else if ([71,73,75,77,85,86].includes(code)) color = "#E0F7FA"; // Snow
        else if ([95,96,99].includes(code)) color = "#2F4F4F"; // Storm

        this.ctx.fillStyle = color;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
}

// Initialize
window.addEventListener('DOMContentLoaded', () => {
    new WeatherDashboard();
});
