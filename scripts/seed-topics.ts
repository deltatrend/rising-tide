/**
 * Loads the topic taxonomy from config/topics.ts into the database.
 *
 * Topic copy is configuration, not user data, so this is safe to re-run: it
 * upserts by slug and never deletes a topic that bills are attached to.
 *
 * Usage: npm run db:seed-topics
 */

import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env.local', quiet: true });
loadEnv({ path: '.env', quiet: true });

async function main(): Promise<void> {
  const { TOPICS } = await import('../config/topics');
  const { getDb, closeDb } = await import('../lib/db/client');
  const { topics } = await import('../lib/db/schema');

  const db = getDb();
  let inserted = 0;

  for (const topic of TOPICS) {
    await db
      .insert(topics)
      .values({
        slug: topic.slug,
        name: topic.name,
        shortDescription: topic.shortDescription,
        longDescription: topic.longDescription,
        category: topic.category,
        sortOrder: topic.sortOrder,
      })
      .onConflictDoUpdate({
        target: topics.slug,
        set: {
          name: topic.name,
          shortDescription: topic.shortDescription,
          longDescription: topic.longDescription,
          category: topic.category,
          sortOrder: topic.sortOrder,
          updatedAt: new Date(),
        },
      });
    inserted += 1;
  }

  console.log(`Seeded ${inserted} topics.`);
  await closeDb();
}

main().catch(async (error) => {
  console.error('Topic seeding failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
