export interface Schedule {
  id: string;
  scheduledTime: string;
  repeatDays: number[];
  active: boolean;
  nextRunAt?: string | null;
}

export type ScheduleInput = Pick<Schedule, 'scheduledTime' | 'repeatDays' | 'active'>;
