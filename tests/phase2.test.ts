import sharp from "sharp";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../lib/db";
import { countPaths, validateStoryGraph } from "../engine/interactive";
import { demoInteractive } from "../engine/tasks/expansion";
import { composePages } from "../engine/media/comic";
import { decideApproval } from "../engine/approvals";
import { startRun } from "../engine/workflow";
import { drain } from "../engine/worker";
import { flywheelTick } from "../engine/flywheel";
import "../engine/jobs";
import { resetDb } from "./helpers";

const canon = { title: "Test World", ageRating: "ALL", synopsis: "s", characters: [{ name: "Ada Vell", role: "", motivation: "", voice: "" }, { name: "Bo", role: "", motivation: "", voice: "" }], locations: ["The Pier", "The Lamp"], rules: [] };

describe("interactive story graphs (unit)", () => {
  it("accepts the demo graph and counts playthroughs", () => {
    const g = demoInteractive(canon);
    expect(validateStoryGraph(g).filter((i) => i.severity === "error")).toHaveLength(0);
    expect(countPaths(g)).toBeGreaterThanOrEqual(3);
  });

  it("rejects dangling choices, dead ends, unreachable nodes and inescapable loops", () => {
    const g = demoInteractive(canon);
    const broken = structuredClone(g);
    broken.nodes[0].choices[0].to = "nowhere";
    expect(validateStoryGraph(broken).some((i) => i.message.includes("missing node"))).toBe(true);

    const dead = structuredClone(g);
    dead.nodes[1].choices = [];
    expect(validateStoryGraph(dead).some((i) => i.message.includes("dead end"))).toBe(true);

    const orphan = structuredClone(g);
    orphan.nodes.push({ id: "x", location: "", characters: [], text: "", choices: [], ending: "lost" });
    expect(validateStoryGraph(orphan).some((i) => i.message.includes("unreachable"))).toBe(true);

    const loop = { title: "t", synopsis: "", start: "a", nodes: [
      { id: "a", location: "", characters: [], text: "", choices: [{ label: "b", to: "b" }, { label: "end", to: "e" }], ending: "" as const },
      { id: "b", location: "", characters: [], text: "", choices: [{ label: "c", to: "c" }], ending: "" as const },
      { id: "c", location: "", characters: [], text: "", choices: [{ label: "b", to: "b" }], ending: "" as const },
      { id: "e", location: "", characters: [], text: "", choices: [], ending: "triumph" as const },
    ] };
    expect(validateStoryGraph(loop).some((i) => i.message.includes("no ending can be reached"))).toBe(true);
  });
});

describe("comic compositor (unit)", () => {
  it("lays out 6 panels per page at print size", async () => {
    const frame = await sharp({ create: { width: 536, height: 302, channels: 3, background: "#334455" } }).png().toBuffer();
    const panels = Array.from({ length: 8 }, (_, i) => ({ image: frame, caption: i % 2 ? `ADA: Line ${i}` : `Action ${i} happens here.`, isDialogue: i % 2 === 1 }));
    const pages = await composePages({ title: "Test", subtitle: "Pilot", panels });
    expect(pages).toHaveLength(2);
    const m = await sharp(pages[0]).metadata();
    expect([m.width, m.height]).toEqual([1200, 1800]);
  });
});

