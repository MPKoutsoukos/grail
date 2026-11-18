import { useState } from 'react'
import { Linking, ScrollView, Switch, Text, View } from 'react-native'
import Constants from 'expo-constants'
import { PRESETS, type Theme } from '@grail/core'
import { Card, Divider, Eyebrow, Header, Press, Row, s } from '../ui'
import { F, useTheme, type ReadingFont } from '../theme'
import { Icon, Wordmark } from '../icons'
import type { Data, ReviewTemplate } from '../data'
import { LICENCE_TEXTS, NOTICES } from '../licences'
import { buildInfo } from '../env'
import { folderLabel } from '../store'

// Shown in the app and in the store listing; the page is the grail-site repo, hosted on GitHub Pages.
export const PRIVACY_URL = 'https://grailnotebook.com/privacy/'
export const CONTACT = 'hello@grailnotebook.com'
export const SOURCE_URL = 'https://github.com/MPKoutsoukos/grail'

// The About page's story, inspired by a talk on creativity as a system rather than a gift.
type Story = { title: string; text: string; inspiredBy: string; url: string }
const STORY: Story | null = {
  title: 'Why grail',
  text: [
    'Ideas rarely arrive when there is time for them. They turn up on a bus, half asleep, in the middle of something else, and land wherever is nearest: a line in some app, the back of a receipt, a voice memo nobody plays back. There was never a shortage of sparks. What was missing was a place for them to land, and to add up.',
    'Creativity isn’t a gift, it’s a system. You don’t wait for the one big idea; you build a place where small ones are kept, found again and set next to each other, until they turn into something.',
    'grail is that place. Every thought is a fragment, dated and left as it is. Tags gather the ones that belong together, and Read stitches them into one continuous text, so a month of scraps reads like a draft. Echoes bring an old one back just when you’d forgotten it. Nothing asks you to be brilliant on the spot; only to keep showing up and writing it down.',
    'The name is a small joke about the old idea of inspiration as a holy grail, searched for and never found. Here it’s a cup you fill, a little at a time.',
  ].join('\n\n'),
  inspiredBy: '“Creativity isn’t a gift, it’s a system” by Perry Daniels',
  url: 'https://www.youtube.com/watch?v=_QVYfPnNOg4',
}

const TEMPLATES: { id: ReviewTemplate; name: string; hint: string }[] = [
  { id: 'manuscript', name: 'Manuscript', hint: 'continuous prose' },
  { id: 'timeline', name: 'Timeline', hint: 'date markers' },
  { id: 'codex', name: 'Codex', hint: 'by tag' },
  { id: 'cards', name: 'Cards', hint: 'boxed' },
]

function Swatch({ t, on, onPress }: { t: Theme; on: boolean; onPress: () => void }) {
  const { c } = useTheme()
  return (
    <Press onPress={onPress} haptic style={{ width: '48%', borderRadius: 16, overflow: 'hidden', borderWidth: 2, borderColor: on ? c.accentLight : 'transparent' }}>
      <View style={{ backgroundColor: t.colors.ink, padding: 12 }}>
        <View style={{ height: 7, width: 40, borderRadius: 4, backgroundColor: t.colors.paper, marginBottom: 6 }} />
        <View style={{ height: 7, width: 64, borderRadius: 4, backgroundColor: t.colors.paperDimmer, marginBottom: 10 }} />
        <View style={[s.row, { gap: 6 }]}>
          {[t.colors.accent, t.colors.accentLight, t.colors.inkSurface2].map((x) => <View key={x} style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: x }} />)}
        </View>
      </View>
      <Text style={{ backgroundColor: c.inkSurface, color: c.paper, fontFamily: F.sans, fontSize: 12.5, paddingHorizontal: 12, paddingVertical: 6 }}>{t.name}</Text>
    </Press>
  )
}

