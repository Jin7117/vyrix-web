import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  Animated, Easing, Image, Pressable, ScrollView, StyleSheet, Text, View,
  useWindowDimensions as useRawDimensions, ViewStyle, StyleProp, Linking, Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { Ionicons } from '@expo/vector-icons';

const Y = '#FCD400';
const BK = '#000';
const W = '#fff';
const F = {
  display: 'Unbounded_800ExtraBold',
  r: 'PlusJakartaSans_400Regular',
  m: 'PlusJakartaSans_500Medium',
  sb: 'PlusJakartaSans_600SemiBold',
  b: 'PlusJakartaSans_700Bold',
  bi: 'PlusJakartaSans_700Bold_Italic',
};
// Desktop web renders at 80% (like browser zoom 80%). Layout code sees the zoomed-out CSS width.
// Height and measureInWindow stay in on-screen px; scroll offsets are CSS px (divide screen px by the zoom).
const zoomFor = (w: number) => (Platform.OS === 'web' && w >= 768 ? 0.8 : 1);
function useWindowDimensions() {
  const { width, height } = useRawDimensions();
  return { width: width / zoomFor(width), height };
}
const ND = true; // useNativeDriver — ignored on web, real perf win on device

/* ---------- scroll-reveal plumbing ---------- */
type Check = (vh: number) => void;
const RevealCtx = createContext<{ add: (c: Check) => () => void; vh: number }>({ add: () => () => {}, vh: 800 });

function useReveal(delay = 0) {
  const { add, vh } = useContext(RevealCtx);
  const ref = useRef<any>(null);
  const v = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState(false);
  useEffect(() => {
    let done = false;
    const check: Check = (h) => {
      if (done) return;
      ref.current?.measureInWindow((_x: number, y: number) => {
        if (!done && y < h * 0.88) {
          done = true;
          setShown(true);
          Animated.timing(v, { toValue: 1, duration: 750, delay, easing: Easing.out(Easing.cubic), useNativeDriver: ND }).start();
          off();
        }
      });
    };
    const off = add(check);
    const t = setTimeout(() => check(vh), 60);
    return () => { clearTimeout(t); off(); };
  }, []);
  return { ref, v, shown };
}

function Reveal({ children, delay = 0, from = 40, style }: { children: React.ReactNode; delay?: number; from?: number; style?: StyleProp<ViewStyle> }) {
  const { ref, v } = useReveal(delay);
  return (
    <Animated.View ref={ref} style={[style, {
      opacity: v,
      transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [from, 0] }) }],
    }]}>
      {children}
    </Animated.View>
  );
}

/* ---------- small building blocks ---------- */
function useHover(scaleTo = 1.04, lift = 0) {
  const v = useRef(new Animated.Value(0)).current;
  const go = (to: number) => Animated.spring(v, { toValue: to, useNativeDriver: ND, friction: 6, tension: 120 }).start();
  return {
    handlers: { onHoverIn: () => go(1), onHoverOut: () => go(0), onPressIn: () => go(-0.6), onPressOut: () => go(0) },
    style: {
      transform: [
        { scale: v.interpolate({ inputRange: [-1, 0, 1], outputRange: [2 - scaleTo, 1, scaleTo] }) },
        { translateY: v.interpolate({ inputRange: [-1, 0, 1], outputRange: [0, 0, -lift] }) },
      ],
    },
  };
}

