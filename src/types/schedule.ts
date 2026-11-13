export interface Schedule {
  id: string;
  scheduledTime: string;
  repeatDays: number[];
  active: boolean;
  nextRunAt?: string | null;
}

export type ScheduleInput = Pick<Schedule, 'scheduledTime' | 'repeatDays' | 'active'>;

/** A time inside a rule's full schedule list: with `id` it updates that saved time, without it creates one. */
export type RuleScheduleInput = ScheduleInput & { id?: string };
