// Инициализация Telegram WebApp
let tg = window.Telegram?.WebApp;
if (tg) {
    tg.expand();
    tg.ready();
}

// Константы
const EFFICIENCY = {
    ac: 0.90,
    dc: 0.93
};

let currentType = 'ac';

// Элементы
const btnAC = document.getElementById('btnAC');
const btnDC = document.getElementById('btnDC');
const stationSelect = document.getElementById('stationSelect');
const stationName = document.getElementById('stationName');
const stationPrice = document.getElementById('stationPrice');
const stationsCount = document.getElementById('stationsCount');
const loadHours = document.getElementById('loadHours');
const energyCost = document.getElementById('energyCost');
const clientPrice = document.getElementById('clientPrice');
const monthlyRevenue = document.getElementById('monthlyRevenue');
const monthlyProfit = document.getElementById('monthlyProfit');
const roi = document.getElementById('roi');
const paybackPeriod = document.getElementById('paybackPeriod');

// Вибрация
function vibrate() {
    if (tg && tg.HapticFeedback) {
        tg.HapticFeedback.impactOccurred('light');
    }
}

// Обработчики
btnAC.addEventListener('click', () => {
    vibrate();
    btnAC.classList.add('active');
    btnDC.classList.remove('active');
    currentType = 'ac';
    calculate();
});

btnDC.addEventListener('click', () => {
    vibrate();
    btnDC.classList.add('active');
    btnAC.classList.remove('active');
    currentType = 'dc';
    calculate();
});

stationSelect.addEventListener('change', (e) => {
    vibrate();
    const selected = e.target.options[e.target.selectedIndex];
    stationName.textContent = selected.getAttribute('data-name');
    stationPrice.textContent = Number(selected.value).toLocaleString('ru-RU') + ' ₽';
    calculate();
});

[stationsCount, loadHours, energyCost, clientPrice].forEach(input => {
    input.addEventListener('input', () => {
        vibrate();
        calculate();
    });
});

// Расчет
function calculate() {
    const stationCost = parseFloat(stationSelect.value) * parseFloat(stationsCount.value);
    const hours = parseFloat(loadHours.value) || 0;
    const buyTariff = parseFloat(energyCost.value) || 0;
    const sellTariff = parseFloat(clientPrice.value) || 0;
    const power = parseFloat(stationSelect.options[stationSelect.selectedIndex].getAttribute('data-power')) || 22;
    const efficiency = EFFICIENCY[currentType];

    // Продано клиенту
    const soldEnergy = power * hours * 30;
    
    // Куплено у сети (с учетом потерь)
    const boughtEnergy = soldEnergy / efficiency;
    
    // Расходы на электричество
    const electricityCost = boughtEnergy * buyTariff;
    
    // Выручка
    const revenue = soldEnergy * sellTariff;
    
    // Прибыль
    const profit = revenue - electricityCost;

    // ROI (годовой)
    const yearlyProfit = profit * 12;
    const roiValue = (yearlyProfit / stationCost) * 100;

    // Окупаемость
    let paybackYears = stationCost / (profit * 12);

    // Форматируем
    monthlyRevenue.textContent = Math.round(revenue).toLocaleString('ru-RU') + ' ₽';
    monthlyProfit.textContent = Math.round(profit).toLocaleString('ru-RU') + ' ₽';
    roi.textContent = Math.round(roiValue) + '%';
    
    if (profit <= 0) {
        paybackPeriod.textContent = '∞';
    } else {
        const years = paybackYears.toFixed(1);
        paybackPeriod.textContent = years + ' года';
    }
}

// Первый расчет
calculate();