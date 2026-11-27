import { useState } from "react";
import { Plus, Briefcase, CheckCircle2, Circle, Clock, Flag } from "lucide-react";
import { useDB } from "../lib/store";
import { useAuth } from "../lib/auth";
import { Page } from "../components/Layout";
import { Card, Button, Badge, StatusBadge, EmptyState, SectionHeading, Modal, Field, Input, Select, ProgressBar, StatCard } from "../components/ui";
import { addMission, addTask, setTaskStatus } from "../lib/actions";
import { formatDate } from "../lib/format";
import type { Task } from "../lib/types";

export default function Missions() {
  const db = useDB();
  const { user } = useAuth();
  const orgId = user?.organizationId;
  const companies = db.companies.filter((c) => c.organizationId === orgId);
  const missions = db.missions.filter((m) => m.organizationId === orgId);
  const tasks = db.tasks.filter((t) => t.organizationId === orgId);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ companyId: companies[0]?.id || "", title: "", type: "révision", dueDate: "" });
  const [taskForm, setTaskForm] = useState({ title: "", priority: "medium", dueDate: "" });
  const [taskOpen, setTaskOpen] = useState(false);

  return (
    <Page>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-black tracking-tight text-slate-900">Missions & tâches</h2><p className="text-sm text-slate-500">Workflow du cabinet</p></div><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => setTaskOpen(true)}><Plus size={15} /> Tâche</Button><Button size="sm" onClick={() => setOpen(true)}><Plus size={15} /> Mission</Button></div></div>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard title="Missions" value={String(missions.length)} icon={<Briefcase size={18} />} tone="indigo" />
        <StatCard title="En cours" value={String(missions.filter((m) => m.status !== "done").length)} icon={<Clock size={18} />} tone="amber" />
        <StatCard title="Tâches ouvertes" value={String(tasks.filter((t) => t.status !== "done").length)} icon={<Flag size={18} />} tone="sky" />
        <StatCard title="Tâches terminées" value={String(tasks.filter((t) => t.status === "done").length)} icon={<CheckCircle2 size={18} />} tone="emerald" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5"><SectionHeading title="Missions" />
          {missions.length === 0 ? <EmptyState icon={<Briefcase />} title="Aucune mission" /> : (
            <div className="space-y-3">{missions.map((m) => { const c = companies.find((x) => x.id === m.companyId); return (
              <div key={m.id} className="rounded-xl border border-slate-100 p-4"><div className="flex items-center justify-between"><p className="font-bold text-slate-800">{m.title}</p><StatusBadge status={m.status} /></div><p className="text-xs text-slate-400">{c?.name} · {m.type} · {formatDate(m.dueDate)}</p><div className="mt-2 flex items-center gap-2"><ProgressBar value={m.progress} tone="violet" /><span className="text-xs font-semibold text-slate-500">{m.progress}%</span></div></div>
            ); })}</div>
          )}
        </Card>
        <Card className="p-5"><SectionHeading title="Tâches" />
          {tasks.length === 0 ? <EmptyState icon={<Flag />} title="Aucune tâche" /> : (
            <div className="space-y-2">{tasks.map((t) => { const c = companies.find((x) => x.id === t.companyId); return (
              <div key={t.id} className="flex items-center gap-3 rounded-xl border border-slate-100 px-4 py-3">
                <button onClick={() => setTaskStatus(t.id, t.status === "done" ? "todo" : "done")}>{t.status === "done" ? <CheckCircle2 size={18} className="text-emerald-500" /> : <Circle size={18} className="text-slate-300" />}</button>
                <div className="flex-1"><p className={`text-sm font-medium ${t.status === "done" ? "text-slate-400 line-through" : "text-slate-800"}`}>{t.title}</p><p className="text-xs text-slate-400">{c?.name} · {formatDate(t.dueDate)}</p></div>
                <Badge tone={t.priority === "high" ? "rose" : t.priority === "medium" ? "amber" : "slate"}>{t.priority}</Badge>
              </div>
            ); })}</div>
          )}
        </Card>
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="Nouvelle mission">
        <div className="space-y-4">
          <Field label="Titre" required><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Client"><Select value={form.companyId} onChange={(e) => setForm({ ...form, companyId: e.target.value })}>{companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
            <Field label="Type"><Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}><option>révision</option><option>clôture</option><option>fiscal</option><option>social</option><option>conseil</option></Select></Field>
          </div>
          <Field label="Échéance"><Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></Field>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button><Button onClick={() => { if (form.title && form.companyId) { addMission(form.companyId, form.title, form.type, new Date().toISOString().slice(0, 10)); setOpen(false); } }}>Créer</Button></div>
        </div>
      </Modal>
      <Modal open={taskOpen} onClose={() => setTaskOpen(false)} title="Nouvelle tâche">
        <div className="space-y-4">
          <Field label="Titre" required><Input value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Priorité"><Select value={taskForm.priority} onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value as Task["priority"] })}><option value="low">Basse</option><option value="medium">Moyenne</option><option value="high">Haute</option></Select></Field>
            <Field label="Échéance"><Input type="date" value={taskForm.dueDate} onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })} /></Field>
          </div>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setTaskOpen(false)}>Annuler</Button><Button onClick={() => { if (taskForm.title) { addTask(null, taskForm.title, taskForm.priority as Task["priority"], taskForm.dueDate || new Date().toISOString().slice(0, 10)); setTaskOpen(false); } }}>Créer</Button></div>
        </div>
      </Modal>
    </Page>
  );
}
