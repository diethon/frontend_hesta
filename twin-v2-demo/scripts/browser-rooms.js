async (page) => {
  const errors = []
  const assets = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('response', response => { if (/\/materials\/.*\.jpg/.test(response.url())) assets.push({ file: response.url().split('/').pop(), status: response.status() }) })
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('http://127.0.0.1:5178/')
  await page.locator('canvas').waitFor()
  await page.locator('.room-label').nth(5).waitFor({ state: 'visible', timeout: 20000 })
  await page.waitForTimeout(2200)
  await page.screenshot({ path: 'output/playwright/realism-overview-1920.png' })
  const rooms = [
    { id: 'living', name: 'Phòng khách' },
    { id: 'bedroom', name: 'Phòng ngủ' },
    { id: 'kitchen', name: 'Phòng bếp' },
    { id: 'bathroom', name: 'Phòng tắm' },
    { id: 'office', name: 'Phòng làm việc' },
  ]
  for (const room of rooms) {
    await page.getByRole('button', { name: room.name, exact: true }).click()
    await page.waitForTimeout(950)
    if (!(await page.getByRole('heading', { name: room.name, exact: true }).isVisible())) throw new Error('Wrong active room: ' + room.id)
    if (await page.locator('.room-label').count() !== 1) throw new Error('Detail view contains unrelated room labels')
    await page.screenshot({ path: 'output/playwright/realism-' + room.id + '.png' })
  }
  await page.getByRole('button', { name: 'Phòng ngủ', exact: true }).click()
  await page.getByRole('button', { name: 'Chuyển sang ban đêm', exact: true }).click()
  await page.waitForTimeout(1000)
  await page.screenshot({ path: 'output/playwright/realism-bedroom-night.png' })
  const before = await page.locator('canvas').screenshot()
  await page.getByRole('switch', { name: 'Bật/tắt Đèn phòng ngủ', exact: true }).click()
  await page.waitForTimeout(900)
  const after = await page.locator('canvas').screenshot()
  if (before.toString('base64') === after.toString('base64')) throw new Error('Bedroom fixture does not respond in 3D')
  await page.getByRole('switch', { name: 'Bật/tắt Đèn phòng ngủ', exact: true }).click()
  await page.getByRole('button', { name: 'Chuyển sang ban ngày', exact: true }).click()
  await page.getByRole('button', { name: 'Đặt lại camera', exact: true }).click()
  await page.waitForTimeout(850)
  if (await page.locator('.room-label').count() !== 6) throw new Error('Reset did not restore overview labels')
  if (errors.length) throw new Error(JSON.stringify(errors))
  const decoded = await page.evaluate(async () => Promise.all(['wood_table_001_nor_gl.jpg', 'wood_table_001_rough.jpg', 'denim_fabric_nor_gl.jpg', 'denim_fabric_rough.jpg'].map(async file => {
    const image = new Image()
    image.src = '/materials/' + file
    await image.decode()
    return { file, width: image.naturalWidth, height: image.naturalHeight }
  })))
  if (decoded.some(image => image.width < 512)) throw new Error('Local scanned material cannot be decoded')
  return { rooms: rooms.map(room => room.id), detailView: 'PASS', bedroomLight: 'PASS', resetOverview: 'PASS', assets, decoded, errors }
}