export function SettingsScreen({ data, onBack, onOpenAbout, onOpenHome, onOpenTour }: {
  data: Data; onBack: () => void; onOpenAbout: () => void; onOpenHome: () => void; onOpenTour: () => void
}) {
  const { c } = useTheme()
  const st = data.settings
  const presets = PRESETS.some((p) => p.id === st.theme.id) ? PRESETS : [...PRESETS, st.theme]
  const where = folderLabel(data.folder)
  return (
    <View style={{ flex: 1, backgroundColor: c.ink }}>
      <Header title="Settings" onBack={onBack} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60, gap: 8 }}>
        <Eyebrow style={{ marginLeft: 4 }}>Your notes</Eyebrow>
        <Card style={{ marginBottom: 18 }}>
          <Row icon={<Icon.library color={c.paperDim} />} title="Home folder" hint={`${where.title}\n${where.detail}`}
            right={<Icon.chevronRight color={c.paperDimmer} size={18} />} onPress={onOpenHome} />
          <Divider />
          <Row icon={<Icon.sparkle color={c.paperDim} />} title="Show the tour" hint="The four-step introduction from the first start"
            right={<Icon.chevronRight color={c.paperDimmer} size={18} />} onPress={onOpenTour} />
        </Card>

        <Eyebrow style={{ marginLeft: 4 }}>Theme</Eyebrow>
        <Card style={{ padding: 12, marginBottom: 18 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 }}>
            {presets.map((t) => <Swatch key={t.id} t={t} on={st.theme.id === t.id} onPress={() => data.updateSetting('theme', t)} />)}
          </View>
        </Card>

        <Eyebrow style={{ marginLeft: 4 }}>Reading</Eyebrow>
        <Card style={{ padding: 12, marginBottom: 18, gap: 12 }}>
          <View style={[s.row, { gap: 8 }]}>
            {([['serif', F.serif], ['sans', F.sans], ['mono', F.mono]] as [ReadingFont, string][]).map(([id, face]) => (
              <Press key={id} onPress={() => data.updateSetting('readingFont', id)} haptic
                style={{ flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 14, backgroundColor: c.ink, borderWidth: 2, borderColor: st.readingFont === id ? c.accentLight : 'transparent' }}>
                <Text style={{ fontFamily: face, fontSize: 24, color: c.paper }}>Aa</Text>
                <Text style={{ fontFamily: F.sans, fontSize: 11.5, color: c.paperDimmer, textTransform: 'capitalize' }}>{id}</Text>
              </Press>
            ))}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {TEMPLATES.map((t) => (
              <Press key={t.id} onPress={() => data.updateSetting('reviewTemplate', t.id)} haptic
                style={{ width: '48%', padding: 12, borderRadius: 14, backgroundColor: c.ink, borderWidth: 2, borderColor: st.reviewTemplate === t.id ? c.accentLight : 'transparent' }}>
                <Text style={{ fontFamily: F.sansMedium, color: c.paper }}>{t.name}</Text>
                <Text style={{ fontFamily: F.sans, fontSize: 12, color: c.paperDimmer }}>{t.hint}</Text>
              </Press>
            ))}
          </View>
        </Card>

        <Card style={{ marginBottom: 18 }}>
          <Row icon={<Icon.sparkle color={c.paperDim} />} title="Echoes" hint="Resurface an older fragment on Browse"
            right={<Switch value={st.echoes} onValueChange={(v) => data.updateSetting('echoes', v)} trackColor={{ true: c.accent, false: c.inkSurface2 }} thumbColor={c.paper} />} />
          <Divider />
          <Row icon={<Icon.pen color={c.paperDim} />} title="Haptics" hint="A light tap on create and long-press"
            right={<Switch value={st.haptics} onValueChange={(v) => data.updateSetting('haptics', v)} trackColor={{ true: c.accent, false: c.inkSurface2 }} thumbColor={c.paper} />} />
          <Divider />
          <Row icon={<Icon.eye color={c.paperDim} />} title="Link previews" hint={st.linkPreviews ? 'Shown for every link: grail fetches the page by itself' : 'Off: tap Preview under a link, and grail asks first'}
            right={<Switch value={st.linkPreviews === true} onValueChange={(v) => data.updateSetting('linkPreviews', v)} trackColor={{ true: c.accent, false: c.inkSurface2 }} thumbColor={c.paper} />} />
        </Card>

        <Card>
          <Row icon={<Icon.read color={c.paperDim} />} title="About grail" hint="Your notes elsewhere, privacy, contact and licences"
            right={<Icon.chevronRight color={c.paperDimmer} size={18} />} onPress={onOpenAbout} />
        </Card>

        <View style={[s.row, { justifyContent: 'center', marginTop: 24 }]}>
          <Text style={{ fontFamily: F.sans, fontSize: 12, color: c.paperDimmer }}>Plain markdown, on your phone.</Text>
        </View>
      </ScrollView>
    </View>
  )
}

