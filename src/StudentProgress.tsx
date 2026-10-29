import { Activity, CheckCircle2, Circle } from 'lucide-react';
import type { AppData } from './App';

type ProgressItem = { label: string; hint: string; points: number; max: number };

export default function StudentProgress({ data }: { data: AppData }) {
  const items: ProgressItem[] = [
    { label: 'Resume added', hint: data.resumeName || data.resumeText ? 'Resume is in your profile' : 'Add a resume in Resume Analysis', points: data.resumeName || data.resumeText.trim().length >= 50 ? 20 : 0, max: 20 },
    { label: 'Skills confirmed', hint: data.skills.length ? `${data.skills.length} skill${data.skills.length === 1 ? '' : 's'} added` : 'Confirm skills in My Skills', points: Math.min(20, data.skills.length * 5), max: 20 },
    { label: 'Learning goals', hint: data.goals.length ? `${data.goals.length} goal${data.goals.length === 1 ? '' : 's'} added` : 'Set goals in your learning plan', points: Math.min(20, data.goals.length * 10), max: 20 },
    { label: 'Practice assessments', hint: data.results.length ? `${data.results.length} assessment${data.results.length === 1 ? '' : 's'} completed` : 'Complete an AI practice assessment', points: Math.min(20, data.results.length * 10), max: 20 },
    { label: 'Applications', hint: data.applications.length ? `${data.applications.length} application${data.applications.length === 1 ? '' : 's'} submitted` : 'Apply to a suitable opportunity', points: Math.min(20, data.applications.length * 5), max: 20 },
  ];
  const score = items.reduce((total, item) => total + item.points, 0);

  return <section className="panel student-progress-panel">
    <div className="panel-head"><div><h3>Your progress score</h3><p>Earn points by completing steps in your account.</p></div><Activity/></div>
    <div className="student-progress-score"><b>{score}</b><span>/ 100</span><small>{items.filter(item => item.points >= item.max).length} of 5 milestones complete</small></div>
    <ul className="student-progress-list">{items.map(item => <li key={item.label}>
      {item.points >= item.max ? <CheckCircle2 size={17} aria-hidden="true"/> : <Circle size={17} aria-hidden="true"/>}
      <span><b>{item.label}</b><small>{item.hint}</small></span>
      <strong>{item.points}/{item.max}</strong>
    </li>)}</ul>
    <p className="student-progress-note">This private activity score rewards account progress. It is not a measure of ability and is not shared with colleges or employers.</p>
  </section>;
}
