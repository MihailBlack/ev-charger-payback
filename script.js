// Данные о станциях
let stations = [];
let currentType = 'ac';
let selectedStation = null;
let keyboardVisible = false;
let subsidyApplied = false; // Флаг для субсидии 50% (только для 160 кВт)

// Инициализация Telegram Mini App
if (window.Telegram && Telegram.WebApp) {
    Telegram.WebApp.ready();
    Telegram.WebApp.expand();
}

// Функция для правильного склонения годов
function getYearsText(years) {
    const num = Math.abs(years);
    const lastDigit = num % 10;
    const lastTwoDigits = num % 100;
    
    if (lastTwoDigits >= 11 && lastTwoDigits <= 19) return 'лет';
    if (lastDigit === 1) return 'год';
    if (lastDigit >= 2 && lastDigit <= 4) return 'года';
    return 'лет';
}

// Функция для правильного склонения месяцев
function getMonthsText(months) {
    const num = Math.abs(months);
    const lastDigit = num % 10;
    const lastTwoDigits = num % 100;
    
    if (lastTwoDigits >= 11 && lastTwoDigits <= 19) return 'месяцев';
    if (lastDigit === 1) return 'месяц';
    if (lastDigit >= 2 && lastDigit <= 4) return 'месяца';
    return 'месяцев';
}

// Функция для форматирования срока окупаемости
function formatPayback(months) {
    if (months === Infinity || months <= 0) return '∞ (нет прибыли)';
    
    const totalMonths = Math.round(months);
    const years = Math.floor(totalMonths / 12);
    const remainingMonths = totalMonths % 12;
    
    if (years === 0) return `${totalMonths} ${getMonthsText(totalMonths)}`;
    if (remainingMonths === 0) return `${years} ${getYearsText(years)}`;
    return `${years} ${getYearsText(years)} ${remainingMonths} ${getMonthsText(remainingMonths)}`;
}

// Функция для закрытия клавиатуры
function dismissKeyboard() {
    if (document.activeElement && document.activeElement.blur) {
        document.activeElement.blur();
    }
    
    if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
        const hiddenInput = document.createElement('input');
        hiddenInput.style.position = 'absolute';
        hiddenInput.style.top = '-1000px';
        hiddenInput.style.left = '-1000px';
        hiddenInput.style.height = '0';
        hiddenInput.style.opacity = '0';
        document.body.appendChild(hiddenInput);
        hiddenInput.focus();
        setTimeout(() => hiddenInput.remove(), 100);
    }
    
    keyboardVisible = false;
}

// Функция вибрации
function vibrate(pattern = 'light') {
    if (!window.Telegram || !Telegram.WebApp || !Telegram.WebApp.HapticFeedback) {
        if (window.navigator && window.navigator.vibrate) {
            if (pattern === 'light') window.navigator.vibrate(10);
            else if (pattern === 'medium') window.navigator.vibrate(20);
            else if (pattern === 'heavy') window.navigator.vibrate(30);
            else if (pattern === 'success') window.navigator.vibrate([10, 30, 10]);
            else if (pattern === 'error') window.navigator.vibrate([30, 30, 30]);
        }
        return;
    }
    
    try {
        switch(pattern) {
            case 'light': Telegram.WebApp.HapticFeedback.impactOccurred('light'); break;
            case 'medium': Telegram.WebApp.HapticFeedback.impactOccurred('medium'); break;
            case 'heavy': Telegram.WebApp.HapticFeedback.impactOccurred('heavy'); break;
            case 'success': Telegram.WebApp.HapticFeedback.notificationOccurred('success'); break;
            case 'error': Telegram.WebApp.HapticFeedback.notificationOccurred('error'); break;
            case 'warning': Telegram.WebApp.HapticFeedback.notificationOccurred('warning'); break;
            case 'selection': Telegram.WebApp.HapticFeedback.selectionChanged(); break;
            default: Telegram.WebApp.HapticFeedback.impactOccurred('light');
        }
    } catch (e) {
        console.log('Haptic feedback error:', e);
    }
}