function Btn({ label, bg, color, onPress, style }: { label: string; bg: string; color: string; onPress?: () => void; style?: StyleProp<ViewStyle> }) {
  const h = useHover(1.05);
  return (
    <Pressable {...h.handlers} onPress={onPress} accessibilityRole="button">
      <Animated.View style={[s.btn, { backgroundColor: bg }, h.style, style]}>
        <Text style={[s.btnText, { color }]}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

function NavLink({ label, bold, onPress }: { label: string; bold?: boolean; onPress?: () => void }) {
  const v = useRef(new Animated.Value(0)).current;
  const go = (to: number) => Animated.timing(v, { toValue: to, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: ND }).start();
  return (
    <Pressable onHoverIn={() => go(1)} onHoverOut={() => go(0)} onPress={onPress} accessibilityRole="link">
      <Text style={[s.nav, bold && { fontFamily: F.b }]}>{label}</Text>
      <Animated.View style={[s.navLine, { transform: [{ scaleX: v }] }]} />
    </Pressable>
  );
}

// Right-angle triangles used for the "folder tab" diagonals and chamfered corners.
const Tri = ({ w, h, color, dir }: { w: number; h: number; color: string; dir: 'bl' | 'tr' | 'tl' | 'br' }) => {
  const t = 'transparent';
  const m: Record<string, ViewStyle> = {
    bl: { borderBottomWidth: h, borderBottomColor: color, borderRightWidth: w, borderRightColor: t }, // ◣
    tr: { borderTopWidth: h, borderTopColor: color, borderLeftWidth: w, borderLeftColor: t },         // ◥
    tl: { borderTopWidth: h, borderTopColor: color, borderRightWidth: w, borderRightColor: t },       // ◤
    br: { borderBottomWidth: h, borderBottomColor: color, borderLeftWidth: w, borderLeftColor: t },   // ◢
  };
  return <View style={[{ width: 0, height: 0 }, m[dir]]} />;
};

// Card shape: top-left tab + diagonal, body, bottom-right tab + diagonal.
function Folder({ color, tabW, tabH, bottomH = tabH, diag, bottomW, topLeft, topRight, bottomRight, children, bodyStyle }: {
  color: string; tabW: number; tabH: number; bottomH?: number; diag: number; bottomW: number;
  topLeft?: React.ReactNode; topRight?: React.ReactNode; bottomRight?: React.ReactNode;
  children: React.ReactNode; bodyStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <View>
      <View style={{ flexDirection: 'row', height: tabH }}>
        <View style={{ width: tabW, backgroundColor: color, borderTopLeftRadius: 28, justifyContent: 'center' }}>{topLeft}</View>
        <View style={{ marginLeft: -1 }}><Tri w={diag} h={tabH + 1} color={color} dir="bl" /></View>
        <View style={{ flex: 1, justifyContent: 'center' }}>{topRight}</View>
      </View>
      <View style={[{ backgroundColor: color, borderTopRightRadius: 28, borderBottomLeftRadius: 28, marginTop: -1 }, bodyStyle]}>{children}</View>
      <View style={{ flexDirection: 'row', height: bottomH, marginTop: -1 }}>
        <View style={{ flex: 1 }} />
        <View style={{ marginRight: -1, zIndex: 1 }}><Tri w={diag} h={bottomH} color={color} dir="tr" /></View>
        <View style={{ width: bottomW, backgroundColor: color, borderBottomRightRadius: 28, alignItems: 'center', justifyContent: 'center' }}>{bottomRight}</View>
      </View>
    </View>
  );
}

function Chamfer({ color, cut = 34, children, style, delay = 0 }: { color: string; cut?: number; children: React.ReactNode; style?: StyleProp<ViewStyle>; delay?: number }) {
  const h = useHover(1.025, 10);
  return (
    <Reveal delay={delay} style={style}>
      <Pressable {...h.handlers} style={{ flex: 1 }}>
        <Animated.View style={[{ backgroundColor: color, flex: 1 }, h.style]}>
          {children}
          <View style={{ position: 'absolute', top: 0, right: 0 }}><Tri w={cut} h={cut} color={BK} dir="tr" /></View>
          <View style={{ position: 'absolute', bottom: 0, left: 0 }}><Tri w={cut} h={cut} color={BK} dir="bl" /></View>
        </Animated.View>
      </Pressable>
    </Reveal>
  );
}

function CountUp({ to, suffix, style }: { to: number; suffix: string; style: any }) {
  const { ref, shown } = useReveal();
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!shown) return;
    const v = new Animated.Value(0);
    const id = v.addListener(({ value }) => setN(Math.round(value)));
    Animated.timing(v, { toValue: to, duration: 1600, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    return () => v.removeListener(id);
  }, [shown]);
  return <View ref={ref}><Text style={style}>{n}{suffix}</Text></View>;
}

/* ---------- content ---------- */
const PROBLEMS = [
  ['01', 'Too much to organise', 'Notes, screenshots, documents and tabs. Finding the right info takes time you don’t have.'],
  ['02', 'Not sure what’s next', 'Many ideas and unfinished tasks, but no clear view of what deserves attention first.'],
  ['03', 'Gaps you haven’t spotted', 'Are your insights strong enough? Have you missed an assumption or a user need?'],
  ['04', 'Running out of time', 'Research to finish, decisions to make, work to present. Everything feels urgent.'],
];
const FEATURES: [string, string, string, string[], string][] = [
  ['01', 'Project Roadmap', 'Turn goals into a clearer path and see what needs attention next.', ['Work through defined project phases', 'Track progress and pending actions', 'AI-assisted next-step suggestions'], Y],
  ['02', 'Flow : Project Based repository', 'A dynamic space for your project resources, always accessible.', ['Store files, links and references', 'Bring Flow into notes and AI chats', 'Keep project information connected'], W],
  ['03', 'AI across your workspace', 'A dynamic space for your project resources, always accessible.', ['Store files, links and references', 'Bring Flow into notes and AI chats', 'Keep project information connected'], W],
  ['04', 'Notes', 'Keep your thinking and working material together.', ['Create notes and whiteboards', 'Export notes and whiteboards', 'Bring all file types into one place'], Y],
];
const CHECKS = [
  'Validation loops. Feed it your assumptions — it tells you if your project actually supports them.',
  'Gap spotting. It flags blind spots in your project before you present.',
  'Reasoning transparency. You see why it suggests something, so you can disagree if needed.',
];
const QUOTES = [
  '"Your concept shows strong Desire and Viability, but you\'ll need to address feasibility challenges before advancing further."',
  'Suggested next step: interview 2-3 non-student users before finalizing this persona.',
  'Your synthesis in Phase 2 is solid. Ready to move into validation.',
];
const STATS: [number, string, string][] = [
  [250, '+', 'Students from UPES, NID, & NIFT in Beta 1 & 2'],
  [420, '+', 'Projects already organized'],
  [94, '%', 'Would recommend to classmates'],
];
const REVIEWS = [
  ['The Roadmap, Flow repository and Workspace. Loved the range of customization in the native Vyrix document. Being able to add Canva/Figma file directly is such a cool feature. Being able to mark projects complete or Incomplete. And being able to sort the projects in the folders in order of priority.', 'Raunak Arora', 'B.Des, UPES · Sem 7'],
  ['Well, to look back I had AI that I could use at an instant to find research papers related to the subject and the fact that i could upload a lot of different types of files into one place. Also the To do list being In the front space of the app really helped me (I normally don\'t use to-dos - hence getting distracted) stay focused as I was eager to check something off the list.', 'Shivika Dubey', 'B.Des, NID · Sem 7'],
];

/* ---------- sections ---------- */
// Headings the nav links scroll to: empty markers placed right above each heading, outside its Reveal transform.
const anchors: Partial<Record<'features' | 'mentor' | 'trust' | 'footer', any>> = {};
function Hero({ wide }: { wide: boolean }) {
  const { width } = useWindowDimensions();
  const intro = useRef([0, 1, 2, 3, 4, 5].map(() => new Animated.Value(0))).current;
  const art = useRef(new Animated.Value(0)).current;
  const float = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.stagger(110, intro.map((v) => Animated.timing(v, { toValue: 1, duration: 800, easing: Easing.out(Easing.exp), useNativeDriver: ND }))).start();
    Animated.timing(art, { toValue: 1, duration: 1100, delay: 300, easing: Easing.out(Easing.back(1.2)), useNativeDriver: ND }).start();
    Animated.loop(Animated.sequence([
      Animated.timing(float, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: ND }),
      Animated.timing(float, { toValue: 0, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: ND }),
    ])).start();
  }, []);
  const up = (v: Animated.Value) => ({
    opacity: v,
    transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [50, 0] }) }],
  });
  // explicit size: RN-web Image ignores aspectRatio and falls back to intrinsic height
  const artW = wide ? Math.min(690, (width - 84 - 340 - 30) / 2) : Math.min(690, width - 72);
  const hSize = wide ? Math.min(80, width / 22) : Math.min(52, width / 8.5);
  const logo = <Image source={require('./assets/img/logo.png')} style={{ width: wide ? 192 : 140, height: (wide ? 192 : 140) * 248 / 1455, marginLeft: wide ? 75 : 24, marginTop: 6 }} resizeMode="contain" />;
  return (
    <View style={{ paddingHorizontal: wide ? 42 : 12, paddingTop: wide ? 22 : 8 }}>
      <Folder color={W} tabW={wide ? 345 : 190} tabH={wide ? 82 : 64} bottomH={wide ? 104 : 84} diag={wide ? 80 : 50} bottomW={wide ? 342 : 230}
        topLeft={logo}
        bottomRight={<Btn label="See what’s new" bg={BK} color={W} style={{ width: wide ? 242 : 200, height: 58, marginTop: 4 }} />}
        bodyStyle={{ flexDirection: wide ? 'row' : 'column', alignItems: 'center', paddingVertical: wide ? 90 : 40, paddingHorizontal: wide ? width * 0.088 : 24, gap: 30 }}>
        <View style={{ flex: wide ? 1 : undefined, alignSelf: 'stretch', justifyContent: 'center' }}>
          {['Get your', 'project', 'jury-ready'].map((t, i) => (
            <Animated.Text key={t} style={[s.heroH, { fontSize: hSize, lineHeight: hSize * 0.98 }, up(intro[i])]}>{t}</Animated.Text>
          ))}
          <Animated.Text style={[s.heroP, up(intro[3])]}>A research workspace for design students. Research, organise, validate and move forward before jury day.</Animated.Text>
          <Animated.View style={[{ flexDirection: 'row', flexWrap: 'wrap', gap: 15, marginTop: 34 }, up(intro[4])]}>
            <Btn label="Sign up for free" bg={Y} color={BK} />
            <Btn label="Log into Beta 2" bg={BK} color={W} />
          </Animated.View>
          <Animated.Text style={[s.heroSmall, up(intro[5])]}><Text style={{ fontFamily: F.m }}>250+</Text> design students are already using it</Animated.Text>
        </View>
        <Animated.View style={{
          flex: wide ? 1 : undefined, width: wide ? undefined : '100%', alignItems: 'center',
          opacity: art,
          transform: [
            { scale: art.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) },
            { translateY: float.interpolate({ inputRange: [0, 1], outputRange: [0, -14] }) },
          ],
        }}>
          <Image source={require('./assets/img/hero.png')} style={{ width: artW, height: artW * 1086 / 1448 }} resizeMode="contain" />
        </Animated.View>
      </Folder>
    </View>
  );
}

