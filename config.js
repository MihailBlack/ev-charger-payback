// Конфигурация Google Sheets
const CONFIG = {
    API_KEY: 'AIzaSyAJr_tsIBBK3COL6AL_8fziqJrKDWDhUVM',
    SPREADSHEET_ID: '1GQveIDFeYrA-Nq5bJR8SCe_PT5xHTshphF1iEaQc_ZU',
    RANGE: 'Sheet1!A:G',
    
    // Константы расчета
    EFFICIENCY: {
        AC: 0.90,  // КПД 90%
        DC: 0.93   // КПД 93%
    },
    
    COMMISSION: 0.10,  // 10% комиссия ПО
    
    INTERNET_COST: 550,  // ₽ в месяц за станцию
    
    // Ограничения по скорости зарядки
    AC_REAL_SPEED: 7.5,  // кВт реальная скорость для AC
    DC_MAX_SPEED: 60,     // кВт макс скорость для DC (1 машина)
    DC_DUAL_SPEED: 40     // кВт на машину при зарядке двух
};