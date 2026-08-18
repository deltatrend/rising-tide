/**
 * Translates a LegiScan status code into the five steps a New York bill
 * actually goes through, so a reader can see how far something has travelled
 * without knowing any legislative vocabulary.
 */

export type StageState = 'done' | 'current' | 'todo' | 'stopped';

export interface Stage {
  key: string;
  label: string;
  /** Explains what has to happen at this step. */
  description: string;
  state: StageState;
}

const STAGE_DEFINITIONS = [
  {
    key: 'introduced',
    label: 'Introduced',
    description: 'A legislator formally files the bill in their chamber.',
  },
  {
    key: 'committee',
    label: 'In committee',
    description: 'A committee studies the bill and decides whether it moves forward.',
  },
  {
    key: 'first-chamber',
    label: 'Passed first chamber',
    description: 'The full Senate or Assembly votes to approve it.',
  },
  {
    key: 'second-chamber',
    label: 'Passed both chambers',
    description: 'The other chamber approves the identical bill.',
  },
  {
    key: 'governor',
    label: 'Signed into law',
    description: 'The Governor signs it, or the Legislature overrides a veto.',
  },
] as const;

/** How many stages are complete for each LegiScan status code. */
const REACHED_BY_STATUS: Record<number, number> = {
  0: 0, // Pre-filed
  12: 0, // Draft
  1: 1, // Introduced
  9: 1, // Referred to committee
  10: 2, // Reported favorably out of committee
  11: 1, // Reported unfavorably
  2: 3, // Engrossed — passed first chamber
  3: 4, // Enrolled — passed both chambers
  4: 5, // Passed / signed
  8: 5, // Chaptered
  7: 5, // Veto overridden
  5: 4, // Vetoed
  6: 0, // Failed
};

const STOPPED_STATUSES = new Set([5, 6, 11]);

export function deriveStages(statusId: number | null | undefined): Stage[] {
  const status = statusId ?? 1;
  const reached = REACHED_BY_STATUS[status] ?? 1;
  const stopped = STOPPED_STATUSES.has(status);
  const complete = status === 4 || status === 8 || status === 7;

  return STAGE_DEFINITIONS.map((definition, index) => {
    let state: StageState;

    if (complete) {
      state = 'done';
    } else if (index < reached) {
      state = 'done';
    } else if (index === reached) {
      state = stopped ? 'stopped' : 'current';
    } else {
      state = 'todo';
    }

    return { ...definition, state };
  });
}

/** One sentence describing where a bill stands, used above the track. */
export function describeProgress(statusId: number | null | undefined): string {
  const status = statusId ?? 1;

  switch (status) {
    case 4:
    case 8:
      return 'This bill completed the process and is now law.';
    case 7:
      return 'The Legislature enacted this bill over the Governor\u2019s veto.';
    case 5:
      return 'This bill passed the Legislature but the Governor rejected it.';
    case 6:
      return 'This bill stopped moving and did not become law.';
    case 11:
      return 'A committee voted against advancing this bill.';
    case 3:
      return 'Both chambers have approved this bill. It now goes to the Governor.';
    case 2:
      return 'One chamber has approved this bill. The other chamber must act next.';
    case 10:
      return 'A committee has advanced this bill toward a floor vote.';
    case 0:
    case 12:
      return 'This bill has been drafted but not yet formally introduced.';
    default:
      return 'This bill has been introduced and is waiting on committee action.';
  }
}
