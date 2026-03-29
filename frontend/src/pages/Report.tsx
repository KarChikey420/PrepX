import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FileText,
  Mic,
  Printer,
  RotateCcw,
  Sparkles,
  Target,
  Trophy,
  Upload,
  User,
} from 'lucide-react';
import { GlassCard } from '../components/ui/GlassCard';
import { NeonButton } from '../components/ui/NeonButton';
import { CircularScore } from '../components/ui/CircularScore';
import { useInterviewStore } from '../store/useInterviewStore';
import { interviewService } from '../services/interviewService';

const FLOW_STEPS = [
  { label: 'Resume + JD', icon: Upload, note: 'Profile input uploaded' },
  { label: 'Profile', icon: User, note: 'Candidate insights generated' },
  { label: 'Interview', icon: Mic, note: '10 adaptive questions completed' },
  { label: 'Report', icon: Trophy, note: 'Final result is ready' },
];

const TOTAL_QUESTIONS = 10;

const verdictStyles = {
  Hire: {
    chip: 'bg-green-400/10 border-green-400/20 text-green-300',
    accent: 'text-green-300',
    panel: 'from-green-400/8 to-transparent',
  },
  Borderline: {
    chip: 'bg-amber-400/10 border-amber-400/20 text-amber-300',
    accent: 'text-amber-300',
    panel: 'from-amber-400/8 to-transparent',
  },
  'Needs Improvement': {
    chip: 'bg-red-400/10 border-red-400/20 text-red-300',
    accent: 'text-red-300',
    panel: 'from-red-400/8 to-transparent',
  },
} as const;

