/** Committee queries — where water legislation actually sits. */

import { and, asc, desc, eq, sql } from 'drizzle-orm';

import { safeQuery } from '../client';
import { billActions, billCommitteeReferrals, bills, committees } from '../schema';
import { col, tbl } from './sql-helpers';

export interface CommitteeSummary {
  slug: string;
  name: string;
  chamber: string | null;
  pendingBillCount: number;
  referredBillCount: number;
  lastActivityAt: string | null;
}

export async function listCommittees(): Promise<CommitteeSummary[]> {
  return safeQuery(
    async (db) => {
      const rows = await db
        .select({
          slug: committees.slug,
          name: committees.name,
          chamber: committees.chamber,
          pendingBillCount: sql<number>`(
            select count(*)::int from ${tbl(bills)}
            where ${col(bills.pendingCommitteeId)} = ${col(committees.id)} and ${col(bills.isTracked)} = true
          )`,
          referredBillCount: sql<number>`(
            select count(distinct ${col(billCommitteeReferrals.billId)})::int
            from ${tbl(billCommitteeReferrals)}
            join ${tbl(bills)} on ${col(bills.id)} = ${col(billCommitteeReferrals.billId)}
            where ${col(billCommitteeReferrals.committeeId)} = ${col(committees.id)} and ${col(bills.isTracked)} = true
          )`,
          lastActivityAt: sql<string | null>`(
            select max(${col(billCommitteeReferrals.referredOn)})::text
            from ${tbl(billCommitteeReferrals)}
            join ${tbl(bills)} on ${col(bills.id)} = ${col(billCommitteeReferrals.billId)}
            where ${col(billCommitteeReferrals.committeeId)} = ${col(committees.id)} and ${col(bills.isTracked)} = true
          )`,
        })
        .from(committees)
        .orderBy(asc(committees.name));

      return rows
        .map((r) => ({
          ...r,
          pendingBillCount: Number(r.pendingBillCount),
          referredBillCount: Number(r.referredBillCount),
        }))
        .filter((r) => r.pendingBillCount > 0 || r.referredBillCount > 0)
        .sort((a, b) => b.pendingBillCount - a.pendingBillCount || a.name.localeCompare(b.name));
    },
    [] as CommitteeSummary[],
    'listCommittees',
  );
}

export interface CommitteeDetail {
  slug: string;
  name: string;
  chamber: string | null;
  pendingBills: {
    slug: string;
    billNumber: string;
    title: string;
    statusId: number | null;
    lastActionDate: string | null;
  }[];
  recentReferrals: {
    slug: string;
    billNumber: string;
    title: string;
    referredOn: string | null;
  }[];
  recentActions: {
    action: string;
    actionDate: string | null;
    billSlug: string;
    billNumber: string;
  }[];
}

export async function getCommitteeBySlug(slug: string): Promise<CommitteeDetail | null> {
  return safeQuery<CommitteeDetail | null>(
    async (db) => {
      const [committee] = await db
        .select()
        .from(committees)
        .where(eq(committees.slug, slug))
        .limit(1);

      if (!committee) return null;

      const [pendingBills, recentReferrals, recentActions] = await Promise.all([
        db
          .select({
            slug: bills.slug,
            billNumber: bills.billNumber,
            title: bills.title,
            statusId: bills.statusId,
            lastActionDate: bills.lastActionDate,
          })
          .from(bills)
          .where(and(eq(bills.pendingCommitteeId, committee.id), eq(bills.isTracked, true)))
          .orderBy(desc(bills.lastActionDate))
          .limit(50),
        db
          .select({
            slug: bills.slug,
            billNumber: bills.billNumber,
            title: bills.title,
            referredOn: billCommitteeReferrals.referredOn,
          })
          .from(billCommitteeReferrals)
          .innerJoin(bills, eq(bills.id, billCommitteeReferrals.billId))
          .where(
            and(eq(billCommitteeReferrals.committeeId, committee.id), eq(bills.isTracked, true)),
          )
          .orderBy(desc(billCommitteeReferrals.referredOn))
          .limit(25),
        db
          .select({
            action: billActions.action,
            actionDate: billActions.actionDate,
            billSlug: bills.slug,
            billNumber: bills.billNumber,
          })
          .from(billActions)
          .innerJoin(bills, eq(bills.id, billActions.billId))
          .where(
            and(
              eq(bills.isTracked, true),
              eq(bills.pendingCommitteeId, committee.id),
              sql`${billActions.actionDate} is not null`,
            ),
          )
          .orderBy(desc(billActions.actionDate))
          .limit(12),
      ]);

      return {
        slug: committee.slug,
        name: committee.name,
        chamber: committee.chamber,
        pendingBills,
        recentReferrals,
        recentActions,
      };
    },
    null,
    'getCommitteeBySlug',
  );
}

export async function getAllCommitteeSlugs(): Promise<string[]> {
  return safeQuery(
    async (db) => {
      const rows = await db.select({ slug: committees.slug }).from(committees);
      return rows.map((r) => r.slug);
    },
    [] as string[],
    'getAllCommitteeSlugs',
  );
}
