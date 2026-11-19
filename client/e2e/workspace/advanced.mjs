export async function runAdvanced({
  page,
  expect,
  assert,
  run,
  state,
  reset,
  base,
  firstEdgePoint,
}) {
  for (const end of ["source", "target"])
    await run(
      "reconnecting the " +
        end +
        " endpoint updates the real parent and preserves the selected edge",
      async () => {
        await reset(base());
        const point = await firstEdgePoint();
        await page.mouse.click(point.x, point.y);
        const icon = page.getByRole("img", {
          name:
            end === "source"
              ? "Drag to change parent"
              : "Drag to change destination",
          exact: true,
        });
        await expect(icon).toBeVisible();
        const from = await icon.boundingBox(),
          to = await page
            .getByTestId("item-4")
            .locator(
              '[data-handleid="' +
                (end === "source" ? "flow-source" : "flow-target") +
                '"]',
            )
            .boundingBox();
        await page.mouse.move(
          from.x + from.width / 2,
          from.y + from.height / 2,
        );
        await page.mouse.down();
        await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, {
          steps: 24,
        });
        await page.mouse.up();
        await expect
          .poll(
            async () =>
              (await state()).trials.find(
                (t) => t.id === (end === "source" ? 4 : 1),
              ).defaultNextTrialId,
          )
          .toBe(end === "source" ? 2 : 4);
        const s = await state();
        if (end === "source") assert.deepEqual(s.trials[0].branches, []);
        else assert.deepEqual(s.trials[0].branches, [4]);
      },
    );
  await run(
    "collapsed aggregate edges remain selectable and cannot be deleted or reconnected",
    async () => {
      const s = base();
      s.trials[0].branches = [2, 3];
      s.trials[0].branchConditions = [
        {
          id: 1,
          nextTrialId: 3,
          rules: [{ column: "response", op: "==", value: "yes" }],
        },
      ];
      await reset(s);
      await page.getByTestId("item-2").dblclick();
      await page.getByTestId("item-3").click();
      await page.getByTitle("Add loop", { exact: true }).click();
      await expect.poll(async () => (await state()).loops.length).toBe(1);
      await page.waitForTimeout(300);
      const before = await state(),
        point = await firstEdgePoint();
      await page.mouse.click(point.x, point.y);
      await expect(page.locator(".react-flow__edge.selected")).toHaveCount(1);
      await expect(page.locator(".edge-reconnect-icon")).toHaveCount(0);
      await expect(page.getByTitle("Delete selection")).toBeDisabled();
      await page.keyboard.press("Backspace");
      assert.deepEqual(await state(), before);
    },
  );
  await run(
    "panel Default shares the canvas destination and text editing does not delete the selected trial",
    async () => {
      await reset(base());
      await page.getByTestId("item-1").click();
      await page.getByTitle("Branches", { exact: true }).click();
      const selects = page.locator("select");
      await expect(selects.first()).toBeVisible();
      const option = await selects.first().locator("option").allTextContents();
      assert.ok(option.some((text) => text.includes("Ensayo A")));
      await selects.first().selectOption("4");
      await expect
        .poll(async () => (await state()).trials[0].defaultNextTrialId)
        .toBe(4);
      await page.keyboard.press("Backspace");
      assert.equal((await state()).trials.length, 4);
      await page
        .getByRole("button", { name: "Save configuration", exact: true })
        .click();
      await expect(page.locator(".react-flow__edge")).toHaveCount(2);
    },
  );
  await run(
    "deleting all selected trials leaves a working empty canvas and the next trial becomes its sole start",
    async () => {
      await reset(base());
      await page.getByTestId("item-1").dblclick();
      for (const id of [2, 3, 4]) await page.getByTestId("item-" + id).click();
      await page.keyboard.press("Backspace");
      await expect.poll(async () => (await state()).trials.length).toBe(0);
      assert.equal((await state()).entryItemId, null);
      await page.getByTitle("Add trial", { exact: true }).click();
      await expect.poll(async () => (await state()).trials.length).toBe(1);
      await expect(page.locator(".node-status-badge--start")).toHaveCount(1);
    },
  );
}
