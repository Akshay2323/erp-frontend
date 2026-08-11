/**
 * Frontend-only salary confirmation store (localStorage).
 * Replace with API calls when the backend endpoints are ready.
 */

export type SalaryConfirmationStatus = "not_sent" | "sent" | "confirmed";

export type SalaryConfirmationRecord = {
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  month: number;
  year: number;
  netPayable: number;
  status: SalaryConfirmationStatus;
  sentAt: string | null;
  sentBy: string | null;
  confirmedAt: string | null;
  confirmedBy: string | null;
};

export type SalaryConfirmationLog = {
  id: string;
  at: string;
  action: "sent" | "confirmed" | "cancelled_view";
  actor: string;
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  month: number;
  year: number;
  netPayable: number;
  message: string;
};

type StoreShape = {
  records: Record<string, SalaryConfirmationRecord>;
  logs: SalaryConfirmationLog[];
  version: number;
};

const STORAGE_KEY = "jyoti_salary_confirmations_v1";
const CHANGE_EVENT = "jyoti-salary-confirmation-change";

/** In-memory cache so useSyncExternalStore getSnapshot stays referentially stable. */
let memoryStore: StoreShape | null = null;
const EMPTY_LOGS: SalaryConfirmationLog[] = [];
const logsCache = new Map<string, SalaryConfirmationLog[]>();

function periodKey(employeeId: number, month: number, year: number): string {
  return `${employeeId}:${year}-${String(month).padStart(2, "0")}`;
}

function emptyStore(): StoreShape {
  return { records: {}, logs: [], version: 0 };
}

function readStore(): StoreShape {
  if (typeof window === "undefined") return emptyStore();
  if (memoryStore) return memoryStore;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      memoryStore = emptyStore();
      return memoryStore;
    }
    const parsed = JSON.parse(raw) as Partial<StoreShape>;
    memoryStore = {
      records: parsed.records ?? {},
      logs: Array.isArray(parsed.logs) ? parsed.logs : [],
      version: typeof parsed.version === "number" ? parsed.version : 0,
    };
    return memoryStore;
  } catch {
    memoryStore = emptyStore();
    return memoryStore;
  }
}