describe("expansion cycle (integration)", () => {
  beforeEach(() => resetDb());

  async function publishedFranchise() {
    const brief = await db.brief.create({ data: { text: "cozy lighthouse adventures", createdBy: "test" } });
    await startRun("ip.discovery", { briefId: brief.id, brief: brief.text, conceptCount: 2, prototypeCount: 1 }, { createdBy: "test", briefId: brief.id });
    await drain();
    const c = await db.concept.findFirstOrThrow({ where: { rank: 1 } });
    await decideApproval((await db.approval.findFirstOrThrow({ where: { kind: "NEW_IP" } })).id, { approved: true, decision: { selected: [c.id] } }, "user:test");
    await drain();
    await decideApproval((await db.approval.findFirstOrThrow({ where: { kind: "PUBLISH", status: "PENDING" } })).id, { approved: true }, "user:test");
    await drain();
    return db.franchise.findFirstOrThrow();
  }

  it("develop -> founder picks episode, comic and interactive -> all three ship to WEBSTER WORLD", async () => {
    const f = await publishedFranchise();
    expect(f.status).toBe("ACTIVE");

    // Flywheel is off by default; enabling it starts a development cycle.
    expect(await flywheelTick()).toMatchObject({ skipped: expect.any(String) });
    await db.studioSettings.update({ where: { id: "studio" }, data: { flywheelEnabled: true } });
    const tick = (await flywheelTick()) as { started: string[] };
    expect(tick.started).toHaveLength(1);
    expect(((await flywheelTick()) as { started: string[] }).started).toHaveLength(0); // idempotent while busy
    await drain();

    const opps = await db.opportunity.findMany();
    expect(opps.some((o) => o.status === "PROPOSAL_ONLY")).toBe(true); // merch/licensing never auto-produced
    for (const o of opps.filter((x) => x.status === "PROPOSED")) expect(o.estBasis).toBeTruthy();
    const strategy = await db.approval.findFirstOrThrow({ where: { kind: "STRATEGY", status: "PENDING" } });
    const picks = opps.filter((o) => ["EPISODE", "COMIC", "INTERACTIVE"].includes(o.kind)).map((o) => o.id);
    await decideApproval(strategy.id, { approved: true, decision: { selected: picks } }, "user:test");
    await drain();

    // Each production pauses at its own publication gate.
    const gates = await db.approval.findMany({ where: { kind: "PUBLISH", status: "PENDING" } });
    expect(gates).toHaveLength(3);
    for (const g of gates) await decideApproval(g.id, { approved: true }, "user:test");
    await drain();

    const runs = await db.workflowRun.findMany({ where: { type: { in: ["franchise.pilot", "franchise.comic", "franchise.interactive", "franchise.develop"] } } });
    expect(runs.every((r) => r.status === "COMPLETED")).toBe(true);
    const titles = await db.worldTitle.findMany({ where: { releaseId: { not: null } } });
    expect(titles.map((t) => t.kind).sort()).toEqual(["PLAY", "READ", "WATCH", "WATCH"]);
    const comic = titles.find((t) => t.kind === "READ")!;
    expect(((comic.readContent as { comicPages: string[] }).comicPages).length).toBeGreaterThan(0);
    const play = titles.find((t) => t.kind === "PLAY")!;
    const graph = (play.playContent as { graph: Parameters<typeof validateStoryGraph>[0] }).graph;
    expect(validateStoryGraph(graph).filter((i) => i.severity === "error")).toHaveLength(0);
    const ep2 = await db.production.findFirstOrThrow({ where: { format: "EPISODE" } });
    expect(ep2.status).toBe("RELEASED");
    expect(await db.opportunity.count({ where: { status: "IN_PRODUCTION" } })).toBe(3);
  });

  it("canon change: approval creates a new hashed version and flags every dependent asset", async () => {
    const f = await publishedFranchise();
    const lead = await db.canonEntity.findFirstOrThrow({ where: { franchiseId: f.id, type: "CHARACTER" }, include: { assets: true } });
    expect(lead.assets.length).toBeGreaterThan(0);
    const ap = await db.approval.create({
      data: { kind: "CANON_CHANGE", title: "Change lead", summary: "test", requestedBy: "user:test", franchiseId: f.id, payload: { entityId: lead.id, changes: { appearance: "A new coat." }, reason: "Wardrobe update" } },
    });
    await decideApproval(ap.id, { approved: true }, "user:test");
    const after = await db.franchise.findUniqueOrThrow({ where: { id: f.id }, include: { versions: { orderBy: { version: "desc" } } } });
    expect(after.canonVersion).toBe(2);
    expect(after.versions[0].hash).not.toBe(after.versions[1].hash);
    expect(await db.asset.count({ where: { entities: { some: { entityId: lead.id } }, status: "NEEDS_REVIEW" } })).toBe(lead.assets.length);
    const entity = await db.canonEntity.findUniqueOrThrow({ where: { id: lead.id } });
    expect(entity.revision).toBe(2);
    expect((entity.data as { appearance: string }).appearance).toBe("A new coat.");
  });
});
