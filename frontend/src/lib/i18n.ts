export type Locale = 'en' | 'ar';

const LOCALE_TAG: Record<Locale, string> = {
  en: 'en-US',
  ar: 'ar-SA-u-nu-arab',
};

export const DICT = {
  'app.brand.name': { en: 'Climence', ar: 'كليمينس' },
  'app.brand.sub': { en: 'Command Center', ar: 'مركز القيادة' },
  'app.signout': { en: 'Sign out', ar: 'تسجيل الخروج' },
  'app.export': { en: 'Export report', ar: 'تصدير التقرير' },
  'app.search': { en: 'Search sensors, zones, incidents…', ar: 'ابحث عن أجهزة الاستشعار أو المناطق أو الحوادث…' },
  'app.crumb.monitor': { en: 'Monitor', ar: 'مراقبة' },
  'app.crumb.overview': { en: 'Overview', ar: 'نظرة عامة' },
  'app.crumb.dispatch': { en: 'Dispatch Control', ar: 'التحكم في الإرسال' },
  'app.live': { en: 'Live', ar: 'مباشر' },
  'app.connecting': { en: 'Connecting', ar: 'جارٍ الاتصال' },
  'app.reconnecting': { en: 'Reconnecting', ar: 'إعادة الاتصال' },
  'app.demo': { en: 'Stationary', ar: 'ثابت' },
  'app.demo.badge': { en: 'STATIONARY', ar: 'ثابت' },
  'app.demo.title': { en: 'Stationary mode uses Open‑Meteo air quality data (no live sensor connection required).', ar: 'يستخدم الوضع الثابت بيانات جودة الهواء من Open‑Meteo (بدون اتصال بالمستشعرات المباشرة).' },
  'app.toggleDirection': { en: 'Toggle language and direction', ar: 'تبديل اللغة والاتجاه' },
  'app.calendar': { en: 'Calendar', ar: 'التقويم' },
  'app.notifications': { en: 'Notifications', ar: 'الإشعارات' },
  'app.toggleNav': { en: 'Toggle navigation', ar: 'تبديل التنقل' },
  'app.closeNav': { en: 'Close navigation', ar: 'إغلاق التنقل' },
  'app.switchToDemo': { en: 'Switch to stationary mode', ar: 'التبديل إلى الوضع الثابت' },
  'app.switchToLive': { en: 'Switch to live data', ar: 'التبديل إلى البيانات المباشرة' },

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
  'nav.gridSensors': { en: 'Grid Sensors', ar: 'مستشعرات الشبكة' },
  'nav.role.administrator': { en: 'Administrator', ar: 'مسؤول' },
  'nav.role.analyst': { en: 'Analyst', ar: 'محلل' },
  'nav.role.viewer': { en: 'Viewer', ar: 'مشاهد' },
  'nav.region.riyadh': { en: 'Riyadh', ar: 'الرياض' },

  'seg.hardware': { en: 'Hardware Grid', ar: 'شبكة الأجهزة' },
  'seg.heatmap': { en: 'AQI Heatmap', ar: 'خريطة AQI الحرارية' },

  'kpi.city': { en: 'City AQI · Now', ar: 'مؤشر المدينة · الآن' },
  'kpi.dominant': { en: 'Dominant Pollutant', ar: 'الملوث المهيمن' },
  'kpi.alerts': { en: 'Active Alerts', ar: 'تنبيهات نشطة' },
  'kpi.sensors': { en: 'Sensors Online', ar: 'أجهزة متصلة' },
  'kpi.wind': { en: 'Wind · Humidity', ar: 'الرياح · الرطوبة' },

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
  'panel.hotspots.empty': { en: 'No hotspot clusters in the current snapshot.', ar: 'لا توجد عناقيد بؤر في اللقطة الحالية.' },
  'panel.forecast.waiting': { en: 'Forecast is waiting for enough trend points.', ar: 'ينتظر التنبؤ نقاط اتجاه كافية.' },
  'panel.sources.empty': { en: 'Source attribution is not available in this snapshot.', ar: 'تحديد المصادر غير متاح في هذه اللقطة.' },
  'panel.feed.empty': { en: 'No active feed items right now.', ar: 'لا توجد عناصر نشطة في سجل الأحداث الآن.' },
  'feed.pm25Exceeded': { en: 'PM2.5 threshold exceeded · {value} ug/m3', ar: 'تم تجاوز عتبة PM2.5 · {value} ug/m3' },
  'feed.monitoringAdvisory': { en: '{name} monitoring advisory', ar: 'تنبيه مراقبة {name}' },
  'feed.metaDominant': { en: '{coord} · dominant {label} {value} {unit}', ar: '{coord} · السائد {label} {value} {unit}' },

  'report.onDemand': { en: 'On-demand export', ar: 'تصدير فوري' },
  'report.format.pdfSub': { en: 'Print-ready PDF', ar: 'PDF جاهز للطباعة' },
  'report.format.csvSub': { en: 'Raw CSV dataset', ar: 'بيانات CSV خام' },
  'report.format.jsonSub': { en: 'Structured JSON', ar: 'JSON مُنظّم' },
  'report.format.xlsxSub': { en: 'Excel workbook', ar: 'مصنف Excel' },
  'report.generate': { en: 'Generate {format} snapshot', ar: 'إنشاء لقطة {format}' },
  'report.ready': { en: 'Scheduled exports', ar: 'التقارير المجدولة' },
  'report.schedulerRemoved': { en: 'Scheduler removed in this build. Use on-demand exports above.', ar: 'تمت إزالة الجدولة في هذا الإصدار. استخدم التصدير الفوري أعلاه.' },
  'report.footerNote': { en: 'Reports are generated using live sensor data and CAMS satellite validation.', ar: 'يتم إنشاء التقارير باستخدام بيانات المستشعرات المباشرة والتحقق عبر أقمار CAMS.' },
  'report.onDemandTitle': { en: 'On-demand intelligence export', ar: 'تصدير فوري للبيانات' },
  'report.synthNote': { en: 'Reports are synthesized from {sensors} live IoT nodes and validated via CAMS satellite telemetry.', ar: 'يتم توليد التقارير من {sensors} عقد IoT مباشرة والتحقق عبر بيانات CAMS.' },

  'trend.worsening': { en: 'Worsening', ar: 'يتدهور' },
  'trend.stable': { en: 'Stable', ar: 'مستقر' },
  'trend.improving': { en: 'Improving', ar: 'يتحسن' },

  'src.traffic': { en: 'Traffic', ar: 'حركة المرور' },
  'src.industry': { en: 'Industry', ar: 'الصناعة' },
  'src.dust': { en: 'Dust / storms', ar: 'غبار / عواصف' },
  'src.other': { en: 'Other', ar: 'أخرى' },

  'weather.temp': { en: 'Temperature', ar: 'الحرارة' },
  'weather.humidity': { en: 'Humidity', ar: 'الرطوبة' },
  'weather.pressure': { en: 'Pressure', ar: 'الضغط' },
  'weather.windHeader': { en: 'Wind · drift direction', ar: 'الرياح · اتجاه الانجراف' },

  'banner.over': { en: 'PM2.5 exceeds threshold', ar: 'تجاوز PM2.5 الحد المحدد' },
  'banner.under': { en: 'Air quality within advisory limits', ar: 'جودة الهواء ضمن الحدود' },
  'banner.dispatch': { en: 'Dispatch', ar: 'إرسال فريق' },
  'banner.sub.over': { en: 'Citywide advisory active', ar: 'تنبيه شامل على مستوى المدينة' },
  'banner.sub.under': { en: 'Monitoring within configured threshold', ar: 'المراقبة ضمن العتبة المحددة' },

  'btn.onMap': { en: 'On map', ar: 'على الخريطة' },
  'btn.all': { en: 'All', ar: 'الكل' },
  'btn.save': { en: 'Save', ar: 'حفظ' },
  'btn.saving': { en: 'Saving…', ar: 'جارٍ الحفظ…' },
  'btn.remove': { en: 'Remove', ar: 'إزالة' },
  'btn.close': { en: 'Close', ar: 'إغلاق' },
  'btn.viewDetails': { en: 'View details', ar: 'عرض التفاصيل' },
  'btn.seeOnMap': { en: 'See on map', ar: 'عرض على الخريطة' },

  'auth.title': { en: 'Sign in to dashboard', ar: 'سجّل الدخول إلى اللوحة' },
  'auth.subtitle': { en: 'Use your ministry credentials to access real-time monitoring, analytics, and reporting.', ar: 'استخدم بيانات اعتماد الوزارة للوصول إلى المراقبة المباشرة والتحليلات والتقارير.' },
  'auth.secureAccess': { en: 'Secure Access · MEWA', ar: 'وصول آمن · الوزارة' },
  'auth.email': { en: 'Email', ar: 'البريد الإلكتروني' },
  'auth.password': { en: 'Password', ar: 'كلمة المرور' },
  'auth.submit': { en: 'Sign in', ar: 'تسجيل الدخول' },
  'auth.submitting': { en: 'Signing in…', ar: 'جارٍ تسجيل الدخول…' },
  'auth.required': { en: 'Email and password are required.', ar: 'البريد الإلكتروني وكلمة المرور مطلوبان.' },
  'auth.invalid': { en: 'Incorrect email or password.', ar: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.' },
  'auth.rateLimited': { en: 'Too many failed attempts. Try again later.', ar: 'محاولات فاشلة كثيرة. حاول مرة أخرى لاحقًا.' },
  'auth.rateLimitedWait': { en: 'Too many failed attempts. Try again later ({minutes} min).', ar: 'محاولات فاشلة كثيرة. حاول مرة أخرى لاحقًا ({minutes} دقيقة).' },
  'auth.failed': { en: 'Login failed: {message}', ar: 'فشل تسجيل الدخول: {message}' },
  'auth.offline': { en: 'Cannot reach backend. Make sure API is running and port matches shared constants.', ar: 'تعذر الوصول إلى الخادم. تأكد من تشغيل الواجهة الخلفية وأن المنفذ يطابق الثوابت المشتركة.' },
  'auth.demoAccounts': { en: 'Demo accounts', ar: 'حسابات تجريبية' },

  'report.title': { en: 'Generate report', ar: 'إنشاء تقرير' },
  'report.subtitle': { en: 'Export a snapshot of the current city state. PDF opens a print-ready document.', ar: 'صدّر لقطة لحالة المدينة الحالية. يفتح تنسيق PDF مستندًا جاهزًا للطباعة.' },
  'report.subtitleTag': { en: 'FR-15 · FR-16 · UC-A5', ar: 'FR-15 · FR-16 · UC-A5' },
  'report.pdf': { en: 'Printable PDF', ar: 'PDF قابل للطباعة' },
  'report.csv': { en: 'CSV (raw data)', ar: 'CSV (بيانات خام)' },
  'report.json': { en: 'JSON', ar: 'JSON' },
  'report.xlsx': { en: 'Excel workbook', ar: 'مصنف Excel' },
  'report.desc.pdf': { en: 'Opens in a new tab, ready to print or save as PDF.', ar: 'يفتح في علامة تبويب جديدة جاهزًا للطباعة أو الحفظ كملف PDF.' },
  'report.desc.csv': { en: 'Single raw-data file for spreadsheet tools and imports.', ar: 'ملف بيانات خام واحد لأدوات الجداول والاستيراد.' },
  'report.desc.json': { en: 'Full structured snapshot and derived metrics for integrations.', ar: 'لقطة منظمة كاملة ومقاييس مشتقة لعمليات التكامل.' },
  'report.desc.xlsx': { en: 'Typed Excel workbook with Sensors, Alerts, and City Trend sheets.', ar: 'مصنف Excel بقيم مهيكلة وأوراق للمستشعرات والتنبيهات واتجاه المدينة.' },
  'report.schedule': { en: 'Schedule automated report', ar: 'جدولة تقرير تلقائي' },
  'report.cadence.daily': { en: 'Daily', ar: 'يوميًا' },
  'report.cadence.weekly': { en: 'Weekly', ar: 'أسبوعيًا' },
  'report.cadence.monthly': { en: 'Monthly', ar: 'شهريًا' },
  'report.nextRun': { en: 'Next run', ar: 'التشغيل التالي' },
  'report.addSchedule': { en: 'Add schedule', ar: 'أضف جدولًا' },
  'report.close': { en: 'Close', ar: 'إغلاق' },
  'report.existing': { en: 'Scheduled reports', ar: 'التقارير المجدولة' },
  'report.noneScheduled': { en: 'No automated reports yet.', ar: 'لا توجد تقارير مجدولة بعد.' },
  'report.removeSchedule': { en: 'Remove schedule', ar: 'إزالة الجدولة' },
  'report.scheduleAdded': { en: 'Schedule added.', ar: 'تمت إضافة الجدول.' },
  'report.scheduleRemoved': { en: 'Schedule removed.', ar: 'تمت إزالة الجدول.' },
  'report.scheduleRuns': { en: '{cadence} {format} snapshot', ar: 'لقطة {cadence} بتنسيق {format}' },
  'report.countdown.now': { en: 'running now', ar: 'يعمل الآن' },
  'report.countdown.minutes': { en: 'in {value} min', ar: 'خلال {value} دقيقة' },
  'report.countdown.hours': { en: 'in {value} h', ar: 'خلال {value} ساعة' },
  'report.countdown.days': { en: 'in {value} d', ar: 'خلال {value} يوم' },
  'report.status': { en: 'Report schedule updates', ar: 'تحديثات جدولة التقارير' },

  'alerts.liveMonitor': { en: 'Live Monitor', ar: 'مراقبة مباشرة' },
  'alerts.title': { en: 'Incident Response', ar: 'الاستجابة للحوادث' },
  'alerts.subtitle': { en: 'Monitor the city grid for abnormal PM2.5 pollution levels. Manage the global warning threshold to highlight critical sectors automatically.', ar: 'أدر قواعد العتبات العامة لتسليط الضوء على الحالات الشاذة عبر شبكة المستشعرات.' },
  'alerts.activeIncidents': { en: 'Active Incidents', ar: 'حوادث نشطة' },
  'alerts.critical': { en: 'Critical', ar: 'حرج' },
  'alerts.active': { en: 'Active Alerts', ar: 'تنبيهات نشطة' },
  'alerts.networkOptimal': { en: 'Network Optimal', ar: 'الشبكة بحالة مثالية' },
  'alerts.none': { en: 'No active incidents reported across the grid.', ar: 'لا توجد حوادث نشطة مُبلغ عنها عبر الشبكة.' },
  'alerts.warning': { en: 'Warning', ar: 'تحذير' },
  'alerts.info': { en: 'Info', ar: 'معلومة' },
  'alerts.dispatchDrone': { en: 'Dispatch drone', ar: 'إرسال طائرة' },
  'alerts.onlineOnly': { en: 'Online Only', ar: 'متصل فقط' },
  'alerts.globalThreshold': { en: 'Global Threshold', ar: 'العتبة العامة' },
  'alerts.thresholdHelp': { en: 'Configure the city-wide PM2.5 baseline. Any sensor reporting levels above this value will instantly trigger a system warning.', ar: 'حدد خط الأساس لـ PM2.5. المستويات التي تتجاوز هذه القيمة ستفعّل التحذيرات تلقائيًا.' },
  'alerts.triggerLevel': { en: 'PM2.5 Trigger Level', ar: 'مستوى تشغيل PM2.5' },
  'alerts.apply': { en: 'Apply threshold', ar: 'تطبيق العتبة' },
  'alerts.applying': { en: 'Applying…', ar: 'جارٍ التطبيق…' },
  'alerts.saved': { en: 'Update is live on the grid.', ar: 'تم تطبيق التحديث مباشرة على الشبكة.' },
  'alerts.error': { en: 'Failed to apply. Ensure value is between 1 and 500.', ar: 'فشل التطبيق. تأكد من أن القيمة بين 1 و500.' },
  'alerts.readOnly': { en: 'You have read-only access. Administrator privileges required to change grid thresholds.', ar: 'لديك صلاحية قراءة فقط. يلزم امتياز المسؤول لتغيير عتبات الشبكة.' },
  'alerts.currentlyActive': { en: 'Currently Active', ar: 'النشط حاليًا' },
  'alerts.updateLive': { en: 'Update live on grid.', ar: 'التحديث مباشر على الشبكة.' },

  'sensors.gridNetwork': { en: 'Grid Network', ar: 'شبكة الرصد' },
  'sensors.title': { en: 'Sensor Array', ar: 'مصفوفة المستشعرات' },
  'sensors.subtitle': { en: 'Monitor the real-time telemetry and hardware status of all active environmental sensors across the city grid.', ar: 'راقب بيانات القياس المباشرة وحالة العتاد لجميع المستشعرات البيئية النشطة عبر شبكة المدينة.' },
  'sensors.totalUnits': { en: 'Total Units', ar: 'إجمالي الوحدات' },
  'sensors.online': { en: 'Online', ar: 'متصل' },
  'sensors.offline': { en: 'Offline', ar: 'غير متصل' },
  'sensors.idle': { en: 'Idle', ar: 'خامل' },
  'sensors.mission': { en: 'Mission', ar: 'في مهمة' },
  'sensors.currentAqi': { en: 'Current AQI', ar: 'مؤشر AQI الحالي' },
  'sensors.empty': { en: 'No sensor telemetry is available yet.', ar: 'لا توجد بيانات مستشعرات متاحة بعد.' },
  'sensors.pm25': { en: 'PM2.5', ar: 'PM2.5' },
  'sensors.no2': { en: 'NO2', ar: 'NO2' },
  'sensors.temp': { en: 'Temp', ar: 'الحرارة' },
  'sensors.battery': { en: 'Battery', ar: 'البطارية' },
  'sensors.viewOnMap': { en: 'View on map', ar: 'عرض على الخريطة' },
  'sensors.seeDetails': { en: 'See details', ar: 'مشاهدة التفاصيل' },
  'analytics.title': { en: 'Command Center Analytics', ar: 'تحليلات مركز القيادة' },
  'analytics.export': { en: 'Export Intelligence', ar: 'تصدير البيانات' },
  'analytics.forecast.show': { en: 'Show Forecast', ar: 'إظهار التوقعات' },
  'analytics.forecast.hide': { en: 'Hide Forecast', ar: 'إخفاء التوقعات' },
  'analytics.lastRefresh': { en: 'Last refresh', ar: 'آخر تحديث' },
} as const;

export type DictKey = keyof typeof DICT;

export function translate(key: DictKey, locale: Locale): string {
  return DICT[key]?.[locale] ?? DICT[key]?.en ?? key;
}

export function formatMessage(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => String(values[key] ?? ''));
}

export function tFormat(key: DictKey, locale: Locale, values: Record<string, string | number>) {
  return formatMessage(translate(key, locale), values);
}

export function formatNumber(value: number, locale: Locale, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(LOCALE_TAG[locale], options).format(value);
}

export function formatDateTime(value: string | number | Date, locale: Locale, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(LOCALE_TAG[locale], options ?? {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

export function formatDateTimeCompact(value: string | number | Date, locale: Locale): string {
  return formatDateTime(value, locale, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
