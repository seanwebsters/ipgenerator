import type { Asset, Franchise } from "./types";
import { canonHash } from "./franchise";

const ago = (days: number, hours = 0) => new Date(Date.now() - (days * 24 + hours) * 3600_000).toISOString();

/** The demo franchise every new workspace starts with. */
export function moonwilders(): Franchise {
  const C = { wren: "char_wren", bram: "char_bram", tilly: "char_tilly", oolu: "char_oolu", gloam: "char_gloam" };
  const asset = (a: Omit<Asset, "createdAt" | "canonVersion"> & { daysAgo: number; v?: number }): Asset => {
    const { daysAgo, v, ...rest } = a;
    return { ...rest, createdAt: ago(daysAgo), canonVersion: v ?? 3 };
  };

  const f: Franchise = {
    id: "fr_moonwilders",
    name: "Moonwilders",
    tagline: "When the moon rises, the Hushwood wakes, and so do its keepers.",
    prompt: "small forest creatures who look after children's lost dreams at night",
    createdAt: ago(21),
    updatedAt: ago(0, 2),
    stage: "expansion",
    concept: {
      id: "concept_moonwilders",
      title: "Moonwilders",
      logline:
        "When a moth-winged scout finds a child's dream drifting into the Hushwood, she gathers a crew of night creatures to return every lost dream before it turns feral.",
      genre: "Cozy fantasy adventure",
      tone: "Warm, wondrous, gently funny",
      audience: "Kids 4-9 and the grown-ups at bedtime",
      hook: "Every episode returns one real-feeling dream, and ends with a bedtime ritual kids copy at home.",
      formats: ["Animated series", "Picture books", "Plush line", "Cozy mobile game"],
      comparables: ["Bluey", "My Neighbor Totoro", "Animal Crossing"],
      palette: ["#1e1b4b", "#6d28d9", "#fbbf24", "#a7f3d0"],
      scores: { originality: 82, marketability: 88, expandability: 86, merchability: 94 },
    },
    alternates: [],
    core: {
      logline:
        "When a moth-winged scout finds a child's dream drifting into the Hushwood, she gathers a crew of night creatures to return every lost dream before it turns feral.",
      premise:
        "Every night, dreams that children lose on the way to sleep drift into the Hushwood as tiny lanterns. The Moonwilders - five young night creatures and one very old owl - find each lantern, learn whose dream it is, and carry it home before sunrise. Dreams left too long go feral, and the Gloam is always hungry.",
      themes: ["Small acts of care", "Fear shrinks when it's shared", "Everyone belongs somewhere"],
      pillars: [
        "A cast you can draw from memory",
        "A bedtime ritual in every story",
        "Every dream is a collectible lantern",
        "Gentle peril, never cruelty",
      ],
      audience: "Kids 4-9 and the grown-ups at bedtime",
      tone: "Warm, wondrous, gently funny",
      comparables: ["Bluey", "My Neighbor Totoro", "Animal Crossing"],
      formats: [
        { name: "Animated series (52 x 11')", status: "core", note: "Hero format. Sets the look, voice and music." },
        { name: "Picture books", status: "planned", note: "One per season, bedtime-length." },
        { name: "Plush & lantern night-lights", status: "planned", note: "The lantern is the hero SKU." },
        { name: "Cozy mobile game", status: "exploring", note: "Collect and return dream lanterns." },
        { name: "Bedtime audio stories", status: "exploring", note: "Narrated by Oolu." },
      ],
    },
    characters: [
      {
        id: C.wren,
        name: "Wren",
        role: "protagonist",
        archetype: "The Seeker",
        description: "A moth-winged scout, the smallest Moonwilder and the first to fly toward any light.",
        motivation: "Wants to prove a small creature can carry a big dream.",
        flaw: "Flies before she looks.",
        visualNotes: "Silver-violet moth wings, oversized amber scarf, lantern on her hip. Reads at icon size.",
        voice: "Bright, quick, asks three questions at once",
        color: "#a78bfa",
        relationships: [
          { characterId: C.bram, kind: "best friends" },
          { characterId: C.oolu, kind: "apprentice of" },
          { characterId: C.gloam, kind: "hunted by" },
        ],
        revision: 3,
      },
      {
        id: C.bram,
        name: "Bram",
        role: "best friend",
        archetype: "The Gentle Giant",
        description: "A big, careful badger who builds everything the crew needs - mostly bridges, mostly at the last minute.",
        motivation: "Wants everyone home safe before sunrise.",
        flaw: "Worries so much he freezes.",
        visualNotes: "Round silhouette, striped toque, tool belt of acorn caps.",
        voice: "Low, slow, surprisingly funny",
        color: "#60a5fa",
        relationships: [{ characterId: C.wren, kind: "best friends" }, { characterId: C.tilly, kind: "build partner" }],
        revision: 1,
      },
      {
        id: C.tilly,
        name: "Tilly Thistle",
        role: "inventor",
        archetype: "The Tinkerer",
        description: "A hedgehog inventor whose gadgets work perfectly, eventually.",
        motivation: "Wants to build a machine that can catch a dream without dimming it.",
        flaw: "Won't admit when she's wrong.",
        visualNotes: "Spines tipped with tiny brass screws, goggles, patchwork apron.",
        voice: "Fast, precise, sudden giggles",
        color: "#fbbf24",
        relationships: [{ characterId: C.bram, kind: "build partner" }],
        revision: 1,
      },
      {
        id: C.oolu,
        name: "Oolu",
        role: "mentor",
        archetype: "The Keeper of Secrets",
        description: "An ancient barn owl who has kept the Hushwood's lanterns for a thousand nights and forgotten nearly half of them.",
        motivation: "Wants to pass on the Lantern Rules before her own light fades.",
        flaw: "Hides the truth about the Gloam to protect the young ones.",
        visualNotes: "Heart-shaped pale face, spectacles on a chain, feathers like old paper.",
        voice: "Soft, measured, hums when thinking",
        color: "#34d399",
        relationships: [{ characterId: C.wren, kind: "mentor to" }, { characterId: C.gloam, kind: "once knew" }],
        revision: 2,
      },
      {
        id: C.gloam,
        name: "The Gloam",
        role: "antagonist",
        archetype: "The Hollow Crown",
        description: "A shadow made of every dream nobody came back for. Not evil - just very, very lonely.",
        motivation: "Wants one dream to be about it.",
        flaw: "Believes nobody could ever look for it.",
        visualNotes: "Ink-wash silhouette, two pinprick lights for eyes, edges that fray into moths.",
        voice: "Whispered, overlapping, childlike underneath",
        color: "#f87171",
        relationships: [{ characterId: C.wren, kind: "fascinated by" }],
        revision: 1,
      },
    ],
    world: {
      premise: "Lost dreams drift into a forest that only exists between moonrise and sunrise.",
      setting: "The Hushwood, a night-only forest beyond every child's window",
      era: "Timeless storybook present",
      locations: [
        { id: "loc_hollow", name: "Lantern Hollow", kind: "Home base", description: "A hollow oak lit by rescued dream-lanterns, where the crew sorts each night's finds.", mood: "Safe, warm, cluttered" },
        { id: "loc_pond", name: "The Silver Pond", kind: "Gateway", description: "The moon's reflection here is a door to the Dreamshore, where dreams go home.", mood: "Shimmering, hushed" },
        { id: "loc_reach", name: "Gloamreach", kind: "Danger zone", description: "Thorny dark edge of the wood where feral dreams gather.", mood: "Tense, beautiful, wrong" },
        { id: "loc_meadow", name: "Starfall Meadow", kind: "Wonder", description: "Where fallen stars sleep. Every season finale ends here.", mood: "Open, glowing" },
        { id: "loc_market", name: "The Moth Market", kind: "Social hub", description: "A floating night market run by lantern moths who trade in whispers.", mood: "Bustling, twinkling" },
      ],
      rules: [
        { id: "rule_moon", title: "Moonrise to sunrise", description: "The Hushwood and the Moonwilders only exist while the moon is up." },
        { id: "rule_feral", title: "Untended dreams go feral", description: "A lantern left alone until dawn becomes a feral dream - mischievous, then sad." },
        { id: "rule_seen", title: "Never be seen awake", description: "If a waking child sees a Moonwilder, the child keeps the memory and the Moonwilder loses one." },
        { id: "rule_carry", title: "Carry it, don't catch it", description: "A dream can be guided home but never trapped; trapped dreams dim." },
      ],
      factions: [
        { id: "fac_mw", name: "The Moonwilders", ideology: "Every dream deserves to get home", description: "Wren's crew and Oolu." },
        { id: "fac_moths", name: "The Lantern Moths", ideology: "Light is for trading", description: "Merchants of the Moth Market; useful, gossipy, never quite honest." },
        { id: "fac_gloam", name: "The Gloam Court", ideology: "What's lost should stay lost", description: "Feral dreams who follow the Gloam." },
      ],
      timeline: [
        { id: "tl_1", when: "The First Night", event: "The moon plants the Hushwood to catch dreams that fall from sleepy children." },
        { id: "tl_2", when: "A thousand nights ago", event: "Oolu becomes the first Lantern Keeper." },
        { id: "tl_3", when: "The Long Dark", event: "A whole town's dreams go untended; the Gloam is born." },
        { id: "tl_4", when: "Season 1", event: "Wren follows a runaway lantern and founds the Moonwilders." },
        { id: "tl_5", when: "Season 1 finale", event: "The Gloam asks Wren to find a dream about it." },
      ],
    },
    assets: [
      asset({ id: "a_ep1", studio: "story", kind: "episode outline", title: "Wren and the Runaway Lantern", summary: "Pilot: Wren chases a lantern that won't go home and meets Bram.", body: "COLD OPEN - A lantern zips past Wren's window.\nACT 1 - Wren chases it alone into the Hushwood.\nACT 2 - She meets Bram, who has built a bridge to nowhere.\nACT 3 - Together they guide the lantern to the Silver Pond.\nTAG - Oolu, watching from above: 'Two. That's a start.'", dependsOn: [C.wren, C.bram, C.oolu], status: "approved", daysAgo: 12 }),
      asset({ id: "a_ep2", studio: "story", kind: "episode outline", title: "Tilly's Dream-Catcher (Doesn't Work)", summary: "Tilly's machine catches a dream and dims it; she learns Rule 4.", body: "Tilly builds a dream-catcher. It works - too well. The dream dims.\nWren and Bram help her un-catch it.\nTilly writes the rule on her workshop wall: CARRY, DON'T CATCH.", dependsOn: [C.tilly, C.wren, C.bram, "rule_carry"], status: "approved", daysAgo: 10 }),
      asset({ id: "a_style", studio: "animation", kind: "style frame brief", title: "Style frame: Wren at the Silver Pond", summary: "Key art that locks the series look.", body: "Painterly gouache backgrounds, clean ink character lines.\nOne warm lantern source against moonlit blue.\nWren mid-hover, scarf trailing, looking back at Bram.", dependsOn: [C.wren, C.bram, "loc_pond"], status: "approved", daysAgo: 9 }),
      asset({ id: "a_theme", studio: "music", kind: "main theme brief", title: "Moonwilders - Main Theme ('The Lantern Song')", summary: "A five-note motif for lullaby, title and finale.", body: "Key: D major, drifting to B minor in the bridge.\nCelesta, warm strings, soft hand percussion, distant choir.\nMotif: rising fifth, falling step - 'carry it home'.", dependsOn: [], status: "approved", daysAgo: 8 }),
      asset({ id: "a_book", studio: "publishing", kind: "picture book", title: "Wren and the Very Long Night", summary: "32-page bedtime picture book, ages 3-7.", body: "Wren can't find the last lantern. She asks everyone. She asks Oolu. In the end it was inside her scarf all along - her own dream, waiting.", dependsOn: [C.wren, C.oolu], status: "approved", daysAgo: 7 }),
      asset({ id: "a_plush", studio: "merch", kind: "product line", title: "Moonwilders hero plush + lantern night-light", summary: "Four plush at three sizes; the lantern glows.", body: "- Wren: 8in / 12in, removable scarf\n- Bram: 10in / 16in\n- Tilly: 8in with brass-tipped spines\n- Oolu: 12in, spectacles\nHero SKU: Dream Lantern night-light, 20-minute fade.", dependsOn: [C.wren, C.bram, C.tilly, C.oolu], status: "approved", daysAgo: 6 }),
      asset({ id: "a_game", studio: "games", kind: "game concept", title: "Moonwilders: Lantern Keepers", summary: "Cozy mobile game - collect and return dream lanterns.", body: "Play as Wren. Each night: explore a Hushwood glade, find lanterns, match them to sleeping children, guide them home.\nBram builds bridges, Tilly unlocks gadgets.\nCosmetic-only monetisation.", dependsOn: [C.wren, C.bram, C.tilly, "loc_hollow", "rule_feral"], status: "pending", daysAgo: 2 }),
      asset({ id: "a_brand", studio: "brand", kind: "style guide", title: "Brand style guide v1", summary: "Colour, type and voice for every studio.", body: "Primary: Hushwood Night #1e1b4b. Accent: Lantern Gold #fbbf24.\nDisplay: rounded serif. Body: humanist sans.\nAlways leave a light in the frame.", dependsOn: [], status: "approved", daysAgo: 11 }),
      asset({ id: "a_s1", studio: "social", kind: "short-form post", title: "POV: a moth just returned your dream", summary: "Character intro: Wren in 12 seconds.", body: "POV: a moth just returned your dream\n\nMeet Wren. She's very small and very fast.\n\n#Moonwilders #animation #cozy", dependsOn: [C.wren], status: "approved", daysAgo: 5, meta: { platform: "TikTok", format: "Character intro", day: 1, hashtags: ["#Moonwilders", "#animation", "#cozy"] } }),
      asset({ id: "a_s2", studio: "social", kind: "short-form post", title: "Bram has one rule. Guess it.", summary: "Poll: what's Bram's rule? (Everyone home before sunrise.)", body: "Bram has one rule. Guess it.\n\n#Moonwilders #lore", dependsOn: [C.bram], status: "approved", daysAgo: 5, meta: { platform: "Instagram", format: "Poll", day: 3, hashtags: ["#Moonwilders", "#lore"] } }),
      asset({ id: "a_s3", studio: "social", kind: "short-form post", title: "Rule 3 of the Hushwood", summary: "Lore drop: never be seen awake.", body: "Rule 3 of the Hushwood...\n\n#Moonwilders #lore #storytime", dependsOn: [C.oolu, "rule_seen"], status: "approved", daysAgo: 4, meta: { platform: "YouTube Shorts", format: "Lore drop", day: 5, hashtags: ["#Moonwilders", "#lore", "#storytime"] } }),
      asset({ id: "a_s4", studio: "social", kind: "short-form post", title: "Tilly's invention, rated", summary: "Behind the scenes: Tilly's gadgets, 1-10.", body: "Rate Tilly's invention 1-10\n\n#Moonwilders #originalcharacter", dependsOn: [C.tilly], status: "approved", daysAgo: 4, meta: { platform: "TikTok", format: "Mini-episode", day: 8, hashtags: ["#Moonwilders", "#originalcharacter"] } }),
      asset({ id: "a_s5", studio: "social", kind: "short-form post", title: "Wren's lantern sound", summary: "Sound trend built on the theme's first five notes.", body: "The sound Wren's lantern makes\n\n#Moonwilders #sound", dependsOn: [C.wren], status: "needs_review", reviewReason: "Wren changed in canon v3: visualNotes updated", daysAgo: 3, v: 2, meta: { platform: "TikTok", format: "Sound trend", day: 12, hashtags: ["#Moonwilders", "#sound"] } }),
      asset({ id: "a_s6", studio: "social", kind: "short-form post", title: "Who is the Gloam?", summary: "Fan question: theories about the Gloam.", body: "Nobody in the Hushwood talks about this\n\n#Moonwilders #theory", dependsOn: [C.gloam], status: "pending", daysAgo: 1, meta: { platform: "X", format: "Fan question", day: 15, hashtags: ["#Moonwilders", "#theory"] } }),
      asset({ id: "a_s7", studio: "social", kind: "short-form post", title: "Oolu's bedtime ritual", summary: "Three breaths, one wish - a ritual kids copy.", body: "Oolu's bedtime ritual, in 15 seconds\n\n#Moonwilders #bedtime", dependsOn: [C.oolu], status: "pending", daysAgo: 1, meta: { platform: "Instagram", format: "Mini-episode", day: 19, hashtags: ["#Moonwilders", "#bedtime"] } }),
    ],
    vault: [],
    canon: { version: 0, history: [] },
    approvals: [],
    plan: null,
    activity: [],
  };

  f.canon.version = 3;
  const hash = canonHash(f);
  f.canon.history = [
    { version: 3, createdAt: ago(3), author: "You", summary: "Edited Wren", changes: ["visualNotes updated (amber scarf replaces red cloak)"], hash },
    { version: 2, createdAt: ago(14), author: "Juno (Character Lead)", summary: "Deepened Oolu", changes: ["motivation updated", "relationship: once knew The Gloam"], hash: "7b1e04c2a95f3d10" },
    { version: 1, createdAt: ago(18), author: "You", summary: "Greenlit to canon", changes: ["5 characters", "5 locations, 4 rules", "5 formats planned"], hash: "3f9a6d21c07e8b54" },
  ];

  const at = ago(18);
  f.vault = [
    { id: "v_tm_us", kind: "trademark", title: "MOONWILDERS", jurisdiction: "US (USPTO)", classes: "9, 16, 25, 28, 41", status: "filed", notes: "Intent-to-use filed. Serial number pending (simulated).", updatedAt: ago(10) },
    { id: "v_tm_eu", kind: "trademark", title: "MOONWILDERS", jurisdiction: "EU (EUIPO)", classes: "9, 16, 25, 28, 41", status: "cleared", notes: "Priority deadline in 5 months.", updatedAt: at },
    { id: "v_tm_wren", kind: "trademark", title: "WREN OF THE HUSHWOOD", jurisdiction: "US (USPTO)", classes: "28", status: "idea", notes: "Character mark for plush line.", updatedAt: at },
    { id: "v_cr", kind: "copyright", title: "Moonwilders series bible (canon v1)", jurisdiction: "US Copyright Office", classes: "Literary work", status: "registered", notes: "Registered (simulated).", updatedAt: ago(15) },
    { id: "v_design", kind: "design", title: "Dream Lantern night-light", jurisdiction: "EU (EUIPO)", classes: "Lighting", status: "idea", notes: "Register before toy-fair reveal.", updatedAt: at },
    { id: "v_dom", kind: "domain", title: "moonwilders.com", jurisdiction: "Global", classes: "-", status: "registered", notes: "Plus .co.uk and .tv (simulated).", updatedAt: at },
    { id: "v_cot", kind: "chain-of-title", title: "Creator assignment & AI-assist disclosure", jurisdiction: "Contract", classes: "-", status: "flagged", notes: "Needs signature from the creator before licensing talks.", updatedAt: ago(2) },
  ];

  f.approvals = [
    { id: "apr_s5", createdAt: ago(3), agent: "social", studio: "social", kind: "review", title: 'Review "Wren\'s lantern sound"', description: "Wren changed (visualNotes updated). Check this short-form post still matches canon.", refId: "a_s5", status: "pending" },
    { id: "apr_game", createdAt: ago(2), agent: "games", studio: "games", kind: "asset", title: "Moonwilders: Lantern Keepers", description: "Pixel delivered a game concept: Cozy mobile game - collect and return dream lanterns.", refId: "a_game", status: "pending" },
    { id: "apr_s6", createdAt: ago(1), agent: "social", studio: "social", kind: "asset", title: "Who is the Gloam?", description: "Pulse delivered a short-form post: Fan question: theories about the Gloam.", refId: "a_s6", status: "pending" },
    { id: "apr_s7", createdAt: ago(1), agent: "social", studio: "social", kind: "asset", title: "Oolu's bedtime ritual", description: "Pulse delivered a short-form post: Three breaths, one wish.", refId: "a_s7", status: "pending" },
  ];

  f.plan = {
    objective: "Prove the Moonwilders cast with families in 90 days, then take the series pitch to streamers.",
    createdAt: ago(12),
    phases: [
      {
        name: "Weeks 1-2 - Lock the foundation",
        tasks: [
          { id: "t1", studio: "brand", title: "Brand style guide", deliverable: "style guide", status: "done", assetId: "a_brand" },
          { id: "t2", studio: "animation", title: "Series style frame", deliverable: "style frame brief", status: "done", assetId: "a_style" },
          { id: "t3", studio: "vault", title: "File US word mark", deliverable: "trademark filing", status: "done" },
        ],
      },
      {
        name: "Weeks 3-6 - Find the audience",
        tasks: [
          { id: "t4", studio: "social", title: "30-day launch calendar", deliverable: "short-form post", status: "awaiting_approval" },
          { id: "t5", studio: "music", title: "Main theme", deliverable: "main theme brief", status: "done", assetId: "a_theme" },
          { id: "t6", studio: "story", title: "Pilot and episode 2 outlines", deliverable: "episode outline", status: "done", assetId: "a_ep1" },
        ],
      },
      {
        name: "Weeks 7-12 - Expand the slate",
        tasks: [
          { id: "t7", studio: "publishing", title: "First picture book", deliverable: "picture book", status: "done", assetId: "a_book" },
          { id: "t8", studio: "games", title: "Mobile game concept", deliverable: "game concept", status: "awaiting_approval", assetId: "a_game" },
          { id: "t9", studio: "merch", title: "Hero plush line", deliverable: "product line", status: "done", assetId: "a_plush" },
          { id: "t10", studio: "story", title: "Season 1 arc", deliverable: "season arc", status: "queued" },
          { id: "t11", studio: "brand", title: "Logo wordmark", deliverable: "logo brief", status: "queued" },
        ],
      },
    ],
  };

  f.activity = [
    { id: "act7", at: ago(1), agent: "social", text: "Delivered 2 posts for approval." },
    { id: "act6", at: ago(2), agent: "games", text: 'Delivered "Moonwilders: Lantern Keepers" for approval.' },
    { id: "act5b", at: ago(2, 20), agent: "you", text: "Confirmed consistent with canon: 6 assets using Wren." },
    { id: "act5", at: ago(3), agent: "director", text: "Wren changed. 7 downstream assets flagged for review." },
    { id: "act4", at: ago(6), agent: "merch", text: "Hero plush line approved." },
    { id: "act3", at: ago(10), agent: "vault", text: "US trademark filed for MOONWILDERS (simulated)." },
    { id: "act2", at: ago(12), agent: "director", text: "New plan: 11 tasks across 3 phases." },
    { id: "act1", at: ago(18), agent: "vault", text: "Canon v1 hashed into the IP Vault." },
  ];
  return f;
}
