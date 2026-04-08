// In-app changelog entries. Keep newest first.
// Date format: YYYY-MM-DD. Version: semver or rolling release tag.
// Add a new entry any time a user-visible change ships.
// Keep web and mobile changelogs in sync — they share this structure.

export interface ChangelogEntry {
  version: string;
  date: string; // YYYY-MM-DD
  title: string;
  highlights: string[];
  tag?: 'new' | 'improved' | 'fixed';
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.4.0',
    date: '2026-04-07',
    title: 'Bulk editing, smarter pro scheduling',
    tag: 'new',
    highlights: [
      'Bulk select and delete equipment — long-press or tap Select to clean up inventory fast.',
      'Pro visit cadence enforcement prevents accidental double-booking within the same two-month window.',
      'Job acceptance is now race-safe: only the first provider to tap Accept gets the job.',
      'Pro inspection reports now capture a homeowner signature on-site.',
    ],
  },
  {
    version: '1.3.0',
    date: '2026-04-01',
    title: 'Home Token, transfers, and a cleaner onboarding',
    tag: 'new',
    highlights: [
      'Home Token: your complete home record with edit history, completeness score, and verification badges.',
      'Home transfer flow lets you hand your Canopy record to the next owner when you sell.',
      'Redesigned 6-step onboarding with per-fireplace and per-filter detail capture.',
      'USPS address standardization for every new home.',
    ],
  },
  {
    version: '1.2.0',
    date: '2026-03-20',
    title: 'Certified Pro network and pro portal polish',
    tag: 'improved',
    highlights: [
      'Certified Pros are now invitation-only and vetted — Pro+ gets bi-monthly home visits.',
      'Technician onboarding, background checks, and insurance verification built into the admin flow.',
      'Pro portal: jobs, visits, quotes, invoices, and availability all in one place.',
    ],
  },
];
