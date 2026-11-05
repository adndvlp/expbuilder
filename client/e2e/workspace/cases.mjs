export async function runCases({
  page,
  expect,
  assert,
  run,
  state,
  reset,
  base,
  handles,
  firstEdgePoint,
  dragTo,
}) {
  await run(
    "actual canvas renders edges, a single start and persistent free-trial action",
    async () => {
      await expect(page.locator(".react-flow__edge")).toHaveCount(2);
      await expect(page.locator(".node-status-badge--start")).toHaveCount(1);
      await expect(page.getByTitle("Add trial", { exact: true })).toBeVisible();
    },
  );
  await run(
    "a real handle gesture persists a Default and survives reload",
    async () => {
      await handles(3, 4);
      await expect
        .poll(
          async () =>
            (await state()).trials.find((t) => t.id === 3).defaultNextTrialId,
        )
        .toBe(4);
      await page.reload();
      await expect(page.getByTestId("item-4")).toBeVisible();
      await expect(page.locator(".react-flow__edge")).toHaveCount(3);
    },
  );
  await run(
    "edge selection exposes both white reconnection icons and Delete removes its source rules",
    async () => {
      const path = page.locator(".react-flow__edge-path").last(),
        point = await path.evaluate((p) => {
          const v = p
            .getPointAtLength(p.getTotalLength() / 2)
            .matrixTransform(p.getScreenCTM());
          return { x: v.x, y: v.y };
        });
      await page.mouse.click(point.x, point.y);
      await expect(page.locator(".edge-reconnect-icon")).toHaveCount(2);
      await expect(
        page.locator(".edge-reconnect-icon path").first(),
      ).toHaveAttribute("stroke", "#fff");
      await page.keyboard.press("Backspace");
      await expect
        .poll(
          async () =>
            (await state()).trials.find((t) => t.id === 3).branches.length,
        )
        .toBe(0);
    },
  );
  await run(
    "undo restores the connection through a persisted command",
    async () => {
      await page.keyboard.press("Meta+z");
      await expect
        .poll(
          async () =>
            (await state()).trials.find((t) => t.id === 3).defaultNextTrialId,
        )
        .toBe(4);
    },
  );
  await run(
    "double click enters multi selection and body clicks toggle checkboxes",
    async () => {
      await page.getByTestId("item-2").dblclick();
      await expect(
        page.getByRole("checkbox", { name: "Select Ensayo A" }),
      ).toBeChecked();
      await page.getByTestId("item-3").click();
      await expect(
        page.getByRole("checkbox", { name: "Select Final" }),
      ).toBeChecked();
    },
  );
  await run(
    "selected connected trials create a real loop without a range modal",
    async () => {
      await page.getByTitle("Add loop", { exact: true }).click();
      await expect.poll(async () => (await state()).loops.length).toBe(1);
      const s = await state();
      assert.equal(s.loops[0].repetitions, 1);
      assert.deepEqual(s.loops[0].trials, [2, 3]);
    },
  );

  await run(
    "clipboard pastes the induced graph, preserves isolated selections and uses unique names",
    async () => {
      await reset(base());
      await page.getByTestId("item-1").dblclick();
      await page.getByTestId("item-2").click();
      await page.getByTestId("item-4").click();
      await page.keyboard.press("Meta+c");
      await page.keyboard.press("Meta+v");
      await expect.poll(async () => (await state()).trials.length).toBe(7);
      const s = await state(),
        copies = s.trials.slice(4);
      assert.equal(copies[0].defaultNextTrialId, copies[1].id);
      assert.equal(copies[1].defaultNextTrialId, null);
      assert.equal(copies[2].defaultNextTrialId, null);
      await expect(page.getByTitle("Undo")).toBeEnabled();
      await page.keyboard.press("Meta+v");
      await expect.poll(async () => (await state()).trials.length).toBe(10);
      assert.equal(new Set((await state()).trials.map((t) => t.name)).size, 10);
    },
  );
  await run(
    "rectangle selection ignores zero area and selects on a small intersection",
    async () => {
      await reset(base());
      await page.mouse.click(1450, 950);
      await expect(
        page.locator(".node-selection-control input:checked"),
      ).toHaveCount(0);
      const box = await page.getByTestId("item-1").boundingBox();
      await page.mouse.move(box.x - 10, box.y - 10);
      await page.mouse.down();
      await page.mouse.move(box.x + 2, box.y + 2, { steps: 12 });
      await page.mouse.up();
      await expect(
        page.getByRole("checkbox", { name: "Select Inicio" }),
      ).toBeChecked();
    },
  );
  for (const mode of ["sequential", "parallel"])
    await run(
      "ghost " + mode + " preview commits the matching Default/Then topology",
      async () => {
        await reset(base());
        const point = await firstEdgePoint();
        await dragTo(4, {
          x: point.x + (mode === "parallel" ? 55 : 0),
          y: point.y,
        });
        await expect(page.locator(".workspace-ghost")).toHaveCount(1);
        await expect(page.locator(".insertion-preview")).toContainText(
          mode === "parallel" ? "paralelo" : "secuencial",
        );
        await page.mouse.up();
        await expect
          .poll(async () =>
            (await state()).trials.find((t) => t.id === 1).branches.includes(4),
          )
          .toBe(true);
        const s = await state();
        assert.equal(
          s.trials[0].defaultNextTrialId,
          mode === "parallel" ? 2 : 4,
        );
        assert.equal(
          s.trials[3].defaultNextTrialId,
          mode === "parallel" ? null : 2,
        );
      },
    );
  await run(
    "partial convergence moves without moving the active structure and reload preserves it",
    async () => {
      const s = base();
      s.trials[3].defaultNextTrialId = 3;
      s.trials[3].branches = [3];
      await reset(s);
      const active = await page.getByTestId("item-1").boundingBox(),
        free = await page.getByTestId("item-4").boundingBox();
      await dragTo(4, {
        x: free.x + free.width / 2 + 120,
        y: free.y + free.height / 2 + 100,
      });
      await page.mouse.up();
      await expect(page.getByTitle("Undo")).toBeEnabled();
      await expect
        .poll(
          async () =>
            Object.keys((await state()).editorLayout?.positionsByItemId ?? {})
              .length,
        )
        .toBe(4);
      const moved = await page.getByTestId("item-4").boundingBox();
      assert.ok(moved.x > free.x + 90);
      assert.equal(
        (await page.getByTestId("item-1").boundingBox()).x,
        active.x,
      );
      await page.reload();
      await expect(page.getByTestId("item-4")).toBeVisible();
    },
  );
  await run(
    "loop connection offers level then placement; cancelling is read-only",
    async () => {
      await reset(base());
      await page.getByTestId("item-2").dblclick();
      await page.getByTestId("item-3").click();
      await page.getByTitle("Add loop", { exact: true }).click();
      await expect.poll(async () => (await state()).loops.length).toBe(1);
      const s = await state(),
        loop = s.loops[0];
      await page
        .getByTestId("item-" + loop.id)
        .getByTitle("Expand loop")
        .click();
      await expect(page.getByTestId("item-2")).toBeVisible();
      await page.waitForTimeout(350);
      const before = await state();
      await handles(2, 4);
      await expect(
        page.getByText("Select branch level", { exact: true }),
      ).toBeVisible();
      await page
        .getByRole("checkbox", { name: loop.name, exact: true })
        .check();
      await page.getByRole("button", { name: "Continue", exact: true }).click();
      await expect(
        page.getByText("Connect Existing Trial", { exact: true }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Cancel", exact: true }).click();
      assert.deepEqual(await state(), before);
      await handles(2, 4);
      await page
        .getByRole("checkbox", { name: loop.name, exact: true })
        .check();
      await page.getByRole("button", { name: "Continue", exact: true }).click();
      await page
        .getByRole("button", { name: "As Branch (Parallel)", exact: true })
        .click();
      await expect
        .poll(
          async () =>
            (await state()).trials.find((t) => t.id === 4).parentLoopId,
        )
        .toBe(loop.id);
    },
  );
  await page.screenshot({
    path: "/private/tmp/workspace-production-canvas.png",
  });
}