const ProgressMetric: React.FC<{
  label: string;
  value: string;
  percentage: number;
  toneClass?: string;
}> = ({ label, value, percentage, toneClass = 'bg-neon-cyan' }) => (
  <div className="space-y-3">
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs font-bold uppercase tracking-[0.24em] text-gray-500">{label}</span>
      <span className="text-sm font-black text-white">{value}</span>
    </div>
    <div className="h-2 overflow-hidden rounded-full bg-slate-800/80">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${Math.max(0, Math.min(percentage, 100))}%` }}
        transition={{ duration: 1.1, ease: 'easeOut' }}
        className={`h-full rounded-full ${toneClass}`}
      />
    </div>
  </div>
);

export const Report: React.FC = () => {
  const navigate = useNavigate();
  const { sessionId, profile, report, setReport, reset } = useInterviewStore();
  const [isLoading, setIsLoading] = useState(!report);
  const [reportMarkdown, setReportMarkdown] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      navigate('/upload');
      return;
    }

    if (report) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    const loadReport = async () => {
      setIsLoading(true);
      setLoadError(null);

      try {
        const data = await interviewService.getReport(sessionId);
        if (!isMounted) {
          return;
        }

        setReportMarkdown(data.report_markdown);

        if (data.report) {
          setReport(data.report);
        } else if (data.status !== 'ready') {
          setLoadError('Complete the interview to unlock your final result and score.');
        } else {
          setLoadError('The report text was saved, but the structured result payload is missing for this session.');
        }
      } catch (error) {
        console.error('Failed to load report:', error);
        if (isMounted) {
          setLoadError('We could not load the saved result right now. Please try again from the interview page.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadReport();

    return () => {
      isMounted = false;
    };
  }, [sessionId, report, setReport, navigate]);

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="mb-6 h-16 w-16 rounded-full border-4 border-neon-cyan/20 border-t-neon-cyan shadow-neon-glow"
        />
        <p className="text-sm font-bold uppercase tracking-[0.32em] text-gray-400">Generating Final Result</p>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="mx-auto max-w-4xl py-10">
        <GlassCard className="overflow-hidden border-amber-300/10 bg-gradient-to-br from-amber-300/5 to-transparent p-10">
          <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-300/10 text-amber-300">
            <AlertCircle size={26} />
          </div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.3em] text-amber-300">Result Pending</p>
          <h2 className="mb-4 text-3xl font-black text-white">Your report is not ready yet</h2>
          <p className="mb-8 max-w-2xl text-base leading-relaxed text-gray-300">
            {loadError || 'Finish the interview first, then PrepX will generate your final score and performance summary.'}
          </p>

          {reportMarkdown && (
            <GlassCard className="mb-8 border-white/5 bg-slate-950/40 p-5">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.24em] text-gray-500">Saved Report Snapshot</p>
              <pre className="whitespace-pre-wrap font-mono text-xs leading-6 text-gray-300">{reportMarkdown}</pre>
            </GlassCard>
          )}

          <div className="flex flex-wrap gap-4">
            <NeonButton onClick={() => navigate('/interview')}>
              Return To Interview
            </NeonButton>
            <NeonButton variant="outline" onClick={() => navigate('/profile')}>
              Review Profile
            </NeonButton>
          </div>
        </GlassCard>
      </div>
    );
  }

  const verdictStyle = verdictStyles[report.verdict as keyof typeof verdictStyles] || verdictStyles.Borderline;
  const skillMatch = profile
    ? Math.round((profile.matched_skills.length / Math.max(profile.key_jd_requirements.length, 1)) * 100)
    : Math.round(report.overall_score * 10);
  const focusAreaCount = profile?.interview_focus_areas.length || report.strong_areas.length || report.weak_areas.length || 1;

  return (
    <div className="mx-auto max-w-7xl py-4 md:py-6 px-4 md:px-0">
      <div className="mb-10 flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
        <div className="flex-1">
          <p className="mb-2 text-[10px] md:text-xs font-bold uppercase tracking-[0.3em] text-neon-cyan">Result Section</p>
          <h2 className="text-2xl md:text-4xl font-black tracking-tight text-white">Interview Progress And Score</h2>
          <p className="mt-3 max-w-3xl text-sm md:text-base leading-relaxed text-gray-400">
            Review the full journey from upload to final report, then use the score and recommendations to plan your next interview round.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <NeonButton variant="outline" onClick={() => window.print()}>
            <Printer size={18} />
            Save As PDF
          </NeonButton>
          <NeonButton variant="outline" onClick={() => navigate('/profile')}>
            <ArrowRight size={18} />
            View Profile
          </NeonButton>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-8 xl:grid-cols-12">
        <GlassCard className={`xl:col-span-8 overflow-hidden bg-gradient-to-br ${verdictStyle.panel} p-4 md:p-10`}>
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[260px_minmax(0,1fr)] lg:items-center">
            <div className="flex justify-center scale-90 md:scale-100">
              <CircularScore score={report.overall_score} size={200} label="Overall Score" />
            </div>

            <div>
              <div className={`mb-5 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-black uppercase tracking-[0.24em] ${verdictStyle.chip}`}>
                <Sparkles size={16} />
                {report.verdict}
              </div>

              <h3 className="mb-3 text-2xl md:text-3xl font-black text-white text-center lg:text-left">
                {profile?.candidate_name || 'Candidate Result'}
              </h3>
              <p className="mb-2 text-xs md:text-sm uppercase tracking-[0.24em] text-gray-500 text-center lg:text-left">
                {profile?.job_title_applying_for || 'Interview Role'}
              </p>
              <p className="max-w-2xl text-xs md:text-base leading-relaxed text-gray-300 text-center lg:text-left">
                {report.overall_summary}
              </p>

              <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-gray-500">Questions</p>
                  <p className="mt-2 text-2xl font-black text-white">{TOTAL_QUESTIONS}/10</p>
                  <p className="mt-1 text-sm text-gray-400">Adaptive rounds completed</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-gray-500">Focus Areas</p>
                  <p className="mt-2 text-2xl font-black text-white">{focusAreaCount}</p>
                  <p className="mt-1 text-sm text-gray-400">Profile-led topics reviewed</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-gray-500">JD Match</p>
                  <p className="mt-2 text-2xl font-black text-white">{skillMatch}%</p>
                  <p className="mt-1 text-sm text-gray-400">Matched skills against requirements</p>
                </div>
              </div>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="xl:col-span-4 p-4 md:p-8">
          <p className="mb-6 text-xs font-bold uppercase tracking-[0.28em] text-gray-500">Application Flow</p>
          <div className="space-y-5">
            {FLOW_STEPS.map((step, index) => {
              const Icon = step.icon;
              const isLast = index === FLOW_STEPS.length - 1;

              return (
                <div key={step.label} className="relative flex gap-4">
                  {!isLast && <div className="absolute left-[19px] top-11 h-10 w-px bg-white/10" />}
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-neon-cyan/20 bg-neon-cyan/10 text-neon-cyan">
                    <Icon size={18} />
                  </div>
                  <div className="pb-6">
                    <p className="text-sm font-black uppercase tracking-[0.2em] text-white">{step.label}</p>
                    <p className="mt-1 text-sm leading-relaxed text-gray-400">{step.note}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 rounded-2xl border border-neon-cyan/15 bg-neon-cyan/5 p-5">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-neon-cyan">Progress Snapshot</p>
            <div className="mt-5 space-y-5">
              <ProgressMetric label="Journey Completion" value="100%" percentage={100} />
              <ProgressMetric label="Interview Completion" value={`${TOTAL_QUESTIONS}/${TOTAL_QUESTIONS}`} percentage={100} toneClass="bg-blue-400" />
              <ProgressMetric label="Readiness Score" value={`${Math.round(report.overall_score * 10)}%`} percentage={report.overall_score * 10} toneClass="bg-emerald-400" />
            </div>
          </div>
        </GlassCard>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-6 md:gap-8 lg:grid-cols-3">
        <GlassCard className="border-emerald-400/10 p-5 md:p-7">
          <div className="mb-5 flex items-center gap-3">
            <CheckCircle2 className="text-emerald-300" />
            <h3 className="text-lg font-black text-white">Strong Areas</h3>
          </div>
          <div className="space-y-3">
            {report.strong_areas.map((area, index) => (
              <div key={`${area}-${index}`} className="rounded-2xl border border-white/5 bg-white/5 p-4 text-sm leading-relaxed text-gray-300">
                {area}
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard className="border-red-400/10 p-5 md:p-7">
          <div className="mb-5 flex items-center gap-3">
            <AlertTriangle className="text-red-300" />
            <h3 className="text-lg font-black text-white">Growth Areas</h3>
          </div>
          <div className="space-y-3">
            {report.weak_areas.map((area, index) => (
              <div key={`${area}-${index}`} className="rounded-2xl border border-white/5 bg-white/5 p-4 text-sm leading-relaxed text-gray-300">
                {area}
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard className="border-blue-400/10 p-5 md:p-7">
          <div className="mb-5 flex items-center gap-3">
            <FileText className="text-blue-300" />
            <h3 className="text-lg font-black text-white">Communication</h3>
          </div>
          <p className="rounded-2xl border border-white/5 bg-white/5 p-4 text-sm leading-7 text-gray-300">
            {report.communication_assessment}
          </p>
        </GlassCard>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-8 xl:grid-cols-12">
        <GlassCard className="xl:col-span-7 overflow-hidden border-neon-cyan/15 p-4 md:p-8">
          <div className="mb-6 flex items-center gap-3">
            <Target className="text-neon-cyan" />
            <h3 className="text-xl font-black text-white">Action Plan</h3>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {report.recommendations.map((recommendation, index) => (
              <div
                key={`${recommendation}-${index}`}
                className="rounded-2xl border border-white/5 bg-white/5 p-5 transition-colors hover:border-neon-cyan/20"
              >
                <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-full bg-neon-cyan/10 text-sm font-black text-neon-cyan">
                  {index + 1}
                </div>
                <p className="text-sm leading-7 text-gray-300">{recommendation}</p>
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard className="xl:col-span-5 p-4 md:p-8">
          <div className="mb-6 flex items-center gap-3">
            <AlertCircle className={verdictStyle.accent} />
            <h3 className="text-xl font-black text-white">Skill Gaps Vs Job</h3>
          </div>
          <div className="space-y-3">
            {report.skill_gap.map((gap, index) => (
              <div key={`${gap}-${index}`} className="rounded-2xl border border-white/5 bg-white/5 p-4 text-sm leading-relaxed text-gray-300">
                {gap}
              </div>
            ))}
          </div>

          {reportMarkdown && (
            <div className="mt-8 rounded-2xl border border-white/5 bg-slate-950/35 p-5">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.24em] text-gray-500">Detailed Written Report</p>
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap font-mono text-xs leading-6 text-gray-300">
                {reportMarkdown}
              </pre>
            </div>
          )}
        </GlassCard>
      </div>

      <GlassCard className="bg-gradient-to-r from-neon-cyan/8 via-transparent to-blue-400/8 p-4 md:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="text-center lg:text-left">
            <p className="mb-2 text-[10px] md:text-xs font-bold uppercase tracking-[0.3em] text-neon-cyan">Next Move</p>
            <h3 className="text-xl md:text-2xl font-black text-white">Turn this report into your next improvement sprint</h3>
            <p className="mt-2 max-w-2xl text-xs md:text-sm leading-7 text-gray-400">
              Revisit your profile, close the highlighted skill gaps, and then run another interview to compare your score with this baseline.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <NeonButton onClick={() => navigate('/profile')}>
              Review Profile
            </NeonButton>
            <NeonButton
              variant="outline"
              onClick={() => {
                reset();
                navigate('/upload');
              }}
            >
              <RotateCcw size={18} />
              Start New Interview
            </NeonButton>
          </div>
        </div>
      </GlassCard>
    </div>
  );
};
