import { readFileSync } from "fs";
import { DgPermissions } from "./checkAccess_permissions.js";

const BotVersion = "1.0";

const _assertFn = (file, cond, additionalMsg) => {
  if (cond) return;
  if (additionalMsg) additionalMsg += "\n";
  console.error(
    "ОШИБКА :: Некорректная конфигурация бота (файл %s)\n%s См. руководство (файл README.md)",
    file,
    additionalMsg ?? ""
  );
  process.exit(-1);
};

const _strictCast = {
  boolean: (x) =>
    x.toLowerCase() === "true"
      ? true
      : x.toLowerCase() === "false"
      ? false
      : null,
  integer: (x) => (!isNaN(parseInt(x)) ? parseInt(x) : null),
};

const _permissionMapping = {
  ["партнёрство"]: DgPermissions.postPartnerships,
  ["смотреть_чужую_стату"]: DgPermissions.viewForeignStats,
  ["смотреть_стату_отдела"]: DgPermissions.viewDepartmentStats,
  ["управлять_партнёрством"]: DgPermissions.managePartnerships,
  ["управлять_чс"]: DgPermissions.manageBlacklist,
  ["админ"]: DgPermissions.admin,
};

function _getValidEnv() {
  const assert = _assertFn.bind(null, ".env");
  const env = { ...process.env };

  env.ENABLE_DEBUG = "ENABLE_DEBUG" in env
    ? _strictCast.boolean(env.ENABLE_DEBUG)
    : false;
  env.TextPrefix =
    env.ENABLE_DEBUG && env.TEST_BOT_TEXT_PREFIX
      ? env.TEST_BOT_TEXT_PREFIX
      : env.BOT_TEXT_PREFIX;
  env.BotVersion = BotVersion;
  env.PARTNER_ROLE_ID = env.PARTNER_ROLE_ID || undefined;
  env.LOG_LEVEL = env.LOG_LEVEL ? env.LOG_LEVEL.toLowerCase() : "info";
  env.REQUIREMENT_MINIMAL_MEMBERS = "REQUIREMENT_MINIMAL_MEMBERS" in env
    ? _strictCast.integer(env.REQUIREMENT_MINIMAL_MEMBERS)
    : -1;
  env.REQUIREMENT_ONCE_PER_DAY = "REQUIREMENT_ONCE_PER_DAY" in env
    ? _strictCast.boolean(env.REQUIREMENT_ONCE_PER_DAY)
    : false;
  env.DELETE_OLD_TEXTS = "DELETE_OLD_TEXTS" in env
    ? _strictCast.boolean(env.DELETE_OLD_TEXTS)
    : true;
  env.GENERAL_SCAN_UNFETCHED_STRATEGY = "GENERAL_SCAN_DELETE_UNFETCHED" in env
    ? (env.GENERAL_SCAN_UNFETCHED_STRATEGY = env.GENERAL_SCAN_UNFETCHED_STRATEGY.toLocaleUpperCase(),
      ["DELETE", "IGNORE", "COUNT"].includes(env.GENERAL_SCAN_UNFETCHED_STRATEGY)
      ? env.GENERAL_SCAN_UNFETCHED_STRATEGY
      : null)
    : "IGNORE";
  env.PARTNER_ALERTS_BATCH_DURATION = "PARTNER_ALERTS_BATCH_DURATION" in env
    ? _strictCast.integer(env.PARTNER_ALERTS_BATCH_DURATION)
    : 60;
  env.GENERAL_SCAN_DAILY_LIMIT = "GENERAL_SCAN_DAILY_LIMIT" in env
    ? _strictCast.integer(env.GENERAL_SCAN_DAILY_LIMIT)
    : 300;
  env.LOGS_LIFE_DURATION = "LOGS_LIFE_DURATION" in env
    ? _strictCast.integer(env.LOGS_LIFE_DURATION)
    : 30;
  env.ADMIN_ID_LIST = env.ADMIN_ID_LIST
    ? env.ADMIN_ID_LIST.replaceAll(" ", "").split(",")
    : [];
  env.PARTNERSHIP_CHANNELS_ID = env.PARTNERSHIP_CHANNELS_ID
    ? env.PARTNERSHIP_CHANNELS_ID.replaceAll(" ", "").split(",")
    : [];
  env.WATCHDOG_BOT_ENABLED = "WATCHDOG_BOT_ENABLED" in env
    ? _strictCast.boolean(env.WATCHDOG_BOT_ENABLED)
    : true;

  assert(
    env.ENABLE_DEBUG !== null,
    "Указано некорректное значение для ENABLE_DEBUG. Принимается только TRUE и FALSE"
  );
  assert(
    env.REQUIREMENT_MINIMAL_MEMBERS !== null,
    "Указано некорректное значение для REQUIREMENT_MINIMAL_MEMBERS. Принимаются только целые числа"
  );
  assert(
    env.REQUIREMENT_ONCE_PER_DAY !== null,
    "Указано некорректное значение для REQUIREMENT_ONCE_PER_DAY. Принимается только TRUE и FALSE"
  );
  assert(
    env.LOGS_LIFE_DURATION !== null,
    "Указано некорректное значение для LOGS_LIFE_DURATION. Принимаются целые числа"
  );
  assert(
    env.PARTNER_ALERTS_BATCH_DURATION !== null,
    "Указано некорректное значение для PARTNER_ALERTS_BATCH_DURATION. Принимаются целые числа"
  );
  assert(
    env.GENERAL_SCAN_UNFETCHED_STRATEGY !== null,
    "Указано некорректное значение для GENERAL_SCAN_UNFETCHED_STRATEGY. Принимается DELETE, IGNORE и COUNT"
  );
  assert(
    env.GENERAL_SCAN_DAILY_LIMIT !== null,
    "Указано некорректное значение для GENERAL_SCAN_DAILY_LIMIT. Принимаются целые числа"
  );
  assert(
    env.BOT_SECRET_TOKEN !== undefined,
    "Не указан BOT_SECRET_TOKEN"
  );
  assert(
    env.GUILD_ID !== undefined,
    "Не указан GUILD_ID"
  );
  assert(
    env.PARTNERSHIP_CHANNELS_ID.length > 0,
    "Не указан PARTNERSHIP_CHANNELS_ID"
  );
  assert(
    env.STAFF_CHANNEL_ID !== undefined,
    "Не указан STAFF_CHANNEL_ID"
  );
  assert(
    env.BOT_SYSTEM_CHANNEL_ID !== undefined,
    "Не указан BOT_SYSTEM_CHANNEL_ID"
  );
  assert(
    env.TextPrefix !== undefined,
    "Не указан BOT_TEXT_PREFIX"
  );

  env.ROLE_PERMISSIONS = {};
  for (const key of Object.keys(env)) {
    const matches = /^ROLE_(\d+)_PERMISSIONS$/.exec(key);
    if (matches === null) continue;
    const id = matches[1];
    assert(
      id != "",
      "Некорректный ID роли: " +
        id +
        ", в настройке прав роли. Полное имя переменной: " +
        key
    );
    env.ROLE_PERMISSIONS[id] = 0;
    const perms = env[key].replaceAll(" ", "").split(",");
    for (const pm of perms) {
      assert(pm in _permissionMapping, "Право " + pm + " не найдено");
      const real = _permissionMapping[pm];
      env.ROLE_PERMISSIONS[id] |= real;
    }
  }
  return env;
}

function _getValidResources() {
  const _FileName = "bot-resources.json";
  const assert = _assertFn.bind(null, _FileName);

  let _ResFile;
  try {
    _ResFile = readFileSync("./" + _FileName, "utf-8");
  } catch (_) {
    console.error(
      "ОШИБКА :: Не удалось найти файл '%s'.\nОн точно лежит в папке бота?",
      _FileName
    );
    process.exit(-1);
  }

  let res;
  try {
    res = JSON.parse(_ResFile);
  } catch (_) {
    assert(false);
  }

  assert(typeof res.colors === "object");
  assert(typeof res.images === "object");
  assert(typeof res.emoji === "object");

  res.colors = Object.fromEntries(
    Object.entries(res.colors).map(([k, v]) => [
      k,
      parseInt(v.startsWith("#") ? v.slice(1) : v, 16),
    ])
  );

  return res;
}

export const ConfigEnv = _getValidEnv();
export const resources = _getValidResources();
