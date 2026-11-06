import request from "supertest";

export async function inspectAndRestore(app, buffer) {
  const inspected = await request(app)
    .post("/api/import-experiments/inspect")
    .attach("zipfile", buffer, "backup.zip");
  if (inspected.status !== 200) return inspected;
  return request(app)
    .post(`/api/import-experiments/${inspected.body.importID}/apply`)
    .send({ mode: "restore", replaceExisting: true });
}
