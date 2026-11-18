import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseFrontmatter, stringifyFrontmatter } from './frontmatter.ts'
import { markdownToNote, noteToMarkdown, excerpt, type Note } from './note.ts'

// What gray-matter (js-yaml) wrote for grail notes before the redo.
const GRAY = `---
id: '1718267361000'
type: text
title: '2026-06-13 14:02'
tags:
  - worldbuilding
  - npcs
created: 1718267361000
updated: 1718270000000
drawingPath: 1718267361000.png
---
Built beneath the tidewall, its shelves are read only at low water… #npcs
`

test('reads notes gray-matter wrote', () => {
  const n = markdownToNote('1718267361000.md', GRAY)
  assert.equal(n.id, '1718267361000')
  assert.equal(n.title, '2026-06-13 14:02')
  assert.deepEqual(n.tags, ['worldbuilding', 'npcs'])
  assert.equal(n.created, 1718267361000)
  assert.equal(n.drawingPath, '1718267361000.png')
  assert.equal(n.body, 'Built beneath the tidewall, its shelves are read only at low water… #npcs')
})

test('reads flow lists, double quotes, CRLF, empty lists and bare keys', () => {
  const { data, body } = parseFrontmatter('---\r\nid: "42"\r\ntags: [a, "b, c", \'d\']\r\nempty: []\r\nnothing:\r\ntitle: "#places"\r\n---\r\n\r\nhello\r\n')
  assert.deepEqual(data, { id: '42', tags: ['a', 'b, c', 'd'], empty: [], nothing: null, title: '#places' })
  assert.equal(body.trim(), 'hello')
})

test('a file without frontmatter is all body', () => {
  assert.deepEqual(parseFrontmatter('# just markdown\n'), { data: {}, body: '# just markdown\n' })
})

test('round-trips tricky titles and bodies', () => {
  const titles = ['#places', '2026-06-13 14:02', 'Names: I keep losing', "it's 'quoted'", '  padded ', 'true', '123',
    'Ελληνικά', 'a # not a comment', '[bracketed]', 'emoji ✦', '- dash first', 'line"quote']
  for (const title of titles) {
    const n: Note = { id: '1', type: 'text', title, body: '---\nnot frontmatter\n---', tags: ['x'], created: 1, updated: 2 }
    const back = markdownToNote('1.md', noteToMarkdown(n))
    assert.equal(back.title, title, `title ${JSON.stringify(title)}`)
    assert.equal(back.body, n.body)
    assert.deepEqual(back.tags, ['x'])
  }
})

test('writes YAML other tools read: ids stay strings', () => {
  const out = stringifyFrontmatter({ id: '1718267361000', n: 5, ok: true, tags: [] }, 'body')
  assert.match(out, /^---\nid: "1718267361000"\nn: 5\nok: true\ntags: \[\]\n---\nbody\n$/)
})

test('excerpts skip markdown and tags', () => {
  assert.equal(excerpt('## The tidewarden\n\nEvery door #npcs'), 'The tidewarden')
  assert.equal(excerpt('#lore #npcs\nCaptain Iry sold the chain #npcs'), 'Captain Iry sold the chain')
})

test('scenes: older drawings get a size that holds everything; fitting centres them', async () => {
  const { sceneSize, fitScene, parseScene } = await import('./scene.ts')
  const legacy = parseScene(JSON.stringify({ elements: [{ id: 'a', tool: 'pen', stroke: '#fff', strokeWidth: 4, points: [10, 10, 1200, 700] }] }))!
  assert.deepEqual(sceneSize(legacy, { w: 400, h: 800 }), { w: 1204, h: 800 })
  assert.deepEqual(sceneSize({ width: 390, height: 700, elements: [] }, { w: 1, h: 1 }), { w: 390, h: 700 })
  const f = fitScene({ w: 400, h: 800 }, { w: 1200, h: 800 })
  assert.equal(f.scale, 1)
  assert.equal(f.x, 400)
  assert.equal(f.y, 0)
  assert.equal(parseScene('not json'), null)
})

test('plain markdown from another app: dated by the file, tags from its text', () => {
  const n = markdownToNote('Shopping ideas.md', 'Some thoughts #Garden and #books\n', 1700000000000)
  assert.equal(n.id, 'Shopping ideas')
  assert.equal(n.created, 1700000000000)
  assert.equal(n.updated, 1700000000000)
  assert.deepEqual(n.tags, ['garden', 'books'])
  assert.equal(n.title, '')
})

test('a grail note keeps its own dates and tag list', () => {
  const n = markdownToNote('1718267361000.md', GRAY, 5)
  assert.equal(n.created, 1718267361000)
  assert.deepEqual(n.tags, ['worldbuilding', 'npcs'])
})

test('#deleted: hidden until asked for, and restorable', async () => {
  const { markDeleted, restoreNote, isDeleted, collectCategories, categoryPool } = await import('./note.ts')
  const { matchesText, matchesQuery } = await import('./filter.ts')
  const n = markdownToNote('1.md', GRAY)
  const d = markDeleted(n)
  assert.ok(isDeleted(d))
  assert.match(d.body, /\n\n#deleted$/)
  assert.equal(matchesText(d, ''), false)
  assert.equal(matchesText(d, 'tidewall'), false)
  assert.equal(matchesText(d, '#deleted'), true)
  assert.equal(matchesQuery(d, '#npcs'), false)
  assert.equal(matchesQuery(d, '#deleted'), true)
  assert.equal(matchesQuery(d, '#deleted #npcs'), false) // npcs membership is suspended while deleted
  assert.deepEqual(categoryPool([d], 'npcs'), [])
  assert.deepEqual(collectCategories([d, { ...n, id: '2' }]).map((t) => t.name), ['npcs', 'worldbuilding', 'deleted'])
  const r = restoreNote(d)
  assert.equal(isDeleted(r), false)
  assert.equal(r.body, n.body)
  assert.equal(matchesText(r, 'tidewall'), true)
})