function Problems({ wide, pad }: { wide: boolean; pad: number }) {
  const { width } = useWindowDimensions();
  return (
    <View style={{ paddingHorizontal: pad, paddingTop: wide ? 150 : 75 }}>
      <Reveal>
        <Text style={s.h2}>Your project isn’t empty. <Text style={{ color: Y, fontFamily: F.bi }}>It’s just all over the place.</Text>{'\n'}Turn scattered research into a jury-ready direction.</Text>
      </Reveal>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 36, marginTop: 78, paddingHorizontal: wide ? 13 : 0 }}>
        {PROBLEMS.map(([n, t, d], i) => (
          <Chamfer key={n} color={Y} delay={i * 120} style={{ flexGrow: 1, flexBasis: width >= 1500 ? 0 : width >= 700 ? '40%' : '100%', minHeight: 292 }}>
            <View style={{ padding: 36, paddingTop: 38 }}>
              <Text style={s.num}>{n}</Text>
              <Text style={[s.cardT, { marginTop: 36 }]}>{t}</Text>
              <Text style={s.cardP}>{d}</Text>
            </View>
          </Chamfer>
        ))}
      </View>
    </View>
  );
}

function Features({ wide, pad }: { wide: boolean; pad: number }) {
  return (
    <View style={{ paddingHorizontal: pad, paddingTop: wide ? 315 : 90 }}>
      <View ref={(el) => { anchors.features = el; }} />
      <Reveal>
        <Text style={s.h2}>How Vyrix helps: from scattered work to a{'\n'}<Text style={{ color: Y }}>research-forward direction</Text></Text>
      </Reveal>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 38, marginTop: 66, paddingHorizontal: wide ? 13 : 0 }}>
        {FEATURES.map(([n, t, d, items, c], i) => (
          <Chamfer key={n} color={c} delay={(i % 2) * 150} style={{ flexBasis: wide ? '47%' : '100%', flexGrow: 1, minHeight: 290 }}>
            <View style={{ padding: 58, paddingTop: 38 }}>
              <Text style={s.num}>{n}</Text>
              <Text style={[s.cardT, { marginTop: i < 2 ? 46 : 54 }]}>{t}</Text>
              <Text style={[s.cardP, { marginTop: 22 }]}>{d}</Text>
              {items.map((it) => <Text key={it} style={[s.cardP, { marginTop: 0, paddingLeft: 10 }]}>{'•  '}{it}</Text>)}
            </View>
          </Chamfer>
        ))}
      </View>
    </View>
  );
}

