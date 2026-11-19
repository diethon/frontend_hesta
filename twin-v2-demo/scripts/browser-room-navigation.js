async page => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('http://127.0.0.1:5178/')
  await page.locator('.room-label').nth(5).waitFor({ state: 'visible', timeout: 20000 })
  const results = []
  const inspectScene = () => page.evaluate(async () => {
    // Read the existing development renderer for diagnostics; no production hook.
    const url = performance.getEntriesByType('resource').map(entry => entry.name).find(name => name.includes('/@react-three_fiber.js'))
    const fiber = await import(url)
    const canvas = document.querySelector('canvas')
    const { camera, controls, scene } = fiber._roots.get(canvas).store.getState()
    const geometry = []
    scene.traverse(object => {
      if (!object.isMesh || !object.geometry?.attributes.position) return
      const positions = object.geometry.attributes.position.array
      let sum = 0
      for (let i = 0; i < positions.length; i++) sum += positions[i] * ((i % 13) + 1)
      geometry.push({ id: object.uuid, sum, scale: object.scale.toArray() })
    })
    const e = camera.matrixWorld.elements
    const dot = (a, b) => e[a] * e[b] + e[a + 1] * e[b + 1] + e[a + 2] * e[b + 2]
    return { geometry, polar: controls.getPolarAngle(), up: camera.up.toArray(), projectionAspect: (camera.right - camera.left) / (camera.top - camera.bottom), canvasAspect: canvas.clientWidth / canvas.clientHeight, axes: [dot(0, 0), dot(4, 4), dot(8, 8), dot(0, 4), dot(0, 8), dot(4, 8)] }
  })
  const assertProjection = state => {
    if (Math.abs(state.projectionAspect - state.canvasAspect) > .001) throw new Error('Canvas/camera aspect mismatch')
    if (state.polar < Math.PI / 5 - .001 || state.polar > Math.PI * .36 + .001) throw new Error('Orbit reached an extreme tilt')
    if (JSON.stringify(state.up) !== '[0,1,0]') throw new Error('Camera vertical axis changed')
    if (state.axes.some((value, i) => Math.abs(value - (i < 3 ? 1 : 0)) > .001)) throw new Error('Camera basis is distorted')
  }
  for (const name of ['Phòng khách', 'Phòng ngủ', 'Phòng bếp', 'Phòng tắm', 'Phòng làm việc', 'Sân vườn & garage']) {
    await page.getByRole('button', { name, exact: true }).click()
    await page.waitForTimeout(800)
    const back = page.getByRole('button', { name: 'Quay lại toàn cảnh', exact: false })
    await back.waitFor({ state: 'visible' })
    const reachable = await back.evaluate(el => { const box = el.getBoundingClientRect(); return box.height >= 44 && el.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)) })
    if (!reachable) throw new Error('Return control is covered or too small: ' + name)
    await back.click()
    await page.locator('.room-label').nth(5).waitFor({ state: 'visible' })
    results.push('Room return: ' + name)
  }
  await page.getByRole('button', { name: 'Phòng ngủ', exact: true }).click()
  await page.waitForTimeout(800)
  const baseline = await inspectScene()
  assertProjection(baseline)
  await page.getByRole('button', { name: 'Xoay mô hình', exact: true }).click()
  const box = await page.locator('canvas').boundingBox()
  for (const [dx, dy] of [[.32, .3], [-.32, -.3], [.3, -.3], [-.3, .3]]) {
    await page.mouse.move(box.x + box.width * .5, box.y + box.height * .6)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width * (.5 + dx), box.y + box.height * (.6 + dy), { steps: 20 })
    await page.mouse.up()
    await page.waitForTimeout(650)
    const state = await inspectScene()
    assertProjection(state)
    if (JSON.stringify(state.geometry) !== JSON.stringify(baseline.geometry)) throw new Error('Furniture shape/scale changed while rotating')
  }
  await page.screenshot({ path: 'output/playwright/room-rotation-fixed.png' })
  results.push('Four strong rotations: aspect, camera basis, geometry and scale unchanged')
  await page.keyboard.press('Escape')
  await page.locator('.room-label').nth(5).waitFor({ state: 'visible' })
  results.push('Escape returns to overview')
  await page.getByRole('button', { name: 'Phòng ngủ', exact: true }).click()
  await page.getByRole('button', { name: 'Hướng dẫn', exact: true }).click()
  await page.keyboard.press('Escape')
  if (await page.locator('.room-label').count() !== 1) throw new Error('Closing help incorrectly exits the room')
  results.push('Help Escape does not exit room')
  await page.setViewportSize({ width: 320, height: 740 })
  const back = page.getByRole('button', { name: 'Quay lại toàn cảnh', exact: false })
  await back.waitFor({ state: 'visible' })
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error('Mobile horizontal overflow')
  const reachable = await back.evaluate(el => { const box = el.getBoundingClientRect(); return box.height >= 44 && el.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)) })
  if (!reachable) throw new Error('Mobile return button is covered')
  await back.click()
  await page.getByRole('button', { name: 'Phòng ngủ', exact: true }).click()
  await page.waitForTimeout(800)
  assertProjection(await inspectScene())
  await page.screenshot({ path: 'output/playwright/room-return-mobile.png', fullPage: true })
  results.push('320px return control visible, reachable, no overflow')
  await back.click()
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.getByRole('button', { name: 'Phòng ngủ', exact: true }).click()
  await page.waitForTimeout(800)
  await page.screenshot({ path: 'output/playwright/room-return-desktop.png' })
  return { passed: results }
}