// Загрузка данных из Google Sheets
async function loadStations() {
    const API_KEY = CONFIG.API_KEY;
    const SPREADSHEET_ID = CONFIG.SPREADSHEET_ID;
    
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${CONFIG.RANGE}?key=${API_KEY}`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.values) {
            stations = data.values.slice(1).map(row => ({
                id: row[0],
                type: row[1].toLowerCase(),
                name: row[2],
                power: parseFloat(row[3]),
                realSpeed: parseFloat(row[4]),
                ports: parseInt(row[5]),
                price: parseFloat(row[6])
                // Убрано поле subsidy
            }));
            
            // После загрузки данных:
            // 1. Подсвечиваем AC кнопку
            highlightActiveType('ac');
            
            // 2. Обновляем селект и выбираем первую станцию
            updateModelSelect(false); // false = выбираем первую станцию
            
            vibrate('success');
        }
    } catch (error) {
        console.error('Ошибка загрузки:', error);
        // Показываем заглушку с тестовыми данными, чтобы приложение не падало
        stations = [
            { id: 1, type: 'ac', name: 'AC 001', power: 7.5, price: 150000 },
            { id: 2, type: 'ac', name: 'AC 002', power: 15, price: 250000 },
            { id: 3, type: 'dc', name: 'DC 40', power: 40, price: 500000 },
            { id: 4, type: 'dc', name: 'DC 80', power: 80, price: 800000 },
            { id: 5, type: 'dc', name: 'DC 120', power: 120, price: 1200000 },
            { id: 6, type: 'dc', name: 'DC 160', power: 160, price: 1600000 }
        ];
        
        highlightActiveType('ac');
        updateModelSelect(false);
        
        vibrate('error');
    }
}

function highlightActiveType(type) {
    document.querySelectorAll('.type-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelectorAll(`.type-btn.${type}`).forEach(btn => {
        btn.classList.add('active');
    });
}

// Обновить выпадающий список моделей
function updateModelSelect(keepEmpty = false) {
    const select = document.getElementById('modelSelect');
    const filtered = stations.filter(s => s.type === currentType);
    
    select.innerHTML = '<option value="">🔍 Выберите модель станции</option>';
    filtered.forEach(station => {
        const option = document.createElement('option');
        option.value = station.id;
        option.textContent = `${station.name} - ${station.price.toLocaleString()} ₽`; // Убрана звездочка
        select.appendChild(option);
    });
    
    if (!keepEmpty && filtered.length > 0) {
        // ВЫБИРАЕМ ПЕРВУЮ СТАНЦИЮ АВТОМАТИЧЕСКИ
        select.value = filtered[0].id;
        updateStationInfo();
    } else {
        select.value = '';
        selectedStation = null;
        document.getElementById('subsidyCheckboxContainer').style.display = 'none';
        document.getElementById('results').innerHTML = '<div class="info-message">👆 Выберите модель станции для расчета</div>';
    }
}

// Обновить информацию о выбранной станции
function updateStationInfo() {
    const select = document.getElementById('modelSelect');
    const stationId = select.value;
    
    if (!stationId) {
        selectedStation = null;
        document.getElementById('subsidyCheckboxContainer').style.display = 'none';
        document.getElementById('results').innerHTML = '<div class="info-message">👆 Выберите модель станции для расчета</div>';
        return;
    }
    
    selectedStation = stations.find(s => s.id == stationId);
    
    // Показываем чекбокс субсидии 50% только для станции 160 кВт
    if (selectedStation && selectedStation.name.includes('160')) {
        document.getElementById('subsidyCheckboxContainer').style.display = 'block';
    } else {
        document.getElementById('subsidyCheckboxContainer').style.display = 'none';
        subsidyApplied = false; // Сбрасываем флаг
        // Сбрасываем чекбокс
        const checkbox = document.getElementById('subsidyCheckbox');
        if (checkbox) checkbox.checked = false;
    }
    
    // СРАЗУ ДЕЛАЕМ РАСЧЕТ
    calculate();
}

// Переключение субсидии 50%
function toggleSubsidy(checked) {
    subsidyApplied = checked;
    vibrate('light');
    calculate();
}

// Установить тип станции (AC/DC)
function setType(type) {
    if (type === currentType) return;
    
    currentType = type;
    vibrate('medium');
    highlightActiveType(type);
    
    // При смене типа автоматически выбираем первую станцию и делаем расчет
    updateModelSelect(false); // false = выбираем первую станцию
}

// Обновить значение часов
function updateHours() {
    const hours = document.getElementById('hoursSlider').value;
    document.getElementById('hoursValue').textContent = hours + ' часов';
    
    clearTimeout(window.hoursTimer);
    window.hoursTimer = setTimeout(() => {
        vibrate('light');
        if (selectedStation) calculate();
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
            // 001 - 1 машина, 7.5 кВт
            const speed = CONFIG.AC_REAL_SPEED; // 7.5
            details.total = speed * hours;
            details.mode = 'Одна машина (7.5 кВт)';
            details.breakdown.push({
                speed: speed,
                hours: hours,
                energy: speed * hours
            });
        } else if (station.name.includes('002')) {
            // 002 - 2 машины, каждая по 7.5 кВт
            const speed = CONFIG.AC_REAL_SPEED * 2; // 15 кВт суммарно
            details.total = speed * hours;
            details.mode = 'Две машины одновременно (2×7.5 кВт)';
            details.breakdown.push({
                speed: speed,
                hours: hours,
                energy: speed * hours
            });
        }
    } else { // DC
        if (station.name.includes('40') && station.power <= 40) {
            // 40 кВт - одна машина
            details.total = station.power * hours;
            details.mode = 'Одна машина (40 кВт)';
            details.breakdown.push({
                speed: station.power,
                hours: hours,
                energy: station.power * hours
            });
        } 
        else if (station.name.includes('80')) {
            // 80 кВт - две машины по 40 кВт
            const speedPerCar = 40;
            const totalSpeed = speedPerCar * 2; // 80 кВт
            details.total = totalSpeed * hours;
            details.mode = 'Две машины (2×40 кВт)';
            details.breakdown.push({
                speed: totalSpeed,
                hours: hours,
                energy: totalSpeed * hours
            });
        }
        else if (station.name.includes('120')) {
            // 120 кВт - две машины по 60 кВт
            const speedPerCar = 60;
            const totalSpeed = speedPerCar * 2; // 120 кВт
            details.total = totalSpeed * hours;
            details.mode = 'Две машины (2×60 кВт)';
            details.breakdown.push({
                speed: totalSpeed,
                hours: hours,
                energy: totalSpeed * hours
            });
        }
        else if (station.name.includes('160')) {
            // 160 кВт - станция мощная, но машины в среднем берут 60 кВт
            // Поэтому средний расчет: 2 машины по 60 кВт = 120 кВт/ч
            const avgSpeedPerCar = 60; // Средняя скорость зарядки машин
            const totalAvgSpeed = avgSpeedPerCar * 2; // 120 кВт средняя нагрузка
            details.total = totalAvgSpeed * hours;
            details.mode = 'Две машины (средний расчет 2×60 кВт)';
            details.breakdown.push({
                speed: totalAvgSpeed,
                hours: hours,
                energy: totalAvgSpeed * hours
            });
        }
        else {
            // На всякий случай, если модель не определена
            details.total = station.power * hours;
            details.mode = 'Стандартный режим';
            details.breakdown.push({
                speed: station.power,
                hours: hours,
                energy: station.power * hours
            });
        }
    }
    
    return details;
}

// ОСНОВНАЯ ФУНКЦИЯ РАСЧЕТА
function calculate() {
    if (!selectedStation) {
        document.getElementById('results').innerHTML = '<div class="info-message">👆 Выберите модель станции для расчета</div>';
        return;
    }
    
    const hours = parseFloat(document.getElementById('hoursSlider').value);
    const stationCount = parseInt(document.getElementById('stationCount').value) || 1;
    const costPrice = parseFloat(document.getElementById('costPrice').value) || 0;
    const clientPrice = parseFloat(document.getElementById('clientPrice').value) || 0;
    
    const energyDetails = calculateEnergyDetails(hours, selectedStation);
    const energyPerDay = energyDetails.total;
    
    // Цена станции с учетом субсидии 50% (только для 160 кВт)
    let stationPrice = selectedStation.price;
    if (selectedStation.name.includes('160') && subsidyApplied) {
        stationPrice = stationPrice * 0.5; // Скидка 50%
    }
    
    const revenuePerDay = energyPerDay * clientPrice;
    
    const efficiency = currentType === 'dc' ? CONFIG.EFFICIENCY.DC : CONFIG.EFFICIENCY.AC;
    const energyConsumed = energyPerDay / efficiency;
    const energyLoss = energyConsumed - energyPerDay;
    const energyCostPerDay = energyConsumed * costPrice;
    
    const commissionPerDay = revenuePerDay * CONFIG.COMMISSION;
    const internetPerDay = CONFIG.INTERNET_COST / 30;
    
    const profitPerDay = revenuePerDay - energyCostPerDay - commissionPerDay - internetPerDay;
    
    const revenueMonth = revenuePerDay * 30 * stationCount;
    const energyCostMonth = energyCostPerDay * 30 * stationCount;
    const commissionMonth = commissionPerDay * 30 * stationCount;
    const internetMonth = CONFIG.INTERNET_COST * stationCount;
    const profitMonth = profitPerDay * 30 * stationCount;
    
    const totalCost = stationPrice * stationCount;
    let paybackMonths = profitMonth > 0 ? totalCost / profitMonth : Infinity;
    let paybackText = formatPayback(paybackMonths);
    
    const formatMoney = (num) => {
        return Math.round(num).toLocaleString() + ' ₽';
    };
    
    const formatEnergy = (num) => {
        return Math.round(num).toLocaleString() + ' кВт';
    };
    
    // Детализация с учетом количества станций
    let energyBreakdownHtml = '';
    energyDetails.breakdown.forEach(item => {
        const energyForAllStations = item.energy * stationCount;
        energyBreakdownHtml += `
            <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 8px; padding-left: 12px; border-left: 2px solid #007AFF;">
                <span style="color: #666;">${item.speed} кВт × ${item.hours}ч × ${stationCount} шт</span>
                <span style="font-weight: 500;">${formatEnergy(energyForAllStations)}</span>
            </div>
        `;
    });
    
    // Информация о субсидии для отображения (только для 160 кВт)
    const subsidyText = (selectedStation.name.includes('160') && subsidyApplied) 
        ? `<div style="margin-top: 8px; font-size: 13px; color: #34C759; background: #e8f5e9; padding: 8px 12px; border-radius: 12px;">✨ Применена субсидия 50% - цена станции ${formatMoney(stationPrice)}</div>` 
        : '';
    
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
        
        <div class="energy-detail">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px;">
                <span style="font-size: 20px;">🔋</span>
                <h3 style="font-size: 16px; font-weight: 600; color: #1a1a1a;">Детализация по энергии</h3>
            </div>
            
            <div style="margin-bottom: 20px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px; padding: 0 4px;">
                    <span style="color: #666;">Режим:</span>
                    <span style="font-weight: 600; color: #007AFF;">${energyDetails.mode}</span>
                </div>
                ${energyBreakdownHtml}
            </div>
            
            <div style="background: white; border-radius: 16px; padding: 16px; margin-top: 16px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                    <span style="color: #666;">Продано клиентам:</span>
                    <span style="font-weight: 700;">${formatEnergy(energyPerDay * 30 * stationCount)}/мес</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                    <span style="color: #666;">Потреблено из сети:</span>
                    <span style="font-weight: 700;">${formatEnergy(energyConsumed * 30 * stationCount)}/мес</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px; color: #FF9F0A;">
                    <span>Потери на КПД (${currentType === 'dc' ? '7%' : '10%'}):</span>
                    <span style="font-weight: 700;">${formatEnergy(energyLoss * 30 * stationCount)}/мес</span>
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
        
        ${subsidyText}
        
        <div style="margin-top: 24px;">
            <div style="font-size: 15px; color: #666; margin-bottom: 8px; font-weight: 500;">⏱️ Срок окупаемости</div>
            <div class="payback-badge">${paybackText}</div>
        </div>
        
        <div style="margin-top: 20px; font-size: 12px; color: #999; text-align: center; padding-bottom: 8px;">
            КПД: ${currentType === 'dc' ? '93% (DC)' : '90% (AC)'} | 
            Станций в сети: ${stationCount}
        </div>
    `;
    
    vibrate('medium');
}