export function AboutScreen({ onBack, onOpenLicences }: { onBack: () => void; onOpenLicences: () => void }) {
  const { c } = useTheme()
  const version = Constants.expoConfig?.version ?? ''
  const { env, build } = buildInfo()
  const para = { fontFamily: F.serif, fontSize: 16.5, lineHeight: 26, color: c.paper }
  const step = (n: number, text: string) => (
    <View key={n} style={[s.row, { alignItems: 'flex-start', gap: 10 }]}>
      <Text style={{ fontFamily: F.mono, fontSize: 13, lineHeight: 21, color: c.accentLight, width: 16 }}>{n}</Text>
      <Text style={{ flex: 1, fontFamily: F.sans, fontSize: 14, lineHeight: 21, color: c.paperDim }}>{text}</Text>
    </View>
  )
  return (
    <View style={{ flex: 1, backgroundColor: c.ink }}>
      <Header title="About" onBack={onBack} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
        <View style={{ alignItems: 'center', marginVertical: 24 }}>
          <Wordmark size={46} color={c.accentLight} />
          <Text style={{ fontFamily: F.sans, fontSize: 13, color: c.paperDimmer, marginTop: 2 }}>
            Version {version}{build ? ` (build ${build})` : ''}{env !== 'prod' ? ` · ${env}` : ''}
          </Text>
          <Text style={{ fontFamily: F.sans, fontSize: 14, lineHeight: 21, color: c.paperDim, textAlign: 'center', marginTop: 10, maxWidth: 320 }}>
            Quiet notes that gather into one continuous read.
          </Text>
        </View>

        {STORY && (
          <>
            <Eyebrow style={{ marginLeft: 4, marginBottom: 8 }}>{STORY.title}</Eyebrow>
            <Card style={{ padding: 18, marginBottom: 18, gap: 12 }}>
              {STORY.text.split('\n\n').map((p, i) => <Text key={i} style={para}>{p}</Text>)}
              <Press onPress={() => void Linking.openURL(STORY.url)}>
                <Text style={{ fontFamily: F.sans, fontSize: 13, color: c.accentLight }}>Inspired by {STORY.inspiredBy}</Text>
              </Press>
            </Card>
          </>
        )}

        <Eyebrow style={{ marginLeft: 4, marginBottom: 8 }}>Your notes on Google Drive or a computer</Eyebrow>
        <Card style={{ padding: 16, marginBottom: 18, gap: 10 }}>
          <Text style={{ fontFamily: F.sans, fontSize: 14, lineHeight: 21, color: c.paperDim }}>
            grail keeps your notes on this phone. To have a copy in Google Drive, and so on your computer:
          </Text>
          {step(1, 'Open Read (or a tag’s read) and tap the download button, Save a snapshot.')}
          {step(2, 'Choose Save as PDF. grail keeps the PDF in your notes; tap Open.')}
          {step(3, 'Tap the PDF snapshot card: it opens in your PDF viewer.')}
          {step(4, 'In the viewer, tap Share (or Send a copy) and choose Drive, then Save. Pick a folder, for example one called grail.')}
          {step(5, 'On your computer, open drive.google.com, or the Google Drive folder if Google Drive for desktop is installed: the PDF is there.')}
          <Text style={{ fontFamily: F.sans, fontSize: 12.5, lineHeight: 19, color: c.paperDimmer }}>
            A snapshot is a copy of that moment, not a live sync: notes you write afterwards stay on the phone until you save a new snapshot. Uninstalling grail deletes the notes on this phone, so keep a recent snapshot somewhere safe.
          </Text>
        </Card>

        <Eyebrow style={{ marginLeft: 4, marginBottom: 8 }}>Your privacy</Eyebrow>
        <Card style={{ marginBottom: 18 }}>
          <Row icon={<Icon.key color={c.paperDim} />} title="Only on this phone"
            hint="Your notes, pictures and drawings are plain files in your home folder on this phone: grail's own, or the one you chose (Settings → Home folder). grail has no account, no server, no ads and no analytics." />
          <Divider />
          <Row icon={<Icon.eye color={c.paperDim} />} title="Online only for link previews"
            hint="The only time grail uses the internet is to show a link preview: when you ask, or for every link if you turn previews on in Settings. It then fetches that page (for YouTube, YouTube's description of the video) and keeps the preview on this phone. The website sees that request, as with any visit. Nothing about your notes is sent." />
          <Divider />
          <Row icon={<Icon.doc color={c.paperDim} />} title="Privacy policy" hint={PRIVACY_URL}
            right={<Icon.chevronRight color={c.paperDimmer} size={18} />} onPress={() => void Linking.openURL(PRIVACY_URL)} />
        </Card>

        <Card>
          <Row icon={<Icon.alert color={c.paperDim} />} title="Contact" hint={CONTACT}
            right={<Icon.chevronRight color={c.paperDimmer} size={18} />} onPress={() => void Linking.openURL(`mailto:${CONTACT}?subject=grail`)} />
          <Divider />
          <Row icon={<Icon.library color={c.paperDim} />} title="Licences" hint="The fonts, icons and libraries grail is built with"
            right={<Icon.chevronRight color={c.paperDimmer} size={18} />} onPress={onOpenLicences} />
        </Card>

        {/* The GPL asks apps with a screen to show these: copyright, licence, no warranty, where the source is. */}
        <Text style={{ fontFamily: F.sans, fontSize: 12, lineHeight: 18, color: c.paperDimmer, textAlign: 'center', marginTop: 24, paddingHorizontal: 8 }}>
          © 2026 MPKoutsoukos. grail is free software: you can share and change it under the GNU General Public
          License, version 3. It comes with no warranty. The grail name and look are trademarks.{'\n'}
          <Text style={{ color: c.accentLight }} onPress={() => void Linking.openURL(SOURCE_URL)}>Source code</Text>
          {' · '}
          <Text style={{ color: c.accentLight }} onPress={() => void Linking.openURL('https://www.gnu.org/licenses/gpl-3.0.html')}>GPL v3</Text>
        </Text>
      </ScrollView>
    </View>
  )
}

