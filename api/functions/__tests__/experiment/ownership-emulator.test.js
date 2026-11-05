import { jest } from "@jest/globals";

const run = process.env.RUN_M01_FIRESTORE_TESTS === "1";
const describeEmulator = run ? describe : describe.skip;

describeEmulator("M01 ownership and Firestore rules (real emulator)", () => {
  jest.setTimeout(30000);
  const project = "demo-expbuilder-m01";
  const experiment = `http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/projects/${project}/databases/(default)/documents/experiments/study`;
  let db, withMutation;
  function jwt(uid) {
    const encode = (value) =>
      Buffer.from(JSON.stringify(value)).toString("base64url");
    return [
      encode({ alg: "none", typ: "JWT" }),
      encode({
        aud: project,
        iss: `https://securetoken.google.com/${project}`,
        sub: uid,
        user_id: uid,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        auth_time: Math.floor(Date.now() / 1000),
        firebase: { sign_in_provider: "custom", identities: {} },
      }),
      "",
    ].join(".");
  }
  async function client(method, fields, uid = "alice", suffix = "") {
    return fetch(experiment + suffix, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(uid ? { Authorization: `Bearer ${jwt(uid)}` } : {}),
      },
      ...(fields ? { body: JSON.stringify({ fields }) } : {}),
    });
  }
  beforeAll(async () => {
    if (
      !/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || "") ||
      process.env.GCLOUD_PROJECT !== project
    )
      throw new Error(
        "This suite only runs against its isolated demo emulator",
      );
    ({ db } = await import("../../app.js"));
    ({ withExperimentMutation: withMutation } = await import(
      "../../experiment/mutation.js"
    ));
  });
  beforeEach(async () => {
    await db
      .doc("experiments/study")
      .set({
        owner: "alice",
        id: "study",
        active: true,
        sessions: 9,
        currentCondition: 4,
      });
  });
  afterAll(async () => {
    await db?.terminate();
  });

  test("clients cannot create remote experiments even for themselves", async () => {
    await db.doc("experiments/study").delete();
    expect(
      (
        await client("PATCH", {
          owner: { stringValue: "alice" },
          id: { stringValue: "study" },
          active: { booleanValue: true },
        })
      ).status,
    ).toBe(403);
  });
  test.each([
    "owner",
    "sessions",
    "currentCondition",
    "createdAt",
    "storageProvider",
    "mutationLease",
    "provisioningState",
  ])("owner cannot overwrite server field %s", async (field) => {
    const value = ["sessions", "currentCondition"].includes(field)
      ? { integerValue: "0" }
      : { stringValue: "forged" };
    const response = await client(
      "PATCH",
      { [field]: value },
      "alice",
      `?updateMask.fieldPaths=${field}`,
    );
    expect(response.status).toBe(403);
    expect((await db.doc("experiments/study").get()).data().owner).toBe(
      "alice",
    );
  });
  test("owners can save transitional settings on a backend-created document", async () => {
    await db
      .doc("experiments/study")
      .update({
        schemaVersion: 2,
        provisioningState: "ready",
        createdAt: new Date(),
        driveFolderId: "folder",
      });
    const response = await client(
      "PATCH",
      {
        batchConfig: {
          mapValue: { fields: { batchSize: { integerValue: "7" } } },
        },
      },
      "alice",
      "?updateMask.fieldPaths=batchConfig",
    );
    expect(response.status).toBe(200);
    expect(
      (await db.doc("experiments/study").get()).data().batchConfig.batchSize,
    ).toBe(7);
  });
  test("settings and reads are denied to another user and unauthenticated clients", async () => {
    expect((await client("GET", undefined, "bob")).status).toBe(403);
    expect((await client("GET", undefined, null)).status).toBe(403);
    expect((await client("GET")).status).toBe(200);
    expect(
      (
        await client(
          "PATCH",
          { active: { booleanValue: false } },
          "bob",
          "?updateMask.fieldPaths=active",
        )
      ).status,
    ).toBe(403);
  });
  test("clients cannot bypass authorized deletion", async () => {
    expect((await client("DELETE")).status).toBe(403);
    expect((await db.doc("experiments/study").get()).exists).toBe(true);
  });
  test("publication attempts are readable only by their owner and never writable by clients", async () => {
    await db
      .doc("experiments/study/publication_attempts/attempt")
      .set({ status: "preparing" });
    expect(
      (await client("GET", undefined, "alice", "/publication_attempts/attempt"))
        .status,
    ).toBe(200);
    expect(
      (await client("GET", undefined, "bob", "/publication_attempts/attempt"))
        .status,
    ).toBe(403);
    expect(
      (
        await client(
          "PATCH",
          { status: { stringValue: "published" } },
          "alice",
          "/publication_attempts/attempt?updateMask.fieldPaths=status",
        )
      ).status,
    ).toBe(403);
  });
  test("a pending first publication cannot be activated directly by its owner", async () => {
    await db
      .doc("experiments/study")
      .update({
        active: false,
        provisioningState: "ready",
        initialPublicationPending: true,
      });
    expect(
      (
        await client(
          "PATCH",
          { active: { booleanValue: true } },
          "alice",
          "?updateMask.fieldPaths=active",
        )
      ).status,
    ).toBe(403);
  });
  test("real concurrent transactions reserve exactly one owner before either callback can mutate providers", async () => {
    await db.doc("experiments/race").delete();
    const effects = [];
    const outcomes = await Promise.allSettled(
      ["alice", "bob"].map((uid) =>
        withMutation(
          {
            experimentID: "race",
            uid,
            operation: "prepare",
            initialData: {
              owner: uid,
              active: false,
              provisioningState: "preparing",
            },
          },
          async () => {
            effects.push(uid);
          },
        ),
      ),
    );
    expect(
      outcomes.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      outcomes.find((result) => result.status === "rejected").reason.code,
    ).toBe("EXPERIMENT_FORBIDDEN");
    expect(effects).toHaveLength(1);
    expect((await db.doc("experiments/race").get()).data().owner).toBe(
      effects[0],
    );
  });
});
