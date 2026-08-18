/**
 * Legislator queries.
 *
 * Deliberately narrow: these pages describe a legislator's relationship to the
 * tracked water-policy dataset only. Rising Tide is not a general politician
 * database and does not store biography, finance or unrelated voting data.
 */

import { and, asc, desc, eq, sql } from 'drizzle-orm';

import { safeQuery } from '../client';
import { billSponsors, bills, individualVotes, people, rollCalls } from '../schema';
import { col, tbl } from './sql-helpers';

export interface LegislatorSummary {
  slug: string;
  name: string;
  /** Kept separate so an A–Z sort orders by surname, as a directory should. */
  lastName: string | null;
  party: string | null;
  partyId: number | null;
  role: string | null;
  roleId: number | null;
  district: string | null;
  sponsoredCount: number;
  cosponsoredCount: number;
}

export async function listLegislators(): Promise<LegislatorSummary[]> {
  return safeQuery(
    async (db) => {
      const rows = await db
        .select({
          slug: people.slug,
          name: people.name,
          lastName: people.lastName,
          party: people.party,
          partyId: people.partyId,
          role: people.role,
          roleId: people.roleId,
          district: people.district,
          sponsoredCount: sql<number>`(
            select count(*)::int from ${tbl(billSponsors)}
            join ${tbl(bills)} on ${col(bills.id)} = ${col(billSponsors.billId)}
            where ${col(billSponsors.personId)} = ${col(people.id)}
              and ${col(bills.isTracked)} = true
              and ${col(billSponsors.sponsorTypeId)} = 1
          )`,
          cosponsoredCount: sql<number>`(
            select count(*)::int from ${tbl(billSponsors)}
            join ${tbl(bills)} on ${col(bills.id)} = ${col(billSponsors.billId)}
            where ${col(billSponsors.personId)} = ${col(people.id)}
              and ${col(bills.isTracked)} = true
              and coalesce(${col(billSponsors.sponsorTypeId)}, 0) <> 1
          )`,
        })
        .from(people)
        .orderBy(asc(people.lastName), asc(people.name));

      return rows
        .map((r) => ({
          ...r,
          sponsoredCount: Number(r.sponsoredCount),
          cosponsoredCount: Number(r.cosponsoredCount),
        }))
        .filter((r) => r.sponsoredCount > 0 || r.cosponsoredCount > 0);
    },
    [] as LegislatorSummary[],
    'listLegislators',
  );
}

export interface LegislatorDetail {
  slug: string;
  name: string;
  party: string | null;
  partyId: number | null;
  role: string | null;
  roleId: number | null;
  district: string | null;
  ballotpedia: string | null;
  lastSyncedAt: Date;
  sponsored: {
    slug: string;
    billNumber: string;
    title: string;
    statusId: number | null;
    lastActionDate: string | null;
  }[];
  cosponsored: {
    slug: string;
    billNumber: string;
    title: string;
    statusId: number | null;
    lastActionDate: string | null;
  }[];
  votes: {
    voteId: number;
    voteText: string;
    voteDate: string | null;
    description: string | null;
    chamber: string | null;
    passed: boolean | null;
    billSlug: string;
    billNumber: string;
    billTitle: string;
  }[];
}

export async function getLegislatorBySlug(slug: string): Promise<LegislatorDetail | null> {
  return safeQuery<LegislatorDetail | null>(
    async (db) => {
      const [person] = await db.select().from(people).where(eq(people.slug, slug)).limit(1);
      if (!person) return null;

      const billColumns = {
        slug: bills.slug,
        billNumber: bills.billNumber,
        title: bills.title,
        statusId: bills.statusId,
        lastActionDate: bills.lastActionDate,
        sponsorTypeId: billSponsors.sponsorTypeId,
      };

      const [sponsorships, votes] = await Promise.all([
        db
          .select(billColumns)
          .from(billSponsors)
          .innerJoin(bills, eq(bills.id, billSponsors.billId))
          .where(and(eq(billSponsors.personId, person.id), eq(bills.isTracked, true)))
          .orderBy(desc(bills.lastActionDate)),
        db
          .select({
            voteId: individualVotes.voteId,
            voteText: individualVotes.voteText,
            voteDate: rollCalls.voteDate,
            description: rollCalls.description,
            chamber: rollCalls.chamber,
            passed: rollCalls.passed,
            billSlug: bills.slug,
            billNumber: bills.billNumber,
            billTitle: bills.title,
          })
          .from(individualVotes)
          .innerJoin(rollCalls, eq(rollCalls.id, individualVotes.rollCallId))
          .innerJoin(bills, eq(bills.id, rollCalls.billId))
          .where(and(eq(individualVotes.personId, person.id), eq(bills.isTracked, true)))
          .orderBy(desc(rollCalls.voteDate))
          .limit(100),
      ]);

      return {
        slug: person.slug,
        name: person.name,
        party: person.party,
        partyId: person.partyId,
        role: person.role,
        roleId: person.roleId,
        district: person.district,
        ballotpedia: person.ballotpedia,
        lastSyncedAt: person.lastSyncedAt,
        sponsored: sponsorships.filter((s) => s.sponsorTypeId === 1),
        cosponsored: sponsorships.filter((s) => s.sponsorTypeId !== 1),
        votes,
      };
    },
    null,
    'getLegislatorBySlug',
  );
}

export async function getAllLegislatorSlugs(): Promise<string[]> {
  return safeQuery(
    async (db) => {
      const rows = await db.select({ slug: people.slug }).from(people);
      return rows.map((r) => r.slug);
    },
    [] as string[],
    'getAllLegislatorSlugs',
  );
}
