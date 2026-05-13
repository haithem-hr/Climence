// Minimal two-language dictionary so NFR-08 means "text is translated",
// not only "layout flipped to RTL".

export type Locale = 'en' | 'ar';

export const DICT = {
  // top-level
  'app.brand.sub': { en: 'Command Center', ar: 'مركز القيادة' },
  'app.signout': { en: 'Sign out', ar: 'تسجيل الخروج' },
  'app.export': { en: 'Export report', ar: 'تصدير التقرير' },
  'app.search': {
    en: 'Search sensors, zones, incidents…',
    ar: 'ابحث عن أجهزة الاستشعار أو المناطق أو الحوادث…',
  },
  'app.crumb.monitor': { en: 'Monitor', ar: 'مراقبة' },
  'app.crumb.overview': { en: 'Overview', ar: 'نظرة عامة' },
  'app.crumb.dispatch': { en: 'Dispatch Control', ar: 'التحكم في الإرسال' },

  // nav sections / items
  'nav.monitor': { en: 'Monitor', ar: 'مراقبة' },
  'nav.operate': { en: 'Operate', ar: 'تشغيل' },
  'nav.system': { en: 'System', ar: 'النظام' },
  'nav.overview': { en: 'Overview', ar: 'نظرة عامة' },
  'nav.livemap': { en: 'Live Map', ar: 'الخريطة المباشرة' },
  'nav.analytics': { en: 'Analytics', ar: 'تحليلات' },
  'nav.alerts': { en: 'Alerts', ar: 'تنبيهات' },
  'nav.sensors': { en: 'Sensors', ar: 'أجهزة الاستشعار' },
  'nav.dispatch': { en: 'Dispatch', ar: 'الإرسال' },
  'nav.reports': { en: 'Reports', ar: 'التقارير' },
  'nav.integrations': { en: 'Integrations', ar: 'التكاملات' },
  'nav.settings': { en: 'Settings', ar: 'الإعدادات' },

  // segmented control
  'seg.hardware': { en: 'Hardware Grid', ar: 'شبكة الأجهزة' },
  'seg.heatmap': { en: 'AQI Heatmap', ar: 'خريطة AQI الحرارية' },

  // KPIs
  'kpi.city': { en: 'City AQI · Now', ar: 'مؤشر المدينة · الآن' },
  'kpi.dominant': { en: 'Dominant Pollutant', ar: 'الملوث المهيمن' },
  'kpi.alerts': { en: 'Active Alerts', ar: 'تنبيهات نشطة' },
  'kpi.sensors': { en: 'Sensors Online', ar: 'أجهزة متصلة' },
  'kpi.wind': { en: 'Wind · Humidity', ar: 'الرياح · الرطوبة' },

  // panels
  'panel.alertSettings': { en: 'Alert Settings', ar: 'إعدادات التنبيه' },
  'panel.trend': { en: 'City-wide', ar: 'المدينة' },
  'panel.trend.eyebrow': { en: 'Trend · PM2.5', ar: 'اتجاه · PM2.5' },
  'panel.hotspots': { en: 'Hotspots', ar: 'البؤر' },
  'panel.hotspots.eyebrow': { en: 'Last 5 min · ranked', ar: 'آخر ٥ دقائق · مرتبة' },
  'panel.pollutants': { en: 'Pollutants', ar: 'الملوثات' },
  'panel.pollutants.eyebrow': { en: 'Breakdown · now', ar: 'التوزيع · الآن' },
  'panel.weather': { en: 'Weather', ar: 'الطقس' },
  'panel.weather.eyebrow': { en: 'Meteorology', ar: 'الأرصاد' },
  'panel.forecast': { en: 'Forecast', ar: 'التنبؤ' },
  'panel.forecast.eyebrow': { en: 'AQI · next hours', ar: 'AQI · الساعات القادمة' },
  'panel.sources': { en: 'Sources', ar: 'المصادر' },
  'panel.sources.eyebrow': { en: 'Attribution · live', ar: 'النسب · مباشرة' },
  'panel.feed': { en: 'Feed', ar: 'الأحداث' },
  'panel.feed.eyebrow': { en: 'Events · live', ar: 'أحداث · مباشرة' },

  // trend labels
  'trend.worsening': { en: 'Worsening', ar: 'يتدهور' },
  'trend.stable': { en: 'Stable', ar: 'مستقر' },
  'trend.improving': { en: 'Improving', ar: 'يتحسن' },

  // sources
  'src.traffic': { en: 'Traffic', ar: 'حركة المرور' },
  'src.industry': { en: 'Industry', ar: 'الصناعة' },
  'src.dust': { en: 'Dust / storms', ar: 'غبار / عواصف' },
  'src.other': { en: 'Other', ar: 'أخرى' },

  // weather cells
  'weather.temp': { en: 'Temperature', ar: 'الحرارة' },
  'weather.humidity': { en: 'Humidity', ar: 'الرطوبة' },
  'weather.pressure': { en: 'Pressure', ar: 'الضغط' },
  'weather.windHeader': { en: 'Wind · drift direction', ar: 'الرياح · اتجاه الانجراف' },

  // banner
  'banner.over': {
    en: 'PM2.5 exceeds threshold',
    ar: 'تجاوز PM2.5 الحد المحدد',
  },
  'banner.under': { en: 'Air quality within advisory limits', ar: 'جودة الهواء ضمن الحدود' },
  'banner.dispatch': { en: 'Dispatch', ar: 'إرسال فريق' },

  // buttons
  'btn.onMap': { en: 'On map', ar: 'على الخريطة' },
  'btn.all': { en: 'All', ar: 'الكل' },
  'btn.save': { en: 'Save', ar: 'حفظ' },
  'btn.saving': { en: 'Saving…', ar: 'جارٍ الحفظ…' },

  // report modal
  'report.title': { en: 'Generate report', ar: 'إنشاء تقرير' },
  'report.subtitle': {
    en: 'Export a snapshot of the current city state. PDF opens a print-ready document.',
    ar: 'صدّر لقطة لحالة المدينة الحالية. يُفتح PDF جاهزًا للطباعة.',
  },
  'report.pdf': { en: 'Printable PDF', ar: 'PDF قابل للطباعة' },
  'report.csv': { en: 'CSV (raw data)', ar: 'CSV (بيانات خام)' },
  'report.json': { en: 'JSON', ar: 'JSON' },
  'report.schedule': { en: 'Schedule automated report', ar: 'جدولة تقرير تلقائي' },
  'report.cadence.daily': { en: 'Daily', ar: 'يوميًا' },
  'report.cadence.weekly': { en: 'Weekly', ar: 'أسبوعيًا' },
  'report.cadence.monthly': { en: 'Monthly', ar: 'شهريًا' },
  'report.nextRun': { en: 'Next run', ar: 'التشغيل التالي' },
  'report.addSchedule': { en: 'Add schedule', ar: 'أضف جدول' },
  'report.close': { en: 'Close', ar: 'إغلاق' },
  'report.existing': { en: 'Scheduled reports', ar: 'التقارير المجدولة' },
  'report.noneScheduled': { en: 'No automated reports yet.', ar: 'لا توجد تقارير مجدولة بعد.' },
} as const;

export type DictKey = keyof typeof DICT;

export function translate(key: DictKey, locale: Locale): string {
  return DICT[key]?.[locale] ?? DICT[key]?.en ?? key;
}
