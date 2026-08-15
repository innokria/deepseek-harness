/** `update` namespace dictionaries. */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'available': '发现新版本 {version}',
  'downloading': '正在下载更新 {percent}%',
  'downloaded': '已下载 {version}，重启后安装',
} satisfies Record<string, string>

/** The update namespace key union. */
export type UpdateKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'available': 'Update {version} available',
  'downloading': 'Downloading update {percent}%',
  'downloaded': '{version} downloaded — restart to install',
} satisfies Record<UpdateKey, string>
