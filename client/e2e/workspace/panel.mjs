export async function runPanel({
  page,
  expect,
  assert,
  run,
  state,
  reset,
  base,
  dragTo,
  firstEdgePoint,
}) {
  await run(
    "removing a Then in the real panel removes its edge and preserves Default",
    async () => {
      const s = base();
      s.trials[0].branches = [2, 4];
      s.trials[0].branchConditions = [
        { id: 1, kind: "route", nextTrialId: 4, rules: [] },
      ];
      await reset(s);
      await page.getByTestId("item-1").click();
      await page.getByTitle("Branches", { exact: true }).click();
      await expect(page.getByTitle("Remove condition")).toBeVisible();
      await page.getByTitle("Remove condition").click();
      await expect
        .poll(async () => (await state()).trials[0].branchConditions.length)
        .toBe(0);
      assert.deepEqual((await state()).trials[0].branches, [2]);
      await page
        .getByRole("button", { name: "Save configuration", exact: true })
        .click();
      await expect(page.locator(".react-flow__edge")).toHaveCount(2);
    },
  );
  await run(
    "Escape cancels a ghost without persisting a connection or a new history operation",
    async () => {
      await reset(base());
      const before = await state(),
        point = await firstEdgePoint();
      await dragTo(4, point);
      await expect(page.locator(".workspace-ghost")).toHaveCount(1);
      await page.keyboard.press("Escape");
      await page.mouse.up();
      await expect(page.locator(".workspace-ghost")).toHaveCount(0);
      assert.deepEqual(await state(), before);
      await expect(page.getByTitle("Undo")).toBeDisabled();
    },
  );
  await run(
    "trackpad-style wheel pan preserves selection and never starts a rectangle",
    async () => {
      await reset(base());
      await page.getByTestId("item-1").dblclick();
      const viewport = page.locator(".react-flow__viewport"),
        before = await viewport.getAttribute("style");
      await page.mouse.move(1200, 800);
      await page.mouse.wheel(150, 100);
      await expect.poll(() => viewport.getAttribute("style")).not.toBe(before);
      await expect(
        page.getByRole("checkbox", { name: "Select Inicio" }),
      ).toBeChecked();
      await expect(page.locator(".react-flow__selection")).toHaveCount(0);
    },
  );
  await run(
    "same-end connectors and loop markers cannot create user connections",
    async () => {
      await reset(base());
      const before = await state();
      for (const handle of ["flow-source", "flow-target"]) {
        const from = await page
            .getByTestId("item-1")
            .locator('[data-handleid="' + handle + '"]')
            .boundingBox(),
          to = await page
            .getByTestId("item-4")
            .locator('[data-handleid="' + handle + '"]')
            .boundingBox();
        await page.mouse.move(
          from.x + from.width / 2,
          from.y + from.height / 2,
        );
        await page.mouse.down();
        await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, {
          steps: 16,
        });
        await page.mouse.up();
      }
      assert.deepEqual(await state(), before);
      await page.getByTestId("item-2").dblclick();
      await page.getByTestId("item-3").click();
      await page.getByTitle("Add loop", { exact: true }).click();
      await expect.poll(async () => (await state()).loops.length).toBe(1);
      await page.waitForTimeout(300);
      const grouped = await state(),
        loop = grouped.loops[0],
        from = await page
          .getByTestId("item-" + loop.id)
          .locator('[data-handleid="flow-source"]')
          .boundingBox(),
        to = await page
          .getByTestId("item-4")
          .locator('[data-handleid="flow-target"]')
          .boundingBox();
      await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
      await page.mouse.down();
      await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, {
        steps: 16,
      });
      await page.mouse.up();
      assert.deepEqual(await state(), grouped);
    },
  );
}
