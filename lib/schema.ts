import { z } from 'zod';
export const levels = ['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate', 'Create'] as const;
export const citationSchema = z.object({ sourceId: z.string(), quote: z.string().min(4).max(2000) });
export const topicSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  objective: z.string(),
  weight: z.number().min(1).max(100),
  citations: z.array(citationSchema).min(1).max(10),
  lectureOrder: z.number().optional(),
  lectureTag: z.string().optional()
});
export const questionSchema = z.object({ id: z.string(), topicId: z.string(), prompt: z.string().min(5), options: z.array(z.string().min(1)).length(4), answer: z.number().int().min(0).max(3), explanation: z.string().min(5), difficulty: z.enum(['Foundational', 'Intermediate', 'Challenging']), citations: z.array(citationSchema).min(1).max(10) });
export const analysisSchema = z.object({ summary: z.string(), examInsight: z.string(), topics: z.array(topicSchema).min(2).max(6), diagnostic: z.array(questionSchema).length(6), final: z.array(questionSchema).length(6) });
export const taskFormatSchema = z.enum(['mcq', 'fill-blank', 'matching', 'frq']);
export type TaskFormat = z.infer<typeof taskFormatSchema>;
export const taskSchema = z.object({
  id: z.string(),
  topicId: z.string(),
  level: z.enum(levels),
  format: taskFormatSchema.optional(),
  teaching: z.string().min(10),
  prompt: z.string().min(5),
  hint: z.string(),
  modelAnswer: z.string().min(5),
  rubric: z.array(z.string()).min(1).max(6),
  citations: z.array(citationSchema).min(1).max(10),
  mcqOptions: z.array(z.string()).optional(),
  blankTemplate: z.string().optional(),
  matchingPairs: z.array(z.object({ left: z.string(), right: z.string() })).optional()
});
export const tasksSchema = z.object({ tasks: z.array(taskSchema).length(6) });
export const feedbackSchema = z.object({ score: z.number().int().min(0).max(100), summary: z.string().min(5), criteria: z.array(z.object({ criterion: z.string(), met: z.boolean(), feedback: z.string() })).min(1).max(6), nextStep: z.string() });
export type Citation = z.infer<typeof citationSchema>;
export type Topic = z.infer<typeof topicSchema>;
export type Question = z.infer<typeof questionSchema>;
export type Task = z.infer<typeof taskSchema>;
export type Feedback = z.infer<typeof feedbackSchema>;
export type Analysis = z.infer<typeof analysisSchema>;
export type Source = { id: string; filename: string; page?: number; text: string; exam: boolean };
export type QuizResult = { score: number; answers: number[]; questions: Question[]; topics: { id: string; name: string; correct: number; total: number; score: number }[] };
export type Attempt = { answer: string; feedback: Feedback };
export type Session = { version: 1; id: string; createdAt: number; mode: 'demo' | 'live'; subject: string; stage: 'analysis' | 'diagnostic' | 'diagnostic-results' | 'learning' | 'final' | 'complete'; sources: Source[]; analysis: Analysis; diagnostic?: QuizResult; final?: QuizResult; tasks: Task[]; taskIndex: number; attempts: Record<string, Attempt[]>; hints: string[]; priorities: string[] };
export type PublicTask = Omit<Task, 'modelAnswer' | 'hint' | 'rubric'> & { hint?: string; modelAnswer?: string; rubric?: string[] };
export type PublicSession = Omit<Session, 'sources' | 'analysis' | 'tasks'> & { sources: Omit<Source, 'text'>[]; analysis: Omit<Analysis, 'diagnostic' | 'final'>; questions?: Omit<Question, 'answer' | 'explanation'>[]; task?: PublicTask; taskCount: number };
export type Envelope = { token: string; session: PublicSession };

export type CognitivePhase = {
  phase: number;
  title: string;
  tagline: string;
  focus: string;
  levels: readonly ('Remember' | 'Understand' | 'Apply' | 'Analyze' | 'Evaluate' | 'Create')[];
  taskIndices: readonly number[];
};

export const PHASES: readonly CognitivePhase[] = [
  {
    phase: 1,
    title: 'Remember',
    tagline: 'Recalling facts and basic concepts',
    focus: 'Recall foundational facts, definitions, formulas, and terminology without notes.',
    levels: ['Remember'],
    taskIndices: [0]
  },
  {
    phase: 2,
    title: 'Understand',
    tagline: 'Explaining ideas or concepts',
    focus: 'Construct meaning, paraphrase core principles, and explain why concepts work.',
    levels: ['Understand'],
    taskIndices: [1]
  },
  {
    phase: 3,
    title: 'Apply & Analyze',
    tagline: 'Using information in new situations / Drawing connections among ideas',
    focus: 'Apply techniques to solve novel challenges and dissect structures into constituent parts.',
    levels: ['Apply', 'Analyze'],
    taskIndices: [2, 3]
  },
  {
    phase: 4,
    title: 'Evaluate & Create',
    tagline: 'Justifying a stand or decision / Producing new or original work',
    focus: 'Appraise trade-offs, defend judgments, and synthesize components into original solutions.',
    levels: ['Evaluate', 'Create'],
    taskIndices: [4, 5]
  }
] as const;

export function getPhaseForTaskIndex(index: number): CognitivePhase {
  return PHASES.find(p => p.taskIndices.includes(index)) || PHASES[0];
}