function writeStore(store: StoreShape): void {
  if (typeof window === "undefined") return;
  store.version = (store.version || 0) + 1;
  memoryStore = store;
  logsCache.clear();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function pushLog(
  store: StoreShape,
  entry: Omit<SalaryConfirmationLog, "id" | "at"> & { at?: string },
): void {
  store.logs.unshift({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: entry.at ?? new Date().toISOString(),
    action: entry.action,
    actor: entry.actor,
    employeeId: entry.employeeId,
    employeeCode: entry.employeeCode,
    employeeName: entry.employeeName,
    month: entry.month,
    year: entry.year,
    netPayable: entry.netPayable,
    message: entry.message,
  });
  // Keep last 500 entries
  if (store.logs.length > 500) {
    store.logs = store.logs.slice(0, 500);
  }
}

export function getConfirmationRecord(
  employeeId: number,
  month: number,
  year: number,
): SalaryConfirmationRecord | null {
  const store = readStore();
  return store.records[periodKey(employeeId, month, year)] ?? null;
}

export function findConfirmationByEmployeeCode(
  employeeCode: string,
  month: number,
  year: number,
): SalaryConfirmationRecord | null {
  const code = employeeCode.trim().toLowerCase();
  if (!code) return null;
  const store = readStore();
  return (
    Object.values(store.records).find(
      (r) =>
        r.month === month &&
        r.year === year &&
        r.employeeCode.trim().toLowerCase() === code,
    ) ?? null
  );
}

export function getConfirmationStatus(
  employeeId: number,
  month: number,
  year: number,
): SalaryConfirmationStatus {
  return getConfirmationRecord(employeeId, month, year)?.status ?? "not_sent";
}

export function listConfirmationLogs(filters?: {
  month?: number;
  year?: number;
  employeeId?: number;
}): SalaryConfirmationLog[] {
  const store = readStore();
  if (!filters || (filters.month == null && filters.year == null && filters.employeeId == null)) {
    return store.logs;
  }

  const cacheKey = `${store.version}:${filters.month ?? "*"}:${filters.year ?? "*"}:${filters.employeeId ?? "*"}`;
  const cached = logsCache.get(cacheKey);
  if (cached) return cached;

  const filtered = store.logs.filter((log) => {
    if (filters.month != null && log.month !== filters.month) return false;
    if (filters.year != null && log.year !== filters.year) return false;
    if (filters.employeeId != null && log.employeeId !== filters.employeeId) return false;
    return true;
  });
  logsCache.set(cacheKey, filtered.length === 0 ? EMPTY_LOGS : filtered);
  return filtered.length === 0 ? EMPTY_LOGS : filtered;
}

export function getSalaryConfirmationStoreVersion(): number {
  return readStore().version;
}

export type SendConfirmationInput = {
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  month: number;
  year: number;
  netPayable: number;
};

export function sendSalaryConfirmations(
  items: SendConfirmationInput[],
  actor: string,
): { sent: number; skipped: number } {
  if (items.length === 0) return { sent: 0, skipped: 0 };
  const store = readStore();
  let sent = 0;
  let skipped = 0;
  const now = new Date().toISOString();

  for (const item of items) {
    const key = periodKey(item.employeeId, item.month, item.year);
    const existing = store.records[key];
    if (existing?.status === "confirmed") {
      skipped += 1;
      continue;
    }

    store.records[key] = {
      employeeId: item.employeeId,
      employeeCode: item.employeeCode,
      employeeName: item.employeeName,
      month: item.month,
      year: item.year,
      netPayable: item.netPayable,
      status: "sent",
      sentAt: now,
      sentBy: actor,
      confirmedAt: existing?.confirmedAt ?? null,
      confirmedBy: existing?.confirmedBy ?? null,
    };

    pushLog(store, {
      action: "sent",
      actor,
      employeeId: item.employeeId,
      employeeCode: item.employeeCode,
      employeeName: item.employeeName,
      month: item.month,
      year: item.year,
      netPayable: item.netPayable,
      message: `Salary confirmation request sent to ${item.employeeName} (${item.employeeCode || item.employeeId}).`,
      at: now,
    });
    sent += 1;
  }

  writeStore(store);
  return { sent, skipped };
}

export function confirmSalaryByEmployee(input: {
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  month: number;
  year: number;
  netPayable: number;
  actor: string;
}): { ok: boolean; reason?: string } {
  const store = readStore();

  // Prefer the record created when admin sent the request (may use a different id key matched by code).
  const byCode = input.employeeCode
    ? Object.values(store.records).find(
        (r) =>
          r.month === input.month &&
          r.year === input.year &&
          r.employeeCode.trim().toLowerCase() === input.employeeCode.trim().toLowerCase(),
      )
    : null;

  const employeeId = byCode?.employeeId ?? input.employeeId;
  const key = periodKey(employeeId, input.month, input.year);
  const existing = store.records[key] ?? byCode ?? null;

  if (existing?.status === "confirmed") {
    return { ok: false, reason: "You have already confirmed this salary." };
  }

  const now = new Date().toISOString();
  store.records[key] = {
    employeeId,
    employeeCode: input.employeeCode || existing?.employeeCode || "",
    employeeName: input.employeeName || existing?.employeeName || input.actor,
    month: input.month,
    year: input.year,
    netPayable: input.netPayable,
    status: "confirmed",
    sentAt: existing?.sentAt ?? null,
    sentBy: existing?.sentBy ?? null,
    confirmedAt: now,
    confirmedBy: input.actor,
  };

  pushLog(store, {
    action: "confirmed",
    actor: input.actor,
    employeeId,
    employeeCode: input.employeeCode || existing?.employeeCode || "",
    employeeName: input.employeeName || existing?.employeeName || input.actor,
    month: input.month,
    year: input.year,
    netPayable: input.netPayable,
    message: `${input.employeeName} confirmed salary for ${input.month}/${input.year} (Net ₹${input.netPayable.toLocaleString("en-IN", { minimumFractionDigits: 2 })}).`,
    at: now,
  });

  writeStore(store);
  return { ok: true };
}

/** Subscribe to store changes (same tab + cross-tab). */
export function subscribeSalaryConfirmations(listener: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY || e.key === null) {
      memoryStore = null;
      logsCache.clear();
      listener();
    }
  };
  const onLocal = () => listener();
  window.addEventListener(CHANGE_EVENT, onLocal);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onLocal);
    window.removeEventListener("storage", onStorage);
  };
}