function Mentor({ wide }: { wide: boolean }) {
  return (
    <View style={{ paddingHorizontal: wide ? 117 : 12, paddingTop: wide ? 285 : 90 }}>
      <View ref={(el) => { anchors.mentor = el; }} />
      <Reveal from={80}>
        <Folder color={Y} tabW={wide ? 315 : 160} tabH={wide ? 75 : 56} diag={wide ? 80 : 50} bottomW={wide ? 312 : 140}
          bodyStyle={{ flexDirection: wide ? 'row' : 'column', paddingHorizontal: wide ? 110 : 24, paddingTop: wide ? 30 : 20, paddingBottom: wide ? 80 : 40, gap: 40, alignItems: wide ? 'flex-end' : 'stretch' }}>
          <View style={{ flex: wide ? 1 : undefined, maxWidth: 760 }}>
            <Reveal delay={100}><Text style={s.eyebrow}>YOUR PROJECT MENTOR</Text></Reveal>
            <Reveal delay={200}><Text style={[s.h2, { color: BK, marginTop: 8 }]}>An AI that guides, not just generates</Text></Reveal>
            <Reveal delay={300}><Text style={[s.heroP, { marginTop: 22, fontFamily: F.r }]}>Your project deserves a second mind. Vyrix AI helps you examine your thinking, spot contradictions and ask the questions you should ask before jury.</Text></Reveal>
            <View style={{ marginTop: 34, gap: 26 }}>
              {CHECKS.map((c, i) => <CheckRow key={i} text={c} delay={450 + i * 150} />)}
            </View>
          </View>
          <Reveal delay={350} from={60} style={{ flex: wide ? 0.82 : undefined }}>
            <View style={s.quoteBox}>
              {QUOTES.map((q, i) => <Reveal key={i} delay={700 + i * 450} from={16}><Text style={s.quote}>{q}</Text></Reveal>)}
            </View>
          </Reveal>
        </Folder>
      </Reveal>
    </View>
  );
}

