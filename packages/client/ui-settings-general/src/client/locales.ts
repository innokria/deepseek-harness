/** Shell chrome and General-nav dictionaries; feature rows own their copy. */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'trigger': '设置',
  'title': '设置',
  'close': '关闭',
  'openDocument': '打开配置文件',
  'openDocument.error': '无法打开配置文件',
  'general.nav': '通用设置',
  'launchAtLogin.title': '开机自启',
  'launchAtLogin.description': '登录系统后自动启动 DeepSeek Harness（仅安装版可开启，默认关闭）',
  'launchAtLogin.yes': '是',
  'launchAtLogin.no': '否',
  'notifications.title': '系统通知',
  'notifications.description': '服务意外退出、反复崩溃或恢复时弹出系统提示（默认开启）',
  'notifications.yes': '是',
  'notifications.no': '否',
} satisfies Record<string, string>

/** The settings namespace key union. */
export type SettingsKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'trigger': 'Settings',
  'title': 'Settings',
  'close': 'Close',
  'openDocument': 'Open configuration file',
  'openDocument.error': 'Could not open configuration file',
  'general.nav': 'General',
  'launchAtLogin.title': 'Launch at login',
  'launchAtLogin.description': 'Start DeepSeek Harness automatically when you sign in (packaged app only; off by default)',
  'launchAtLogin.yes': 'Yes',
  'launchAtLogin.no': 'No',
  'notifications.title': 'System notifications',
  'notifications.description': 'Show a system toast when the service crashes, keeps failing, or recovers (on by default)',
  'notifications.yes': 'Yes',
  'notifications.no': 'No',
} satisfies Record<SettingsKey, string>
