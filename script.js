// Данные о станциях
let stations = [];
let currentType = 'ac';
let selectedStation = null;

// Инициализация Telegram Mini App
if (window.Telegram && Telegram.WebApp) {
    Telegram.WebApp.ready();
    Telegram.WebApp.expand();
}

// Функция вибрации
function vibrate(pattern = 'light') {
    if (!window.Telegram || !Telegram.WebApp || !Telegram.WebApp.HapticFeedback) {
        // Если нет Telegram WebApp, пробуем нативную вибрацию
        if (window.navigator && window.navigator.vibrate) {
            if (pattern === 'light') window.navigator.vibrate(10);
            else if (pattern === 'medium') window.navigator.vibrate(20);
            else if (pattern === 'heavy') window.navigator.vibrate(30);
            else if (pattern === 'success') window.navigator.vibrate([10, 30, 10]);
            else if (pattern === 'error') window.navigator.vibrate([30, 30, 30]);
        }
        return;
    }
    
    // Используем Telegram Haptic Feedback
    try {
        switch(pattern) {
            case 'light':
                Telegram.WebApp.HapticFeedback.impactOccurred('light');
                break;
            case 'medium':
                Telegram.WebApp.HapticFeedback.impactOccurred('medium');
                break;
            case 'heavy':
                Telegram.WebApp.HapticFeedback.impactOccurred('heavy');
                break;
            case 'success':
                Telegram.WebApp.HapticFeedback.notificationOccurred('success');
                break;
            case 'error':
                Telegram.WebApp.HapticFeedback.notificationOccurred('error');
                break;
            case 'warning':
                Telegram.WebApp.HapticFeedback.notificationOccurred('warning');
                break;
            case 'selection':
                Telegram.WebApp.HapticFeedback.selectionChanged();
                break;
            default:
                Telegram.WebApp.HapticFeedback.impactOccurred('light');
        }
    } catch (e) {
        console.log('Haptic feedback error:', e);
    }
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
            vibrate('success'); // Вибрация при успешной загрузке
        }
    } catch (error) {
        console.error('Ошибка загрузки:', error);
        document.getElementById('modelSelect').innerHTML = '<option value="">Ошибка загрузки</option>';
        vibrate('error'); // Вибрация при ошибке
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
        vibrate('light'); // Легкая вибрация при появлении субсидии
    } else {
        document.getElementById('subsidyInfo').style.display = 'none';
    }
    
    calculate();
}

// Установить тип станции (AC/DC)
function setType(type) {
    if (type === currentType) return; // Не вибрируем если тот же тип
    
    currentType = type;
    vibrate('medium'); // Вибрация при переключении типа
    
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
    
    // Легкая вибрация при изменении слайдера (с задержкой, чтобы не спамить)
    clearTimeout(window.hoursTimer);
    window.hoursTimer = setTimeout(() => {
        vibrate('light');
        calculate();
    }, 50);
}

