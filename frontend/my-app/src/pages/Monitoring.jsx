// src/pages/Monitoring.jsx
import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectLabel,
  SelectItem,
} from "../components/ui/select";
import {
  Download,
  Trash2,
  Edit2,
  Loader,
  AlertCircle,
  Calendar,
} from "lucide-react";
import { useHistoryLog } from "../contexts/HistoryContext.jsx";
import { useMonitoring } from "../contexts/MonitoringContext.jsx";

export default function Monitoring() {
  const { addEvent } = useHistoryLog();
  const { entries, addEntry, updateEntry, deleteEntry } = useMonitoring();

  // --- Фильтр по дате ---
  const [filter, setFilter] = useState("all");
  const filtered = useMemo(() => {
    if (filter === "all") return entries;
    const now = new Date();
    const cutoff = new Date(now);
    if (filter === "7days") cutoff.setDate(now.getDate() - 7);
    if (filter === "month") cutoff.setMonth(now.getMonth() - 1);
    return entries.filter((e) => {
      const d = new Date(e.date);
      return d >= cutoff && d <= now;
    });
  }, [entries, filter]);
  // Новые сначала
  const displayed = filtered.slice().reverse();

  // Fullscreen API
  const tableRef = useRef(null);
  const [isFs, setIsFs] = useState(false);
  useEffect(() => {
    const onFs = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);
  const toggleFs = () => {
    if (!document.fullscreenElement) tableRef.current?.requestFullscreen();
    else document.exitFullscreen();
  };

  // Список оборудования
  const equipmentList = Array.from({ length: 10 }, (_, i) => ({
    code: `EQ-100${i + 1}`,
    name: `Жабдық ${i + 1}`,
  }));

  // Начальное состояние формы
  const initForm = {
    eq: equipmentList[0].code,
    date: "",
    asic: "",
    fan: "",
    loadCore: "",
    loadMem: "",
    loadDisk: "",
    powerNow: "",
    energyDay: "",
    hashrate: "",
    efficiency: "",
    uptime: "",
    errHw: "",
    activePct: "",
  };
  const [form, setForm] = useState(initForm);
  const [editIdx, setEditIdx] = useState(null);
  const [errors, setErrors] = useState({});
  const [toast, setToast] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [confirmDeleteIdx, setConfirmDeleteIdx] = useState(null);

  // Авто-скрытие тоста
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  // Поля формы
  const formFields = [
    { name: "asic", placeholder: "ASIC(°C)" },
    { name: "fan", placeholder: "Вентилятор(%)" },
    { name: "loadCore", placeholder: "Ядро(%)" },
    { name: "loadMem", placeholder: "Жад(%)" },
    { name: "loadDisk", placeholder: "Диск(%)" },
    { name: "powerNow", placeholder: "Энергия(Вт)" },
    { name: "energyDay", placeholder: "Энергия(кВт·сағ)" },
    { name: "hashrate", placeholder: "Hashrate(TH/s)" },
    { name: "efficiency", placeholder: "Эффективтік(TH/kWh)" },
    { name: "uptime", placeholder: "Uptime(сағ)" },
    { name: "errHw", placeholder: "HW қате" },
    { name: "activePct", placeholder: "Белсенді(%)" },
  ];
  const columns = [
    { header: "Жабдық", accessor: "eq" },
    { header: "Күні", accessor: "date" },
    ...formFields.map((f) => ({ header: f.placeholder, accessor: f.name })),
  ];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    if (errors[name]) setErrors((err) => ({ ...err, [name]: "" }));
  };

  const formatValue = (key, val) => {
    const n = parseFloat(val);
    if (isNaN(n)) return val;
    switch (key) {
      case "powerNow":
        return `${n.toFixed(0)} W`;
      case "energyDay":
        return `${n.toFixed(2)} кВт·сағ`;
      case "hashrate":
        return `${n.toFixed(2)} TH/s`;
      case "efficiency":
        return `${n.toFixed(2)} TH/kWh`;
      case "uptime":
        return `${n} сағ`;
      case "activePct":
        return `${n}%`;
      default:
        return val;
    }
  };

  const saveRecord = () => {
    const errs = {};
    if (!form.date) errs.date = "Күні міндетті";
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    setIsSaving(true);
    const rec = {
      ...form,
      id: editIdx != null ? entries[editIdx].id : Date.now(),
    };
    if (editIdx == null) {
      addEntry(rec);
      setToast("Жазба қосылды");
    } else {
      updateEntry(rec);
      setToast("Жазба жаңартылды");
    }
    setForm(initForm);
    setEditIdx(null);
    setIsSaving(false);
    addEvent({
      type: editIdx == null ? "Add Record" : "Edit Record",
      params: { id: rec.id },
    });
  };

  const onEdit = (i) => {
    setForm(entries[i]);
    setEditIdx(i);
  };
  const onDelete = (i) => setConfirmDeleteIdx(i);
  const confirmDelete = () => {
    const i = confirmDeleteIdx;
    if (i == null) return;
    deleteEntry(entries[i].id);
    setToast("Жазба өшірілді");
    if (editIdx === i) {
      setForm(initForm);
      setEditIdx(null);
    }
    addEvent({ type: "Delete Record", params: { id: entries[i].id } });
    setConfirmDeleteIdx(null);
  };
  const cancelDelete = () => setConfirmDeleteIdx(null);

  const exportCSV = () => {
    if (!entries.length) return;
    setIsExporting(true);
    const hdr = columns.map((c) => c.header);
    const rows = entries.map((r) => columns.map((c) => r[c.accessor]));
    const csv = [hdr, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const fn = `monitoring_${Date.now()}.csv`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fn;
    a.click();
    URL.revokeObjectURL(url);
    setIsExporting(false);
    setToast("CSV экспортталды");
    addEvent({
      type: "Export CSV",
      params: { count: entries.length },
      file: fn,
    });
  };

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 dark:text-gray-100 p-4 space-y-4 text-xs">
      {/* Форма */}
      <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition">
        <CardHeader>
          <CardTitle className="text-sm text-gray-900 dark:text-gray-100">
            Мониторинг жазбасын қосу / өзгерту
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {/* Селект оборудования */}
          <Select
            value={form.eq}
            onValueChange={(v) => setForm((f) => ({ ...f, eq: v }))}
          >
            <SelectTrigger className="h-7 text-xs bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-indigo-200">
              <SelectValue placeholder="Жабдық" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel className="text-xs dark:text-gray-300">
                  Жабдық
                </SelectLabel>
                {equipmentList.map((eq) => (
                  <SelectItem key={eq.code} value={eq.code} className="text-xs">
                    {eq.name} ({eq.code})
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          {/* Дата */}
          <div>
            <Input
              type="date"
              name="date"
              value={form.date}
              onChange={handleChange}
              className="h-7 text-xs bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 placeholder-gray-400"
              aria-invalid={!!errors.date}
            />
            {errors.date && (
              <p className="text-red-600 text-xs">{errors.date}</p>
            )}
          </div>

          {/* Остальные поля */}
          {formFields.map((f) => (
            <Input
              key={f.name}
              name={f.name}
              value={form[f.name]}
              onChange={handleChange}
              placeholder={f.placeholder}
              className="h-7 text-xs bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 placeholder-gray-400"
            />
          ))}

          {/* Кнопки */}
          <div className="col-span-full flex justify-end gap-2 mt-2">
            <Button
              onClick={saveRecord}
              disabled={isSaving}
              className="h-7 px-2 bg-blue-600 hover:bg-blue-700 text-white text-xs"
            >
              {isSaving ? (
                <Loader className="animate-spin w-3 h-3 mr-1 inline" />
              ) : editIdx == null ? (
                "Қосу"
              ) : (
                "Жаңарту"
              )}
            </Button>
            <Button
              variant="outline"
              onClick={exportCSV}
              disabled={isExporting || !entries.length}
              className="h-7 px-2 flex items-center bg-blue-600 hover:bg-blue-700 text-white text-xs"
            >
              {isExporting ? (
                <Loader className="animate-spin w-3 h-3 mr-1 inline" />
              ) : (
                <Download className="w-3 h-3 mr-1 inline" />
              )}
              CSV экспорт
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 right-4 bg-green-600 text-white px-3 py-1 rounded text-xs shadow">
          {toast}
        </div>
      )}

      {/* Таблица */}
      <div
        ref={tableRef}
        className="relative overflow-auto max-h-60 bg-white dark:bg-gray-800 rounded shadow"
        style={isFs ? { height: "100vh" } : {}}
      >
        <button
          onClick={toggleFs}
          className="absolute top-2 right-2 z-10 p-1 bg-blue-600 hover:bg-blue-700 text-white rounded shadow text-xs"
          title={isFs ? "Шығу" : "Толық экран"}
        >
          {isFs ? "✕" : "⛶"}
        </button>

        <table className="w-full table-auto divide-y text-xs">
          <thead className="sticky top-0 bg-blue-600 text-white">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.accessor}
                  className="px-1 py-0.5 text-left whitespace-nowrap"
                >
                  {col.header}
                </th>
              ))}
              <th className="px-1 py-0.5 text-left whitespace-nowrap">
                Әрекет
              </th>
            </tr>
          </thead>
          <tbody className="divide-y bg-gray-50 dark:bg-gray-700">
            {displayed.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + 1}
                  className="p-4 text-center text-gray-500 dark:text-gray-300"
                >
                  <AlertCircle className="w-6 h-6 text-blue-600 mb-2 inline-block" />
                  Жазбалар жоқ. Жоғарыдағы форманы пайдаланыңыз.
                </td>
              </tr>
            ) : (
              displayed.map((r, i) => (
                <tr
                  key={r.id}
                  className="hover:bg-gray-100 dark:hover:bg-gray-600"
                >
                  {columns.map((col) => (
                    <td
                      key={col.accessor}
                      className="px-1 py-0.5 whitespace-nowrap"
                    >
                      {formatValue(col.accessor, r[col.accessor])}
                    </td>
                  ))}
                  <td className="px-1 py-0.5 whitespace-nowrap flex gap-1">
                    <button onClick={() => onEdit(i)} title="Өңдеу">
                      <Edit2 className="w-4 h-4 text-blue-600 hover:text-blue-700" />
                    </button>
                    <button onClick={() => onDelete(i)} title="Жою">
                      <Trash2 className="w-4 h-4 text-red-600 hover:text-red-700" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Фильтр и возврат наверх */}
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center space-x-2">
          <Calendar className="w-5 h-5 text-blue-600" />
          <Select
            value={filter}
            onValueChange={setFilter}
            className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white"
          >
            <SelectTrigger className="w-36 h-7 text-xs">
              <SelectValue placeholder="Фильтр" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel className="text-xs dark:text-gray-300">
                  Дерек
                </SelectLabel>
                <SelectItem value="7days" className="text-xs">
                  Соңғы 7 күн
                </SelectItem>
                <SelectItem value="month" className="text-xs">
                  Соңғы ай
                </SelectItem>
                <SelectItem value="all" className="text-xs">
                  Бәрі
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <Button
          size="sm"
          onClick={scrollToTop}
          className="h-7 px-2 bg-blue-600 hover:bg-blue-700 text-white text-xs"
        >
          Бастауға оралу
        </Button>
      </div>

      {/* Подтверждение удаления */}
      {confirmDeleteIdx != null && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center">
          <div className="bg-white dark:bg-gray-800 p-6 rounded shadow max-w-sm w-full space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 text-center">
              Жоюды растайсыз ба?
            </h3>
            <p className="text-center text-gray-700 dark:text-gray-300">
              Сіз бұл жазбаны шынымен жойғыңыз келе ме?
            </p>
            <div className="flex justify-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={cancelDelete}
                className="h-7 px-2 bg-blue-600 hover:bg-blue-700 text-white text-xs"
              >
                Жоқ
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={confirmDelete}
                className="h-7 px-2 bg-red-600 hover:bg-red-700 text-white text-xs"
              >
                Иә
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
