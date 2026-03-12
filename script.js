// Данные о станциях
let stations = [];
let currentType = 'ac';
let selectedStation = null;

// Инициализация Telegram Mini App
if (window.Telegram && Telegram.WebApp) {
    Telegram.WebApp.ready();
    Telegram.WebApp.expand();
}

// Загрузка данных из Google Sheets
async function loadStations() {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}/values/${CONFIG.RANGE}?key=${CONFIG.API_KEY}`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.values) {
            // Пропускаем заголовки (первая строка)
            stations = data.values.slice(1).map(row => ({
                id: row[0],
                type: row[1].toLowerCase(),
                name: row[2],
                power: parseFloat(row[3]),
                realSpeed: parseFloat(row[4]),
                ports: parseInt(row[5]),
                price: parseFloat(row[6]),
                subsidy: row[7] === 'Да' || row[7] === 'да' || row[7] === 'TRUE'
            }));
            
            updateModelSelect();
        }
    } catch (error) {
        console.error('Ошибка загрузки:', error);
        document.getElementById('modelSelect').innerHTML = '<option value="">Ошибка загрузки</option>';
    }
}

// Обновить выпадающий список моделей
function updateModelSelect() {
    const select = document.getElementById('modelSelect');
    const filtered = stations.filter(s => s.type === currentType);
    
    select.innerHTML = '<option value="">Выберите модель</option>';
    filtered.forEach(station => {
        const option = document.createElement('option');
        option.value = station.id;
        option.textContent = `${station.name} - ${station.price.toLocaleString()} ₽${station.subsidy ? ' (субсидия)' : ''}`;
        select.appendChild(option);
    });
    
    if (filtered.length > 0) {
        select.value = filtered[0].id;
        updateStationInfo();
    }
}

// Обновить информацию о выбранной станции
function updateStationInfo() {
    const select = document.getElementById('modelSelect');
    const stationId = select.value;
    
    if (!stationId) {
        selectedStation = null;
        document.getElementById('subsidyInfo').style.display = 'none';
        return;
    }
    
    selectedStation = stations.find(s => s.id == stationId);
    
    // Показываем информацию о субсидии
    if (selectedStation && selectedStation.subsidy) {
        document.getElementById('subsidyInfo').style.display = 'block';
    } else {
        document.getElementById('subsidyInfo').style.display = 'none';
    }
    
    calculate();
}

// Установить тип станции (AC/DC)
function setType(type) {
    currentType = type;
    
    // Обновляем активную кнопку
    document.querySelectorAll('.type-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelectorAll(`.type-btn.${type}`).forEach(btn => {
        btn.classList.add('active');
    });
    
    updateModelSelect();
}

// Обновить значение часов
function updateHours() {
    const hours = document.getElementById('hoursSlider').value;
    document.getElementById('hoursValue').textContent = hours + ' часов';
    calculate();
}

// Расчет проданной энергии
function calculateEnergy(hours, station) {
    if (currentType === 'ac') {
        if (station.name.includes('001')) {
            // Серия 001: всегда 7.5 кВт
            return CONFIG.AC_REAL_SPEED * hours;
        } else if (station.name.includes('002')) {
            // Серия 002: до 12ч - 1 машина, после - 2 машины
            if (hours <= 12) {
                return CONFIG.AC_REAL_SPEED * hours;
            } else {
                return (CONFIG.AC_REAL_SPEED * 12) + (CONFIG.AC_REAL_SPEED * 2 * (hours - 12));
            }
        }
    } else { // DC
        if (station.power <= 40) {
            // DC 40 кВт
            return station.power * hours;
        } else {
            // DC 80+ кВт
            if (hours <= 12) {
                return CONFIG.DC_MAX_SPEED * hours; // 1 машина на 60 кВт
            } else {
                return (CONFIG.DC_MAX_SPEED * 12) + (CONFIG.DC_DUAL_SPEED * 2 * (hours - 12));
            }
        }
    }
    return 0;
}

// ОСНОВНАЯ ФУНКЦИЯ РАСЧЕТА
function calculate() {
    if (!selectedStation) {
        document.getElementById('results').innerHTML = '<div class="error">Выберите модель станции</div>';
        return;
    }
    
    // Получаем значения из формы
    const hours = parseFloat(document.getElementById('hoursSlider').value);
    const stationCount = parseInt(document.getElementById('stationCount').value) || 1;
    const costPrice = parseFloat(document.getElementById('costPrice').value) || 0;
    const clientPrice = parseFloat(document.getElementById('clientPrice').value) || 0;
    
    // Расчет проданной энергии
    const energyPerDay = calculateEnergy(hours, selectedStation);
    
    // Выручка в день
    const revenuePerDay = energyPerDay * clientPrice;
    
    // Затраты на ЭЭ с учетом КПД
    const efficiency = currentType === 'dc' ? CONFIG.EFFICIENCY.DC : CONFIG.EFFICIENCY.AC;
    const energyConsumed = energyPerDay / efficiency;
    const energyCostPerDay = energyConsumed * costPrice;
    
    // Комиссия ПО
    const commissionPerDay = revenuePerDay * CONFIG.COMMISSION;
    
    // Интернет в день
    const internetPerDay = CONFIG.INTERNET_COST / 30;
    
    // Чистая прибыль в день (одна станция)
    const profitPerDay = revenuePerDay - energyCostPerDay - commissionPerDay - internetPerDay;
    
    // Месячные показатели для всей сети
    const revenueMonth = revenuePerDay * 30 * stationCount;
    const energyCostMonth = energyCostPerDay * 30 * stationCount;
    const commissionMonth = commissionPerDay * 30 * stationCount;
    const internetMonth = CONFIG.INTERNET_COST * stationCount;
    const profitMonth = profitPerDay * 30 * stationCount;
    
    // Окупаемость
    const totalCost = selectedStation.price * stationCount;
    let paybackMonths = profitMonth > 0 ? totalCost / profitMonth : Infinity;
    let paybackText = profitMonth <= 0 ? '∞ (нет прибыли)' : 
        `${paybackMonths.toFixed(1)} мес (${(paybackMonths/12).toFixed(1)} лет)`;
    
    // Форматирование чисел
    const formatMoney = (num) => {
        return Math.round(num).toLocaleString() + ' ₽';
    };
    
    // Отображаем результаты
    document.getElementById('results').innerHTML = `
        <div class="result-grid">
            <div class="result-item">
                <span class="result-label">💰 Выручка в месяц</span>
                <span class="result-value">${formatMoney(revenueMonth)}</span>
            </div>
            <div class="result-item">
                <span class="result-label">⚡ Затраты на ЭЭ</span>
                <span class="result-value">${formatMoney(energyCostMonth)}</span>
            </div>
            <div class="result-item">
                <span class="result-label">📱 Комиссия ПО (10%)</span>
                <span class="result-value">${formatMoney(commissionMonth)}</span>
            </div>
            <div class="result-item">
                <span class="result-label">🌐 Интернет</span>
                <span class="result-value">${formatMoney(internetMonth)}</span>
            </div>
            <div class="result-item">
                <span class="result-label">📊 Чистая прибыль</span>
                <span class="result-value positive">${formatMoney(profitMonth)}</span>
            </div>
        </div>
        
        <div style="margin-top: 20px;">
            <div style="font-size: 14px; color: #666; margin-bottom: 8px;">⏱️ Срок окупаемости</div>
            <div class="payback-badge">${paybackText}</div>
        </div>
        
        <div style="margin-top: 16px; font-size: 12px; color: #999; text-align: center;">
            КПД: ${currentType === 'dc' ? '93% (DC)' : '90% (AC)'} | 
            Продано энергии: ${Math.round(energyPerDay * 30)} кВт·ч/мес
        </div>
    `;
}

// Загружаем данные при старте
loadStations();