function CheckRow({ text, delay }: { text: string; delay: number }) {
  const { ref, v } = useReveal(delay);
  return (
    <View ref={ref} style={{ flexDirection: 'row', gap: 20, alignItems: 'flex-start' }}>
      <Animated.View style={{ transform: [{ scale: v.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 1.25, 1] }) }] }}>
        <Ionicons name="checkmark-circle" size={28} color={BK} />
      </Animated.View>
      <Animated.Text style={[s.check, { opacity: v, transform: [{ translateX: v.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }] }]}>{text}</Animated.Text>
    </View>
  );
}

function Trust({ wide, pad }: { wide: boolean; pad: number }) {
  return (
    <View style={{ paddingHorizontal: pad, paddingTop: wide ? 285 : 90, paddingBottom: wide ? 270 : 90 }}>
      <View ref={(el) => { anchors.trust = el; }} />
      <Reveal><Text style={[s.eyebrow, { color: W }]}>TRUSTED BY STUDENTS</Text></Reveal>
      <Reveal delay={100}><Text style={[s.h2, { marginTop: 8 }]}>Already shaping stronger projects</Text></Reveal>
      <View style={{ flexDirection: wide ? 'row' : 'column', gap: 45, marginTop: 44 }}>
        {STATS.map(([n, suf, label], i) => (
          <Reveal key={label} delay={i * 130} style={{ flex: wide ? 1 : undefined, marginTop: wide ? i * 8 : 0 }}>
            <HoverCard style={[s.stat]}>
              <CountUp to={n} suffix={suf} style={s.statN} />
              <Text style={s.statL}>{label}</Text>
            </HoverCard>
          </Reveal>
        ))}
      </View>
      <View style={{ flexDirection: wide ? 'row' : 'column', gap: 48, marginTop: 32 }}>
        {REVIEWS.map(([q, name, meta], i) => (
          <Reveal key={name} delay={i * 160} style={{ flex: wide ? 1 : undefined, marginTop: wide ? i * 12 : 0 }}>
            <HoverCard style={s.review}>
              <Text style={s.reviewQ}>{q}</Text>
              <Text style={s.reviewName}>{name}</Text>
              <Text style={s.reviewMeta}>{meta}</Text>
            </HoverCard>
          </Reveal>
        ))}
      </View>
    </View>
  );
}

