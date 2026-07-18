#!/usr/bin/env npx tsx
/**
 * Comprehensive database encoding cleanup + deduplication.
 *
 * Algorithm:
 * 1. Group courses by (departmentId, normalized-slug title) to find duplicates
 * 2. For duplicate groups: merge into the keeper, delete others
 * 3. Then normalize remaining course text (fix mojibake + smart punct -> ASCII)
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const NORMALIZE_MAP: Record<string, string> = {
  "\u00e2\u20ac\u2122": "'",
  "\u00e2\u20ac\u02dc": "'",
  "\u00e2\u20ac\u0153": '"',
  "\u00e2\u20ac\u009d": '"',
  "\u00e2\u20ac\u2013": "-",
  "\u00e2\u20ac\u2014": "-",
  "\u00e2\u20ac\u201c": "-",
  "\u00e2\u20ac\u201d": "-",
  "\u00e2\u2013\u00a0": "-",
  "\u00e2\u20ac\u2018": "'",
  "\u00e2\u20ac\u2019": "'",
  "\ufb00": "ff",
  "\ufb01": "fi",
  "\u2013": "-",
  "\u2014": "-",
  "\u2018": "'",
  "\u2019": "'",
  "\u201c": '"',
  "\u201d": '"',
  "\u2026": "...",
};

function normalizeText(text: string): string {
  let cleaned = text;
  for (const [pattern, replacement] of Object.entries(NORMALIZE_MAP)) {
    if (cleaned.includes(pattern)) {
      cleaned = cleaned.split(pattern).join(replacement);
    }
  }
  return cleaned;
}

function needsNormalization(text: string): boolean {
  for (const pattern of Object.keys(NORMALIZE_MAP)) {
    if (text.includes(pattern)) return true;
  }
  return false;
}

async function main() {
  // Phase 1: Deduplicate
  console.log("=== Phase 1: Deduplicate ===");
  const allCourses = await prisma.course.findMany({
    include: {
      options: { include: { offerings: true } },
    },
    orderBy: { id: "asc" },
  });

  // Build normalized-title-slug groups
  const groups = new Map<string, typeof allCourses>();
  for (const c of allCourses) {
    const slug = c.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const key = `${c.departmentId}|${slug}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(c);
  }

  let mergedCount = 0;
  for (const [, group] of groups) {
    if (group.length <= 1) continue;

    // Sort so cleanest entry (fewest non-ASCII) is kept
    group.sort((a, b) => {
      const aBad = [...a.title].filter((ch) => ch.charCodeAt(0) > 127).length;
      const bBad = [...b.title].filter((ch) => ch.charCodeAt(0) > 127).length;
      return aBad - bBad;
    });

    const keeper = group[0];
    console.log(`Group: "${keeper.title}" (keeping #${keeper.id})`);
    for (const dupe of group) {
      console.log(`  #${dupe.id}: "${dupe.title}"${dupe.id === keeper.id ? " [KEEPER]" : ""}`);
    }

    for (const dupe of group) {
      if (dupe.id === keeper.id) continue;

      // Merge offerings
      for (const option of dupe.options) {
        const existing = keeper.options.find((o) => o.name === option.name);
        if (existing) {
          for (const offering of option.offerings) {
            try {
              await prisma.courseOffering.update({
                where: { id: offering.id },
                data: { courseOptionId: existing.id },
              });
            } catch {
              // May have unique constraint conflict on courseCode
              console.log(`    SKIP offering ${offering.courseCode} (conflict)`);
            }
          }
          await prisma.courseOption.delete({ where: { id: option.id } }).catch(() => {});
        } else {
          await prisma.courseOption.update({
            where: { id: option.id },
            data: { courseId: keeper.id },
          }).catch(() => {});
        }
      }

      await prisma.course.delete({ where: { id: dupe.id } });
      mergedCount++;
      console.log(`  DELETED #${dupe.id}`);
    }
  }
  console.log(`\nDeduplication: ${mergedCount} courses deleted`);

  // Phase 2: Normalize remaining courses
  console.log("\n=== Phase 2: Normalize encoding ===");

  // Get all courses again after dedup
  const remaining = await prisma.course.findMany({
    include: {
      options: { include: { offerings: true } },
    },
    orderBy: { id: "asc" },
  });

  console.log(`Remaining courses: ${remaining.length}`);

  let normCount = 0;
  for (const course of remaining) {
    const newTitle = normalizeText(course.title);
    const newDesc = course.description ? normalizeText(course.description) : course.description;
    const newNotes = Array.isArray(course.notes)
      ? (course.notes as string[]).map((n: string) => normalizeText(n))
      : course.notes;

    const changed =
      newTitle !== course.title ||
      newDesc !== course.description ||
      JSON.stringify(newNotes) !== JSON.stringify(course.notes);

    if (!changed) continue;

    normCount++;
    console.log(`NORM #${course.id}: "${course.title}" -> "${newTitle}"`);

    // Normalize options and offerings too
    for (const option of course.options) {
      for (const offering of option.offerings) {
        const updates: Record<string, unknown> = {};
        const nc = normalizeText(offering.courseCode);
        if (nc !== offering.courseCode) updates.courseCode = nc;
        const nl = offering.semesterLabel ? normalizeText(offering.semesterLabel) : offering.semesterLabel;
        if (nl !== offering.semesterLabel) updates.semesterLabel = nl;
        const nd = offering.duration ? normalizeText(offering.duration) : offering.duration;
        if (nd !== offering.duration) updates.duration = nd;
        // Normalize prerequisites
        if (Array.isArray(offering.prerequisites)) {
          const newPrereqs = (offering.prerequisites as string[]).map((p) => normalizeText(p));
          const oldPrereqs = JSON.stringify(offering.prerequisites);
          if (JSON.stringify(newPrereqs) !== oldPrereqs) {
            updates.prerequisites = newPrereqs;
          }
        }
        if (Object.keys(updates).length > 0) {
          await prisma.courseOffering.update({
            where: { id: offering.id },
            data: updates,
          }).catch((e) => console.log(`  SKIP offering #${offering.id}: ${e.message.slice(0, 80)}`));
        }
      }
    }

    await prisma.course.update({
      where: { id: course.id },
      data: {
        title: newTitle,
        normalizedTitle: newTitle
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, ""),
        description: newDesc,
        notes: newNotes,
      },
    });
  }

  console.log(`\nNormalization: ${normCount} courses updated`);
  console.log("\nDatabase encoding cleanup complete!");
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
