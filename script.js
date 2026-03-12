// Инициализация Telegram WebApp
let tg = window.Telegram?.WebApp;
if (tg) {
    tg.expand();
    tg.enableClosingConfirmation();
}

// Константы
const EFFICIENCY = {
    ac: 0.90, // КПД 90% для AC
    dc: 0.93  // КПД 93% для DC
};

// Текущий тип станции
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
const monthlyRevenueDetail = document.getElementById('monthlyRevenueDetail');
const monthlyProfit = document.getElementById('monthlyProfit');
const roi = document.getElementById('roi');
const paybackPeriod = document.getElementById('paybackPeriod');
const profitLabel = document.getElementById('profitLabel');

// Функция вибрации
function vibrate() {
    if (tg && tg.HapticFeedback) {
        tg.HapticFeedback.impactOccurred('light');
    } else if (navigator.vibrate) {
        navigator.vibrate(10);
    }
}

// Обработчики переключения типа
btnAC.addEventListener('click', () => {
    vibrate();
    btnAC.classList.add('active');
    btnDC.classList.remove('active');
    currentType = 'ac';
    profitLabel.textContent = 'Прибыль*';
    calculate();
});

btnDC.addEventListener('click', () => {
    vibrate();
    btnDC.classList.add('active');
    btnAC.classList.remove('active');
    currentType = 'dc';
    profitLabel.textContent = 'Прибыль';
    calculate();
});

// Обработчик выбора станции
stationSelect.addEventListener('change', (e) => {
    vibrate();
    const selected = e.target.options[e.target.selectedIndex];
    stationName.textContent = selected.getAttribute('data-name');
    stationPrice.textContent = Number(selected.value).toLocaleString('ru-RU') + ' ₽';
    calculate();
});

// Обработчики ввода
[stationsCount, loadHours, energyCost, clientPrice].forEach(input => {
    input.addEventListener('input', () => {
        vibrate();
        calculate();
    });
});

// Функция расчета
function calculate() {
    // Получаем значения
    const stationCost = parseFloat(stationSelect.value) * parseFloat(stationsCount.value);
    const hours = parseFloat(loadHours.value) || 0;
    const buyTariff = parseFloat(energyCost.value) || 0;
    const sellTariff = parseFloat(clientPrice.value) || 0;
    const power = parseFloat(stationSelect.options[stationSelect.selectedIndex].getAttribute('data-power')) || 22;
    const efficiency = EFFICIENCY[currentType];

    // Расчеты
    const soldEnergy = power * hours * 30; // кВт·ч в месяц
    const boughtEnergy = soldEnergy / efficiency; // кВт·ч в месяц
    const electricityCost = boughtEnergy * buyTariff;
    const revenue = soldEnergy * sellTariff;
    const profit = revenue - electricityCost;
    const yearlyProfit = profit * 12;
    const roiValue = (yearlyProfit / stationCost) * 100;
    let paybackYears = stationCost / (profit * 12);

    // Форматируем результаты
    monthlyRevenue.textContent = Math.round(revenue).toLocaleString('ru-RU') + ' ₽';
    monthlyRevenueDetail.textContent = currentType === 'ac' ? 
        'выручка в месяц (до вычета потерь)' : 
        'выручка в месяц';
    
    monthlyProfit.textContent = Math.round(profit).toLocaleString('ru-RU') + ' ₽';
    roi.textContent = roiValue.toFixed(1) + '%';
    
    if (profit <= 0) {
        paybackPeriod.innerHTML = '∞ <span>никогда</span>';
    } else {
        const years = paybackYears.toFixed(1);
        const months = Math.round(paybackYears * 12);
        paybackPeriod.innerHTML = `${years} года <span>(${months} мес.)</span>`;
    }

    // Добавляем звездочку для AC
    if (currentType === 'ac') {
        monthlyProfit.innerHTML = Math.round(profit).toLocaleString('ru-RU') + ' ₽*';
    }
}

// Первый расчет
calculate();