function HoverCard({ children, style }: { children: React.ReactNode; style: StyleProp<ViewStyle> }) {
  const h = useHover(1.02, 8);
  return <Pressable {...h.handlers}><Animated.View style={[style, h.style]}>{children}</Animated.View></Pressable>;
}

function Social({ icon, url }: { icon: 'logo-instagram' | 'logo-linkedin'; url: string }) {
  const h = useHover(1.12);
  return (
    <Pressable {...h.handlers} onPress={() => Linking.openURL(url)} accessibilityRole="link">
      <Animated.View style={[s.social, h.style]}><Ionicons name={icon} size={20} color={BK} /></Animated.View>
    </Pressable>
  );
}

function Footer({ wide }: { wide: boolean }) {
  return (
    <View ref={(el) => { anchors.footer = el; }} style={{ backgroundColor: W, paddingHorizontal: wide ? 84 : 24, paddingTop: 48, paddingBottom: 28 }}>
      <Reveal style={{ flexDirection: wide ? 'row' : 'column', justifyContent: 'space-between', alignItems: wide ? 'flex-end' : 'flex-start', gap: 40 }}>
        <View>
          <Text style={s.fH}>Contact us at</Text>
          <Text style={[s.fT, { marginTop: 14 }]}>support@vyrix.in</Text>
          <Text style={[s.fH, { marginTop: 30 }]}>Socials</Text>
          <View style={{ flexDirection: 'row', gap: 4, marginTop: 18 }}>
            <Social icon="logo-instagram" url="https://instagram.com" />
            <Social icon="logo-linkedin" url="https://linkedin.com" />
          </View>
          <Image source={require('./assets/img/logo.png')} style={{ width: 248, height: 248 * 248 / 1455, marginTop: 36, marginLeft: -5 }} resizeMode="contain" />
          <Text style={[s.fT, { marginTop: 22 }]}>© 2026 Vyrix. All rights reserved.</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 36 }}>
          <Text style={s.fT}>Privacy Policy</Text>
          <Text style={s.fT}>Terms of use</Text>
        </View>
        <View style={{ alignItems: 'center' }}>
          <Image source={require('./assets/img/aispire.png')} style={{ width: 228, height: 228 }} resizeMode="contain" />
          <Text style={[s.fT, { marginTop: 4 }]}>A product from <Text style={{ fontFamily: F.b }}>Aispire Private Limited</Text></Text>
          <Text style={[s.fT, { marginTop: 4 }]}>contact@aispire.co.in</Text>
        </View>
      </Reveal>
    </View>
  );
}