const LICENCE_NAMES: Record<string, string> = {
  MIT: 'MIT License', ISC: 'ISC License', 'OFL-1.1': 'SIL Open Font License 1.1',
}

export function LicencesScreen({ onBack }: { onBack: () => void }) {
  const { c } = useTheme()
  const [open, setOpen] = useState<string | null>(null)
  const groups = Object.keys(LICENCE_NAMES).map((id) => ({ id, items: NOTICES.filter((n) => n.licence === id) })).filter((g) => g.items.length)
  return (
    <View style={{ flex: 1, backgroundColor: c.ink }}>
      <Header title="Licences" onBack={onBack} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
        <Text style={{ fontFamily: F.sans, fontSize: 13, lineHeight: 19, color: c.paperDim, marginBottom: 16, marginLeft: 4 }}>
          grail is built with these open-source fonts, icons and libraries. Their copyright notices and licences follow, as their authors require. Thank you to everyone who made them.
        </Text>
        {groups.map(({ id, items }) => (
          <View key={id} style={{ marginBottom: 18 }}>
            <Eyebrow style={{ marginLeft: 4, marginBottom: 8 }}>{LICENCE_NAMES[id]}</Eyebrow>
            <Card>
              {items.map((n, i) => (
                <View key={n.name}>
                  {i > 0 && <Divider />}
                  <Row title={n.name} hint={n.copyright || LICENCE_NAMES[id]} />
                </View>
              ))}
              <Divider />
              <Row title={open === id ? 'Hide the licence text' : 'Read the licence text'}
                right={open === id ? <Icon.chevronUp color={c.paperDimmer} size={18} /> : <Icon.chevronDown color={c.paperDimmer} size={18} />}
                onPress={() => setOpen(open === id ? null : id)} />
              {open === id && (
                <Text selectable style={{ fontFamily: F.mono, fontSize: 11.5, lineHeight: 17, color: c.paperDim, padding: 16, paddingTop: 4 }}>
                  {LICENCE_TEXTS[id]}
                </Text>
              )}
            </Card>
          </View>
        ))}
      </ScrollView>
    </View>
  )
}