// Расчет проданной энергии с детализацией
function calculateEnergyDetails(hours, station) {
    let details = {
        total: 0,
        mode: '',
        breakdown: []
    };
    
    if (currentType === 'ac') {
        if (station.name.includes('001')) {
            // Серия 001: всегда 7.5 кВт
            details.total = CONFIG.AC_REAL_SPEED * hours;
            details.mode = 'Одна машина постоянно';
            details.breakdown.push({
                period: 'Весь день',
                speed: CONFIG.AC_REAL_SPEED,
                hours: hours,
                energy: CONFIG.AC_REAL_SPEED * hours
            });
        } else if (station.name.includes('002')) {
            // Серия 002: до 12ч - 1 машина, после - 2 машины
            if (hours <= 12) {
                details.total = CONFIG.AC_REAL_SPEED * hours;
                details.mode = 'Одна машина';
                details.breakdown.push({
                    period: '0-12 часов',
                    speed: CONFIG.AC_REAL_SPEED,
                    hours: hours,
                    energy: CONFIG.AC_REAL_SPEED * hours
                });
            } else {
                const energyFirst = CONFIG.AC_REAL_SPEED * 12;
                const energySecond = CONFIG.AC_REAL_SPEED * 2 * (hours - 12);
                details.total = energyFirst + energySecond;
                details.mode = 'Смешанный режим';
                details.breakdown.push({
                    period: '0-12 часов (1 машина)',
                    speed: CONFIG.AC_REAL_SPEED,
                    hours: 12,
                    energy: energyFirst
                });
                details.breakdown.push({
                    period: `${12}-${hours} часов (2 машины)`,
                    speed: CONFIG.AC_REAL_SPEED * 2,
                    hours: hours - 12,
                    energy: energySecond
                });
            }
        }
    } else { // DC
        if (station.power <= 40) {
            // DC 40 кВт
            details.total = station.power * hours;
            details.mode = 'Полная мощность';
            details.breakdown.push({
                period: 'Весь день',
                speed: station.power,
                hours: hours,
                energy: station.power * hours
            });
        } else {
            // DC 80+ кВт
            if (hours <= 12) {
                details.total = CONFIG.DC_MAX_SPEED * hours;
                details.mode = 'Одна машина (60 кВт)';
                details.breakdown.push({
                    period: '0-12 часов',
                    speed: CONFIG.DC_MAX_SPEED,
                    hours: hours,
                    energy: CONFIG.DC_MAX_SPEED * hours
                });
            } else {
                const energyFirst = CONFIG.DC_MAX_SPEED * 12;
                const energySecond = CONFIG.DC_DUAL_SPEED * 2 * (hours - 12);
                details.total = energyFirst + energySecond;
                details.mode = 'Смешанный режим';
                details.breakdown.push({
                    period: '0-12 часов (1 машина, 60 кВт)',
                    speed: CONFIG.DC_MAX_SPEED,
                    hours: 12,
                    energy: energyFirst
                });
                details.breakdown.push({
                    period: `${12}-${hours} часов (2 машины по 40 кВт)`,
                    speed: CONFIG.DC_DUAL_SPEED * 2,
                    hours: hours - 12,
                    energy: energySecond
                });
            }
        }
    }
    
    return details;
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
    
    // Детальный расчет энергии
    const energyDetails = calculateEnergyDetails(hours, selectedStation);
    const energyPerDay = energyDetails.total;
    
    // Выручка в день
    const revenuePerDay = energyPerDay * clientPrice;
    
    // Затраты на ЭЭ с учетом КПД
    const efficiency = currentType === 'dc' ? CONFIG.EFFICIENCY.DC : CONFIG.EFFICIENCY.AC;
    const energyConsumed = energyPerDay / efficiency;
    const energyLoss = energyConsumed - energyPerDay; // Потери на КПД
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
    
    const formatEnergy = (num) => {
        return Math.round(num).toLocaleString() + ' кВт·ч';
    };
    
    // Создаем HTML для детализации энергии
    let energyBreakdownHtml = '';
    energyDetails.breakdown.forEach(item => {
        energyBreakdownHtml += `
            <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 8px; padding-left: 12px; border-left: 2px solid #007AFF;">
                <span style="color: #666;">${item.period}:</span>
                <span style="font-weight: 500;">${item.speed} кВт × ${item.hours}ч = ${formatEnergy(item.energy)}</span>
            </div>
        `;
    });
    
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
        
        <!-- Детальная статистика по энергии -->
        <div class="energy-detail">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px;">
                <span style="font-size: 20px;">🔋</span>
                <h3 style="font-size: 16px; font-weight: 600; color: #1a1a1a;">Детализация по энергии</h3>
            </div>
            
            <div style="margin-bottom: 20px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px; padding: 0 4px;">
                    <span style="color: #666;">Режим работы:</span>
                    <span style="font-weight: 600; color: #007AFF;">${energyDetails.mode}</span>
                </div>
                
                ${energyBreakdownHtml}
            </div>
            
            <div style="background: white; border-radius: 16px; padding: 16px; margin-top: 16px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                    <span style="color: #666;">Продано клиентам:</span>
                    <span style="font-weight: 700;">${formatEnergy(energyPerDay * 30)}/мес</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                    <span style="color: #666;">Потреблено из сети:</span>
                    <span style="font-weight: 700;">${formatEnergy(energyConsumed * 30)}/мес</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px; color: #FF9F0A;">
                    <span>Потери на КПД (${currentType === 'dc' ? '7%' : '10%'}):</span>
                    <span style="font-weight: 700;">${formatEnergy(energyLoss * 30)}/мес</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding-top: 12px; border-top: 1px dashed #ccc; margin-top: 8px;">
                    <span style="color: #666;">Стоимость 1 кВт·ч:</span>
                    <span style="font-weight: 600;">${costPrice.toFixed(2)} ₽ (покупка) / ${clientPrice.toFixed(2)} ₽ (продажа)</span>
                </div>
            </div>
            
            <div style="margin-top: 16px; font-size: 13px; color: #666; background: #e8f0fe; padding: 12px; border-radius: 12px;">
                ⚡ Маржа с 1 кВт·ч: ${(clientPrice - (costPrice / efficiency)).toFixed(2)} ₽ (с учетом потерь)
            </div>
        </div>
        
        <div style="margin-top: 24px;">
            <div style="font-size: 15px; color: #666; margin-bottom: 8px; font-weight: 500;">⏱️ Срок окупаемости</div>
            <div class="payback-badge">${paybackText}</div>
        </div>
        
        <div style="margin-top: 20px; font-size: 12px; color: #999; text-align: center; padding-bottom: 8px;">
            КПД: ${currentType === 'dc' ? '93% (DC)' : '90% (AC)'} | 
            Станций в сети: ${stationCount}
        </div>
    `;
    
    // Вибрация при расчете (medium)
    vibrate('medium');
}

// Добавляем вибрацию на все инпуты
document.addEventListener('DOMContentLoaded', function() {
    // Вибрация при изменении количества станций
    document.getElementById('stationCount').addEventListener('change', function() {
        vibrate('light');
        calculate();
    });
    
    // Вибрация при изменении себестоимости
    document.getElementById('costPrice').addEventListener('change', function() {
        vibrate('light');
        calculate();
    });
    
    // Вибрация при изменении цены для клиента
    document.getElementById('clientPrice').addEventListener('change', function() {
        vibrate('light');
        calculate();
    });
    
    // Загружаем данные при старте
    loadStations();
});

// Если пользователь тыкает на субсидию - дополнительная вибрация
document.addEventListener('click', function(e) {
    if (e.target.closest('.subsidy-badge')) {
        vibrate('success');
    }
});