// Логика клавиатуры
document.addEventListener('DOMContentLoaded', function() {
    // Вешаем обработчики на все поля
    document.getElementById('stationCount').addEventListener('change', function() {
        vibrate('light');
        if (selectedStation) calculate();
    });
    
    document.getElementById('costPrice').addEventListener('change', function() {
        vibrate('light');
        if (selectedStation) calculate();
    });
    
    document.getElementById('clientPrice').addEventListener('change', function() {
        vibrate('light');
        if (selectedStation) calculate();
    });
    
    // Отслеживаем фокус для клавиатуры
    const inputs = document.querySelectorAll('input, select');
    inputs.forEach(input => {
        input.addEventListener('focus', () => keyboardVisible = true);
        input.addEventListener('blur', () => {
            setTimeout(() => {
                keyboardVisible = document.activeElement && 
                    (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'SELECT');
            }, 100);
        });
    });
    
    // Закрытие клавиатуры при клике мимо
    const closeKeyboardHandler = (e) => {
        const isInput = e.target.tagName === 'INPUT' || 
                       e.target.tagName === 'SELECT' || 
                       e.target.closest('input') || 
                       e.target.closest('select') ||
                       e.target.closest('.input-field') ||
                       e.target.closest('.select-box') ||
                       e.target.closest('.label') ||
                       e.target.closest('.checkbox-container');
        
        if (!isInput && keyboardVisible) {
            setTimeout(dismissKeyboard, 50);
        }
    };
    
    document.addEventListener('mousedown', closeKeyboardHandler);
    document.addEventListener('touchstart', closeKeyboardHandler);
    
    // Подсвечиваем AC и загружаем данные
    highlightActiveType('ac');
    loadStations();
});

// Вибрация при клике на субсидию
document.addEventListener('click', function(e) {
    if (e.target.closest('.subsidy-badge')) {
        vibrate('success');
    }
});