// Only the black part of the header sticks: an overlay that starts where the white logo tab's diagonal ends,
// so the logo tab scrolls away with the page while the nav stays pinned.
const NAV = [['Product', 'hero'], ['Features', 'features'], ['AI', 'mentor'], ['Reviews', 'trust']] as const;
type Section = 'hero' | 'features' | 'mentor' | 'trust' | 'footer';
function StickyNav({ wide, go }: { wide: boolean; go: (k: Section) => void }) {
  const { width } = useWindowDimensions();
  const top = wide ? 22 : 8;
  const tabEnd = wide ? 42 + 345 : 12 + 190; // where the white logo tab ends and its diagonal starts
  const diag = wide ? 80 : 50;
  const tabH = wide ? 82 : 64;
  return (
    <>
    {/* black strip above the logo tab, so content never shows over the header's top edge */}
    <View style={{ position: 'absolute', top: 0, left: 0, width: tabEnd, height: top, backgroundColor: BK }} pointerEvents="none" />
    {/* black wedge above the logo tab's diagonal: sticks with the bar, mirrors the white Tri underneath */}
    <View style={{ position: 'absolute', top: 0, left: tabEnd - 1, width: diag + 1 }} pointerEvents="none">
      <View style={{ height: top, backgroundColor: BK }} />
      <Tri w={diag} h={tabH + 1} color={BK} dir="tr" />
    </View>
    <View style={{
      position: 'absolute', top: 0, right: 0, left: tabEnd + diag - 1,
      height: top + (wide ? 82 : 64), paddingTop: top, backgroundColor: BK, flexDirection: 'row', alignItems: 'center',
      paddingRight: wide ? 82 : 28,
    }}>
      {wide && (
        <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'center', gap: width > 1500 ? 88 : 48, paddingBottom: 8 }}>
          {NAV.map(([l, k]) => <NavLink key={l} label={l} onPress={() => go(k)} />)}
        </View>
      )}
      <View style={{ flex: wide ? undefined : 1, alignItems: 'flex-end', paddingBottom: 8 }}>
        <NavLink label="Contact Us" bold onPress={() => go('footer')} />
      </View>
    </View>
    </>
  );
}

export default function App() {
  // Fonts live in assets/fonts (not node_modules): Vercel drops node_modules paths from the deployed output.
  const [loaded] = useFonts({
    Unbounded_800ExtraBold: require('./assets/fonts/Unbounded_800ExtraBold.ttf'),
    PlusJakartaSans_400Regular: require('./assets/fonts/PlusJakartaSans_400Regular.ttf'),
    PlusJakartaSans_500Medium: require('./assets/fonts/PlusJakartaSans_500Medium.ttf'),
    PlusJakartaSans_600SemiBold: require('./assets/fonts/PlusJakartaSans_600SemiBold.ttf'),
    PlusJakartaSans_700Bold: require('./assets/fonts/PlusJakartaSans_700Bold.ttf'),
    PlusJakartaSans_700Bold_Italic: require('./assets/fonts/PlusJakartaSans_700Bold_Italic.ttf'),
    ionicons: require('./assets/fonts/Ionicons.ttf'), // pre-registers Ionicons so it never fetches its node_modules copy
  });
  const { width, height } = useWindowDimensions();
  useEffect(() => {
    if (Platform.OS === 'web') (document.documentElement.style as any).zoom = String(zoomFor(window.innerWidth));
  }, [width]);
  const checks = useRef(new Set<Check>()).current;
  const scroll = useRef<any>(null);
  const content = useRef<any>(null);
  const go = (k: Section) => {
    if (k === 'hero') return scroll.current?.scrollTo({ y: 0, animated: true });
    const w = width >= 1100;
    const headerH = w ? 104 : 72;
    const z = Platform.OS === 'web' ? zoomFor(window.innerWidth) : 1;
    // measured at click time (onLayout doesn't fire reliably on web): heading's offset inside the scroll content
    content.current?.measureInWindow((_cx: number, cy: number) => anchors[k]?.measureInWindow((_x: number, sy: number) => {
      const y = (sy - cy) / z - headerH - 40; // heading sits 40px under the sticky header
      scroll.current?.scrollTo({ y: Math.max(0, y), animated: true });
    }));
  };
  const ctx = useRef({
    add: (c: Check) => { checks.add(c); return () => { checks.delete(c); }; },
    vh: height,
  }).current;
  ctx.vh = height;
  if (!loaded) return <View style={{ flex: 1, backgroundColor: BK }} />;
  const wide = width >= 1100;
  const pad = wide ? width * 0.1 : 20;
  return (
    <RevealCtx.Provider value={ctx}>
      <StatusBar style="light" />
      <View style={{ flex: 1, backgroundColor: BK }}>
        <ScrollView ref={scroll} style={{ flex: 1 }} scrollEventThrottle={32}
          onScroll={() => checks.forEach((c) => c(height))}>
          <View ref={content}>
          <Hero wide={wide} />
          <Problems wide={wide} pad={pad} />
          <Features wide={wide} pad={pad} />
          <Mentor wide={wide} />
          <Trust wide={wide} pad={pad} />
          <Footer wide={wide} />
          </View>
        </ScrollView>
        <StickyNav wide={wide} go={go} />
      </View>
    </RevealCtx.Provider>
  );
}

