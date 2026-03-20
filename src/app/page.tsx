"use client";

import { BoardClock } from "@/components/BoardClock";
import { supabase } from "@/../lib/supabaseClient";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

type Row = {
  testRig: string;
  lwoNo: string;
  project: string;
  task: string;
  status: string;
  operator: string;
  attendance: boolean;
  eventLog: string;
};

const headers = [
  "Test Rig",
  "LWO NO.",
  "Project",
  "Task",
  "Status",
  "Operator",
  "Attendance",
  "Event Log",
] as const;

const emptyRow: Row = {
  testRig: "",
  lwoNo: "",
  project: "",
  task: "",
  status: "",
  operator: "",
  attendance: true,
  eventLog: "",
};

const KANBAN_HISTORY_KEY = "kanban_history_logs";
const KANBAN_RECORD_ID = 1;
const AUTH_SETTINGS_ID = 1;

type KanbanDataV1 = {
  version: 1;
  companyName: string;
  savedAt: string; // ISO string
  rows: Row[];
};

type KanbanSnapshot = {
  date: string; // YYYY-MM-DD
  companyName: string;
  savedAt: string; // ISO string
  rows: Row[];
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function formatYYYYMMDD(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export default function Home() {
  const initialRows = useMemo<Row[]>(
    () => [
      {
        testRig: "WD01",
        lwoNo: "LN-001",
        project: "PD-001",
        task: "Durability test – 2 stations (LH/RH)",
        status: "0 / 35000",
        operator: "Ke Jun",
        attendance: true,
        eventLog: "Equipment maintenance",
      },
      {
        testRig: "WD02",
        lwoNo: "LN-002",
        project: "PD-001",
        task: "High-low temperature test",
        status: "1 / 2",
        operator: "Ke Jun",
        attendance: true,
        eventLog: "",
      },
      {
        testRig: "WD03",
        lwoNo: "LN-003",
        project: "PD-001",
        task: "High-low temperature test",
        status: "1 / 2",
        operator: "Ke Jun",
        attendance: true,
        eventLog: "",
      },
      {
        testRig: "WD04",
        lwoNo: "LN-004",
        project: "PD-001",
        task: "Rust proof test",
        status: "0 / 5",
        operator: "Ke Jun",
        attendance: true,
        eventLog: "",
      },
    ],
    [],
  );

  const [companyName, setCompanyName] = useState("[公司名称占位符]");
  const [rows, setRows] = useState<Row[]>(() => initialRows);

  const [isAuthed, setIsAuthed] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const [draftCompanyName, setDraftCompanyName] =
    useState("[公司名称占位符]");
  const [draftRows, setDraftRows] = useState<Row[]>(() => initialRows);

  const [authOpen, setAuthOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordChangeError, setPasswordChangeError] = useState<string | null>(
    null,
  );
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLogs, setHistoryLogs] = useState<KanbanSnapshot[]>([]);
  const [previewSnapshot, setPreviewSnapshot] = useState<KanbanSnapshot | null>(
    null,
  );
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2000);
    return () => window.clearTimeout(id);
  }, [toast]);

  const fetchAuthPassword = async (): Promise<string | null> => {
    const { data, error } = await supabase
      .from("auth_settings")
      .select("password")
      .eq("id", AUTH_SETTINGS_ID)
      .maybeSingle();
    if (error || !data || typeof data.password !== "string") return null;
    return data.password;
  };

  /** 未配置 auth_settings 时使用的默认密码（仅当 Supabase 读不到密码时生效） */
  const DEFAULT_PASSWORD = "123456";

  const updateAuthPassword = async (newPassword: string): Promise<void> => {
    const { error } = await supabase
      .from("auth_settings")
      .upsert(
        { id: AUTH_SETTINGS_ID, password: newPassword },
        { onConflict: "id" },
      );
    if (error) throw error;
  };

  const fetchFromSupabase = async () => {
    const { data, error } = await supabase
      .from("kanban_data")
      .select("data")
      .eq("id", KANBAN_RECORD_ID)
      .maybeSingle();
    if (error) {
      console.warn("Failed to fetch kanban_data", error);
      return null;
    }
    if (!data || !data.data) {
      return null;
    }
    const payload = data.data as KanbanDataV1;
    if (
      !payload ||
      typeof payload !== "object" ||
      (payload as { version?: unknown }).version !== 1
    ) {
      return null;
    }
    return payload;
  };

  const saveToSupabase = async (nextCompanyName: string, nextRows: Row[]) => {
    const payload: KanbanDataV1 = {
      version: 1,
      companyName: nextCompanyName,
      savedAt: new Date().toISOString(),
      rows: nextRows,
    };
    const { error } = await supabase
      .from("kanban_data")
      .upsert({ id: KANBAN_RECORD_ID, data: payload }, { onConflict: "id" });
    if (error) {
      console.error("Failed to save kanban_data", error);
      throw error;
    }
    return payload;
  };

  const readHistoryLogs = (): KanbanSnapshot[] => {
    try {
      const raw = window.localStorage.getItem(KANBAN_HISTORY_KEY);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      const cleaned = parsed
        .filter((x) => x && typeof x === "object")
        .map((x) => x as Partial<KanbanSnapshot>)
        .filter(
          (x): x is KanbanSnapshot =>
            typeof x.date === "string" &&
            typeof x.companyName === "string" &&
            typeof x.savedAt === "string" &&
            Array.isArray(x.rows),
        );
      cleaned.sort((a, b) => b.date.localeCompare(a.date));
      return cleaned;
    } catch {
      return [];
    }
  };

  const writeHistoryLogs = (next: KanbanSnapshot[]) => {
    window.localStorage.setItem(KANBAN_HISTORY_KEY, JSON.stringify(next));
  };

  const upsertTodaySnapshot = (nextCompanyName: string, nextRows: Row[]) => {
    const today = formatYYYYMMDD(new Date());
    const snapshot: KanbanSnapshot = {
      date: today,
      companyName: nextCompanyName,
      savedAt: new Date().toISOString(),
      rows: nextRows,
    };
    const prev = readHistoryLogs();
    const withoutToday = prev.filter((x) => x.date !== today);
    const next = [snapshot, ...withoutToday].sort((a, b) =>
      b.date.localeCompare(a.date),
    );
    writeHistoryLogs(next);
    return next;
  };

  const exportSnapshotCsv = (snap: KanbanSnapshot) => {
    const columns: Array<{ key: keyof Row; label: string }> = [
      { key: "testRig", label: "Test Rig" },
      { key: "lwoNo", label: "LWO NO." },
      { key: "project", label: "Project" },
      { key: "task", label: "Task" },
      { key: "status", label: "Status" },
      { key: "operator", label: "Operator" },
      { key: "attendance", label: "Attendance Status" },
      { key: "eventLog", label: "Event Log" },
    ];

    const esc = (v: unknown) => {
      const s = String(v ?? "");
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };

    const lines: string[] = [];
    lines.push(esc("Date"), esc(snap.date), esc("Company"), esc(snap.companyName));
    lines.push("");
    lines.push(columns.map((c) => esc(c.label)).join(","));
    for (const r of snap.rows) {
      lines.push(
        columns
          .map((c) =>
            c.key === "attendance"
              ? esc(r.attendance ? "YES" : "NO")
              : esc(r[c.key]),
          )
          .join(","),
      );
    }

    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kanban_snapshot_${snap.date}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const startEditing = () => {
    setDraftCompanyName(companyName);
    setDraftRows(rows);
    setIsEditing(true);
  };

  const logout = () => {
    setIsEditing(false);
    setIsAuthed(false);
    setAuthOpen(false);
    setAdminOpen(false);
    setPasswordDialogOpen(false);
    setHistoryOpen(false);
    setPreviewSnapshot(null);
    setPassword("");
    setPasswordError(null);
  };

  const viewRows = isEditing ? draftRows : rows;
  const rowCount = viewRows.length || 1;
  const dense = rowCount > 10;
  const cellTextSize = dense
    ? "text-[clamp(0.75rem,1.3vw,1.35rem)]"
    : "text-[clamp(0.9rem,1.6vw,1.8rem)]";
  const cellDisplayClass = `${cellTextSize} align-middle break-words leading-[1] overflow-hidden text-center`;
  const cellPaddingY = isEditing ? "py-3" : dense ? "py-[0.12rem]" : "py-0.5";
  const headerTextSize = "text-[clamp(0.9rem,1.5vw,1.55rem)]";
  const inputClass =
    "w-full rounded-[0.6rem] border border-[#0b3b73] bg-[#021a3d] px-3 py-2 text-[#e6f7ff] outline-none focus:border-[#38bdf8]";

  const addRow = () => {
    setDraftRows((prev) => [...prev, { ...emptyRow }]);
  };

  const removeRow = (index: number) => {
    setDraftRows((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleAttendance = (index: number) => {
    // Edit-mode LED toggle: update local draft first, then immediately sync to Supabase.
    setDraftRows((prev) => {
      const next = prev.map((row, i) =>
        i === index ? { ...row, attendance: !row.attendance } : row,
      );

      void (async () => {
        try {
          await saveToSupabase(draftCompanyName, next);
          const nextLogs = upsertTodaySnapshot(draftCompanyName, next);
          setHistoryLogs(nextLogs);
        } catch (e) {
          console.warn("Failed to sync attendance toggle", e);
        }
      })();

      return next;
    });
  };

  useEffect(() => {
    let active = true;

    // 初次进入或退出编辑模式后，如果当前不是编辑中，则从云端拉一次最新数据
    if (!isEditing) {
      (async () => {
        setIsLoading(true);
        const payload = await fetchFromSupabase();
        if (!active) return;
        if (payload) {
          setCompanyName(payload.companyName);
          setRows(payload.rows);
          setDraftCompanyName(payload.companyName);
          setDraftRows(payload.rows);
        }
        setIsLoading(false);
      })();
    }

    // 编辑模式或修改密码弹窗打开时暂停自动轮询
    if (isEditing || passwordDialogOpen) {
      return () => {
        active = false;
      };
    }

    const id = window.setInterval(async () => {
      const payload = await fetchFromSupabase();
      if (!payload) return;
      if (!active) return;
      setCompanyName(payload.companyName);
      setRows(payload.rows);
      setDraftCompanyName(payload.companyName);
      setDraftRows(payload.rows);
    }, 30_000);

    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, [isEditing, passwordDialogOpen]);

  return (
    <div className="h-[100vh] w-dvw overflow-hidden bg-[#01061a] text-[#e6f7ff]">
      {toast ? (
        <div className="fixed top-[clamp(0.75rem,1.5vw,1.25rem)] left-1/2 z-50 -translate-x-1/2 rounded-full bg-slate-900/80 px-5 py-3 text-[clamp(0.95rem,1.2vw,1.1rem)] font-semibold text-white shadow-lg backdrop-blur">
          {toast}
        </div>
      ) : null}
      <div className="flex h-full min-h-0 flex-col gap-[clamp(0.75rem,1.5vw,1.75rem)] p-[clamp(1rem,2vw,2.5rem)]">
        {isLoading && !isEditing && (
          <div className="pointer-events-none absolute right-[clamp(1rem,2vw,2.5rem)] top-[clamp(1rem,2vw,2.5rem)] rounded-full bg-slate-900/70 px-4 py-2 text-[clamp(0.8rem,1vw,0.95rem)] font-medium text-white shadow-sm backdrop-blur">
            正在从云端加载…
          </div>
        )}
        <header className="shrink-0 flex flex-wrap items-center justify-between gap-[clamp(0.75rem,1.5vw,1.75rem)]">
          <div className="flex shrink-0 items-center pl-8">
            <Image
              src="/BorgWarner_Logo_Dark_Blue_(1).svg"
              alt="BorgWarner"
              width={546}
              height={45}
              className="h-[45px] w-auto max-w-[min(100vw-8rem,560px)] mes-logo-filter"
              priority
            />
          </div>

          <div className="flex items-center gap-[clamp(0.5rem,1vw,1.25rem)]">
            <div className="text-right translate-y-[2px]">
              <BoardClock />
            </div>
            {isAuthed ? (
              <button
                type="button"
                onClick={logout}
                className="rounded-[0.75rem] border border-[#0b3b73] bg-[#021a3d]/60 px-4 py-3 text-[clamp(0.875rem,1.2vw,1.125rem)] font-semibold text-[#e6f7ff] shadow-sm backdrop-blur hover:bg-[#021a3d]/80"
              >
                退出登录
              </button>
            ) : null}
          </div>
        </header>

        {isEditing ? (
          <div className="sticky top-0 z-20 shrink-0 flex flex-wrap items-center justify-between gap-[clamp(0.75rem,1.5vw,1.75rem)] rounded-[1rem] border border-[#0b3b73] bg-[#021a3d]/70 p-4 shadow-sm backdrop-blur">
            <div className="flex items-center gap-4">
              <div className="text-[clamp(0.95rem,1.2vw,1.25rem)] font-semibold text-[#e6f7ff]">
                编辑模式
              </div>
              <div className="rounded-full bg-amber-500/80 px-3 py-1 text-[clamp(0.75rem,0.95vw,0.85rem)] font-medium text-white shadow-sm backdrop-blur">
                自动同步已暂停
              </div>
            </div>
            <div className="flex flex-wrap gap-[clamp(0.5rem,1vw,1.25rem)]">
              <button
                type="button"
                onClick={async () => {
                  setCompanyName(draftCompanyName);
                  setRows(draftRows);
                  try {
                    await saveToSupabase(draftCompanyName, draftRows);
                    const next = upsertTodaySnapshot(
                      draftCompanyName,
                      draftRows,
                    );
                    setHistoryLogs(next);
                    setToast("保存成功");
                  } catch {
                    // storage may fail (quota/private mode)
                  }
                  setIsEditing(false);
                }}
                className="rounded-[0.75rem] bg-emerald-600 px-5 py-3 text-[clamp(0.95rem,1.2vw,1.25rem)] font-bold text-white shadow-sm hover:bg-emerald-700"
              >
                保存修改
              </button>
              <button
                type="button"
                onClick={() => {
                  setDraftCompanyName(companyName);
                  setDraftRows(rows);
                  setIsEditing(false);
                }}
                className="rounded-[0.75rem] border border-[#0b3b73] bg-[#021a3d]/60 px-5 py-3 text-[clamp(0.95rem,1.2vw,1.25rem)] font-bold text-[#e6f7ff] shadow-sm hover:bg-[#021a3d]/80"
              >
                取消
              </button>
            </div>
          </div>
        ) : null}

        <section
          className={
            isEditing
              ? "min-h-0 flex-1 flex flex-col mes-cut-frame bg-[#01152f] shadow-sm"
              : "min-h-0 flex-1 h-full flex flex-col mes-cut-frame bg-[#01152f] shadow-sm"
          }
        >
          <div
            className={
              isEditing
                ? "h-full min-h-0 flex-1 flex flex-col overflow-y-auto"
                : "h-full min-h-0 flex-1 flex flex-col overflow-hidden"
            }
          >
            <table
              className={
                isEditing
                  ? "w-full table-fixed border-separate border-spacing-0"
                  : "h-full w-full table-fixed border-separate border-spacing-0"
              }
              style={isEditing ? undefined : { height: "100%" }}
            >
            <caption className="caption-top border border-[#0d3a7d] border-b-0 bg-[#07142b] py-2 text-center text-[clamp(1.15rem,2.0vw,1.95rem)] font-black tracking-[0.1rem] text-[#00f2fe]">
              TESTING TASK LIST
            </caption>
            <thead className="sticky top-0 z-10 bg-[#0a1931] shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]">
              <tr className="bg-[#0a1931] text-[#00f2fe]">
                {headers.map((h) => (
                  <th
                    key={h}
                    className={`border border-[#0d3a7d] border-b-2 border-b-[#00f2fe] bg-[#0a1931] px-3 py-3 text-center align-middle uppercase font-black text-[#00f2fe] ${
                      h === "Attendance"
                        ? "whitespace-nowrap leading-tight text-[clamp(0.74rem,0.95vw,0.9rem)] tracking-[0.005rem]"
                        : `whitespace-nowrap ${headerTextSize} tracking-[0.03rem]`
                    }`}
                  >
                    {h}
                  </th>
                ))}
                {isEditing && (
                  <th
                    className={`border border-[#0d3a7d] border-b-2 border-b-[#00f2fe] bg-[#0a1931] px-3 py-3 text-center align-middle whitespace-nowrap uppercase ${headerTextSize} font-black tracking-[0.03rem] text-[#00f2fe] w-[6rem]`}
                  >
                    操作
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {viewRows.map((r, idx) => (
                <tr
                  key={
                    isEditing ? `edit-${idx}` : `${r.testRig}-${r.lwoNo}-${idx}`
                  }
                  className={
                    idx % 2 === 0 ? "bg-[#01152f]" : "bg-[#021a3d]"
                  }
                  style={
                    isEditing
                      ? { minHeight: "60px" }
                      : { height: "1px", minHeight: 0, flex: "1 0 auto" }
                  }
                >
                  <td
                    className={`border border-[#0d3a7d] px-4 ${cellPaddingY} ${isEditing ? cellTextSize : cellDisplayClass} font-semibold`}
                  >
                      {isEditing ? (
                        <input
                          value={r.testRig}
                          onChange={(e) =>
                            setDraftRows((prev) =>
                              prev.map((row, i) =>
                                i === idx
                                  ? { ...row, testRig: e.target.value }
                                  : row,
                              ),
                            )
                          }
                          className={inputClass}
                        />
                      ) : (
                        r.testRig ? r.testRig : "\u00A0"
                      )}
                    </td>

                  <td
                    className={`border border-[#0d3a7d] px-4 ${cellPaddingY} ${isEditing ? cellTextSize : cellDisplayClass}`}
                  >
                      {isEditing ? (
                        <input
                          value={r.lwoNo}
                          onChange={(e) =>
                            setDraftRows((prev) =>
                              prev.map((row, i) =>
                                i === idx
                                  ? { ...row, lwoNo: e.target.value }
                                  : row,
                              ),
                            )
                          }
                          className={inputClass}
                        />
                      ) : (
                        r.lwoNo ? r.lwoNo : "\u00A0"
                      )}
                    </td>

                  <td
                    className={`border border-[#0d3a7d] px-4 ${cellPaddingY} ${isEditing ? cellTextSize : cellDisplayClass}`}
                  >
                      {isEditing ? (
                        <input
                          value={r.project}
                          onChange={(e) =>
                            setDraftRows((prev) =>
                              prev.map((row, i) =>
                                i === idx
                                  ? { ...row, project: e.target.value }
                                  : row,
                              ),
                            )
                          }
                          className={inputClass}
                        />
                      ) : (
                        r.project ? r.project : "\u00A0"
                      )}
                    </td>

                  <td
                    className={`border border-[#0d3a7d] px-4 ${cellPaddingY} ${isEditing ? cellTextSize : cellDisplayClass}`}
                  >
                      {isEditing ? (
                        <textarea
                          value={r.task}
                          onChange={(e) =>
                            setDraftRows((prev) =>
                              prev.map((row, i) =>
                                i === idx
                                  ? { ...row, task: e.target.value }
                                  : row,
                              ),
                            )
                          }
                          rows={2}
                          className={`${inputClass} resize-none`}
                        />
                      ) : (
                        r.task ? r.task : "\u00A0"
                      )}
                    </td>

                  <td
                    className={`border border-[#0d3a7d] px-4 ${cellPaddingY} ${isEditing ? cellTextSize : cellDisplayClass}`}
                  >
                      {isEditing ? (
                        <input
                          value={r.status}
                          onChange={(e) =>
                            setDraftRows((prev) =>
                              prev.map((row, i) =>
                                i === idx
                                  ? { ...row, status: e.target.value }
                                  : row,
                              ),
                            )
                          }
                          className={inputClass}
                        />
                      ) : (
                        r.status ? r.status : "\u00A0"
                      )}
                    </td>

                  <td
                    className={`border border-[#0d3a7d] px-4 ${cellPaddingY} ${isEditing ? cellTextSize : cellDisplayClass}`}
                  >
                      {isEditing ? (
                        <input
                          value={r.operator}
                          onChange={(e) =>
                            setDraftRows((prev) =>
                              prev.map((row, i) =>
                                i === idx
                                  ? { ...row, operator: e.target.value }
                                  : row,
                              ),
                            )
                          }
                          className={inputClass}
                        />
                      ) : (
                        r.operator ? r.operator : "\u00A0"
                      )}
                    </td>

                  <td
                    className={`attendance-led-td ${cellPaddingY} ${isEditing ? cellTextSize : cellDisplayClass}`}
                    style={{
                      display: "table-cell",
                      verticalAlign: "middle",
                      textAlign: "center",
                      width: 120,
                      minWidth: 120,
                      maxWidth: 120,
                    }}
                  >
                    {isEditing ? (
                      <button
                        type="button"
                        onClick={() => toggleAttendance(idx)}
                        className={`mes-led attendance-led cursor-pointer border-0 bg-transparent p-0 m-0 leading-none focus:outline-none ${
                          r.attendance ? "mes-led-on" : "mes-led-off"
                        }`}
                        aria-label={
                          r.attendance ? "切换为未出勤" : "切换为已出勤"
                        }
                      />
                    ) : (
                      <span
                        className={`mes-led attendance-led ${r.attendance ? "mes-led-on" : "mes-led-off"}`}
                        aria-hidden="true"
                      />
                    )}
                    </td>

                    <td
                      className={`border border-[#0d3a7d] px-4 ${cellPaddingY} ${isEditing ? cellTextSize : cellDisplayClass}`}
                    >
                      {isEditing ? (
                        <textarea
                          value={r.eventLog}
                          onChange={(e) =>
                            setDraftRows((prev) =>
                              prev.map((row, i) =>
                                i === idx
                                  ? { ...row, eventLog: e.target.value }
                                  : row,
                              ),
                            )
                          }
                          rows={2}
                          className={`${inputClass} resize-none`}
                        />
                      ) : r.eventLog ? (
                        r.eventLog
                      ) : (
                        <span className="text-[#88bcd6]">—</span>
                      )}
                    </td>
                  {isEditing && (
                    <td
                      className={`border border-[#0d3a7d] px-2 ${cellPaddingY} ${cellTextSize} align-middle w-[6rem]`}
                    >
                      <button
                        type="button"
                        onClick={() => removeRow(idx)}
                        className="rounded-lg border border-[#0b3b73] bg-[#021a3d]/60 px-3 py-1.5 text-[clamp(0.8rem,1vw,0.95rem)] font-medium text-[#e6f7ff] hover:bg-rose-900/30 hover:text-[#ff9aa2] hover:border-rose-400/50"
                        title="删除该行"
                      >
                        🗑️ 删除
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            </table>
          </div>
          {isEditing && (
            <div className="shrink-0 border-t border-[#0b3b73] bg-[#021a3d]/40 px-4 py-3">
              <button
                type="button"
                onClick={addRow}
                className="rounded-[0.75rem] border border-[#0b3b73] bg-[#021a3d]/70 px-4 py-2.5 text-[clamp(0.9rem,1.1vw,1rem)] font-semibold text-[#e6f7ff] shadow-sm hover:bg-[#021a3d]/90"
              >
                ➕ 添加新行
              </button>
            </div>
          )}
        </section>
      </div>

      <button
        type="button"
        onClick={() => {
          if (isAuthed) {
            setHistoryLogs(readHistoryLogs());
            setAdminOpen(true);
            return;
          }
          setAuthOpen(true);
          setPassword("");
          setPasswordError(null);
        }}
        className="fixed bottom-[clamp(1rem,2vw,2.5rem)] right-[clamp(1rem,2vw,2.5rem)] rounded-full border border-white/30 bg-slate-900/30 p-4 text-white shadow-lg backdrop-blur hover:bg-slate-900/40"
        aria-label="Admin"
        title="管理"
      >
        <span className="block text-[clamp(1.25rem,2vw,2rem)] leading-none">
          ⚙︎
        </span>
      </button>

      {authOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-[clamp(1rem,2vw,2.5rem)]"
          role="dialog"
          aria-modal="true"
          aria-label="Password"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setAuthOpen(false);
          }}
        >
          <div className="w-full max-w-[32rem] rounded-[1rem] border border-[#0b3b73] bg-[#01152f] p-6 shadow-xl text-[#e6f7ff]">
            <div className="text-[clamp(1rem,1.4vw,1.25rem)] font-bold text-[#e6f7ff]">
              管理员验证
            </div>
            <div className="mt-4">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key !== "Enter") return;
                  const current = await fetchAuthPassword();
                  const effective = current ?? DEFAULT_PASSWORD;
                  if (password !== effective) {
                    setPasswordError(
                      current === null
                        ? "密码错误（若已配置 auth_settings 表，请检查表中 id=1 的 password 或 RLS 策略）"
                        : "密码错误",
                    );
                    return;
                  }
                  setIsAuthed(true);
                  setAuthOpen(false);
                  setPassword("");
                  setPasswordError(null);
                  startEditing();
                }}
                className="w-full rounded-[0.75rem] border border-[#0b3b73] bg-[#021a3d] px-4 py-3 text-[clamp(0.95rem,1.2vw,1.1rem)] text-[#e6f7ff] outline-none focus:border-[#38bdf8]"
                placeholder="请输入密码"
                autoFocus
              />
              {passwordError ? (
                <div className="mt-3 text-[clamp(0.9rem,1.1vw,1rem)] font-semibold text-rose-600">
                  {passwordError}
                </div>
              ) : null}
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setAuthOpen(false)}
                className="rounded-[0.75rem] border border-[#0b3b73] bg-[#021a3d] px-5 py-3 text-[clamp(0.95rem,1.2vw,1.1rem)] font-bold text-[#e6f7ff] hover:bg-[#021a3d]/80"
              >
                取消
              </button>
              <button
                type="button"
                onClick={async () => {
                  const current = await fetchAuthPassword();
                  const effective = current ?? DEFAULT_PASSWORD;
                  if (password !== effective) {
                    setPasswordError(
                      current === null
                        ? "密码错误（若已配置 auth_settings 表，请检查表中 id=1 的 password 或 RLS 策略）"
                        : "密码错误",
                    );
                    return;
                  }
                  setIsAuthed(true);
                  setAuthOpen(false);
                  setPassword("");
                  setPasswordError(null);
                  startEditing();
                }}
                className="rounded-[0.75rem] bg-[#0b3b73] px-5 py-3 text-[clamp(0.95rem,1.2vw,1.1rem)] font-bold text-white hover:bg-[#09345f]"
              >
                确认
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {adminOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-[clamp(1rem,2vw,2.5rem)]"
          role="dialog"
          aria-modal="true"
          aria-label="Admin panel"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setAdminOpen(false);
          }}
        >
          <div className="w-full max-w-[36rem] rounded-[1rem] border border-[#0b3b73] bg-[#01152f] p-6 shadow-xl text-[#e6f7ff]">
            <div className="text-[clamp(1rem,1.4vw,1.25rem)] font-bold text-[#e6f7ff]">
              管理面板
            </div>
            <div className="mt-5 grid gap-3">
              <button
                type="button"
                onClick={() => {
                  setAdminOpen(false);
                  startEditing();
                }}
                className="w-full rounded-[0.75rem] bg-[#0b3b73] px-5 py-3 text-[clamp(0.95rem,1.2vw,1.1rem)] font-bold text-white hover:bg-[#09345f]"
              >
                进入编辑模式
              </button>
              <button
                type="button"
                onClick={() => {
                  setAdminOpen(false);
                  setHistoryLogs(readHistoryLogs());
                  setHistoryOpen(true);
                }}
                className="w-full rounded-[0.75rem] border border-[#0b3b73] bg-[#021a3d] px-5 py-3 text-[clamp(0.95rem,1.2vw,1.1rem)] font-bold text-[#e6f7ff] hover:bg-[#021a3d]/80"
              >
                查看历史数据
              </button>
              <button
                type="button"
                onClick={() => {
                  setAdminOpen(false);
                  setPasswordDialogOpen(true);
                  setOldPassword("");
                  setNewPassword("");
                  setConfirmPassword("");
                  setPasswordChangeError(null);
                }}
                className="w-full rounded-[0.75rem] border border-[#0b3b73] bg-[#021a3d] px-5 py-3 text-[clamp(0.95rem,1.2vw,1.1rem)] font-bold text-[#e6f7ff] hover:bg-[#021a3d]/80"
              >
                修改登录密码
              </button>
              <button
                type="button"
                onClick={logout}
                className="w-full rounded-[0.75rem] border border-[#0b3b73] bg-[#021a3d] px-5 py-3 text-[clamp(0.95rem,1.2vw,1.1rem)] font-bold text-rose-300 hover:bg-[#021a3d]/80"
              >
                退出登录
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {passwordDialogOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-[clamp(1rem,2vw,2.5rem)]"
          role="dialog"
          aria-modal="true"
          aria-label="修改登录密码"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setPasswordDialogOpen(false);
              setPasswordChangeError(null);
            }
          }}
        >
          <div className="w-full max-w-[28rem] rounded-[1rem] border border-[#0b3b73] bg-[#01152f] p-6 shadow-xl text-[#e6f7ff]">
            <div className="text-[clamp(1rem,1.4vw,1.25rem)] font-bold text-[#e6f7ff]">
              修改登录密码
            </div>
            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-[clamp(0.85rem,1vw,0.95rem)] font-medium text-[#e6f7ff]">
                  旧密码
                </label>
                <input
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  className="w-full rounded-[0.75rem] border border-[#0b3b73] bg-[#021a3d] px-4 py-3 text-[clamp(0.95rem,1.2vw,1.1rem)] text-[#e6f7ff] outline-none focus:border-[#38bdf8]"
                  placeholder="请输入当前密码"
                />
              </div>
              <div>
                <label className="mb-1 block text-[clamp(0.85rem,1vw,0.95rem)] font-medium text-[#e6f7ff]">
                  新密码
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-[0.75rem] border border-[#0b3b73] bg-[#021a3d] px-4 py-3 text-[clamp(0.95rem,1.2vw,1.1rem)] text-[#e6f7ff] outline-none focus:border-[#38bdf8]"
                  placeholder="请输入新密码"
                />
              </div>
              <div>
                <label className="mb-1 block text-[clamp(0.85rem,1vw,0.95rem)] font-medium text-[#e6f7ff]">
                  确认新密码
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-[0.75rem] border border-[#0b3b73] bg-[#021a3d] px-4 py-3 text-[clamp(0.95rem,1.2vw,1.1rem)] text-[#e6f7ff] outline-none focus:border-[#38bdf8]"
                  placeholder="请再次输入新密码"
                />
              </div>
              {passwordChangeError ? (
                <div className="text-[clamp(0.9rem,1.1vw,1rem)] font-semibold text-rose-600">
                  {passwordChangeError}
                </div>
              ) : null}
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setPasswordDialogOpen(false);
                  setPasswordChangeError(null);
                }}
                className="rounded-[0.75rem] border border-[#0b3b73] bg-[#021a3d]/60 px-5 py-3 text-[clamp(0.95rem,1.2vw,1.1rem)] font-bold text-[#e6f7ff] hover:bg-[#021a3d]/80"
              >
                取消
              </button>
              <button
                type="button"
                onClick={async () => {
                  setPasswordChangeError(null);
                  const current = await fetchAuthPassword();
                  if (current === null) {
                    setPasswordChangeError("无法获取当前密码，请稍后重试");
                    return;
                  }
                  if (oldPassword !== current) {
                    setPasswordChangeError("旧密码错误");
                    return;
                  }
                  if (newPassword !== confirmPassword) {
                    setPasswordChangeError("两次输入的新密码不一致");
                    return;
                  }
                  if (!newPassword.trim()) {
                    setPasswordChangeError("新密码不能为空");
                    return;
                  }
                  try {
                    await updateAuthPassword(newPassword.trim());
                    setToast("密码修改成功，请牢记");
                    setPasswordDialogOpen(false);
                    setOldPassword("");
                    setNewPassword("");
                    setConfirmPassword("");
                  } catch {
                    setPasswordChangeError("更新失败，请稍后重试");
                  }
                }}
                className="rounded-[0.75rem] bg-[#0b3b73] px-5 py-3 text-[clamp(0.95rem,1.2vw,1.1rem)] font-bold text-white hover:bg-[#09345f]"
              >
                确认修改
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {historyOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-[clamp(1rem,2vw,2.5rem)]"
          role="dialog"
          aria-modal="true"
          aria-label="History"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setHistoryOpen(false);
          }}
        >
          <div className="w-full max-w-[48rem] rounded-[1rem] border border-[#0b3b73] bg-[#01152f] p-6 shadow-xl text-[#e6f7ff]">
            <div className="flex items-center justify-between gap-4">
              <div className="text-[clamp(1rem,1.4vw,1.25rem)] font-bold text-[#e6f7ff]">
                历史快照（按日期倒序）
              </div>
              <button
                type="button"
                onClick={() => setHistoryOpen(false)}
                className="rounded-[0.75rem] border border-[#0b3b73] bg-[#021a3d]/60 px-4 py-2 text-[clamp(0.9rem,1.1vw,1rem)] font-bold text-[#e6f7ff] hover:bg-[#021a3d]/80"
              >
                关闭
              </button>
            </div>

            <div className="mt-5 max-h-[70vh] overflow-auto rounded-[0.75rem] border border-slate-200">
              {historyLogs.length === 0 ? (
                <div className="p-6 text-[clamp(0.95rem,1.2vw,1.1rem)] font-semibold text-slate-600">
                  暂无历史记录
                </div>
              ) : (
                <ul className="divide-y divide-slate-200">
                  {historyLogs
                    .slice()
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .map((snap) => (
                      <li
                        key={snap.date}
                        className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-slate-50"
                      >
                        <div className="min-w-[12rem]">
                          <div className="text-[clamp(0.95rem,1.2vw,1.1rem)] font-bold text-[#e6f7ff]">
                            {snap.date}
                          </div>
                          <div className="mt-1 text-[clamp(0.85rem,1.05vw,1rem)] text-slate-600">
                            {snap.companyName}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={() => setPreviewSnapshot(snap)}
                            className="rounded-[0.75rem] bg-slate-900 px-4 py-2 text-[clamp(0.9rem,1.1vw,1rem)] font-bold text-white hover:bg-slate-800"
                          >
                            预览
                          </button>
                          <button
                            type="button"
                            onClick={() => exportSnapshotCsv(snap)}
                            className="rounded-[0.75rem] border border-[#0b3b73] bg-[#021a3d]/60 px-4 py-2 text-[clamp(0.9rem,1.1vw,1rem)] font-bold text-[#e6f7ff] hover:bg-[#021a3d]/80"
                          >
                            导出 CSV
                          </button>
                        </div>
                      </li>
                    ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {previewSnapshot ? (
        <div
          className="fixed inset-0 z-50 bg-[#01061a] text-[#e6f7ff]"
          role="dialog"
          aria-modal="true"
          aria-label="History preview"
        >
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="rotate-[-20deg] text-[clamp(3rem,8vw,7rem)] font-black tracking-widest text-slate-200/60">
              历史回顾
            </div>
          </div>

          <div className="relative flex h-full min-h-0 flex-col gap-[clamp(0.75rem,1.5vw,1.75rem)] p-[clamp(1rem,2vw,2.5rem)]">
            <div className="shrink-0 flex flex-wrap items-center justify-between gap-4 rounded-[1rem] border border-[#0b3b73] bg-[#021a3d]/70 p-4 shadow-sm backdrop-blur">
              <div className="text-[clamp(1rem,1.6vw,1.5rem)] font-extrabold text-[#e6f7ff]">
                历史回顾：{previewSnapshot.date}
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => exportSnapshotCsv(previewSnapshot)}
                  className="rounded-[0.75rem] border border-[#0b3b73] bg-[#021a3d]/60 px-4 py-2 text-[clamp(0.9rem,1.1vw,1rem)] font-bold text-[#e6f7ff] hover:bg-[#021a3d]/80"
                >
                  下载当前快照（CSV）
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewSnapshot(null)}
                  className="rounded-[0.75rem] bg-slate-900 px-4 py-2 text-[clamp(0.9rem,1.1vw,1rem)] font-bold text-white hover:bg-slate-800"
                >
                  关闭预览
                </button>
              </div>
            </div>

            <header className="shrink-0 flex flex-wrap items-end justify-between gap-[clamp(0.75rem,1.5vw,1.75rem)]">
              <div className="min-w-[min(32rem,100%)] flex-1">
                <div className="text-[clamp(1.375rem,2.8vw,3.25rem)] font-extrabold tracking-tight text-[#ffffff]">
                  {previewSnapshot.companyName}
                </div>
              </div>
              <div className="text-right translate-y-[2px]">
                <BoardClock />
              </div>
            </header>

            <section className="min-h-0 flex-1 overflow-hidden mes-cut-frame bg-[#01152f] shadow-sm text-[#e6f7ff]">
              <div className="h-full overflow-auto">
                <table
                  className="w-full table-fixed border-separate border-spacing-0"
                  style={{ borderCollapse: "separate", height: "100%" }}
                >
                  <caption className="caption-top border border-[#0d3a7d] border-b-0 bg-[#07142b] py-2 text-center text-[clamp(1.15rem,2.0vw,1.95rem)] font-black tracking-[0.1rem] text-[#00f2fe]">
                    TESTING TASK LIST
                  </caption>
                  <thead className="sticky top-0 z-10 bg-[#0a1931] shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]">
                    <tr className="bg-[#0a1931] text-[#00f2fe]">
                      {headers.map((h) => (
                        <th
                          key={h}
                          className={`border border-[#0d3a7d] border-b-2 border-b-[#00f2fe] bg-[#0a1931] px-3 py-3 text-center align-middle uppercase font-black text-[#00f2fe] ${
                            h === "Attendance"
                              ? "whitespace-nowrap leading-tight text-[clamp(0.74rem,0.95vw,0.9rem)] tracking-[0.005rem]"
                              : `whitespace-nowrap ${headerTextSize} tracking-[0.03rem]`
                          }`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewSnapshot.rows.map((r, idx) => (
                      <tr
                        key={`${r.testRig}-${r.lwoNo}-${idx}`}
                        className={
                          idx % 2 === 0 ? "bg-[#01152f]" : "bg-[#021a3d]"
                        }
                        style={{ height: "1px", minHeight: 0, flex: "1 0 auto" }}
                      >
                    <td className={`border border-[#0d3a7d] px-4 py-4 ${cellTextSize} font-semibold`}>
                      {r.testRig ? r.testRig : "\u00A0"}
                    </td>
                    <td className={`border border-[#0d3a7d] px-4 py-4 ${cellTextSize}`}>{r.lwoNo ? r.lwoNo : "\u00A0"}</td>
                    <td className={`border border-[#0d3a7d] px-4 py-4 ${cellTextSize}`}>{r.project ? r.project : "\u00A0"}</td>
                    <td className={`border border-[#0d3a7d] px-4 py-4 ${cellTextSize}`}>{r.task ? r.task : "\u00A0"}</td>
                    <td className={`border border-[#0d3a7d] px-4 py-4 ${cellTextSize}`}>{r.status ? r.status : "\u00A0"}</td>
                    <td className={`border border-[#0d3a7d] px-4 py-4 ${cellTextSize}`}>{r.operator ? r.operator : "\u00A0"}</td>
                        <td
                          className={`attendance-led-td py-4 ${cellTextSize}`}
                          style={{
                            display: "table-cell",
                            verticalAlign: "middle",
                            textAlign: "center",
                            width: 120,
                            minWidth: 120,
                            maxWidth: 120,
                          }}
                        >
                          <span
                            className={`mes-led attendance-led ${r.attendance ? "mes-led-on" : "mes-led-off"}`}
                            aria-hidden="true"
                          />
                        </td>
                        <td className={`border border-[#0d3a7d] px-4 py-4 ${cellTextSize}`}>
                          {r.eventLog ? (
                            r.eventLog
                          ) : (
                            <span className="text-[#88bcd6]">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>
      ) : null}
    </div>
  );
}
