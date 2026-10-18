import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, hashPassword, verifyPassword } from "../lib/crypto";
import { screenOriginality } from "../engine/tasks/originality";
import { validateBible, validateScript } from "../engine/canon";
import { cuesFor, planShots } from "../engine/workflows/pilot";
import { demoBible, demoConcepts } from "../engine/tasks/ip";
import { demoPilot } from "../engine/tasks/production";
import { parseIntentLocally } from "../engine/tasks/learning";
import { assignVariant } from "../engine/learning";
import { backoffMs } from "../engine/queue";

describe("crypto", () => {
  it("round-trips secrets with AES-GCM and rejects tampering", () => {
    const enc = encryptSecret("sk-ant-secret-value");
    expect(enc.ciphertext).not.toContain("secret");
    expect(decryptSecret(enc)).toBe("sk-ant-secret-value");
    expect(() => decryptSecret({ ...enc, tag: Buffer.alloc(16).toString("base64") })).toThrow();
  });
  it("hashes passwords with scrypt", () => {
    const h = hashPassword("hunter2");
    expect(verifyPassword("hunter2", h)).toBe(true);
    expect(verifyPassword("hunter3", h)).toBe(false);
  });
});

describe("originality screen", () => {
  it("flags protected names and near-misses, passes originals", () => {
    expect(screenOriginality([{ field: "title", text: "Return to Hogwarts", isName: false }])[0]?.matches).toBe("Hogwarts");
    expect(screenOriginality([{ field: "lead", text: "Pikachoo", isName: true }])[0]?.kind).toBe("similar");
    expect(screenOriginality([{ field: "title", text: "Marrow Hymnal", isName: true }])).toHaveLength(0);
  });
});

describe("canon and production planning", () => {
  const concept = demoConcepts("lighthouse storms", 1).concepts[0];
  const bible = demoBible(concept);
  const canon = {
    title: concept.title,
    ageRating: concept.ageRating,
    synopsis: bible.synopsis,
    characters: bible.characters.map((c) => ({ name: c.name, role: c.role, motivation: c.motivation, voice: c.voice })),
    locations: bible.locations.map((l) => l.name),
    rules: bible.rules.map((r) => r.name),
  };

  it("validates bibles", () => {
    expect(validateBible(bible).filter((i) => i.severity === "error")).toHaveLength(0);
    const dup = { ...bible, characters: [bible.characters[0], bible.characters[0]] };
    expect(validateBible(dup).some((i) => i.message.includes("Duplicate"))).toBe(true);
  });

  it("catches non-canon speakers", () => {
    const script = demoPilot(canon);
    expect(validateScript(script, canon).filter((i) => i.severity === "error")).toHaveLength(0);
    script.scenes[0].dialogue.push({ character: "Mickey", line: "Hello", framing: "close" });
    expect(validateScript(script, canon).some((i) => i.message.includes("Mickey"))).toBe(true);
  });

  it("plans one establishing shot per scene plus one per line, with captions in order", () => {
    const script = demoPilot(canon);
    const shots = planShots(script, canon.characters.map((c) => c.name));
    const lines = script.scenes.reduce((n, s) => n + s.dialogue.length, 0);
    expect(shots).toHaveLength(script.scenes.length + lines);
    const cues = cuesFor(shots);
    expect(cues).toHaveLength(lines);
    for (let i = 1; i < cues.length; i++) expect(cues[i].start).toBeGreaterThan(cues[i - 1].end);
  });
});

describe("misc engine behaviour", () => {
  it("parses founder commands", () => {
    const i = parseIntentLocally("Develop five original fantasy franchises for young adults and prototype the two strongest concepts.");
    expect(i).toMatchObject({ action: "develop_franchises", conceptCount: 5, prototypeCount: 2 });
    expect(parseIntentLocally("status report please").action).toBe("status_report");
  });
  it("assigns experiment variants deterministically and roughly evenly", () => {
    expect(assignVariant("viewer-1", "exp")).toBe(assignVariant("viewer-1", "exp"));
    const counts = { A: 0, B: 0 };
    for (let i = 0; i < 2000; i++) counts[assignVariant(`v${i}`, "exp")]++;
    expect(Math.abs(counts.A - counts.B)).toBeLessThan(200);
  });
  it("backs off exponentially with a cap", () => {
    expect(backoffMs(1)).toBeLessThanOrEqual(2000);
    expect(backoffMs(5)).toBeGreaterThanOrEqual(16_000);
    expect(backoffMs(50)).toBeLessThanOrEqual(600_000);
  });
});