const s = StyleSheet.create({
  nav: { color: W, fontFamily: F.sb, fontSize: 18, paddingVertical: 4 },
  navLine: { height: 2, backgroundColor: Y, borderRadius: 1 },
  btn: { height: 51, paddingHorizontal: 46, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontFamily: F.b, fontSize: 16 },
  heroH: { fontFamily: F.display, color: '#1a1a1a', letterSpacing: -1 },
  heroP: { fontFamily: F.m, fontSize: 20, lineHeight: 30, color: '#222', marginTop: 34, maxWidth: 520 },
  heroSmall: { fontFamily: F.r, fontSize: 20, color: '#222', marginTop: 36 },
  h2: { fontFamily: F.b, fontSize: 44, lineHeight: 55, color: W, letterSpacing: -0.5 },
  num: { fontFamily: F.display, fontSize: 20, color: BK },
  cardT: { fontFamily: F.b, fontSize: 22, color: BK },
  cardP: { fontFamily: F.r, fontSize: 18, lineHeight: 27, color: BK, marginTop: 16 },
  eyebrow: { fontFamily: F.sb, fontSize: 20, color: BK },
  check: { fontFamily: F.r, fontSize: 18, lineHeight: 27, color: BK, flex: 1, maxWidth: 610 },
  quoteBox: { backgroundColor: BK, borderRadius: 20, paddingHorizontal: 34, paddingVertical: 40, gap: 46 },
  quote: { fontFamily: F.r, fontSize: 18, lineHeight: 27, color: W },
  stat: { backgroundColor: W, borderRadius: 18, paddingHorizontal: 36, paddingVertical: 28, minHeight: 150 },
  statN: { fontFamily: F.sb, fontSize: 48, color: BK },
  statL: { fontFamily: F.r, fontSize: 18, color: BK, marginTop: 10 },
  review: { backgroundColor: W, borderRadius: 18, paddingHorizontal: 36, paddingTop: 34, paddingBottom: 30 },
  reviewQ: { fontFamily: F.r, fontSize: 18, lineHeight: 25, color: '#222' },
  reviewName: { fontFamily: F.m, fontSize: 18, color: '#222', marginTop: 40 },
  reviewMeta: { fontFamily: F.r, fontSize: 14, color: '#222', marginTop: 8 },
  fH: { fontFamily: F.b, fontSize: 16, color: BK },
  fT: { fontFamily: F.r, fontSize: 17, color: BK },
  social: { width: 41, height: 41, borderRadius: 8, borderWidth: 1.5, borderColor: BK, alignItems: 'center', justifyContent: 'center' },
});
